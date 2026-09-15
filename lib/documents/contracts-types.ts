// Types du sous-module Contrats (Lot 2). Client-safe (aucune I/O).

export type ContractStatus = "actif" | "a_renouveler" | "expire" | "resilie" | "en_attente_signature";

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  actif: "Actif",
  a_renouveler: "À renouveler",
  expire: "Expiré",
  resilie: "Résilié",
  en_attente_signature: "En attente de signature",
};

// Pastille couleur (§8) — mappée sur les tons du thème.
export const CONTRACT_STATUS_TONE: Record<ContractStatus, "success" | "warning" | "danger" | "muted" | "info"> = {
  actif: "success",
  a_renouveler: "warning",
  expire: "danger",
  resilie: "muted",
  en_attente_signature: "info",
};

export const CONTRACT_STATUSES: ContractStatus[] = ["actif", "a_renouveler", "expire", "resilie", "en_attente_signature"];

// ── Templates dynamiques ────────────────────────────────────────────────────
export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "checkgroup";

export type TemplateField = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  prefill?: string; // clé de pré-remplissage (ex. client.name, client.address)
  placeholder?: string;
  full?: boolean;   // occupe toute la largeur du formulaire
};

export type TemplateSection = { title: string; fields: TemplateField[] };
export type ContractClause = { title: string; body: string };

export type ContractTemplate = {
  key: string;
  name: string;
  kind: string;
  category: string | null;
  sections: TemplateSection[];
  clauses: ContractClause[];
};

// Valeur d'un champ : chaîne, nombre, ou liste (checkgroup).
export type FieldValue = string | number | string[] | null;

// ── Contrat (forme UI) ──────────────────────────────────────────────────────
export type Contract = {
  id: string;
  ref: string | null;
  clientId: string;
  templateKey: string | null;
  category: string | null;
  title: string;
  status: ContractStatus;
  startDate: string | null;
  endDate: string | null;
  signedDate: string | null;
  frequency: string | null;
  passagesPerYear: number | null;
  passagesDone: number;
  amount: number | null;
  billingMode: string | null;
  data: Record<string, FieldValue>;
  pdfUrl: string | null;
  sentAt: string | null;
  createdAt: string;
  createdByName: string | null;
};

// Déduit un nombre de passages/an à partir de la fréquence choisie.
export function passagesFromFrequency(freq: string | null | undefined): number | null {
  if (!freq) return null;
  const m = /([1-4])\s*passage/i.exec(freq);
  if (m) return parseInt(m[1], 10);
  if (/unique/i.test(freq)) return 1;
  return null;
}
