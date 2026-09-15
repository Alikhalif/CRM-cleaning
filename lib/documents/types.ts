// Types du registre documentaire (§1, §3). Client-safe (aucune I/O).

export type DocKind = "contrat" | "certificat" | "rapport" | "attestation" | "piece_jointe" | "autre";
export type DocCategory = "hotte" | "desinsectisation" | "deratisation" | "nuisibles" | "nettoyage" | "autre";

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  contrat: "Contrat",
  certificat: "Certificat",
  rapport: "Rapport d'intervention",
  attestation: "Attestation",
  piece_jointe: "Pièce jointe",
  autre: "Autre document",
};

export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  hotte: "Hotte",
  desinsectisation: "Désinsectisation",
  deratisation: "Dératisation",
  nuisibles: "Nuisibles",
  nettoyage: "Nettoyage",
  autre: "Autre",
};

// Un document unifié tel qu'affiché dans l'onglet « Documents & Contrats » — il
// provient soit de client_documents (upload/génération), soit d'une source
// existante lue en lecture seule (ex. certificat hotte déjà émis).
export type ClientDocument = {
  id: string;
  source: "client_documents" | "cert_hotte";
  clientId: string;
  kind: DocKind;
  category: DocCategory | null;
  title: string;
  ref: string | null;
  fileName: string | null;
  mimeType: string | null;
  signed: boolean;
  status: string | null;
  createdAt: string;
  createdByName: string | null;
  url: string | null;      // URL signée (visualisation / téléchargement)
  canDelete: boolean;      // false pour les sources en lecture seule (cert_hotte)
  dossierId: string | null;
};

export const DOC_KINDS: DocKind[] = ["contrat", "certificat", "rapport", "attestation", "piece_jointe", "autre"];
export const DOC_CATEGORIES: DocCategory[] = ["hotte", "desinsectisation", "deratisation", "nuisibles", "nettoyage", "autre"];
