// Notifications DocuSign Connect — PUR, aucune I/O.
//
// Trois exigences du §8 et du §11, et chacune a une raison concrète :
//
//   • AUTHENTIFIÉ — l'URL du webhook est publique. Sans vérification de
//     signature, n'importe qui pourrait déclarer un contrat « signé ».
//   • IDEMPOTENT — DocuSign réémet ses notifications en cas d'échec. Une même
//     notification rejouée ne doit produire qu'un seul archivage.
//   • REPRISE — si DocuSign confirme la signature mais que le téléchargement
//     échoue, l'archivage n'est PAS terminé. L'événement reste en file et
//     sera rejoué, avec une attente croissante.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Destinataire, EtatDestinataire, StatutDocuSign } from "./statuts";

// ── Authentification (HMAC Connect) ───────────────────────────────────

/**
 * Vérifie la signature HMAC d'une notification.
 *
 * DocuSign Connect signe le corps brut avec une clé partagée et place le
 * résultat en base64 dans `x-docusign-signature-1`. On compare en temps
 * constant : une comparaison naïve laisserait fuiter la clé octet par octet.
 *
 * ⚠️ Le corps doit être le TEXTE BRUT reçu, pas un JSON re-sérialisé : la
 * moindre différence d'espaces invaliderait la signature.
 */
export function signatureValide(
  corpsBrut: string,
  signatureRecue: string | null | undefined,
  cleSecrete: string | null | undefined,
): { ok: boolean; raison?: string } {
  if (!cleSecrete) {
    // En l'absence de clé configurée, on REFUSE. Accepter « parce que ce
    // n'est pas configuré » est exactement la faille à éviter : un contrat
    // ne doit pas pouvoir être déclaré signé par un inconnu.
    return { ok: false, raison: "clé HMAC DocuSign non configurée" };
  }
  if (!signatureRecue) return { ok: false, raison: "signature absente" };

  const attendue = createHmac("sha256", cleSecrete).update(corpsBrut, "utf8").digest("base64");
  const a = Buffer.from(attendue, "utf8");
  const b = Buffer.from(signatureRecue, "utf8");
  if (a.length !== b.length) return { ok: false, raison: "signature invalide" };
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, raison: "signature invalide" };
}

/**
 * Clé d'idempotence d'une notification.
 *
 * Elle combine l'enveloppe, le statut et l'horodatage DocuSign. Deux
 * notifications différentes sur la même enveloppe donnent donc deux clés,
 * mais le MÊME événement rejoué donne la même clé — c'est précisément ce
 * qu'il faut pour n'archiver qu'une fois.
 */
export function cleEvenement(e: {
  envelopeId: string;
  statut: string;
  horodatage?: string | null;
}): string {
  const h = (e.horodatage ?? "").trim();
  return `docusign:${e.envelopeId}:${e.statut}${h ? `:${h}` : ""}`;
}

// ── Lecture du corps ──────────────────────────────────────────────────

export type NotificationLue = {
  envelopeId: string;
  statut: StatutDocuSign;
  horodatage: string | null;
  destinataires: Destinataire[];
  motifAnnulation: string | null;
  completedAt: string | null;
};

const STATUTS_DS = new Set<string>([
  "created", "sent", "delivered", "completed", "declined", "voided", "deleted",
]);
const ETATS_DEST = new Set<string>([
  "created", "sent", "delivered", "signed", "completed", "declined", "autoresponded",
]);

const txt = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};

/**
 * Lit une notification DocuSign Connect (format JSON).
 *
 * Tolérante sur la forme — DocuSign a plusieurs générations de format — mais
 * STRICTE sur le fond : sans identifiant d'enveloppe ni statut reconnu, on
 * refuse. Mieux vaut une notification rejetée et visible qu'un archivage
 * fondé sur un message mal compris.
 */
export function lireNotification(payload: unknown): { ok: true; notification: NotificationLue } | { ok: false; raison: string } {
  if (!payload || typeof payload !== "object") return { ok: false, raison: "corps illisible" };
  const p = payload as Record<string, unknown>;

  // Format récent : { event, data: { envelopeId, envelopeSummary: {...} } }
  // Format ancien : { envelopeStatus: { envelopeId, status, RecipientStatuses } }
  const data = (p.data ?? {}) as Record<string, unknown>;
  const resume = (data.envelopeSummary ?? p.envelopeStatus ?? {}) as Record<string, unknown>;

  const envelopeId =
    txt(data.envelopeId) ?? txt(resume.envelopeId) ?? txt(p.envelopeId);
  if (!envelopeId) return { ok: false, raison: "identifiant d'enveloppe absent" };

  const brut = (txt(resume.status) ?? txt(p.event) ?? "").toLowerCase()
    // Le format récent envoie « envelope-completed ».
    .replace(/^envelope-/, "");
  if (!STATUTS_DS.has(brut)) {
    return { ok: false, raison: `statut DocuSign inconnu : « ${brut || "vide"} »` };
  }

  const brutsDest = Array.isArray(resume.recipients)
    ? (resume.recipients as unknown[])
    : Array.isArray((resume.recipients as Record<string, unknown> | undefined)?.signers)
      ? ((resume.recipients as Record<string, unknown>).signers as unknown[])
      : Array.isArray(resume.RecipientStatuses)
        ? (resume.RecipientStatuses as unknown[])
        : [];

  const destinataires: Destinataire[] = [];
  for (const d of brutsDest) {
    if (!d || typeof d !== "object") continue;
    const r = d as Record<string, unknown>;
    const email = txt(r.email) ?? txt(r.Email);
    const etat = (txt(r.status) ?? txt(r.Status) ?? "").toLowerCase();
    if (!email || !ETATS_DEST.has(etat)) continue;
    destinataires.push({
      email,
      nom: txt(r.name) ?? txt(r.UserName),
      role: txt(r.roleName) ?? txt(r.RoutingOrder),
      statut: etat as EtatDestinataire,
      signeLe: txt(r.signedDateTime) ?? txt(r.Signed),
      motifRefus: txt(r.declinedReason) ?? txt(r.DeclineReason),
    });
  }

  return {
    ok: true,
    notification: {
      envelopeId,
      statut: brut as StatutDocuSign,
      horodatage: txt(resume.statusChangedDateTime) ?? txt(p.generatedDateTime) ?? null,
      destinataires,
      motifAnnulation: txt(resume.voidedReason) ?? txt(resume.VoidedReason),
      completedAt: txt(resume.completedDateTime) ?? txt(resume.Completed),
    },
  };
}

// ── File de reprise ───────────────────────────────────────────────────

/** Attente avant la prochaine tentative, en minutes. */
const PALIERS_MINUTES = [1, 5, 15, 60, 240, 720];

/** Au-delà, on arrête de réessayer et on alerte le Super Admin (§8). */
export const MAX_ESSAIS = PALIERS_MINUTES.length;

/**
 * Quand réessayer, après `essais` échecs.
 *
 * L'attente croît : réessayer toutes les secondes contre un service
 * indisponible ne fait qu'ajouter de la charge. `null` = on renonce et on
 * alerte, plutôt que de boucler indéfiniment en silence.
 */
export function prochainEssai(essais: number, maintenant = Date.now()): Date | null {
  if (essais >= MAX_ESSAIS) return null;
  const minutes = PALIERS_MINUTES[Math.max(0, essais)];
  return new Date(maintenant + minutes * 60_000);
}

export function alerteNecessaire(essais: number): boolean {
  return essais >= MAX_ESSAIS;
}

/**
 * Faut-il traiter cette notification maintenant ?
 *
 * Une notification déjà traitée est ignorée — c'est l'idempotence. Une
 * notification en échec attend son prochain créneau.
 */
export function aTraiterMaintenant(
  e: { etat: "en_attente" | "en_cours" | "traite" | "echec"; prochainEssaiLe?: string | null },
  maintenant = Date.now(),
): boolean {
  if (e.etat === "traite" || e.etat === "en_cours") return false;
  if (!e.prochainEssaiLe) return true;
  const t = new Date(e.prochainEssaiLe).getTime();
  return !Number.isFinite(t) || t <= maintenant;
}
