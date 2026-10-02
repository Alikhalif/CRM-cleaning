// Module Sous-traitants — helpers PURS (aucune I/O, importable côté client).
// Types + calcul de conformité + libellés. La couche serveur (-server.ts) fait
// les lectures Supabase et réutilise ces helpers.

export type SubcontractorDocType =
  | "kbis"
  | "assurance_decennale"
  | "cni_dirigeant"
  | "contrat_sous_traitance"
  | "autre";

export type InvoiceStatus = "recue" | "a_regler" | "reglee" | "litige";
export type InsuranceStatus = "valide" | "bientot_expiree" | "expiree" | "manquante";
export type PresenceStatus = "present" | "manquant";
export type ContratStatus = "signe" | "non_signe";

export const DOC_TYPE_LABEL: Record<SubcontractorDocType, string> = {
  kbis: "Extrait Kbis",
  assurance_decennale: "Assurance décennale",
  cni_dirigeant: "Carte d'identité du dirigeant",
  contrat_sous_traitance: "Contrat de sous-traitance",
  autre: "Autre document",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  recue: "Reçue",
  a_regler: "À régler",
  reglee: "Réglée",
  litige: "Litige",
};

export const INSURANCE_STATUS_LABEL: Record<InsuranceStatus, string> = {
  valide: "Valide",
  bientot_expiree: "Bientôt expirée",
  expiree: "Expirée",
  manquante: "Manquante",
};

// Nombre de jours avant échéance à partir duquel on signale « bientôt expirée ».
export const INSURANCE_SOON_DAYS = 60;

export type ConformityDocInput = {
  docType: SubcontractorDocType;
  endDate?: string | null; // décennale
  status?: string | null;  // contrat : 'signe'
};

export type Conformity = {
  kbis: PresenceStatus;
  cni: PresenceStatus;
  contrat: ContratStatus;
  assurance: InsuranceStatus;
  assuranceEndDate?: string | null;
  daysToInsuranceExpiry?: number | null;
  isComplete: boolean;
  issues: string[]; // libellés d'alerte lisibles
};

function daysBetween(fromIso: string, to: Date): number {
  const d = new Date(fromIso);
  return Math.round((d.getTime() - to.getTime()) / 86400000);
}

// Calcule la conformité à partir des documents COURANTS (is_current, non supprimés).
export function computeConformity(docs: ConformityDocInput[], now: Date = new Date()): Conformity {
  const has = (t: SubcontractorDocType) => docs.some((d) => d.docType === t);
  const kbis: PresenceStatus = has("kbis") ? "present" : "manquant";
  const cni: PresenceStatus = has("cni_dirigeant") ? "present" : "manquant";

  const contratDoc = docs.find((d) => d.docType === "contrat_sous_traitance");
  const contrat: ContratStatus = contratDoc && contratDoc.status === "signe" ? "signe" : "non_signe";

  const assuranceDoc = docs.find((d) => d.docType === "assurance_decennale");
  let assurance: InsuranceStatus = "manquante";
  let assuranceEndDate: string | null | undefined = assuranceDoc?.endDate ?? null;
  let daysToInsuranceExpiry: number | null = null;
  if (assuranceDoc) {
    if (assuranceDoc.endDate) {
      const d = daysBetween(assuranceDoc.endDate, now);
      daysToInsuranceExpiry = d;
      if (d < 0) assurance = "expiree";
      else if (d <= INSURANCE_SOON_DAYS) assurance = "bientot_expiree";
      else assurance = "valide";
    } else {
      assurance = "valide"; // attestation présente sans date de fin renseignée
    }
  }

  const issues: string[] = [];
  if (kbis === "manquant") issues.push("Kbis manquant");
  if (assurance === "manquante") issues.push("Assurance décennale manquante");
  if (assurance === "expiree") issues.push("Assurance décennale expirée");
  if (assurance === "bientot_expiree") issues.push("Assurance décennale bientôt expirée");
  if (cni === "manquant") issues.push("Carte d'identité du dirigeant manquante");
  if (contrat === "non_signe") issues.push("Contrat de sous-traitance non signé");

  const isComplete =
    kbis === "present" && cni === "present" && contrat === "signe" && assurance === "valide";

  return { kbis, cni, contrat, assurance, assuranceEndDate, daysToInsuranceExpiry, isComplete, issues };
}

export type TimelineEvent = { at: string; label: string; kind: string };

export function formatFrDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function money(n?: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
