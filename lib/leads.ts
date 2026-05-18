// Lead domain types for the pipeline.
// Status spelling follows the CDC §5.4 reference (not the n8n doc's longer form):
// `lead | envoye | ouvert | signe | encaisse | perdu`.

export type Sector = "urgence" | "nettoyage" | "enr" | "renovation";

export type LeadStatus =
  | "lead"
  | "envoye"
  | "ouvert"
  | "signe"
  | "encaisse"
  | "perdu";

export type SubEnvoi = "mano" | "auto";
export type SubSignature = "sans" | "avec";

export type Source =
  | "google-ads"
  | "meta-ads"
  | "site-web"
  | "telephone"
  | "recommandation";

export type Commercial = {
  id: string;
  name: string;
  initials: string;
  // CSS variable name (defined in tokens) or a hex — kept simple as hex for mocks.
  color: string;
};

export type Lead = {
  id: string;
  shortId: string; // e.g. "L-1042"
  client: string; // display name (person or company) — composed on read
  isCompany: boolean;
  // Raw name parts kept alongside the composed `client` so the edit-contact
  // modal can pre-fill them losslessly. Persisted as separate DB columns
  // (client_first_name / client_last_name / client_company) per CDC §5.2.
  firstName?: string;
  lastName?: string;
  company?: string;
  email: string;
  phone: string;
  address: string; // street
  postalCode: string;
  city: string;
  sector: Sector;
  source: Source;
  amount: number; // estimated TTC, EUR
  ownerId: string;
  status: LeadStatus;
  subEnvoi: SubEnvoi | null;
  subSignature: SubSignature | null;
  receivedAt: string; // ISO
  lastActionLabel: string;
  lastActionAt: string; // ISO
  // Set when an n8n WF2 sequence is scheduled or a manual call-back is queued.
  nextFollowupAt?: string;
  isUrgent?: boolean;
  // NRP = « Ne Répond Pas ». Set by the commercial when a contact attempt
  // fails (no answer / no reply). Cleared manually once contact resumes.
  // Orthogonal to status — a lead can be NRP at any pipeline stage.
  isNrp: boolean;
  nrpAt?: string;
  siret?: string;
  vatIntra?: string;
  notes?: string;
  lostReason?: string;
  // Confidential — only visible if the current user holds the immobTravaux
  // permission (CDC §3.5). Encrypted at rest in production.
  immobTravauxAnnotation?: string;
};

// Devis + factures share one table in the CDC (§5.2 documents). The status
// enum differs by type — CDC §5.4.
export type DocumentType = "devis" | "acompte" | "finale";
export type DevisStatus = "brouillon" | "envoye" | "ouvert" | "signe" | "refuse" | "expire";
export type FactureStatus = "brouillon" | "envoye" | "paye" | "retard";
export type DocumentStatus = DevisStatus | FactureStatus;

// `Document` clashes with the DOM `Document` global, so we prefix.
export type CrmDocument = {
  id: string;
  num: string; // DEV-2026-0001 / FA-2026-0001 / FAC-2026-0001
  type: DocumentType;
  status: DocumentStatus;
  leadId: string;
  totalTtc: number;
  issuedAt: string;
  signedAt?: string;
  paidAt?: string;
  acomptePct?: number; // only on devis avec acompte
  acompteAmount?: number;
};

export type TimelineEventKind =
  | "received"
  | "status"
  | "email"
  | "email-reply"
  | "call"
  | "doc-issued"
  | "doc-signed"
  | "payment"
  | "note";

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  at: string; // ISO
  label: string;
  sublabel?: string;
};

export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  devis: "Devis",
  acompte: "Facture d'acompte",
  finale: "Facture finale",
};

// CDC §5.2 legal_entities — issuing companies (multi-société).
export type LegalForm = "SAS" | "SARL" | "EURL" | "SASU" | "EI" | "SCI";

export type LegalEntity = {
  id: string;
  legalName: string;
  legalForm: LegalForm;
  siret: string;
  apeCode: string;
  vatNumber: string;
  addressLine: string;
  postalCode: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  iban: string;
  bic: string;
  defaultVatRate: number;
  legalMentions: string;
  color: string;
  defaultActivities: Sector[];
};

// CDC §5.2 prestations — service catalogue.
export type PrestationUnit = "unité" | "forfait" | "h" | "m²" | "mois";

export type Prestation = {
  id: string;
  sector: Sector;
  label: string;
  unit: PrestationUnit;
  unitPriceHt: number;
  vatRate: number; // percent, e.g. 10 or 20
};

// CDC §5.2 payment_terms.
export type PaymentTermSlug = "comptant" | "30j" | "45j" | "60j";
export type PaymentTerm = { slug: PaymentTermSlug; label: string; days: number };

export const PAYMENT_TERMS: Record<PaymentTermSlug, PaymentTerm> = {
  comptant: { slug: "comptant", label: "Comptant à réception",        days: 0 },
  "30j":    { slug: "30j",      label: "30 jours fin de mois",        days: 30 },
  "45j":    { slug: "45j",      label: "45 jours fin de mois",        days: 45 },
  "60j":    { slug: "60j",      label: "60 jours",                    days: 60 },
};

// CDC §4.12.3 sector defaults — drive the deposit % and the payment term
// pre-selection in the quote editor. Override-able per quote.
export const DEFAULT_ACOMPTE_PCT: Record<Sector, number> = {
  urgence: 0,
  nettoyage: 20,
  enr: 30,
  renovation: 40,
};

export const DEFAULT_PAYMENT_TERM: Record<Sector, PaymentTermSlug> = {
  urgence: "comptant",
  nettoyage: "30j",
  enr: "30j",
  renovation: "45j",
};

// ── Planification (workflow planificatrice — overrides CDC §4.7) ──────
// Spec from product owner: 4 stages of a dossier (à planifier → planifié →
// finalisé → finalisé et soldé). PaymentStatus tracks where the dossier is
// in its encaissement cycle.
export type DossierStatus = "a_planifier" | "planifie" | "finalise" | "solde";

export type PaymentStatus =
  | "acompte_non_paye"
  | "acompte_paye"
  | "partiel"
  | "en_attente"
  | "solde"
  | "impaye";

export type DossierFlag = "a_rappeler" | "attente_retour" | "litige" | "bloque";

export type Technician = {
  id: string;
  name: string;
  initials: string;
  color: string;
  sectors: Sector[];
};

export type Dossier = {
  id: string;
  leadId: string;            // resolves the client via MOCK_LEADS
  status: DossierStatus;
  paymentStatus: PaymentStatus;
  technicianId?: string;
  plannedAt?: string;        // ISO datetime — when the intervention is scheduled
  durationHours?: number;
  notes?: string;
  flags: DossierFlag[];
  createdAt: string;
  updatedAt: string;
};

export const DOSSIER_STATUS_LABEL: Record<DossierStatus, string> = {
  a_planifier: "À planifier",
  planifie: "Planifié",
  finalise: "Finalisé",
  solde: "Finalisé et soldé",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  acompte_non_paye: "Acompte non payé",
  acompte_paye: "Acompte payé",
  partiel: "Paiement partiel",
  en_attente: "En attente paiement",
  solde: "Soldé",
  impaye: "Impayé",
};

export const DOSSIER_FLAG_LABEL: Record<DossierFlag, string> = {
  a_rappeler: "Client à rappeler",
  attente_retour: "Retour client en attente",
  litige: "Litige",
  bloque: "Dossier bloqué",
};

export type DocumentLine = {
  id: string;
  prestationId?: string;
  label: string;
  quantity: number;
  unit: string;
  unitPriceHt: number;
  vatRate: number;
  discountPct?: number;
  totalHt: number; // qty * unitPriceHt * (1 - discountPct/100)
};

// CDC §4.9 clients.
export type ClientType = "pro" | "particulier";
export type ClientOrigin = "lead" | "direct";

export type Client = {
  id: string;
  type: ClientType;
  origin: ClientOrigin;
  name: string;          // raison sociale ou nom complet
  contactName?: string;  // contact référent (pour les pros)
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  siret?: string;        // requis si type=pro
  vatIntra?: string;
  sourceLeadId?: string; // renseigné si origin=lead
  sectors: Sector[];     // activités historisées
  note?: string;
  createdAt: string;
};

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  pro: "Professionnel",
  particulier: "Particulier",
};

export const CLIENT_ORIGIN_LABEL: Record<ClientOrigin, string> = {
  lead: "Issu d'un lead",
  direct: "Direct",
};

export const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  ouvert: "Ouvert",
  signe: "Signé",
  refuse: "Refusé",
  expire: "Expiré",
  paye: "Payé",
  retard: "En retard",
};

// CDC §4.3 — the six pipeline columns, in display order.
export const PIPELINE_COLUMNS: { status: LeadStatus; label: string; hint?: string }[] = [
  { status: "lead", label: "Lead entrant", hint: "Nouveau lead, pas encore traité" },
  { status: "envoye", label: "Devis envoyé", hint: "Sous-statut Mano ou Auto requis" },
  { status: "ouvert", label: "Devis ouvert", hint: "Le client a ouvert le lien" },
  { status: "signe", label: "Signé", hint: "Sous-statut Sans/Avec acompte requis" },
  { status: "encaisse", label: "Encaissé", hint: "Facture finale payée" },
  { status: "perdu", label: "Perdu", hint: "Lead non converti" },
];

export const SECTOR_LABEL: Record<Sector, string> = {
  urgence: "Urgence",
  nettoyage: "Nettoyage",
  enr: "ENR",
  renovation: "Rénovation",
};

// Maps to the --sector-* CSS custom properties already defined in _tokens.scss.
export const SECTOR_VAR: Record<Sector, string> = {
  urgence: "--sector-urgence",
  nettoyage: "--sector-nettoyage",
  enr: "--sector-enr",
  renovation: "--sector-renovation",
};

export const SOURCE_LABEL: Record<Source, string> = {
  "google-ads": "Google Ads",
  "meta-ads": "Meta Ads",
  "site-web": "Site web",
  telephone: "Téléphone",
  recommandation: "Recommandation",
};

// Sub-statuses become *required* when a card reaches "Devis envoyé" (Mano/Auto)
// or "Signé" (Sans/Avec). A "Canal manquant" badge shows until they're set.
const ENVOI_REQUIRED: LeadStatus[] = ["envoye", "ouvert", "signe", "encaisse"];
const SIGNATURE_REQUIRED: LeadStatus[] = ["signe", "encaisse"];

export function needsEnvoi(lead: Lead): boolean {
  return ENVOI_REQUIRED.includes(lead.status) && !lead.subEnvoi;
}

export function needsSignature(lead: Lead): boolean {
  return SIGNATURE_REQUIRED.includes(lead.status) && !lead.subSignature;
}

// "Lancer séquence" (n8n WF2) is offered only on `lead` or `envoye·mano` cards
// that haven't been signed — see CDC §4.3 + spec/SPEC.md.
export function canLaunchSequence(lead: Lead): boolean {
  if (lead.status === "lead") return true;
  if (lead.status === "envoye" && lead.subEnvoi === "mano") return true;
  return false;
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// "il y a 2 j", "il y a 5 h" — short relative time, French.
export function relativeFromNow(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `il y a ${mo} mois`;
  return `il y a ${Math.round(mo / 12)} an${mo >= 24 ? "s" : ""}`;
}
