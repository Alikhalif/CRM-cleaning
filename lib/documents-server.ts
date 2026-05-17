import "server-only";
import { supabaseServer } from "./supabase/server";
import { mapLead, type LeadRowJoined } from "./leads-server";
import type { DocumentWithContext } from "./documents-shared";
import type {
  CrmDocument,
  DocumentLine,
  DocumentStatus,
  DocumentType,
  Lead,
  LegalEntity,
  LegalForm,
  PaymentTermSlug,
  Prestation,
  Sector,
} from "./leads";
import type { Json } from "./supabase/database.types";

// Re-export the shared types so existing call sites (DocumentView, page routes)
// can keep importing from one place.
export type { DocumentDetail, DocumentWithContext, AccountingKpis } from "./documents-shared";
export { computeAccountingKpis } from "./documents-shared";

type EntityRow = {
  id: string;
  legal_name: string;
  legal_form: LegalForm;
  siret: string;
  ape_code: string;
  vat_number: string;
  address: Json | null;
  contact_email: string | null;
  contact_phone: string | null;
  iban: string;
  bic: string;
  default_vat_rate: number;
  legal_mentions: string | null;
  color: string;
};

type EntityAddressJson = { line1?: string; postal_code?: string; city?: string };

function mapEntity(row: EntityRow): LegalEntity {
  const a = (row.address as EntityAddressJson | null) ?? {};
  return {
    id: row.id,
    legalName: row.legal_name,
    legalForm: row.legal_form,
    siret: row.siret,
    apeCode: row.ape_code,
    vatNumber: row.vat_number,
    addressLine: a.line1 ?? "",
    postalCode: a.postal_code ?? "",
    city: a.city ?? "",
    contactEmail: row.contact_email ?? "",
    contactPhone: row.contact_phone ?? "",
    iban: row.iban,
    bic: row.bic,
    defaultVatRate: Number(row.default_vat_rate),
    legalMentions: row.legal_mentions ?? "",
    color: row.color,
    defaultActivities: [], // not used by DocumentView; skip the extra join
  };
}

type DocumentRowJoined = {
  id: string;
  num: string;
  type: DocumentType;
  status: DocumentStatus;
  lead_id: string | null;
  total_ttc: number;
  issued_at: string;
  signed_at: string | null;
  paid_at: string | null;
  acompte_pct: number | null;
  acompte_amount: number | null;
  entity: EntityRow | null;
  lead: LeadRowJoined | null;
};

function mapDocumentBase(row: DocumentRowJoined): CrmDocument {
  return {
    id: row.id,
    num: row.num,
    type: row.type,
    status: row.status,
    leadId: row.lead_id ?? "",
    totalTtc: Number(row.total_ttc),
    issuedAt: row.issued_at,
    signedAt: row.signed_at ?? undefined,
    paidAt: row.paid_at ?? undefined,
    acomptePct: row.acompte_pct ?? undefined,
    acompteAmount: row.acompte_amount ?? undefined,
  };
}

// Payment term defaults mirror CDC §4.12.3 sector profiles.
const PAYMENT_TERM_BY_SECTOR: Record<Sector, PaymentTermSlug> = {
  urgence: "comptant",
  nettoyage: "30j",
  enr: "30j",
  renovation: "45j",
};

// All documents joined with lead + entity, for the Comptabilité tables.
// Returns DocumentWithContext rows from documents-shared.ts.
export async function getAllDocumentsWithContext(): Promise<DocumentWithContext[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("documents")
    .select(
      `
        id, num, type, status, lead_id, total_ttc, issued_at,
        signed_at, paid_at, acompte_pct, acompte_amount,
        entity:legal_entities(
          id, legal_name, legal_form, siret, ape_code, vat_number,
          address, contact_email, contact_phone, iban, bic,
          default_vat_rate, legal_mentions, color
        ),
        lead:leads(
          id, short_id, is_company,
          client_first_name, client_last_name, client_company,
          client_email, client_phone, client_address,
          estimated_amount, owner_id, status, sub_envoi, sub_signature,
          received_at, last_action_label, last_action_at, next_followup_at,
          is_urgent, is_nrp, nrp_at, lost_reason, immob_travaux_annotation,
          activity:activities(slug),
          source:lead_sources(slug),
          owner:users!leads_owner_id_fkey(id, first_name, last_name, color)
        )
      `,
    )
    .order("issued_at", { ascending: false });

  if (error || !data) return [];

  const rows: DocumentWithContext[] = [];
  for (const row of data as unknown as DocumentRowJoined[]) {
    if (!row.entity || !row.lead) continue;
    const baseDoc = mapDocumentBase(row);
    const uiLead = mapLead(row.lead);
    const uiEntity = mapEntity(row.entity);
    const vatRate = VAT_BY_SECTOR[uiLead.sector];
    const totalHt = Math.round((baseDoc.totalTtc / (1 + vatRate / 100)) * 100) / 100;
    rows.push({ doc: baseDoc, lead: uiLead, entity: uiEntity, totalHt });
  }
  return rows;
}

// Legal entities for the Comptabilité entity-filter dropdown (and any other
// page that needs to enumerate issuing companies).
export async function getAllEntities(): Promise<LegalEntity[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("legal_entities")
    .select(
      `id, legal_name, legal_form, siret, ape_code, vat_number,
       address, contact_email, contact_phone, iban, bic,
       default_vat_rate, legal_mentions, color`,
    )
    .order("legal_name", { ascending: true });
  if (error || !data) return [];
  return (data as EntityRow[]).map(mapEntity);
}

// VAT per sector — the documents table only stores total_ttc, so total_ht is
// derived by stripping the sector's default VAT rate.
const VAT_BY_SECTOR: Record<Sector, number> = {
  urgence: 20,
  nettoyage: 20,
  enr: 10,
  renovation: 10,
};

// Placeholder prestation catalogue used by synthesiseLines() below.
// Goes away when the devis editor (CDC §10 phase 2) starts inserting real
// document_lines rows — at which point getDocumentById reads lines from the
// DB instead of fabricating them.
const FALLBACK_PRESTATIONS: Prestation[] = [
  { id: "pr_pv400",  sector: "enr",        label: "Panneau photovoltaïque 400 Wc",  unit: "unité",   unitPriceHt: 280,  vatRate: 10 },
  { id: "pr_ond5",   sector: "enr",        label: "Onduleur hybride 5 kW",          unit: "unité",   unitPriceHt: 1450, vatRate: 10 },
  { id: "pr_pose",   sector: "enr",        label: "Pose et raccordement (forfait)", unit: "forfait", unitPriceHt: 1800, vatRate: 10 },
  { id: "pr_ite",    sector: "renovation", label: "Isolation murs ITE",             unit: "m²",      unitPriceHt: 95,   vatRate: 10 },
  { id: "pr_toit",   sector: "renovation", label: "Réfection toiture",              unit: "m²",      unitPriceHt: 145,  vatRate: 10 },
  { id: "pr_chemin", sector: "renovation", label: "Pose conduit cheminée",          unit: "forfait", unitPriceHt: 1200, vatRate: 10 },
  { id: "pr_urg",    sector: "urgence",    label: "Intervention dépannage",         unit: "forfait", unitPriceHt: 180,  vatRate: 20 },
  { id: "pr_h",      sector: "urgence",    label: "Heure technicien",               unit: "h",       unitPriceHt: 75,   vatRate: 20 },
  { id: "pr_bur",    sector: "nettoyage",  label: "Entretien bureaux (mensuel)",    unit: "mois",    unitPriceHt: 480,  vatRate: 20 },
  { id: "pr_vit",    sector: "nettoyage",  label: "Nettoyage vitrerie",             unit: "m²",      unitPriceHt: 8,    vatRate: 20 },
];

// Build plausible document lines from a stored doc + lead. For devis: pick
// 1–3 prestations from the right sector and back-fit quantities so the line
// sum approximately matches the document's total_ttc. For acompte/finale:
// emit a single line that references the source devis (how French staged
// invoices typically read).
function synthesiseLines(
  doc: CrmDocument,
  lead: Lead,
  sourceDevisNum: string = "—",
): DocumentLine[] {
  if (doc.type === "acompte") {
    const ratePct = lead.sector === "enr" || lead.sector === "renovation" ? 10 : 20;
    const totalHt = +(doc.totalTtc / (1 + ratePct / 100)).toFixed(2);
    return [{
      id: `${doc.id}_line_1`,
      label: `Acompte ${doc.acomptePct ?? 30}% sur devis ${sourceDevisNum}`,
      quantity: 1,
      unit: "forfait",
      unitPriceHt: totalHt,
      vatRate: ratePct,
      totalHt,
    }];
  }

  if (doc.type === "finale") {
    const ratePct = lead.sector === "enr" || lead.sector === "renovation" ? 10 : 20;
    const totalHt = +(doc.totalTtc / (1 + ratePct / 100)).toFixed(2);
    return [{
      id: `${doc.id}_line_1`,
      label: `Solde après acompte sur devis ${sourceDevisNum}`,
      quantity: 1,
      unit: "forfait",
      unitPriceHt: totalHt,
      vatRate: ratePct,
      totalHt,
    }];
  }

  const sectorPrestations = FALLBACK_PRESTATIONS.filter((p) => p.sector === lead.sector);
  if (sectorPrestations.length === 0) return [];
  const vatRate = sectorPrestations[0].vatRate;
  const targetHt = doc.totalTtc / (1 + vatRate / 100);

  if (targetHt < 600 || lead.sector === "urgence") {
    const presta = sectorPrestations[0];
    const qty = Math.max(1, Math.round(targetHt / presta.unitPriceHt));
    const totalHt = qty * presta.unitPriceHt;
    return [{
      id: `${doc.id}_line_1`,
      prestationId: presta.id,
      label: presta.label,
      quantity: qty,
      unit: presta.unit,
      unitPriceHt: presta.unitPriceHt,
      vatRate: presta.vatRate,
      totalHt,
    }];
  }

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

export async function getDocumentById(id: string) {
  const supabase = await supabaseServer();

  const { data: row, error } = await supabase
    .from("documents")
    .select(
      `
        id, num, type, status, lead_id, total_ttc, issued_at,
        signed_at, paid_at, acompte_pct, acompte_amount,
        entity:legal_entities(
          id, legal_name, legal_form, siret, ape_code, vat_number,
          address, contact_email, contact_phone, iban, bic,
          default_vat_rate, legal_mentions, color
        ),
        lead:leads(
          id, short_id, is_company,
          client_first_name, client_last_name, client_company,
          client_email, client_phone, client_address,
          estimated_amount, owner_id, status, sub_envoi, sub_signature,
          received_at, last_action_label, last_action_at, next_followup_at,
          is_urgent, is_nrp, nrp_at, lost_reason, immob_travaux_annotation,
          activity:activities(slug),
          source:lead_sources(slug),
          owner:users!leads_owner_id_fkey(id, first_name, last_name, color)
        )
      `,
    )
    .eq("id", id)
    .maybeSingle<DocumentRowJoined>();

  if (error || !row || !row.entity || !row.lead) return null;

  const baseDoc = mapDocumentBase(row);
  const uiLead = mapLead(row.lead);
  const uiEntity = mapEntity(row.entity);

  // For acompte/finale, look up the source devis number via a second query.
  let relatedDevisNum: string | undefined;
  if (baseDoc.type !== "devis" && baseDoc.leadId) {
    const { data: srcDevis } = await supabase
      .from("documents")
      .select("num")
      .eq("lead_id", baseDoc.leadId)
      .eq("type", "devis")
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ num: string }>();
    relatedDevisNum = srcDevis?.num ?? undefined;
  }

  const lines = synthesiseLines(baseDoc, uiLead, relatedDevisNum);
  const totalHt = lines.reduce((s, l) => s + l.totalHt, 0);
  const totalVat = lines.reduce((s, l) => s + (l.totalHt * l.vatRate) / 100, 0);

  return {
    doc: {
      ...baseDoc,
      lines,
      totalHt: Math.round(totalHt * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      paymentTermSlug: PAYMENT_TERM_BY_SECTOR[uiLead.sector],
      relatedDevisNum,
    },
    entity: uiEntity,
    lead: uiLead,
  };
}
