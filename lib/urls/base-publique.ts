// L'URL publique sur laquelle on envoie un client signer.
//
// ── LE DÉFAUT QUE CE MODULE FERME ────────────────────────────────────
//
// Quatre endroits construisaient cette URL, de deux manières différentes :
//
//   • `lib/devis/sign.ts` et `lib/cert-hotte/send.ts` :
//         process.env.SIGNATURE_BASE_URL || "https://crmoptimum.com"
//   • `app/(app)/_shared/signature-actions.ts` et `app/api/devis/envoyer` :
//         l'en-tête `host` de la requête, sans validation.
//
// Les deux sont dangereuses, pour des raisons opposées. Le repli EN DUR fait
// qu'une recette sans `SIGNATURE_BASE_URL` enverrait au client fictif un lien
// vers le SITE RÉEL : il signerait contre la base de production. C'est une
// contamination par le lien, qu'aucune isolation de base de données n'arrête.
// Et l'en-tête `host` est fourni par le client HTTP : non validé, il permet
// de faire émettre par le CRM un lien vers un domaine arbitraire.
//
// ── CE QUE CE MODULE IMPOSE ──────────────────────────────────────────
//
//   1. une liste blanche de domaines, explicite ;
//   2. aucun repli silencieux vers la production hors production ;
//   3. l'en-tête `host` n'est accepté QUE s'il est sur la liste ;
//   4. une configuration manquante donne un REFUS NOMMÉ, pas un lien douteux ;
//   5. le lien final est vérifiable avant émission (`verifierLienPublic`).
//
// ── CE QU'IL NE CASSE PAS ────────────────────────────────────────────
//
// ⚠️ La production tourne aujourd'hui SANS `SIGNATURE_BASE_URL` : c'est le
// repli en dur qui fabrique ses liens. Le retirer partout couperait les
// parcours de signature en production, ce qui n'est pas demandé. En mode
// `production` le repli subsiste donc, sur le premier domaine autorisé, et il
// est JOURNALISÉ. Hors production, il n'existe plus.

import { type Mode } from "@/lib/env/mode";

/**
 * Domaines autorisés par défaut, utilisés UNIQUEMENT en mode production quand
 * `CGK_DOMAINES_PUBLICS` n'est pas déclarée. En recette et en développement,
 * la déclaration est obligatoire — le garde-fou de démarrage refuse de
 * démarrer sans elle (grief `domaines_non_declares`).
 */
export const DOMAINES_PRODUCTION = ["crmoptimum.com", "www.crmoptimum.com"];

export type SourceBase = "configuration" | "entete_validee" | "repli_production";

export type Resolution =
  | { ok: true; base: string; source: SourceBase }
  | { ok: false; code: string; raison: string };

export type EntreeResolution = {
  mode: Mode;
  signatureBaseUrl?: string;
  appUrl?: string;
  domainesPublics?: string;
  /** En-tête `x-forwarded-host` ou `host`. Donnée NON FIABLE. */
  hoteEntete?: string | null;
  /** En-tête `x-forwarded-proto`. Donnée NON FIABLE. */
  protoEntete?: string | null;
};

function nettoyer(v?: string | null): string {
  return (v ?? "").trim();
}

/** Liste blanche effective. */
export function domainesAutorises(brut: string | undefined, mode: Mode): string[] {
  const declares = nettoyer(brut)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (declares.length > 0) return [...new Set(declares)];
  return mode === "production" ? [...DOMAINES_PRODUCTION] : [];
}

function hoteDe(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.host.toLowerCase();
  } catch {
    return null;
  }
}

export function hoteAutorise(hote: string, autorises: string[]): boolean {
  return autorises.includes(hote.toLowerCase());
}

/**
 * Résout l'URL de base, ou refuse en nommant la cause.
 *
 * Ordre : la configuration d'abord, l'en-tête validé ensuite, le repli de
 * production en dernier et en production seulement.
 */
export function resoudreBase(e: EntreeResolution): Resolution {
  const autorises = domainesAutorises(e.domainesPublics, e.mode);

  if (autorises.length === 0) {
    return {
      ok: false,
      code: "domaines_non_declares",
      raison:
        "Aucun domaine public autorisé n'est déclaré (CGK_DOMAINES_PUBLICS). " +
        "Aucun lien ne peut être validé, donc aucun n'est produit.",
    };
  }

  // 1. La configuration.
  const configure = nettoyer(e.signatureBaseUrl) || nettoyer(e.appUrl);
  if (configure) {
    const hote = hoteDe(configure);
    if (!hote) {
      return {
        ok: false,
        code: "url_illisible",
        raison:
          "SIGNATURE_BASE_URL (ou NEXT_PUBLIC_APP_URL) n'est pas une URL " +
          "absolue en http(s) analysable. Exemple attendu : http://localhost:3000",
      };
    }
    if (!hoteAutorise(hote, autorises)) {
      return {
        ok: false,
        code: "url_hors_liste",
        raison:
          `L'hôte configuré (${hote}) n'est pas dans la liste des domaines ` +
          `autorisés (${autorises.join(", ")}).`,
      };
    }
    return { ok: true, base: configure.replace(/\/+$/, ""), source: "configuration" };
  }

  // 2. L'en-tête de la requête — VALIDÉ contre la liste blanche.
  const hoteEntete = nettoyer(e.hoteEntete).toLowerCase();
  if (hoteEntete) {
    if (!hoteAutorise(hoteEntete, autorises)) {
      return {
        ok: false,
        code: "entete_hors_liste",
        raison:
          `L'en-tête d'hôte de la requête (${hoteEntete}) n'est pas dans la ` +
          `liste des domaines autorisés. Un en-tête est fourni par l'appelant : ` +
          `on ne construit pas un lien public sur une donnée non vérifiée.`,
      };
    }
    const proto =
      nettoyer(e.protoEntete) ||
      (hoteEntete.startsWith("localhost") || hoteEntete.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return { ok: true, base: `${proto}://${hoteEntete}`, source: "entete_validee" };
  }

  // 3. Le repli — en PRODUCTION seulement.
  if (e.mode === "production") {
    return { ok: true, base: `https://${autorises[0]}`, source: "repli_production" };
  }

  return {
    ok: false,
    code: "configuration_absente",
    raison:
      `Mode « ${e.mode} » sans SIGNATURE_BASE_URL et sans en-tête d'hôte ` +
      `exploitable. Aucun repli vers le domaine de production n'est appliqué ` +
      `hors production : ce serait envoyer le client signer sur le site réel. ` +
      `Posez SIGNATURE_BASE_URL=http://localhost:3000.`,
  };
}

/**
 * Vérifie un lien COMPLET avant émission.
 *
 * À appeler juste avant d'envoyer un lien à un client : la base a pu être
 * résolue correctement et le chemin construit ailleurs. C'est le dernier
 * contrôle avant que le lien quitte le CRM.
 */
export function verifierLienPublic(
  lien: string,
  domainesPublics: string | undefined,
  mode: Mode,
): { ok: true } | { ok: false; raison: string } {
  const autorises = domainesAutorises(domainesPublics, mode);
  if (autorises.length === 0) {
    return { ok: false, raison: "Aucun domaine public autorisé n'est déclaré." };
  }
  const hote = hoteDe(lien);
  if (!hote) {
    return { ok: false, raison: `Lien non analysable : « ${lien} ».` };
  }
  if (!hoteAutorise(hote, autorises)) {
    return {
      ok: false,
      raison: `Le lien pointe sur ${hote}, hors des domaines autorisés (${autorises.join(", ")}).`,
    };
  }
  return { ok: true };
}
