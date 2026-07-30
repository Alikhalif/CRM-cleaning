// Lead domain types for the pipeline.
// Status spelling follows the CDC §5.4 reference (not the n8n doc's longer form):
// `lead | envoye | ouvert | signe | encaisse | perdu`.

export type Sector =
  | "urgence"
  | "nettoyage"
  | "nettoyage_difficile"
  | "enr"
  | "renovation"
  | "debarras"
  | "demenagement"
  | "diogene";

// Pays d'opération (CDC §6/§9). Le CRM couvre 4 pays.
export type Country = "FR" | "CH" | "LU" | "BE" | "CA";

export const COUNTRY_LABEL: Record<Country, string> = {
  FR: "France",
  CH: "Suisse",
  LU: "Luxembourg",
  BE: "Belgique",
  CA: "Canada",
};

export const COUNTRIES: Country[] = ["FR", "CH", "LU", "BE", "CA"];

// Profils commerciaux / pools de routage (CDC §7). Un commercial peut en cumuler.
export type CommercialProfile =
  | "appel_entrant"
  | "nettoyage"
  | "debarras_demenagement"
  | "diogene"
  | "performant"
  | "en_attente";

export const COMMERCIAL_PROFILES: CommercialProfile[] = [
  "appel_entrant",
  "nettoyage",
  "debarras_demenagement",
  "diogene",
  "performant",
  "en_attente",
];

export const COMMERCIAL_PROFILE_LABEL: Record<CommercialProfile, string> = {
  appel_entrant: "Appel entrant",
  nettoyage: "Nettoyage",
  debarras_demenagement: "Débarras / Déménagement",
  diogene: "Diogène",
  performant: "Performant",
  en_attente: "En attente",
};

// Capacités dérivées du profil commercial (décision : « auto selon le profil »,
// pas de réglage par utilisateur). Les profils « chasseurs » (appel entrant,
// diogène, débarras/déménagement, performant, en attente) peuvent utiliser le
// click-to-call Ringover et créer des leads. Le profil « nettoyage » (Divers)
// ne reçoit que des devis : ni Ringover ni création. Un admin a tout.
const RINGOVER_PROFILES: CommercialProfile[] = [
  "appel_entrant",
  "diogene",
  "debarras_demenagement",
  "performant",
  "en_attente",
];

export type Capabilities = { canUseRingover: boolean; canAddLead: boolean };

export function profileCapabilities(profiles: string[], isAdmin = false): Capabilities {
  if (isAdmin) return { canUseRingover: true, canAddLead: true };
  const granted = RINGOVER_PROFILES.some((p) => profiles.includes(p));
  return { canUseRingover: granted, canAddLead: granted };
}

// Déduit le pays depuis l'indicatif téléphonique. Sert de dernier recours
// dans la détection (après la landing page et le champ pays du formulaire).
// Ordre sans collision : +352 (LU) ne préfixe pas +32 (BE).
export function countryFromPhone(phone: string | null | undefined): Country | undefined {
  const d = (phone ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("+41") || d.startsWith("0041")) return "CH";
  if (d.startsWith("+352") || d.startsWith("00352")) return "LU";
  if (d.startsWith("+32") || d.startsWith("0032")) return "BE";
  if (d.startsWith("+33") || d.startsWith("0033")) return "FR";
  if (d.startsWith("+1") || d.startsWith("001")) return "CA";
  return undefined;
}

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
  // Pays du lead (CDC §6) — détecté auto ou corrigé manuellement.
  country?: Country;
  // Société émettrice rattachée (CDC §4) + landing page d'origine (§12).
  entityId?: string;
  entityName?: string;
  landingPage?: string;
  // Free-text sub-qualifier within the sector (e.g. "longue distance",
  // "succession"). Captured from the LP form or entered manually.
  typeService?: string;
  source: Source;
  amount: number; // estimated TTC, EUR
  surfaceM2?: number;
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
  // Optional minimal-shape documents for pipeline bucketing. Populated by
  // getAllLeads (the listing fetcher) so the Kanban can detect paid acompte
  // and paid finale without an extra round-trip. Not populated by every
  // fetcher — undefined means "we don't know, treat conservatively".
  documents?: { id: string; type: "devis" | "acompte" | "finale"; status: string }[];
  siret?: string;
  vatIntra?: string;
  notes?: string;
  lostReason?: string;
  // Confidential — only visible if the current user holds the immobTravaux
  // permission (CDC §3.5). Encrypted at rest in production.
  immobTravauxAnnotation?: string;
  // Post-signature delay the client requested, captured by the commercial.
  // Surfaces on the planificatrice's queue so urgent ones float.
  interventionDelay?: InterventionDelay;
  interventionDelayNotes?: string;
  // ── Découverte (call 2026-07-11) — qualification before quoting.
  announcedPrice?: number; // prix annoncé au client pendant la découverte
  discoveryOutcome?: DiscoveryOutcome; // undefined = découverte pas encore faite
  discoveryDoneAt?: string; // ISO — set when an outcome is recorded
  photosRequestedAt?: string; // ISO — set when a photo request is sent
  // Fiche Découverte enrichie (Lot 1, 2026-07-30) — remplie par TOUS les
  // commerciaux ; suit le dossier jusqu'à la planification.
  delaiSouhaite?: DelaiSouhaite;
  priceRange?: string; // ex. "500-700"
  reactionPrix?: ReactionPrix;
  statutClient?: StatutClient;
  etatSalete?: EtatSalete;
  contexteIntervention?: string;
  acompteNegocie?: number; // % de prépaiement négocié (0–100) — qualité du closing
  // Champs techniques propres au métier (débarras/déménagement) — JSONB souple.
  discoveryDetails?: Record<string, unknown>;
  // "Demande extrême" — feeds the commercial-extrême routing tier.
  isExtreme?: boolean;
};

// Découverte outcome (CDC add-on 2026-07-11): ok → prêt pour devis,
// refus → lead perdu, ok_plus → intéressé mais photos/visite requises.
export type DiscoveryOutcome = "ok" | "refus" | "ok_plus";

export const DISCOVERY_OUTCOME_LABEL: Record<DiscoveryOutcome, string> = {
  ok: "OK",
  refus: "Refus",
  ok_plus: "OK voir +",
};

// ── Fiche Découverte enrichie (Lot 1) — menus déroulants standardisés ──

export type DelaiSouhaite =
  | "aujourdhui" | "24h" | "48h" | "semaine" | "15j" | "ce_mois" | "plus_tard";
export const DELAI_SOUHAITE: DelaiSouhaite[] = [
  "aujourdhui", "24h", "48h", "semaine", "15j", "ce_mois", "plus_tard",
];
export const DELAI_SOUHAITE_LABEL: Record<DelaiSouhaite, string> = {
  aujourdhui: "Aujourd'hui",
  "24h": "Sous 24 heures",
  "48h": "Sous 48 heures",
  semaine: "Cette semaine",
  "15j": "Sous 15 jours",
  ce_mois: "Ce mois-ci",
  plus_tard: "Plus tard",
};

export type ReactionPrix = "ok" | "hesitant" | "pas_ok";
export const REACTIONS_PRIX: ReactionPrix[] = ["ok", "hesitant", "pas_ok"];
export const REACTION_PRIX_LABEL: Record<ReactionPrix, string> = {
  ok: "OK",
  hesitant: "Hésitant",
  pas_ok: "Pas OK",
};

export type StatutClient = "proprietaire" | "locataire" | "agence" | "syndic" | "professionnel";
export const STATUTS_CLIENT: StatutClient[] = ["proprietaire", "locataire", "agence", "syndic", "professionnel"];
export const STATUT_CLIENT_LABEL: Record<StatutClient, string> = {
  proprietaire: "Propriétaire",
  locataire: "Locataire",
  agence: "Agence",
  syndic: "Syndic",
  professionnel: "Professionnel",
};

export type EtatSalete = "leger" | "moyen" | "important" | "tres_important" | "extreme";
export const ETATS_SALETE: EtatSalete[] = ["leger", "moyen", "important", "tres_important", "extreme"];
export const ETAT_SALETE_LABEL: Record<EtatSalete, string> = {
  leger: "Léger",
  moyen: "Moyen",
  important: "Important",
  tres_important: "Très important",
  extreme: "Extrême",
};

// Fourchettes de prix annoncées. value stockée en base, label affiché.
export const PRICE_RANGES: { value: string; label: string }[] = [
  ["100", "300"], ["300", "500"], ["500", "700"], ["700", "900"], ["900", "1100"],
  ["1100", "1300"], ["1300", "1500"], ["1500", "2000"], ["2000", "2500"], ["2500", "3000"],
  ["3000", "4000"], ["4000", "5000"], ["5000", "6000"], ["6000", "7000"], ["7000", "8000"],
  ["8000", "9000"], ["9000", "10000"], ["10000", "12500"], ["12500", "15000"],
].map(([a, b]) => ({
  value: `${a}-${b}`,
  label: `${Number(a).toLocaleString("fr-FR")} – ${Number(b).toLocaleString("fr-FR")} €`,
}));
export const PRICE_RANGE_LABEL: Record<string, string> = Object.fromEntries(
  PRICE_RANGES.map((r) => [r.value, r.label]),
);

// Acompte négocié : paliers de 10 % (100 → 0). Qualité du closing, pas une
// probabilité de signature.
export const ACOMPTE_STEPS: number[] = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

// CDC §4.5 — the 5 standard delay buckets + free-text for everything else.
export type InterventionDelay =
  | "sous_72h"
  | "1_semaine"
  | "15_jours"
  | "1_mois"
  | "personnalise";

export const INTERVENTION_DELAY_LABEL: Record<InterventionDelay, string> = {
  sous_72h:     "Sous 72 heures",
  "1_semaine":  "1 semaine",
  "15_jours":   "15 jours",
  "1_mois":     "1 mois",
  personnalise: "Délai personnalisé",
};

// Devis + factures share one table in the CDC (§5.2 documents). The status
// enum differs by type — CDC §5.4.
export type DocumentType = "devis" | "acompte" | "finale";
export type DevisStatus = "brouillon" | "envoye" | "ouvert" | "signe" | "refuse" | "expire";
export type FactureStatus = "brouillon" | "envoye" | "paye" | "retard";
export type DocumentStatus = DevisStatus | FactureStatus;

// Optional refusal reason — set when a devis is marked refused via the
// MarkRefusedModal. Persisted in documents.refusal_reason (devis only).
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
  refusalReason?: string; // only set when status=refuse on a devis
  entityName?: string; // issuing société — surfaced where multi-société matters
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
  nettoyage_difficile: 20,
  enr: 30,
  renovation: 40,
  debarras: 30,
  demenagement: 30,
  diogene: 30,
};

export const DEFAULT_PAYMENT_TERM: Record<Sector, PaymentTermSlug> = {
  urgence: "comptant",
  nettoyage: "30j",
  nettoyage_difficile: "30j",
  enr: "30j",
  renovation: "45j",
  debarras: "comptant",
  demenagement: "comptant",
  diogene: "comptant",
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
  basePostalCode?: string;     // home/dépôt — drives km distance to the client
  serviceDepartments: string[]; // declared coverage (département codes)
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
// Pipeline column key — broader than LeadStatus to surface the two
// payment milestones (acompte / finale) as their own swimlanes. Two of
// the keys ("acompte_paye" and "encaisse" with paid-finale) are derived
// from the documents linked to each lead, not from leads.status alone.
export type PipelineColumnKey =
  | "lead"
  | "envoye"
  | "ouvert"
  | "signe"
  | "acompte_paye"
  | "encaisse"
  | "perdu";

export const PIPELINE_COLUMNS: { status: PipelineColumnKey; label: string; hint?: string }[] = [
  { status: "lead",         label: "Lead entrant",       hint: "Nouveau lead, pas encore traité" },
  { status: "envoye",       label: "Devis envoyé",       hint: "Sous-statut Mano ou Auto requis" },
  { status: "ouvert",       label: "Devis ouvert",       hint: "Le client a ouvert le lien" },
  { status: "signe",        label: "Signé",              hint: "Sous-statut Sans/Avec acompte requis" },
  { status: "acompte_paye", label: "Acompte encaissé",   hint: "Glisser ici = marquer la facture d'acompte payée" },
  { status: "encaisse",     label: "Encaissement final", hint: "Glisser ici = marquer la facture finale payée" },
  { status: "perdu",        label: "Perdu",              hint: "Lead non converti" },
];

// Compute the most-advanced pipeline column for a lead from its status +
// linked documents. Used by the Kanban to bucket cards and by the lead
// detail PipelineProgress component for consistency.
export function pipelineColumnFor(lead: Lead): PipelineColumnKey {
  if (lead.status === "perdu") return "perdu";
  const docs = lead.documents ?? [];
  const hasPaidFinale  = docs.some((d) => d.type === "finale"  && d.status === "paye");
  const hasPaidAcompte = docs.some((d) => d.type === "acompte" && d.status === "paye");
  if (hasPaidFinale) return "encaisse";
  if (hasPaidAcompte) return "acompte_paye";
  // Fall back to leads.status — covers lead / envoye / ouvert / signe / encaisse
  // (the last when status is encaisse but no finale doc tagged paid yet, e.g. legacy data).
  return lead.status as PipelineColumnKey;
}

// Quick lookup: does this lead have an unpaid invoice of the given type?
// Returns the doc id if so. Used by the Kanban drag-handler to know which
// document to mark paid when a card is dragged into Acompte / Encaisse.
export function unpaidInvoiceId(
  lead: Lead,
  type: "acompte" | "finale",
): string | null {
  const doc = (lead.documents ?? []).find(
    (d) => d.type === type && d.status !== "paye",
  );
  return doc?.id ?? null;
}

export const SECTOR_LABEL: Record<Sector, string> = {
  urgence: "Urgence",
  nettoyage: "Nettoyage",
  nettoyage_difficile: "Nettoyage difficile",
  enr: "ENR",
  renovation: "Rénovation",
  debarras: "Débarras",
  demenagement: "Déménagement",
  diogene: "Diogène",
};

// Maps to the --sector-* CSS custom properties already defined in _tokens.scss.
export const SECTOR_VAR: Record<Sector, string> = {
  urgence: "--sector-urgence",
  nettoyage: "--sector-nettoyage",
  nettoyage_difficile: "--sector-nettoyage-difficile",
  enr: "--sector-enr",
  renovation: "--sector-renovation",
  debarras: "--sector-debarras",
  demenagement: "--sector-demenagement",
  diogene: "--sector-diogene",
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
// Pure eligibility check — given a lead AND the global "n8n sequence
// enabled" toggle (fetched from app_settings server-side), does the
// "Lancer séquence" button apply? The toggle is admin-controlled at
// /settings/integrations so it can be flipped without a redeploy.
export function canLaunchSequence(lead: Lead, n8nEnabled: boolean): boolean {
  if (!n8nEnabled) return false;
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

// Compact € display for the Dashboard cards: "12.6 k€", "1.4 M€", "650 €".
// Drops to plain euros under 1k; promotes to M€ at 1M+. Negatives keep the
// sign so deltas read as "-116.3 k€".
export function formatKEUR(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} M€`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)} k€`;
  return `${sign}${abs.toFixed(0)} €`;
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
