// Machine à états de la signature — PURE, aucune I/O.
//
// DocuSign a son propre vocabulaire (`sent`, `delivered`, `completed`…) et il
// ne recouvre pas celui du cahier des charges. « Partiellement signé » et
// « Expiré », notamment, ne sont pas des statuts d'enveloppe DocuSign : le
// premier se DÉDUIT de l'état des destinataires, le second d'un `voided`
// motivé par l'expiration. Traduire ici, une fois, évite d'éparpiller cette
// subtilité dans le reste du code.

/** Les dix statuts du §2, plus le cas des documents non soumis à signature. */
export type StatutSignature =
  | "en_preparation"
  | "en_attente_envoi"
  | "envoye_signature"
  | "en_attente_signature"
  | "partiellement_signe"
  | "signe_toutes_parties"
  | "refuse"
  | "annule"
  | "expire"
  | "erreur_synchronisation";

export const STATUT_LABEL: Record<StatutSignature, string> = {
  en_preparation: "Document en préparation",
  en_attente_envoi: "En attente d'envoi",
  envoye_signature: "Envoyé pour signature",
  en_attente_signature: "En attente de signature",
  partiellement_signe: "Partiellement signé",
  signe_toutes_parties: "Signé par toutes les parties",
  refuse: "Refusé",
  annule: "Annulé",
  expire: "Expiré",
  erreur_synchronisation: "Erreur de synchronisation",
};

/** Ton d'affichage. Les couleurs viennent des tokens du CRM, pas d'ici. */
export const STATUT_TON: Record<StatutSignature, "neutre" | "attente" | "ok" | "alerte" | "erreur"> = {
  en_preparation: "neutre",
  en_attente_envoi: "neutre",
  envoye_signature: "attente",
  en_attente_signature: "attente",
  partiellement_signe: "attente",
  signe_toutes_parties: "ok",
  refuse: "alerte",
  annule: "alerte",
  expire: "alerte",
  erreur_synchronisation: "erreur",
};

/** Statuts terminaux : plus aucune signature n'est attendue. */
export const TERMINAUX: StatutSignature[] = [
  "signe_toutes_parties", "refuse", "annule", "expire",
];

export function estTerminal(s: StatutSignature): boolean {
  return TERMINAUX.includes(s);
}

/** Statut à partir duquel l'archivage automatique doit avoir lieu. */
export function doitEtreArchive(s: StatutSignature): boolean {
  return s === "signe_toutes_parties";
}

// ── Destinataires ─────────────────────────────────────────────────────

export type EtatDestinataire =
  | "created" | "sent" | "delivered" | "signed" | "completed"
  | "declined" | "autoresponded";

export type Destinataire = {
  email: string;
  nom?: string | null;
  role?: string | null;
  statut: EtatDestinataire;
  /** Horodatage de la signature, quand elle a eu lieu. */
  signeLe?: string | null;
  motifRefus?: string | null;
};

const A_SIGNE = new Set<EtatDestinataire>(["signed", "completed"]);

export function aSigne(d: Destinataire): boolean {
  return A_SIGNE.has(d.statut);
}

// ── Traduction depuis DocuSign ────────────────────────────────────────

/** Statut d'enveloppe tel que DocuSign le renvoie. */
export type StatutDocuSign =
  | "created" | "sent" | "delivered" | "completed"
  | "declined" | "voided" | "deleted";

export type EnveloppeDocuSign = {
  statut: StatutDocuSign;
  destinataires: Destinataire[];
  /** Motif d'annulation, renseigné par DocuSign sur un `voided`. */
  motifAnnulation?: string | null;
  completedAt?: string | null;
};

/** Un `voided` motivé par l'expiration doit ressortir « Expiré », pas « Annulé ». */
function estExpiration(motif: string | null | undefined): boolean {
  const m = (motif ?? "").toLowerCase();
  return m.includes("expire") || m.includes("expiration") || m.includes("expired");
}

/**
 * Traduit l'état d'une enveloppe DocuSign en statut du CRM.
 *
 * `delivered` signifie « le destinataire a ouvert le document », pas « il a
 * signé » : c'est donc « en attente de signature ». Et dès qu'un signataire
 * sur plusieurs a signé sans que l'enveloppe soit complète, le statut est
 * « partiellement signé » — information que DocuSign ne donne pas
 * directement et qu'il faut déduire des destinataires.
 */
export function statutDepuisDocuSign(e: EnveloppeDocuSign): StatutSignature {
  switch (e.statut) {
    case "completed":
      return "signe_toutes_parties";
    case "declined":
      return "refuse";
    case "voided":
      return estExpiration(e.motifAnnulation) ? "expire" : "annule";
    case "deleted":
      return "annule";
    case "created":
      return "en_attente_envoi";
    case "sent":
    case "delivered": {
      const signataires = e.destinataires.filter((d) => d.statut !== "autoresponded");
      // Un refus en cours de route l'emporte : inutile d'attendre les autres.
      if (signataires.some((d) => d.statut === "declined")) return "refuse";
      const signes = signataires.filter(aSigne).length;
      if (signes > 0 && signes < signataires.length) return "partiellement_signe";
      if (signataires.length > 0 && signes === signataires.length) {
        // Tous ont signé mais DocuSign n'a pas encore clôturé : on reste en
        // attente de SA confirmation, car c'est elle qui fait foi.
        return "en_attente_signature";
      }
      // Au moins un destinataire a ouvert le document.
      if (signataires.some((d) => d.statut === "delivered")) return "en_attente_signature";
      return "envoye_signature";
    }
  }
}

// ── Transitions ───────────────────────────────────────────────────────

/**
 * Transitions autorisées.
 *
 * On n'accepte pas n'importe quel enchaînement : un document signé par
 * toutes les parties ne redevient jamais « en attente ». Les notifications
 * DocuSign peuvent arriver DANS LE DÉSORDRE — une notification ancienne qui
 * arrive après une récente ne doit pas faire reculer le statut.
 */
const SUIVANTS: Record<StatutSignature, StatutSignature[]> = {
  en_preparation: ["en_attente_envoi", "annule", "erreur_synchronisation"],
  en_attente_envoi: ["envoye_signature", "annule", "erreur_synchronisation"],
  envoye_signature: [
    "en_attente_signature", "partiellement_signe", "signe_toutes_parties",
    "refuse", "annule", "expire", "erreur_synchronisation",
  ],
  en_attente_signature: [
    "partiellement_signe", "signe_toutes_parties",
    "refuse", "annule", "expire", "erreur_synchronisation",
  ],
  partiellement_signe: [
    "signe_toutes_parties", "refuse", "annule", "expire", "erreur_synchronisation",
  ],
  // Terminaux : plus rien, sauf l'erreur de synchronisation qui peut survenir
  // au moment de l'archivage d'un document déjà signé.
  signe_toutes_parties: ["erreur_synchronisation"],
  refuse: [],
  annule: [],
  expire: [],
  // Une erreur de synchronisation se résout : on peut en sortir vers l'état
  // réel une fois le rattrapage réussi.
  erreur_synchronisation: [
    "en_attente_signature", "partiellement_signe", "signe_toutes_parties",
    "refuse", "annule", "expire",
  ],
};

export function transitionAutorisee(de: StatutSignature, vers: StatutSignature): boolean {
  if (de === vers) return true; // idempotent : rejouer une notification ne casse rien
  return SUIVANTS[de].includes(vers);
}

/**
 * Applique une transition, ou la refuse en expliquant pourquoi.
 *
 * Refuser plutôt que forcer : une notification en retard qui ferait reculer
 * un document signé rendrait l'archivage incohérent, et l'anomalie doit se
 * voir plutôt que de se propager.
 */
export function appliquer(
  de: StatutSignature,
  vers: StatutSignature,
): { ok: true; statut: StatutSignature } | { ok: false; raison: string } {
  if (transitionAutorisee(de, vers)) return { ok: true, statut: vers };
  return {
    ok: false,
    raison: `transition refusée : « ${STATUT_LABEL[de]} » → « ${STATUT_LABEL[vers]} »`,
  };
}

/** Signataires restants, pour l'affichage côté planificatrice. */
export function restantASigner(destinataires: readonly Destinataire[]): Destinataire[] {
  return destinataires.filter((d) => !aSigne(d) && d.statut !== "declined" && d.statut !== "autoresponded");
}
