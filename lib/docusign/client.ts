import "server-only";

// Client HTTP DocuSign eSignature. Le SEUL endroit qui parle au réseau.
//
// Il isole trois choses que le reste du code n'a pas à connaître : le jeton
// (obtenu et rafraîchi par `oauth-server.ts`), la base d'URL du compte
// (renvoyée par DocuSign, jamais codée en dur) et la forme des charges utiles.
//
// ⚠️ AUCUN JOURNAL DE CORPS. Une requête d'enveloppe contient le PDF en
// base64 et les coordonnées des signataires ; une réponse d'erreur peut en
// refléter des fragments. On ne journalise que la méthode, le chemin, le
// statut et, pour une erreur, le code DocuSign — jamais le corps.

import { urlApi } from "./config";
import { accesPourEntite, type AccesDocuSign } from "./oauth-server";
import { ANCRE_DONNEUR_ORDRE, ANCRE_SOUS_TRAITANT, DECALAGE_ANCRE } from "./ancres";
import type { Destinataire, EtatDestinataire, StatutDocuSign } from "./statuts";

export type EchecApi = { ok: false; error: string; statutHttp?: number; codeDocuSign?: string };

export type Signataire = {
  email: string;
  nom: string;
  /** `donneur_ordre` signe sur l'ancre de l'entité, `sous_traitant` sur la sienne. */
  role: "donneur_ordre" | "sous_traitant";
};

// ══════════════════════════════════════════════════════════════════════
//  Appel authentifié
// ══════════════════════════════════════════════════════════════════════

type Reponse<T> = { ok: true; data: T } | EchecApi;

/** Lit un code d'erreur DocuSign sans exposer le reste du corps. */
async function codeErreur(rep: Response): Promise<string | undefined> {
  try {
    const brut = await rep.json();
    if (brut && typeof brut === "object") {
      const c = (brut as { errorCode?: unknown }).errorCode;
      if (typeof c === "string") return c;
    }
  } catch {
    // Corps illisible : le statut HTTP suffira.
  }
  return undefined;
}

async function appel<T>(
  acces: AccesDocuSign,
  methode: "GET" | "POST" | "PUT",
  chemin: string,
  options: { corps?: unknown; idempotence?: string } = {},
): Promise<Reponse<T>> {
  const entetes: Record<string, string> = {
    Authorization: `Bearer ${acces.accessToken}`,
    Accept: "application/json",
  };
  if (options.corps !== undefined) entetes["Content-Type"] = "application/json";
  // DocuSign dédoublonne les créations d'enveloppe sur cette clé pendant
  // 24 h : deux clics sur « Envoyer » ne produisent qu'une enveloppe, même si
  // le premier appel a abouti sans que sa réponse nous parvienne.
  if (options.idempotence) entetes["X-DocuSign-Idempotency-Key"] = options.idempotence;

  let rep: Response;
  try {
    rep = await fetch(urlApi(acces.baseUri, acces.accountId, chemin), {
      method: methode,
      headers: entetes,
      body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "DocuSign est injoignable." };
  }

  if (!rep.ok) {
    const code = await codeErreur(rep);
    console.error(`[docusign] ${methode} ${chemin} → HTTP ${rep.status}${code ? ` (${code})` : ""}`);
    return {
      ok: false,
      error: `DocuSign a refusé l'appel (HTTP ${rep.status}${code ? `, ${code}` : ""}).`,
      statutHttp: rep.status,
      codeDocuSign: code,
    };
  }

  try {
    return { ok: true, data: (await rep.json()) as T };
  } catch {
    return { ok: false, error: "Réponse DocuSign illisible." };
  }
}

/** Téléchargement binaire : PDF signé, certificat. */
async function appelBinaire(
  acces: AccesDocuSign,
  chemin: string,
): Promise<{ ok: true; octets: Buffer; mime: string } | EchecApi> {
  let rep: Response;
  try {
    rep = await fetch(urlApi(acces.baseUri, acces.accountId, chemin), {
      headers: { Authorization: `Bearer ${acces.accessToken}`, Accept: "application/pdf" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "DocuSign est injoignable." };
  }
  if (!rep.ok) {
    console.error(`[docusign] GET ${chemin} → HTTP ${rep.status}`);
    return {
      ok: false,
      error: `Téléchargement DocuSign refusé (HTTP ${rep.status}).`,
      statutHttp: rep.status,
    };
  }
  const octets = Buffer.from(await rep.arrayBuffer());
  if (octets.length === 0) return { ok: false, error: "DocuSign a renvoyé un fichier vide." };
  return { ok: true, octets, mime: rep.headers.get("content-type") ?? "application/pdf" };
}

// ══════════════════════════════════════════════════════════════════════
//  Création d'enveloppe
// ══════════════════════════════════════════════════════════════════════

type ReponseEnveloppe = { envelopeId?: unknown; status?: unknown };

/**
 * Crée et envoie une enveloppe.
 *
 * Les champs de signature sont posés par ANCRAGE sur deux jetons invisibles
 * écrits dans le PDF (`lib/docusign/ancres.ts`) : le contenu contractuel
 * n'est pas touché, et la position reste juste si le contrat gagne un
 * article et que le bloc de signature change de page.
 *
 * `routingOrder` est identique pour les deux signataires : ils peuvent signer
 * dans n'importe quel ordre. Imposer une séquence ferait attendre le
 * prestataire sans raison.
 */
export async function creerEnveloppe(input: {
  entityId: string;
  pdf: Buffer;
  nomFichier: string;
  objet: string;
  message: string;
  signataires: Signataire[];
  /** Clé d'idempotence — typiquement la référence du contrat. */
  idempotence: string;
}): Promise<{ ok: true; envelopeId: string; statut: StatutDocuSign } | EchecApi> {
  const a = await accesPourEntite(input.entityId);
  if (!a.ok) return { ok: false, error: a.error };

  const signers = input.signataires.map((s, i) => ({
    email: s.email,
    name: s.nom,
    recipientId: String(i + 1),
    routingOrder: "1",
    tabs: {
      signHereTabs: [{
        anchorString: s.role === "donneur_ordre" ? ANCRE_DONNEUR_ORDRE : ANCRE_SOUS_TRAITANT,
        anchorUnits: "pixels",
        anchorXOffset: String(DECALAGE_ANCRE.x),
        anchorYOffset: String(DECALAGE_ANCRE.y),
        // Sensible à la casse ET mot entier : les jetons sont uniques, mais
        // cette double contrainte évite toute correspondance fortuite.
        anchorCaseSensitive: "true",
        anchorMatchWholeWord: "true",
      }],
      dateSignedTabs: [{
        anchorString: s.role === "donneur_ordre" ? ANCRE_DONNEUR_ORDRE : ANCRE_SOUS_TRAITANT,
        anchorUnits: "pixels",
        anchorXOffset: "140",
        anchorYOffset: String(DECALAGE_ANCRE.y),
        anchorCaseSensitive: "true",
        anchorMatchWholeWord: "true",
      }],
    },
  }));

  const corps = {
    emailSubject: input.objet,
    emailBlurb: input.message,
    documents: [{
      documentId: "1",
      name: input.nomFichier,
      fileExtension: "pdf",
      documentBase64: input.pdf.toString("base64"),
    }],
    recipients: { signers },
    // `sent` envoie immédiatement. `created` laisserait un brouillon dans
    // DocuSign, et le CRM afficherait « envoyé » pour un document que
    // personne n'a reçu.
    status: "sent",
  };

  const r = await appel<ReponseEnveloppe>(a.acces, "POST", "envelopes", {
    corps,
    idempotence: input.idempotence,
  });
  if (!r.ok) return r;

  const id = typeof r.data.envelopeId === "string" ? r.data.envelopeId : "";
  if (!id) return { ok: false, error: "DocuSign n'a pas renvoyé d'identifiant d'enveloppe." };
  const statut = typeof r.data.status === "string" ? r.data.status : "sent";

  return { ok: true, envelopeId: id, statut: statut as StatutDocuSign };
}

// ══════════════════════════════════════════════════════════════════════
//  Lecture d'état
// ══════════════════════════════════════════════════════════════════════

type ReponseEtat = {
  status?: unknown;
  voidedReason?: unknown;
  completedDateTime?: unknown;
  statusChangedDateTime?: unknown;
};

type ReponseDestinataires = { signers?: unknown };

const ETATS_DEST = new Set<string>([
  "created", "sent", "delivered", "signed", "completed", "declined", "autoresponded",
]);

function lireDestinataires(brut: unknown): Destinataire[] {
  const r = brut as ReponseDestinataires | null;
  if (!r || !Array.isArray(r.signers)) return [];
  const out: Destinataire[] = [];
  for (const d of r.signers) {
    if (!d || typeof d !== "object") continue;
    const o = d as Record<string, unknown>;
    const email = typeof o.email === "string" ? o.email : "";
    const etat = (typeof o.status === "string" ? o.status : "").toLowerCase();
    if (!email || !ETATS_DEST.has(etat)) continue;
    out.push({
      email,
      nom: typeof o.name === "string" ? o.name : null,
      role: typeof o.roleName === "string" ? o.roleName : null,
      statut: etat as EtatDestinataire,
      signeLe: typeof o.signedDateTime === "string" ? o.signedDateTime : null,
      motifRefus: typeof o.declinedReason === "string" ? o.declinedReason : null,
    });
  }
  return out;
}

/**
 * État réel d'une enveloppe, lu chez DocuSign.
 *
 * C'est le recours quand une notification arrive incomplète, dans le désordre
 * ou pas du tout (§4) : DocuSign fait foi, pas la notification.
 */
export async function lireEnveloppe(input: {
  entityId: string;
  envelopeId: string;
}): Promise<{
  ok: true;
  statut: StatutDocuSign;
  destinataires: Destinataire[];
  motifAnnulation: string | null;
  completedAt: string | null;
  horodatage: string | null;
} | EchecApi> {
  const a = await accesPourEntite(input.entityId);
  if (!a.ok) return { ok: false, error: a.error };

  const etat = await appel<ReponseEtat>(a.acces, "GET", `envelopes/${input.envelopeId}`);
  if (!etat.ok) return etat;

  const brut = (typeof etat.data.status === "string" ? etat.data.status : "").toLowerCase();
  const connus = new Set(["created", "sent", "delivered", "completed", "declined", "voided", "deleted"]);
  if (!connus.has(brut)) {
    return { ok: false, error: `Statut DocuSign inconnu : « ${brut || "vide"} ».` };
  }

  // Les destinataires se lisent à part : la réponse d'enveloppe ne les porte
  // pas toujours, et c'est d'eux que se déduit « partiellement signé ».
  const dest = await appel<unknown>(a.acces, "GET", `envelopes/${input.envelopeId}/recipients`);

  return {
    ok: true,
    statut: brut as StatutDocuSign,
    destinataires: dest.ok ? lireDestinataires(dest.data) : [],
    motifAnnulation: typeof etat.data.voidedReason === "string" ? etat.data.voidedReason : null,
    completedAt: typeof etat.data.completedDateTime === "string" ? etat.data.completedDateTime : null,
    horodatage: typeof etat.data.statusChangedDateTime === "string"
      ? etat.data.statusChangedDateTime
      : null,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  Téléchargements
// ══════════════════════════════════════════════════════════════════════

/** PDF signé, tous documents réunis. */
export async function telechargerDocumentSigne(input: {
  entityId: string;
  envelopeId: string;
}): Promise<{ ok: true; octets: Buffer; mime: string } | EchecApi> {
  const a = await accesPourEntite(input.entityId);
  if (!a.ok) return { ok: false, error: a.error };
  return appelBinaire(a.acces, `envelopes/${input.envelopeId}/documents/combined`);
}

/**
 * Certificat de réalisation.
 *
 * C'est la pièce probante : identité des signataires, horodatages, adresses
 * IP, empreinte du document. Un PDF signé sans son certificat prouve beaucoup
 * moins — d'où son archivage systématique.
 */
export async function telechargerCertificat(input: {
  entityId: string;
  envelopeId: string;
}): Promise<{ ok: true; octets: Buffer; mime: string } | EchecApi> {
  const a = await accesPourEntite(input.entityId);
  if (!a.ok) return { ok: false, error: a.error };
  return appelBinaire(a.acces, `envelopes/${input.envelopeId}/documents/certificate`);
}

// ══════════════════════════════════════════════════════════════════════
//  Annulation
// ══════════════════════════════════════════════════════════════════════

export async function annulerEnveloppe(input: {
  entityId: string;
  envelopeId: string;
  motif: string;
}): Promise<{ ok: true } | EchecApi> {
  const a = await accesPourEntite(input.entityId);
  if (!a.ok) return { ok: false, error: a.error };
  const r = await appel<unknown>(a.acces, "PUT", `envelopes/${input.envelopeId}`, {
    corps: { status: "voided", voidedReason: input.motif.slice(0, 200) },
  });
  return r.ok ? { ok: true } : r;
}
