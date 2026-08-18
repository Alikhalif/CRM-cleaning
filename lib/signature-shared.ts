// Types & helpers PURS du système de signature électronique — sans I/O,
// importables depuis les composants client (module Signatures, page publique).
// Les accès Supabase vivent dans lib/signature-server.ts.

// ── Statuts d'une demande de signature (enum SQL signature_status) ────────
export type SignatureStatus =
  | "brouillon"
  | "pret"
  | "envoye"
  | "distribue"
  | "consulte"
  | "en_attente_signature"
  | "signe"
  | "refuse"
  | "expire"
  | "annule"
  | "erreur";

export const SIGNATURE_STATUS_LABEL: Record<SignatureStatus, string> = {
  brouillon: "Brouillon",
  pret: "Prêt à envoyer",
  envoye: "Envoyé",
  distribue: "Distribué",
  consulte: "Consulté",
  en_attente_signature: "En attente de signature",
  signe: "Signé",
  refuse: "Refusé",
  expire: "Expiré",
  annule: "Annulé",
  erreur: "Erreur",
};

// Couleur (token CSS) pour la pastille de statut du module.
export const SIGNATURE_STATUS_TONE: Record<SignatureStatus, string> = {
  brouillon: "var(--text-muted)",
  pret: "var(--tone-info)",
  envoye: "var(--tone-info)",
  distribue: "var(--tone-info)",
  consulte: "var(--tone-warning)",
  en_attente_signature: "var(--tone-warning)",
  signe: "var(--tone-success)",
  refuse: "var(--tone-danger)",
  expire: "var(--text-muted)",
  annule: "var(--text-muted)",
  erreur: "var(--tone-danger)",
};

// Statuts terminaux : plus aucune signature/relance possible.
export const SIGNATURE_TERMINAL: SignatureStatus[] = ["signe", "refuse", "expire", "annule"];
export function isSignatureTerminal(s: SignatureStatus): boolean {
  return SIGNATURE_TERMINAL.includes(s);
}

// Filtres du module Signatures (§15).
export const SIGNATURE_FILTERS: { key: string; label: string; statuses: SignatureStatus[] }[] = [
  { key: "en_attente", label: "En attente", statuses: ["envoye", "distribue", "en_attente_signature"] },
  { key: "consultees", label: "Consultées", statuses: ["consulte"] },
  { key: "signees", label: "Signées", statuses: ["signe"] },
  { key: "refusees", label: "Refusées", statuses: ["refuse"] },
  { key: "expirees", label: "Expirées", statuses: ["expire"] },
  { key: "annulees", label: "Annulées", statuses: ["annule"] },
];

// ── Événements de la piste d'audit (§6) ──────────────────────────────────
export type SignatureEventType =
  | "SIGNATURE_REQUEST_CREATED"
  | "EMAIL_SENT"
  | "SIGNATURE_LINK_OPENED"
  | "DOCUMENT_VIEWED"
  | "OTP_REQUESTED"
  | "OTP_VERIFIED"
  | "CONSENT_ACCEPTED"
  | "SIGNATURE_STARTED"
  | "DOCUMENT_SIGNED"
  | "DOCUMENT_FINALIZED"
  | "SIGNED_DOCUMENT_DOWNLOADED"
  | "REMINDER_SENT"
  | "SIGNATURE_DECLINED"
  | "SIGNATURE_REQUEST_EXPIRED"
  | "SIGNATURE_REQUEST_CANCELLED";

export const SIGNATURE_EVENT_LABEL: Record<SignatureEventType, string> = {
  SIGNATURE_REQUEST_CREATED: "Demande de signature créée",
  EMAIL_SENT: "E-mail envoyé",
  SIGNATURE_LINK_OPENED: "Lien ouvert",
  DOCUMENT_VIEWED: "Document consulté",
  OTP_REQUESTED: "Code OTP demandé",
  OTP_VERIFIED: "Code OTP vérifié",
  CONSENT_ACCEPTED: "Consentement accepté",
  SIGNATURE_STARTED: "Signature démarrée",
  DOCUMENT_SIGNED: "Document signé",
  DOCUMENT_FINALIZED: "Document final généré",
  SIGNED_DOCUMENT_DOWNLOADED: "Document signé téléchargé",
  REMINDER_SENT: "Relance envoyée",
  SIGNATURE_DECLINED: "Signature refusée",
  SIGNATURE_REQUEST_EXPIRED: "Demande expirée",
  SIGNATURE_REQUEST_CANCELLED: "Demande annulée",
};

// Texte de consentement par défaut (§5 étape 3) — jamais pré-coché côté UI.
export const DEFAULT_CONSENT_TEXT =
  "Je reconnais avoir pris connaissance du document et j'accepte son contenu " +
  "ainsi que l'utilisation de la signature électronique pour formaliser mon accord.";

// Durée de validité par défaut d'une demande (décision client : 30 jours).
export const SIGNATURE_DEFAULT_EXPIRY_DAYS = 30;

export type SignatureType = "drawn" | "typed";
