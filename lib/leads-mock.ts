import type {
  Client,
  Commercial,
  CrmDocument,
  DocumentLine,
  Dossier,
  DossierStatus,
  LegalEntity,
  Lead,
  PaymentTermSlug,
  Prestation,
  Sector,
  Technician,
  TimelineEvent,
} from "./leads";

// Seed data for the pipeline scaffold. Replaces a real API while we wire the
// front-end shell. Ages are computed at module load so "il y a 2 j" stays
// sensible across reloads without re-seeding.

export const MOCK_COMMERCIAUX: Commercial[] = [
  { id: "u_sophie",  name: "Sophie Lambert",   initials: "SL", color: "#5b4bcc" },
  { id: "u_karim",   name: "Karim Benali",     initials: "KB", color: "#0ea5e9" },
  { id: "u_julie",   name: "Julie Moreau",     initials: "JM", color: "#14c890" },
  { id: "u_thomas",  name: "Thomas Renard",    initials: "TR", color: "#f59e0b" },
  { id: "u_alex",    name: "Alex Pereira",     initials: "AP", color: "#ef4444" },
];

const now = Date.now();
const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
const inHours = (h: number) => new Date(now + h * 3_600_000).toISOString();

export const MOCK_LEADS: Lead[] = [
  // ── Lead entrant ──
  {
    id: "ld_001", shortId: "L-1058",
    client: "Léa Dubois", isCompany: false,
    email: "lea.dubois@example.com", phone: "+33 6 14 22 18 03",
    address: "12 rue Oberkampf", postalCode: "75011", city: "Paris 11e",
    sector: "urgence", source: "google-ads", amount: 480, ownerId: "u_sophie",
    status: "lead", subEnvoi: null, subSignature: null,
    receivedAt: ago(0.5), lastActionLabel: "Lead reçu", lastActionAt: ago(0.5),
    nextFollowupAt: inHours(2),
    isUrgent: true,
    notes: "Fuite chauffe-eau, demande intervention le jour même.",
  },
  {
    id: "ld_002", shortId: "L-1057",
    client: "Atelier Vidal SARL", isCompany: true,
    email: "contact@atelier-vidal.fr", phone: "+33 4 78 31 09 22",
    address: "47 cours Lafayette", postalCode: "69003", city: "Lyon 3e",
    sector: "nettoyage", source: "meta-ads", amount: 1850, ownerId: "u_karim",
    status: "lead", subEnvoi: null, subSignature: null,
    receivedAt: ago(2), lastActionLabel: "Lead reçu", lastActionAt: ago(2),
    siret: "522 481 630 00018", vatIntra: "FR42522481630",
  },
  {
    id: "ld_003", shortId: "L-1056",
    client: "Hervé Marchand", isCompany: false,
    email: "h.marchand@orange.fr", phone: "+33 6 88 41 02 17",
    address: "9 chemin des Vignes", postalCode: "17100", city: "Saintes",
    sector: "enr", source: "site-web", amount: 14200, ownerId: "u_julie",
    status: "lead", subEnvoi: null, subSignature: null,
    receivedAt: ago(5), lastActionLabel: "Lead reçu", lastActionAt: ago(5),
    notes: "Maison 120 m² toit sud, ardoises 2018.",
    immobTravauxAnnotation: "Propriétaire occupant, RDV possible 6/05 entre 14h-17h.",
  },
  {
    id: "ld_004", shortId: "L-1055",
    client: "Cabinet Rousseau", isCompany: true,
    email: "rousseau@cabinet-rousseau.com", phone: "+33 5 56 79 12 04",
    address: "82 rue Sainte-Catherine", postalCode: "33000", city: "Bordeaux",
    sector: "renovation", source: "recommandation", amount: 38500, ownerId: "u_thomas",
    status: "lead", subEnvoi: null, subSignature: null,
    receivedAt: ago(9), lastActionLabel: "Lead reçu", lastActionAt: ago(9),
    siret: "812 644 901 00027", vatIntra: "FR91812644901",
    immobTravauxAnnotation: "Recommandé par M. Lefranc (L-0998), opération immobilière en cours.",
  },

  // ── Devis envoyé ──
  {
    id: "ld_010", shortId: "L-1051",
    client: "Marie Lefèvre", isCompany: false,
    email: "marie.lefevre@gmail.com", phone: "+33 6 22 38 71 09",
    address: "3 allée des Tilleuls", postalCode: "44000", city: "Nantes",
    sector: "nettoyage", source: "google-ads", amount: 920, ownerId: "u_sophie",
    status: "envoye", subEnvoi: "mano", subSignature: null,
    receivedAt: ago(20), lastActionLabel: "Devis envoyé", lastActionAt: ago(2),
  },
  {
    id: "ld_011", shortId: "L-1050",
    client: "Boulangerie Cazeneuve", isCompany: true,
    email: "cazeneuve.contact@gmail.com", phone: "+33 5 61 23 88 17",
    address: "18 place du Capitole", postalCode: "31000", city: "Toulouse",
    sector: "nettoyage", source: "meta-ads", amount: 2400, ownerId: "u_karim",
    status: "envoye", subEnvoi: "auto", subSignature: null,
    receivedAt: ago(36), lastActionLabel: "Email J+0 envoyé", lastActionAt: ago(8),
    nextFollowupAt: inHours(64), // J+3 relance
    siret: "445 217 802 00033",
  },
  {
    id: "ld_012", shortId: "L-1049",
    client: "Pascal Vidal", isCompany: false,
    email: "p.vidal17@laposte.net", phone: "+33 6 71 90 14 28",
    address: "27 quai Valin", postalCode: "17000", city: "La Rochelle",
    sector: "enr", source: "google-ads", amount: 19800, ownerId: "u_julie",
    status: "envoye", subEnvoi: null, subSignature: null,
    receivedAt: ago(48), lastActionLabel: "Devis envoyé", lastActionAt: ago(10),
  },

  // ── Devis ouvert ──
  {
    id: "ld_020", shortId: "L-1042",
    client: "Camille Roux", isCompany: false,
    email: "camille.roux@outlook.com", phone: "+33 6 18 04 32 91",
    address: "55 avenue Berthelot", postalCode: "69007", city: "Lyon 7e",
    sector: "renovation", source: "site-web", amount: 27500, ownerId: "u_thomas",
    status: "ouvert", subEnvoi: "auto", subSignature: null,
    receivedAt: ago(72), lastActionLabel: "Lien ouvert", lastActionAt: ago(4),
    nextFollowupAt: inHours(96), // relance après ouverture
  },
  {
    id: "ld_021", shortId: "L-1041",
    client: "Garage Tessier", isCompany: true,
    email: "garage.tessier@orange.fr", phone: "+33 5 56 45 88 19",
    address: "12 avenue Pasteur", postalCode: "33600", city: "Pessac",
    sector: "urgence", source: "telephone", amount: 720, ownerId: "u_alex",
    status: "ouvert", subEnvoi: "mano", subSignature: null,
    receivedAt: ago(60), lastActionLabel: "Lien ouvert", lastActionAt: ago(1.5),
    siret: "351 904 218 00021",
  },

  // ── Signé ──
  {
    id: "ld_030", shortId: "L-1035",
    client: "Florence Garnier", isCompany: false,
    email: "f.garnier@free.fr", phone: "+33 6 90 33 71 02",
    address: "14 rue de la République", postalCode: "79000", city: "Niort",
    sector: "enr", source: "google-ads", amount: 22300, ownerId: "u_julie",
    status: "signe", subEnvoi: "mano", subSignature: "avec",
    receivedAt: ago(120), lastActionLabel: "Devis signé", lastActionAt: ago(18),
  },
  {
    id: "ld_031", shortId: "L-1033",
    client: "Café Margot", isCompany: true,
    email: "cafe.margot@gmail.com", phone: "+33 1 42 64 18 09",
    address: "61 rue des Abbesses", postalCode: "75018", city: "Paris 18e",
    sector: "nettoyage", source: "recommandation", amount: 1180, ownerId: "u_sophie",
    status: "signe", subEnvoi: "mano", subSignature: "sans",
    receivedAt: ago(96), lastActionLabel: "Devis signé", lastActionAt: ago(22),
    siret: "789 304 511 00015",
  },
  {
    id: "ld_032", shortId: "L-1031",
    client: "Domaine de Beaulieu", isCompany: true,
    email: "intendance@domaine-beaulieu.fr", phone: "+33 5 45 82 11 47",
    address: "Route de Châteaubernard", postalCode: "16100", city: "Cognac",
    sector: "renovation", source: "site-web", amount: 64500, ownerId: "u_thomas",
    status: "signe", subEnvoi: "auto", subSignature: null,
    receivedAt: ago(140), lastActionLabel: "Devis signé", lastActionAt: ago(30),
    siret: "499 712 086 00042", vatIntra: "FR58499712086",
    immobTravauxAnnotation: "Bâtiment classé monument historique, devis avec contraintes.",
  },

  // ── Encaissé ──
  {
    id: "ld_040", shortId: "L-1024",
    client: "Mathieu Perret", isCompany: false,
    email: "mathieu.perret@gmail.com", phone: "+33 6 47 28 09 13",
    address: "8 boulevard Berthelot", postalCode: "16000", city: "Angoulême",
    sector: "enr", source: "meta-ads", amount: 17900, ownerId: "u_julie",
    status: "encaisse", subEnvoi: "mano", subSignature: "avec",
    receivedAt: ago(220), lastActionLabel: "Encaissement final", lastActionAt: ago(48),
  },
  {
    id: "ld_041", shortId: "L-1019",
    client: "SCI Le Beffroi", isCompany: true,
    email: "gestion@sci-lebeffroi.fr", phone: "+33 3 20 51 84 22",
    address: "44 rue de Béthune", postalCode: "59000", city: "Lille",
    sector: "renovation", source: "recommandation", amount: 41200, ownerId: "u_thomas",
    status: "encaisse", subEnvoi: "mano", subSignature: "avec",
    receivedAt: ago(310), lastActionLabel: "Encaissement final", lastActionAt: ago(72),
    siret: "604 218 037 00018", vatIntra: "FR23604218037",
  },

  // ── Perdu ──
  {
    id: "ld_050", shortId: "L-1015",
    client: "Olivier Maréchal", isCompany: false,
    email: "o.marechal@hotmail.fr", phone: "+33 6 33 91 47 02",
    address: "21 rue Jean Jaurès", postalCode: "29200", city: "Brest",
    sector: "urgence", source: "google-ads", amount: 320, ownerId: "u_alex",
    status: "perdu", subEnvoi: "auto", subSignature: null,
    receivedAt: ago(360), lastActionLabel: "Aucune réponse après J+14", lastActionAt: ago(72),
    lostReason: "Aucune réponse après les 4 emails de relance.",
  },
  {
    id: "ld_051", shortId: "L-1009",
    client: "Studio Fontaine", isCompany: true,
    email: "studio.fontaine@gmail.com", phone: "+33 2 99 36 14 88",
    address: "9 rue Hoche", postalCode: "35000", city: "Rennes",
    sector: "nettoyage", source: "meta-ads", amount: 1450, ownerId: "u_karim",
    status: "perdu", subEnvoi: "mano", subSignature: null,
    receivedAt: ago(420), lastActionLabel: "Concurrent retenu", lastActionAt: ago(96),
    siret: "318 905 442 00027",
    lostReason: "Concurrent retenu pour raisons de prix.",
  },
];

// Documents linked to a subset of mock leads. Numbering follows the CDC
// gapless-per-year-per-type rule: DEV-2026-NNNN, FA-2026-NNNN, FAC-2026-NNNN.
export const MOCK_DOCUMENTS: CrmDocument[] = [
  // Devis envoyé / ouvert / signé
  { id: "d_010", num: "DEV-2026-0042", type: "devis", status: "envoye", leadId: "ld_010", totalTtc: 920, issuedAt: ago(2) },
  { id: "d_011", num: "DEV-2026-0041", type: "devis", status: "envoye", leadId: "ld_011", totalTtc: 2400, issuedAt: ago(8) },
  { id: "d_012", num: "DEV-2026-0040", type: "devis", status: "envoye", leadId: "ld_012", totalTtc: 19800, issuedAt: ago(10), acomptePct: 30, acompteAmount: 5940 },
  { id: "d_020", num: "DEV-2026-0036", type: "devis", status: "ouvert", leadId: "ld_020", totalTtc: 27500, issuedAt: ago(40), acomptePct: 40, acompteAmount: 11000 },
  { id: "d_021", num: "DEV-2026-0035", type: "devis", status: "ouvert", leadId: "ld_021", totalTtc: 720,   issuedAt: ago(36) },

  // Signé · Avec acompte → devis signé + facture d'acompte (générée auto)
  { id: "d_030", num: "DEV-2026-0029", type: "devis",   status: "signe", leadId: "ld_030", totalTtc: 22300, issuedAt: ago(72), signedAt: ago(18), acomptePct: 30, acompteAmount: 6690 },
  { id: "d_030f", num: "FA-2026-0011", type: "acompte", status: "envoye", leadId: "ld_030", totalTtc: 6690, issuedAt: ago(18) },

  // Signé · Sans acompte → devis signé seul
  { id: "d_031", num: "DEV-2026-0028", type: "devis",   status: "signe", leadId: "ld_031", totalTtc: 1180, issuedAt: ago(48), signedAt: ago(22) },

  // Signé sans sous-statut paiement encore défini
  { id: "d_032", num: "DEV-2026-0026", type: "devis",   status: "signe", leadId: "ld_032", totalTtc: 64500, issuedAt: ago(80), signedAt: ago(30) },

  // Encaissé → devis signé + acompte payé + facture finale payée
  { id: "d_040",  num: "DEV-2026-0019", type: "devis",   status: "signe", leadId: "ld_040", totalTtc: 17900, issuedAt: ago(180), signedAt: ago(150), acomptePct: 30, acompteAmount: 5370 },
  { id: "d_040f", num: "FA-2026-0006",  type: "acompte", status: "paye",  leadId: "ld_040", totalTtc: 5370,  issuedAt: ago(150), paidAt: ago(140) },
  { id: "d_040g", num: "FAC-2026-0014", type: "finale",  status: "paye",  leadId: "ld_040", totalTtc: 12530, issuedAt: ago(60),  paidAt: ago(48) },

  { id: "d_041",  num: "DEV-2026-0014", type: "devis",   status: "signe", leadId: "ld_041", totalTtc: 41200, issuedAt: ago(280), signedAt: ago(240), acomptePct: 40, acompteAmount: 16480 },
  { id: "d_041f", num: "FA-2026-0004",  type: "acompte", status: "paye",  leadId: "ld_041", totalTtc: 16480, issuedAt: ago(240), paidAt: ago(225) },
  { id: "d_041g", num: "FAC-2026-0009", type: "finale",  status: "paye",  leadId: "ld_041", totalTtc: 24720, issuedAt: ago(85),  paidAt: ago(72) },
];

// Builds a chronological timeline from the lead state + its documents.
// In production this would be reconstructed server-side from `audit_logs`
// (CDC §8.6) — here we synthesize plausible events from existing data.
function buildTimeline(lead: Lead, docs: CrmDocument[]): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: `${lead.id}_received`,
      kind: "received",
      at: lead.receivedAt,
      label: "Lead reçu",
      sublabel: `via ${sourceLabel(lead.source)}`,
    },
  ];

  for (const doc of docs) {
    if (doc.type === "devis") {
      events.push({
        id: `${doc.id}_issued`,
        kind: "doc-issued",
        at: doc.issuedAt,
        label: `Devis ${doc.num} émis`,
      });
      if (doc.signedAt) {
        events.push({
          id: `${doc.id}_signed`,
          kind: "doc-signed",
          at: doc.signedAt,
          label: `Devis ${doc.num} signé`,
        });
      }
    } else if (doc.type === "acompte") {
      events.push({
        id: `${doc.id}_issued`,
        kind: "doc-issued",
        at: doc.issuedAt,
        label: `Facture d'acompte ${doc.num} émise`,
      });
      if (doc.paidAt) {
        events.push({
          id: `${doc.id}_paid`,
          kind: "payment",
          at: doc.paidAt,
          label: `Acompte ${doc.num} encaissé`,
        });
      }
    } else if (doc.type === "finale") {
      events.push({
        id: `${doc.id}_issued`,
        kind: "doc-issued",
        at: doc.issuedAt,
        label: `Facture finale ${doc.num} émise`,
      });
      if (doc.paidAt) {
        events.push({
          id: `${doc.id}_paid`,
          kind: "payment",
          at: doc.paidAt,
          label: `Facture finale ${doc.num} encaissée`,
        });
      }
    }
  }

  if (lead.status === "perdu") {
    events.push({
      id: `${lead.id}_lost`,
      kind: "status",
      at: lead.lastActionAt,
      label: "Lead marqué perdu",
      sublabel: lead.lostReason,
    });
  }

  // Most recent first.
  events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return events;
}

function sourceLabel(s: Lead["source"]): string {
  switch (s) {
    case "google-ads": return "Google Ads";
    case "meta-ads": return "Meta Ads";
    case "site-web": return "Site web";
    case "telephone": return "Téléphone";
    case "recommandation": return "Recommandation";
  }
}

export type LeadDetail = {
  lead: Lead;
  owner: Commercial | undefined;
  documents: CrmDocument[];
  timeline: TimelineEvent[];
};

export function getLeadDetail(id: string): LeadDetail | null {
  const lead = MOCK_LEADS.find((l) => l.id === id);
  if (!lead) return null;
  const owner = MOCK_COMMERCIAUX.find((c) => c.id === lead.ownerId);
  const documents = MOCK_DOCUMENTS.filter((d) => d.leadId === id).sort(
    (a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt),
  );
  const timeline = buildTimeline(lead, documents);
  return { lead, owner, documents, timeline };
}

// ── Legal entities (entités juridiques) ─────────────────────────────────
// CDC mandates multi-entity support. Two entities here are enough to show
// the entity-per-sector mapping working in the UI; in production this CRUD
// lives in Settings → Entités juridiques.
export const MOCK_ENTITIES: LegalEntity[] = [
  {
    id: "ent_services",
    legalName: "CGK Services",
    legalForm: "SAS",
    siret: "894 217 530 00021",
    apeCode: "8121Z",
    vatNumber: "FR42894217530",
    addressLine: "14 rue Pasteur",
    postalCode: "33000",
    city: "Bordeaux",
    contactEmail: "contact@cgk-services.fr",
    contactPhone: "+33 5 56 00 00 00",
    iban: "FR76 1234 5678 9012 3456 7890 123",
    bic: "BDFEFRPP",
    defaultVatRate: 20,
    legalMentions:
      "SAS au capital de 50 000 €. Assurance décennale MMA n° 1234567. " +
      "RGE QualiPropre n° E-2024-00891.",
    color: "#5b4bcc",
    defaultActivities: ["nettoyage", "urgence"],
  },
  {
    id: "ent_energie",
    legalName: "CGK Énergie",
    legalForm: "SARL",
    siret: "917 305 412 00018",
    apeCode: "4321A",
    vatNumber: "FR58917305412",
    addressLine: "27 avenue Carnot",
    postalCode: "33200",
    city: "Bordeaux",
    contactEmail: "energie@cgk-services.fr",
    contactPhone: "+33 5 56 00 00 02",
    iban: "FR76 9876 5432 1098 7654 3210 987",
    bic: "BDFEFRPP",
    defaultVatRate: 10,
    legalMentions:
      "SARL au capital de 80 000 €. RGE QualiPV n° E-2024-04421. " +
      "Assurance décennale Allianz n° 9087625.",
    color: "#14c890",
    defaultActivities: ["enr", "renovation"],
  },
];

export function defaultEntityForSector(sector: Sector): LegalEntity {
  return (
    MOCK_ENTITIES.find((e) => e.defaultActivities.includes(sector)) ??
    MOCK_ENTITIES[0]
  );
}

// ── Prestations catalogue (CDC §4.10) ──────────────────────────────────
export const MOCK_PRESTATIONS: Prestation[] = [
  // ENR
  { id: "pr_pv400",  sector: "enr", label: "Panneau photovoltaïque 400 Wc", unit: "unité", unitPriceHt: 280,  vatRate: 10 },
  { id: "pr_ond5",   sector: "enr", label: "Onduleur hybride 5 kW",         unit: "unité", unitPriceHt: 1450, vatRate: 10 },
  { id: "pr_pose",   sector: "enr", label: "Pose et raccordement (forfait)", unit: "forfait", unitPriceHt: 1800, vatRate: 10 },
  // Rénovation
  { id: "pr_ite",    sector: "renovation", label: "Isolation murs ITE",      unit: "m²", unitPriceHt: 95,  vatRate: 10 },
  { id: "pr_toit",   sector: "renovation", label: "Réfection toiture",       unit: "m²", unitPriceHt: 145, vatRate: 10 },
  { id: "pr_chemin", sector: "renovation", label: "Pose conduit cheminée",   unit: "forfait", unitPriceHt: 1200, vatRate: 10 },
  // Urgence
  { id: "pr_urg",    sector: "urgence", label: "Intervention dépannage", unit: "forfait", unitPriceHt: 180, vatRate: 20 },
  { id: "pr_h",      sector: "urgence", label: "Heure technicien",       unit: "h",       unitPriceHt: 75,  vatRate: 20 },
  // Nettoyage
  { id: "pr_bur",    sector: "nettoyage", label: "Entretien bureaux (mensuel)", unit: "mois", unitPriceHt: 480, vatRate: 20 },
  { id: "pr_vit",    sector: "nettoyage", label: "Nettoyage vitrerie",          unit: "m²",   unitPriceHt: 8,   vatRate: 20 },
];

// ── Document detail ────────────────────────────────────────────────────
export type DocumentDetail = {
  doc: CrmDocument & {
    lines: DocumentLine[];
    totalHt: number;
    totalVat: number;
    paymentTermSlug: PaymentTermSlug;
    notes?: string;
    relatedDevisNum?: string;
  };
  entity: LegalEntity;
  lead: Lead;
};

const PAYMENT_TERM_BY_SECTOR: Record<Sector, PaymentTermSlug> = {
  urgence: "comptant",
  nettoyage: "30j",
  enr: "30j",
  renovation: "45j",
};

// Build plausible document lines on the fly. For a devis, pick 1–3 prestations
// from the right sector and back-fit quantities so the line sum approximately
// matches the document's stored totalTtc. For acompte/finale, render a single
// line that references the source devis (no breakdown — that's how French
// staged invoices typically read).
export function getDocumentById(id: string): DocumentDetail | null {
  const baseDoc = MOCK_DOCUMENTS.find((d) => d.id === id);
  if (!baseDoc) return null;
  const lead = MOCK_LEADS.find((l) => l.id === baseDoc.leadId);
  if (!lead) return null;
  const entity = defaultEntityForSector(lead.sector);

  const lines = synthesiseLines(baseDoc, lead);
  const totalHt = lines.reduce((s, l) => s + l.totalHt, 0);
  const totalVat = lines.reduce((s, l) => s + (l.totalHt * l.vatRate) / 100, 0);

  // Source devis number for acompte/finale invoices.
  let relatedDevisNum: string | undefined;
  if (baseDoc.type !== "devis") {
    const sourceDevis = MOCK_DOCUMENTS.find(
      (d) => d.leadId === baseDoc.leadId && d.type === "devis",
    );
    relatedDevisNum = sourceDevis?.num;
  }

  return {
    doc: {
      ...baseDoc,
      lines,
      totalHt: Math.round(totalHt * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      paymentTermSlug: PAYMENT_TERM_BY_SECTOR[lead.sector],
      relatedDevisNum,
    },
    entity,
    lead,
  };
}

// Denormalised document row for the Comptabilité tables — joins each doc to
// its lead and the issuing entity so the UI can render Client + Entity cells
// without per-row lookups. totalHt is approximated from the sector's default
// VAT rate (10 % ENR/rénovation, 20 % urgence/nettoyage); good enough for a
// list view and matches what `getDocumentById` returns to-the-cent for the
// detailed view.
export type DocumentWithContext = {
  doc: CrmDocument;
  lead: Lead;
  entity: LegalEntity;
  totalHt: number;
};

const VAT_BY_SECTOR: Record<Sector, number> = {
  urgence: 20,
  nettoyage: 20,
  enr: 10,
  renovation: 10,
};

export function getAllDocumentsWithContext(): DocumentWithContext[] {
  return MOCK_DOCUMENTS.map((doc) => {
    const lead = MOCK_LEADS.find((l) => l.id === doc.leadId);
    if (!lead) return null;
    const entity = defaultEntityForSector(lead.sector);
    const vatRate = VAT_BY_SECTOR[lead.sector];
    const totalHt = Math.round((doc.totalTtc / (1 + vatRate / 100)) * 100) / 100;
    return { doc, lead, entity, totalHt };
  }).filter((x): x is DocumentWithContext => x !== null);
}

// CDC §4.8 KPIs row. Pending = Envoyé / Ouvert / Brouillon / En retard for
// invoices; "CA encaissé (mois)" sums acompte + finale `paidAt` in the
// current calendar month (Europe/Paris is fine for scaffold; SQL views will
// replace this).
export type AccountingKpis = {
  devisPending: { count: number; amountTtc: number };
  acompteOutstanding: { count: number; amountTtc: number };
  finaleOutstanding: { count: number; amountTtc: number };
  caThisMonth: number;
};

export function computeAccountingKpis(
  rows: DocumentWithContext[] = getAllDocumentsWithContext(),
): AccountingKpis {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const devisPending = rows.filter(
    (r) => r.doc.type === "devis" && (r.doc.status === "envoye" || r.doc.status === "ouvert"),
  );
  const acompteOut = rows.filter(
    (r) =>
      r.doc.type === "acompte" &&
      (r.doc.status === "envoye" || r.doc.status === "brouillon" || r.doc.status === "retard"),
  );
  const finaleOut = rows.filter(
    (r) =>
      r.doc.type === "finale" &&
      (r.doc.status === "envoye" || r.doc.status === "brouillon" || r.doc.status === "retard"),
  );
  const caThisMonth = rows
    .filter(
      (r) =>
        (r.doc.type === "acompte" || r.doc.type === "finale") &&
        r.doc.status === "paye" &&
        r.doc.paidAt?.startsWith(ym),
    )
    .reduce((s, r) => s + r.doc.totalTtc, 0);

  return {
    devisPending: {
      count: devisPending.length,
      amountTtc: devisPending.reduce((s, r) => s + r.doc.totalTtc, 0),
    },
    acompteOutstanding: {
      count: acompteOut.length,
      amountTtc: acompteOut.reduce((s, r) => s + r.doc.totalTtc, 0),
    },
    finaleOutstanding: {
      count: finaleOut.length,
      amountTtc: finaleOut.reduce((s, r) => s + r.doc.totalTtc, 0),
    },
    caThisMonth,
  };
}

function synthesiseLines(doc: CrmDocument, lead: Lead): DocumentLine[] {
  if (doc.type === "acompte") {
    const sourceNum =
      MOCK_DOCUMENTS.find((d) => d.leadId === doc.leadId && d.type === "devis")?.num ?? "—";
    const ratePct = lead.sector === "enr" || lead.sector === "renovation" ? 10 : 20;
    const totalHt = +(doc.totalTtc / (1 + ratePct / 100)).toFixed(2);
    return [
      {
        id: `${doc.id}_line_1`,
        label: `Acompte ${doc.acomptePct ?? 30}% sur devis ${sourceNum}`,
        quantity: 1,
        unit: "forfait",
        unitPriceHt: totalHt,
        vatRate: ratePct,
        totalHt,
      },
    ];
  }

  if (doc.type === "finale") {
    const sourceNum =
      MOCK_DOCUMENTS.find((d) => d.leadId === doc.leadId && d.type === "devis")?.num ?? "—";
    const ratePct = lead.sector === "enr" || lead.sector === "renovation" ? 10 : 20;
    const totalHt = +(doc.totalTtc / (1 + ratePct / 100)).toFixed(2);
    return [
      {
        id: `${doc.id}_line_1`,
        label: `Solde après acompte sur devis ${sourceNum}`,
        quantity: 1,
        unit: "forfait",
        unitPriceHt: totalHt,
        vatRate: ratePct,
        totalHt,
      },
    ];
  }

  // Devis: synthesise a 1–3 line breakdown using catalogue prestations.
  const sectorPrestations = MOCK_PRESTATIONS.filter((p) => p.sector === lead.sector);
  if (sectorPrestations.length === 0) return [];
  const vatRate = sectorPrestations[0].vatRate;
  const targetHt = doc.totalTtc / (1 + vatRate / 100);

  // Build either a one-line catch-all (urgence + small nettoyage) or a
  // multi-line breakdown for ENR / rénovation / bigger nettoyage devis.
  if (targetHt < 600 || lead.sector === "urgence") {
    const presta = sectorPrestations[0];
    const qty = Math.max(1, Math.round(targetHt / presta.unitPriceHt));
    const totalHt = qty * presta.unitPriceHt;
    return [
      {
        id: `${doc.id}_line_1`,
        prestationId: presta.id,
        label: presta.label,
        quantity: qty,
        unit: presta.unit,
        unitPriceHt: presta.unitPriceHt,
        vatRate: presta.vatRate,
        totalHt,
      },
    ];
  }

  // Multi-line: take up to 3 prestations from the sector, distribute target.
  const picks = sectorPrestations.slice(0, 3);
  const shares = [0.6, 0.3, 0.1].slice(0, picks.length);
  const sumShares = shares.reduce((s, x) => s + x, 0);
  return picks.map((p, idx) => {
    const share = shares[idx] / sumShares;
    const lineTargetHt = targetHt * share;
    const qty = Math.max(1, Math.round(lineTargetHt / p.unitPriceHt));
    const totalHt = qty * p.unitPriceHt;
    return {
      id: `${doc.id}_line_${idx + 1}`,
      prestationId: p.id,
      label: p.label,
      quantity: qty,
      unit: p.unit,
      unitPriceHt: p.unitPriceHt,
      vatRate: p.vatRate,
      totalHt,
    };
  });
}

// ── Clients (CDC §4.9) ─────────────────────────────────────────────────
// Lead-origin clients are derived from signed/encaisse leads; direct clients
// are hand-seeded so the page shows both populations.

function clientFromLead(lead: Lead): Client {
  return {
    id: `cl_${lead.id.replace("ld_", "")}`,
    type: lead.isCompany ? "pro" : "particulier",
    origin: "lead",
    sourceLeadId: lead.id,
    name: lead.client,
    contactName: lead.isCompany ? undefined : lead.client,
    email: lead.email,
    phone: lead.phone,
    address: lead.address,
    postalCode: lead.postalCode,
    city: lead.city,
    siret: lead.siret,
    vatIntra: lead.vatIntra,
    sectors: [lead.sector],
    note: `Issu du lead ${lead.shortId} — converti le ${lead.lastActionAt.slice(0, 10)}.`,
    createdAt: lead.lastActionAt,
  };
}

const DIRECT_CLIENTS: Client[] = [
  {
    id: "cl_direct_patio",
    type: "pro",
    origin: "direct",
    name: "Hôtel Le Patio",
    contactName: "Aurélie Mansard",
    email: "direction@hotel-le-patio.fr",
    phone: "+33 5 56 47 09 22",
    address: "9 cours du Maréchal-Foch",
    postalCode: "33000",
    city: "Bordeaux",
    siret: "543 219 087 00031",
    vatIntra: "FR12543219087",
    sectors: ["nettoyage"],
    note: "Contrat trimestriel d'entretien des chambres. Signé hors plateforme en avril 2026.",
    createdAt: ago(28 * 24),
  },
  {
    id: "cl_direct_vasseur",
    type: "particulier",
    origin: "direct",
    name: "Pierre Vasseur",
    email: "p.vasseur@laposte.net",
    phone: "+33 6 71 02 84 19",
    address: "5 rue des Bouvreuils",
    postalCode: "44000",
    city: "Nantes",
    sectors: ["urgence"],
    note: "Client récurrent depuis 2024, intervient sur tout le grand Nantes.",
    createdAt: ago(60 * 24),
  },
  {
    id: "cl_direct_stcloud",
    type: "pro",
    origin: "direct",
    name: "Mairie de Saint-Cloud",
    contactName: "Régine Pelletier",
    email: "r.pelletier@saintcloud.fr",
    phone: "+33 1 47 71 88 12",
    address: "13 place Charles-de-Gaulle",
    postalCode: "92210",
    city: "Saint-Cloud",
    siret: "219 200 759 00018",
    vatIntra: "FR47219200759",
    sectors: ["nettoyage", "renovation"],
    note: "Marché public renouvelé annuellement.",
    createdAt: ago(90 * 24),
  },
  {
    id: "cl_direct_marquand",
    type: "particulier",
    origin: "direct",
    name: "Lucie Marquand",
    email: "lucie.marquand@gmail.com",
    phone: "+33 6 23 90 41 02",
    address: "21 chemin du Petit Bois",
    postalCode: "78600",
    city: "Maisons-Laffitte",
    sectors: ["nettoyage"],
    note: "Contact bouche-à-oreille via L-1009.",
    createdAt: ago(14 * 24),
  },
];

export const MOCK_CLIENTS: Client[] = [
  ...MOCK_LEADS
    .filter((l) => l.status === "signe" || l.status === "encaisse")
    .map(clientFromLead),
  ...DIRECT_CLIENTS,
];

export function getAllClients(): Client[] {
  return MOCK_CLIENTS;
}

export function getClientById(id: string): Client | null {
  return MOCK_CLIENTS.find((c) => c.id === id) ?? null;
}

// Documents + CA encaissé associated with a client. Lead-origin clients pull
// from the documents linked to their source lead; direct clients have no
// linked docs in the mock (they were onboarded off-platform).
export type ClientStats = {
  documents: CrmDocument[];
  caEncaisse: number;
  caSigne: number;
  lastActivityAt: string;
};

// ── Technicians (intervenants) + Dossiers (workflow planificatrice) ──
// Each signe/encaisse lead spawns a dossier when the planificatrice picks it
// up. The status reflects the operational lifecycle; the payment status is
// tracked independently and may stay "en_attente" long after the dossier is
// finalisé.

export const MOCK_TECHNICIANS: Technician[] = [
  { id: "tech_khaled",  name: "Khaled Brahim",   initials: "KB", color: "#ef4444", sectors: ["urgence", "enr"] },
  { id: "tech_vincent", name: "Vincent Caron",   initials: "VC", color: "#f59e0b", sectors: ["renovation", "enr"] },
  { id: "tech_aicha",   name: "Aïcha Lefort",    initials: "AL", color: "#0ea5e9", sectors: ["nettoyage"] },
  { id: "tech_bastien", name: "Bastien Roy",     initials: "BR", color: "#14c890", sectors: ["urgence", "nettoyage"] },
];

export const MOCK_DOSSIERS: Dossier[] = [
  // ld_030 — Florence Garnier (ENR, signe·avec, acompte FA-2026-0011 envoyé non payé)
  {
    id: "dos_030", leadId: "ld_030",
    status: "a_planifier", paymentStatus: "acompte_non_paye",
    notes: "Devis signé · acompte 30% à encaisser avant planification chantier.",
    flags: [],
    createdAt: ago(18), updatedAt: ago(2),
  },
  // ld_031 — Café Margot (nettoyage, signe·sans, planifié)
  {
    id: "dos_031", leadId: "ld_031",
    status: "planifie", paymentStatus: "en_attente",
    technicianId: "tech_aicha",
    plannedAt: new Date(now + 36 * 3_600_000).toISOString(), // dans 36h
    durationHours: 2,
    flags: [],
    createdAt: ago(22), updatedAt: ago(4),
  },
  // ld_032 — Domaine de Beaulieu (rénovation, signe sans sous-statut, bloqué)
  {
    id: "dos_032", leadId: "ld_032",
    status: "a_planifier", paymentStatus: "en_attente",
    flags: ["bloque"],
    notes: "Bâtiment classé monument historique · attente ABF.",
    createdAt: ago(30), updatedAt: ago(10),
  },
  // ld_040 — Mathieu Perret (ENR, encaisse, intervention faite, facture finale partiellement payée)
  {
    id: "dos_040", leadId: "ld_040",
    status: "finalise", paymentStatus: "partiel",
    technicianId: "tech_vincent",
    plannedAt: ago(48), // intervention passée il y a 2 j
    durationHours: 6,
    flags: ["a_rappeler"],
    notes: "Intervention OK · solde final à relancer.",
    createdAt: ago(150), updatedAt: ago(8),
  },
  // ld_041 — SCI Le Beffroi (rénovation, encaisse, totalement soldé)
  {
    id: "dos_041", leadId: "ld_041",
    status: "solde", paymentStatus: "solde",
    technicianId: "tech_vincent",
    plannedAt: ago(72),
    durationHours: 12,
    flags: [],
    createdAt: ago(240), updatedAt: ago(72),
  },
];

export type DossierWithContext = {
  dossier: Dossier;
  lead: Lead;
  technician?: Technician;
  acompteDoc?: CrmDocument;
  finaleDoc?: CrmDocument;
  devisDoc?: CrmDocument;
};

export function getAllDossiers(): DossierWithContext[] {
  const out: DossierWithContext[] = [];
  for (const dossier of MOCK_DOSSIERS) {
    const lead = MOCK_LEADS.find((l) => l.id === dossier.leadId);
    if (!lead) continue;
    const technician = dossier.technicianId
      ? MOCK_TECHNICIANS.find((t) => t.id === dossier.technicianId)
      : undefined;
    const docs = MOCK_DOCUMENTS.filter((d) => d.leadId === dossier.leadId);
    out.push({
      dossier,
      lead,
      technician,
      acompteDoc: docs.find((d) => d.type === "acompte"),
      finaleDoc: docs.find((d) => d.type === "finale"),
      devisDoc: docs.find((d) => d.type === "devis"),
    });
  }
  return out;
}

export type PlanificationKpis = {
  byStatus: Record<DossierStatus, number>;
  acompteOutstanding: { count: number; amountTtc: number };
  interventionsThisWeek: number;
};

export function computePlanificationKpis(
  rows: DossierWithContext[] = getAllDossiers(),
): PlanificationKpis {
  const byStatus: Record<DossierStatus, number> = {
    a_planifier: 0,
    planifie: 0,
    finalise: 0,
    solde: 0,
  };
  for (const r of rows) byStatus[r.dossier.status]++;

  const outstanding = rows.filter(
    (r): r is DossierWithContext & { acompteDoc: CrmDocument } =>
      r.acompteDoc !== undefined &&
      r.acompteDoc.status !== "paye" &&
      (r.dossier.paymentStatus === "acompte_non_paye" ||
        r.dossier.paymentStatus === "en_attente"),
  );

  const weekFromNow = now + 7 * 24 * 3_600_000;
  const interventionsThisWeek = rows.filter((r) => {
    if (!r.dossier.plannedAt || r.dossier.status === "solde") return false;
    const t = +new Date(r.dossier.plannedAt);
    return t >= now && t <= weekFromNow;
  }).length;

  return {
    byStatus,
    acompteOutstanding: {
      count: outstanding.length,
      amountTtc: outstanding.reduce((s, r) => s + r.acompteDoc.totalTtc, 0),
    },
    interventionsThisWeek,
  };
}

// Surface unpaid-acompte rows for the "Acomptes à encaisser" encart (CDC §4.7).
export function getOutstandingAcomptes(
  rows: DossierWithContext[] = getAllDossiers(),
): DossierWithContext[] {
  return rows.filter(
    (r) =>
      r.acompteDoc &&
      r.acompteDoc.status !== "paye" &&
      r.dossier.paymentStatus !== "solde",
  );
}

// ── Client stats (existing) ───────────────────────────────────────────
export function getClientStats(client: Client): ClientStats {
  if (!client.sourceLeadId) {
    return {
      documents: [],
      caEncaisse: 0,
      caSigne: 0,
      lastActivityAt: client.createdAt,
    };
  }
  const documents = MOCK_DOCUMENTS.filter((d) => d.leadId === client.sourceLeadId).sort(
    (a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt),
  );
  const caEncaisse = documents
    .filter((d) => (d.type === "acompte" || d.type === "finale") && d.status === "paye")
    .reduce((s, d) => s + d.totalTtc, 0);
  const caSigne = documents
    .filter((d) => d.type === "devis" && d.status === "signe")
    .reduce((s, d) => s + d.totalTtc, 0);
  const lastActivityAt = documents.reduce((max, d) => {
    const candidate = d.paidAt ?? d.signedAt ?? d.issuedAt;
    return candidate > max ? candidate : max;
  }, client.createdAt);
  return { documents, caEncaisse, caSigne, lastActivityAt };
}
