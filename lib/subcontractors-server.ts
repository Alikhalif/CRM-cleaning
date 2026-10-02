import "server-only";
import { supabaseServer } from "./supabase/server";
import { supabaseServiceRole } from "./supabase/service";
import {
  computeConformity, type Conformity, type SubcontractorDocType, type InvoiceStatus,
  type TimelineEvent, DOC_TYPE_LABEL, INVOICE_STATUS_LABEL,
} from "./subcontractors-shared";

// Couche données du module SOUS-TRAITANTS. Lectures seules sur les modules
// sources (dossiers, leads, documents, lead_media) — AUCUNE écriture hors des
// tables du module. RLS : réservé admin + planificatrice.

export const SUBCO_BUCKET = "subcontractor-documents";
const SIGNED_TTL = 3600; // 60 min (CDC §8)

export type SubcoIdentity = {
  technicianId: string;
  name: string; initials: string; color: string;
  email?: string; basePostalCode?: string; serviceDepartments: string[];
  sectors: string[]; isActive: boolean;
  raisonSociale?: string; nomCommercial?: string; dirigeant?: string;
  siret?: string; siren?: string; adresse?: string; cpVille?: string; phone?: string; notes?: string;
};

export type SubcoDocument = {
  id: string; docType: SubcontractorDocType; docTypeLabel: string; title: string;
  fileName?: string; url?: string;
  issuedDate?: string; startDate?: string; endDate?: string;
  insurer?: string; contractNumber?: string; activities?: string;
  version: number; isCurrent: boolean; status?: string; notes?: string; createdAt: string;
};

export type SubcoInvoice = {
  id: string; numero?: string; invoiceDate?: string; receivedAt?: string;
  amountHt?: number; vatAmount?: number; amountTtc?: number;
  status: InvoiceStatus; statusLabel: string; paidAt?: string;
  fileName?: string; url?: string; notes?: string;
  dossierId?: string; interventionLabel?: string; createdAt: string;
};

export type SubcoIntervention = {
  dossierId: string; leadId: string; shortId?: string;
  clientName?: string; city?: string; status: string;
  plannedAt?: string; realizedAt?: string;
  devisNum?: string; finaleNum?: string; mediaCount: number;
  invoice?: { id: string; numero?: string; amountTtc?: number; status: InvoiceStatus };
};

export type SubcoOverviewRow = {
  identity: SubcoIdentity; conformity: Conformity;
  interventionsCount: number; invoicesCount: number; outstandingCount: number; outstandingTtc: number;
};

export type SubcoDetail = {
  identity: SubcoIdentity; conformity: Conformity;
  documents: SubcoDocument[]; interventions: SubcoIntervention[];
  invoices: SubcoInvoice[]; timeline: TimelineEvent[];
};

type TechRow = {
  id: string; name: string; initials: string; color: string | null;
  sectors: string[] | null; email: string | null;
  base_postal_code: string | null; service_departments: string[] | null; is_active: boolean;
};
type ProfileRow = {
  technician_id: string; raison_sociale: string | null; nom_commercial: string | null;
  dirigeant: string | null; siret: string | null; siren: string | null;
  adresse: string | null; cp_ville: string | null; phone: string | null; notes: string | null;
};
type DocRow = {
  id: string; technician_id: string; doc_type: SubcontractorDocType; title: string;
  storage_path: string | null; file_name: string | null; issued_date: string | null;
  start_date: string | null; end_date: string | null; insurer: string | null;
  contract_number: string | null; activities: string | null; version: number;
  is_current: boolean; status: string | null; notes: string | null; created_at: string;
};
type InvRow = {
  id: string; technician_id: string; dossier_id: string | null; numero: string | null;
  invoice_date: string | null; received_at: string | null; amount_ht: number | null;
  vat_amount: number | null; amount_ttc: number | null; status: InvoiceStatus;
  paid_at: string | null; storage_path: string | null; file_name: string | null;
  notes: string | null; created_at: string;
};

async function loadSectorMap(): Promise<Map<string, string>> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("activities").select("id, slug").returns<{ id: string; slug: string }[]>();
  return new Map((data ?? []).map((r) => [r.id, r.slug]));
}

function mapIdentity(t: TechRow, p: ProfileRow | undefined, sectorMap: Map<string, string>): SubcoIdentity {
  return {
    technicianId: t.id, name: t.name, initials: t.initials, color: t.color ?? "#5b4bcc",
    email: t.email ?? undefined, basePostalCode: t.base_postal_code ?? undefined,
    serviceDepartments: t.service_departments ?? [],
    sectors: (t.sectors ?? []).map((id) => sectorMap.get(id)).filter((s): s is string => !!s),
    isActive: t.is_active,
    raisonSociale: p?.raison_sociale ?? undefined, nomCommercial: p?.nom_commercial ?? undefined,
    dirigeant: p?.dirigeant ?? undefined, siret: p?.siret ?? undefined, siren: p?.siren ?? undefined,
    adresse: p?.adresse ?? undefined, cpVille: p?.cp_ville ?? undefined,
    phone: p?.phone ?? undefined, notes: p?.notes ?? undefined,
  };
}

// ── Vue liste : tous les sous-traitants + conformité + compteurs ────────────
export async function getSubcontractorsOverview(): Promise<SubcoOverviewRow[]> {
  const supabase = await supabaseServer();
  const [techRes, profRes, docRes, dosRes, invRes, sectorMap] = await Promise.all([
    supabase.from("technicians").select("id, name, initials, color, sectors, email, base_postal_code, service_departments, is_active").order("name").returns<TechRow[]>(),
    supabase.from("subcontractor_profiles").select("technician_id, raison_sociale, nom_commercial, dirigeant, siret, siren, adresse, cp_ville, phone, notes").returns<ProfileRow[]>(),
    supabase.from("subcontractor_documents").select("technician_id, doc_type, end_date, status").is("deleted_at", null).eq("is_current", true).returns<{ technician_id: string; doc_type: SubcontractorDocType; end_date: string | null; status: string | null }[]>(),
    supabase.from("dossiers").select("technician_id").returns<{ technician_id: string | null }[]>(),
    supabase.from("subcontractor_invoices").select("technician_id, status, amount_ttc").is("deleted_at", null).returns<{ technician_id: string; status: InvoiceStatus; amount_ttc: number | null }[]>(),
    loadSectorMap(),
  ]);

  const profByTech = new Map((profRes.data ?? []).map((p) => [p.technician_id, p]));
  const docsByTech = new Map<string, { docType: SubcontractorDocType; endDate: string | null; status: string | null }[]>();
  for (const d of docRes.data ?? []) {
    const arr = docsByTech.get(d.technician_id) ?? [];
    arr.push({ docType: d.doc_type, endDate: d.end_date, status: d.status });
    docsByTech.set(d.technician_id, arr);
  }
  const intCount = new Map<string, number>();
  for (const d of dosRes.data ?? []) if (d.technician_id) intCount.set(d.technician_id, (intCount.get(d.technician_id) ?? 0) + 1);
  const invCount = new Map<string, number>();
  const outCount = new Map<string, number>();
  const outTtc = new Map<string, number>();
  for (const i of invRes.data ?? []) {
    invCount.set(i.technician_id, (invCount.get(i.technician_id) ?? 0) + 1);
    if (i.status !== "reglee") {
      outCount.set(i.technician_id, (outCount.get(i.technician_id) ?? 0) + 1);
      outTtc.set(i.technician_id, (outTtc.get(i.technician_id) ?? 0) + Number(i.amount_ttc ?? 0));
    }
  }

  return (techRes.data ?? []).map((t) => ({
    identity: mapIdentity(t, profByTech.get(t.id), sectorMap),
    conformity: computeConformity(docsByTech.get(t.id) ?? []),
    interventionsCount: intCount.get(t.id) ?? 0,
    invoicesCount: invCount.get(t.id) ?? 0,
    outstandingCount: outCount.get(t.id) ?? 0,
    outstandingTtc: outTtc.get(t.id) ?? 0,
  }));
}

// ── Fiche détaillée d'un sous-traitant ──────────────────────────────────────
export async function getSubcontractorDetail(technicianId: string): Promise<SubcoDetail | null> {
  const supabase = await supabaseServer();
  const admin = await supabaseServiceRole();

  const [techRes, profRes, docRes, invRes, dosRes, sectorMap] = await Promise.all([
    supabase.from("technicians").select("id, name, initials, color, sectors, email, base_postal_code, service_departments, is_active").eq("id", technicianId).maybeSingle<TechRow>(),
    supabase.from("subcontractor_profiles").select("technician_id, raison_sociale, nom_commercial, dirigeant, siret, siren, adresse, cp_ville, phone, notes").eq("technician_id", technicianId).maybeSingle<ProfileRow>(),
    supabase.from("subcontractor_documents").select("id, technician_id, doc_type, title, storage_path, file_name, issued_date, start_date, end_date, insurer, contract_number, activities, version, is_current, status, notes, created_at").eq("technician_id", technicianId).is("deleted_at", null).order("created_at", { ascending: false }).returns<DocRow[]>(),
    supabase.from("subcontractor_invoices").select("id, technician_id, dossier_id, numero, invoice_date, received_at, amount_ht, vat_amount, amount_ttc, status, paid_at, storage_path, file_name, notes, created_at").eq("technician_id", technicianId).is("deleted_at", null).order("received_at", { ascending: false }).returns<InvRow[]>(),
    supabase.from("dossiers").select("id, lead_id, status, planned_at, realized_at, quote_document_id, lead:leads(short_id, is_company, client_first_name, client_last_name, client_company, client_address)").eq("technician_id", technicianId).order("planned_at", { ascending: false }).returns<DossierJoin[]>(),
    loadSectorMap(),
  ]);

  if (!techRes.data) return null;

  // URLs signées (bucket privé) pour documents + factures, en un lot.
  const paths = [
    ...(docRes.data ?? []).map((d) => d.storage_path).filter((p): p is string => !!p),
    ...(invRes.data ?? []).map((i) => i.storage_path).filter((p): p is string => !!p),
  ];
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await admin.storage.from(SUBCO_BUCKET).createSignedUrls(paths, SIGNED_TTL);
    for (const s of signed ?? []) if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  const documents: SubcoDocument[] = (docRes.data ?? []).map((d) => ({
    id: d.id, docType: d.doc_type, docTypeLabel: DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type, title: d.title,
    fileName: d.file_name ?? undefined, url: d.storage_path ? urlByPath.get(d.storage_path) : undefined,
    issuedDate: d.issued_date ?? undefined, startDate: d.start_date ?? undefined, endDate: d.end_date ?? undefined,
    insurer: d.insurer ?? undefined, contractNumber: d.contract_number ?? undefined, activities: d.activities ?? undefined,
    version: d.version, isCurrent: d.is_current, status: d.status ?? undefined, notes: d.notes ?? undefined, createdAt: d.created_at,
  }));

  // Interventions (lecture seule depuis dossiers) + docs client + médias + facture rattachée.
  const dossiers = dosRes.data ?? [];
  const leadIds = [...new Set(dossiers.map((d) => d.lead_id).filter(Boolean))];
  const docsByLead = new Map<string, { type: string; num: string }[]>();
  const mediaByLead = new Map<string, number>();
  if (leadIds.length > 0) {
    const [{ data: cdocs }, { data: media }] = await Promise.all([
      supabase.from("documents").select("lead_id, type, num").in("lead_id", leadIds).returns<{ lead_id: string; type: string; num: string }[]>(),
      supabase.from("lead_media").select("lead_id").in("lead_id", leadIds).is("deleted_at", null).returns<{ lead_id: string }[]>(),
    ]);
    for (const c of cdocs ?? []) { const a = docsByLead.get(c.lead_id) ?? []; a.push({ type: c.type, num: c.num }); docsByLead.set(c.lead_id, a); }
    for (const m of media ?? []) mediaByLead.set(m.lead_id, (mediaByLead.get(m.lead_id) ?? 0) + 1);
  }
  const invByDossier = new Map<string, InvRow>();
  for (const i of invRes.data ?? []) if (i.dossier_id) invByDossier.set(i.dossier_id, i);

  const interventions: SubcoIntervention[] = dossiers.map((d) => {
    const lead = Array.isArray(d.lead) ? d.lead[0] : d.lead;
    const clientName = lead ? (lead.is_company && lead.client_company ? lead.client_company
      : [lead.client_first_name, lead.client_last_name].filter(Boolean).join(" ") || undefined) : undefined;
    const city = lead?.client_address && typeof lead.client_address === "object" ? (lead.client_address as { city?: string }).city : undefined;
    const cdocs = docsByLead.get(d.lead_id) ?? [];
    const inv = invByDossier.get(d.id);
    return {
      dossierId: d.id, leadId: d.lead_id, shortId: lead?.short_id ?? undefined,
      clientName, city, status: d.status,
      plannedAt: d.planned_at ?? undefined, realizedAt: d.realized_at ?? undefined,
      devisNum: cdocs.find((x) => x.type === "devis")?.num, finaleNum: cdocs.find((x) => x.type === "finale")?.num,
      mediaCount: mediaByLead.get(d.lead_id) ?? 0,
      invoice: inv ? { id: inv.id, numero: inv.numero ?? undefined, amountTtc: inv.amount_ttc != null ? Number(inv.amount_ttc) : undefined, status: inv.status } : undefined,
    };
  });

  const dossierLabel = new Map(interventions.map((it) => [it.dossierId, it.shortId ? `Dossier ${it.shortId}` : "Intervention"]));
  const invoices: SubcoInvoice[] = (invRes.data ?? []).map((i) => ({
    id: i.id, numero: i.numero ?? undefined, invoiceDate: i.invoice_date ?? undefined, receivedAt: i.received_at ?? undefined,
    amountHt: i.amount_ht != null ? Number(i.amount_ht) : undefined, vatAmount: i.vat_amount != null ? Number(i.vat_amount) : undefined,
    amountTtc: i.amount_ttc != null ? Number(i.amount_ttc) : undefined,
    status: i.status, statusLabel: INVOICE_STATUS_LABEL[i.status] ?? i.status, paidAt: i.paid_at ?? undefined,
    fileName: i.file_name ?? undefined, url: i.storage_path ? urlByPath.get(i.storage_path) : undefined,
    notes: i.notes ?? undefined, dossierId: i.dossier_id ?? undefined,
    interventionLabel: i.dossier_id ? dossierLabel.get(i.dossier_id) : undefined, createdAt: i.created_at,
  }));

  // Timeline (événements disponibles, sans modifier les autres modules).
  const timeline: TimelineEvent[] = [];
  for (const it of interventions) {
    if (it.plannedAt) timeline.push({ at: it.plannedAt, kind: "intervention", label: `Intervention planifiée${it.shortId ? ` — ${it.shortId}` : ""}` });
    if (it.realizedAt) timeline.push({ at: it.realizedAt, kind: "intervention", label: `Intervention réalisée${it.shortId ? ` — ${it.shortId}` : ""}` });
  }
  for (const d of documents) timeline.push({ at: d.createdAt, kind: "document", label: `${d.docTypeLabel} ajouté` });
  for (const i of invRes.data ?? []) {
    if (i.received_at) timeline.push({ at: i.received_at, kind: "facture", label: `Facture reçue${i.numero ? ` ${i.numero}` : ""}` });
    if (i.paid_at) timeline.push({ at: i.paid_at, kind: "facture", label: `Facture réglée${i.numero ? ` ${i.numero}` : ""}` });
  }
  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const currentDocs = documents.filter((d) => d.isCurrent).map((d) => ({ docType: d.docType, endDate: d.endDate, status: d.status }));

  return {
    identity: mapIdentity(techRes.data, profRes.data ?? undefined, sectorMap),
    conformity: computeConformity(currentDocs),
    documents, interventions, invoices, timeline,
  };
}

type DossierJoin = {
  id: string; lead_id: string; status: string; planned_at: string | null; realized_at: string | null;
  quote_document_id: string | null;
  lead: { short_id: string | null; is_company: boolean | null; client_first_name: string | null;
    client_last_name: string | null; client_company: string | null; client_address: unknown } | { short_id: string | null; is_company: boolean | null; client_first_name: string | null; client_last_name: string | null; client_company: string | null; client_address: unknown }[] | null;
};
