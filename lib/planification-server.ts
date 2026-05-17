import "server-only";
import { supabaseServer } from "./supabase/server";
import { mapLead, type LeadRowJoined } from "./leads-server";
import type { DossierWithContext } from "./dossiers-shared";
import type {
  CrmDocument,
  Dossier,
  DossierFlag,
  DossierStatus,
  DocumentStatus,
  DocumentType,
  PaymentStatus,
  Sector,
  Technician,
} from "./leads";

export type { DossierWithContext } from "./dossiers-shared";
export { computePlanificationKpis, getOutstandingAcomptes } from "./dossiers-shared";
export type { PlanificationKpis } from "./dossiers-shared";

type DossierRow = {
  id: string;
  lead_id: string;
  status: DossierStatus;
  payment_status: PaymentStatus;
  technician_id: string | null;
  planned_at: string | null;
  duration_hours: number | null;
  notes: string | null;
  flags: DossierFlag[];
  created_at: string;
  updated_at: string;
  lead: LeadRowJoined | null;
  technician: TechnicianRow | null;
};

type TechnicianRow = {
  id: string;
  name: string;
  initials: string;
  color: string | null;
  sectors: string[] | null;
};

type DocRow = {
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
};

function mapTechnician(row: TechnicianRow, sectorMap: Map<string, Sector>): Technician {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    color: row.color ?? "#5b4bcc",
    sectors: (row.sectors ?? [])
      .map((id) => sectorMap.get(id))
      .filter((s): s is Sector => s !== undefined),
  };
}

function mapDoc(row: DocRow): CrmDocument {
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

function mapDossier(row: DossierRow): Dossier {
  return {
    id: row.id,
    leadId: row.lead_id,
    status: row.status,
    paymentStatus: row.payment_status,
    technicianId: row.technician_id ?? undefined,
    plannedAt: row.planned_at ?? undefined,
    durationHours: row.duration_hours ?? undefined,
    notes: row.notes ?? undefined,
    flags: row.flags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadSectorMap(): Promise<Map<string, Sector>> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("activities")
    .select("id, slug")
    .returns<{ id: string; slug: Sector }[]>();
  return new Map((data ?? []).map((r) => [r.id, r.slug]));
}

const LEAD_SELECT =
  `id, short_id, is_company,
   client_first_name, client_last_name, client_company,
   client_email, client_phone, client_address,
   estimated_amount, owner_id, status, sub_envoi, sub_signature,
   received_at, last_action_label, last_action_at, next_followup_at,
   is_urgent, is_nrp, nrp_at, lost_reason, immob_travaux_annotation,
   activity:activities(slug),
   source:lead_sources(slug),
   owner:users!leads_owner_id_fkey(id, first_name, last_name, color)`;

const DOC_SELECT =
  "id, num, type, status, lead_id, total_ttc, issued_at, " +
  "signed_at, paid_at, acompte_pct, acompte_amount";

// All dossiers joined with lead + technician, with related docs batched
// in a second query (we'd need a heavy nested select otherwise — a single
// `lead_id IN (...)` filter is cheaper).
export async function getAllDossiers(): Promise<DossierWithContext[]> {
  const supabase = await supabaseServer();

  const [dossiersRes, sectorMap] = await Promise.all([
    supabase
      .from("dossiers")
      .select(
        `
          id, lead_id, status, payment_status, technician_id, planned_at,
          duration_hours, notes, flags, created_at, updated_at,
          lead:leads(${LEAD_SELECT}),
          technician:technicians(id, name, initials, color, sectors)
        `,
      )
      .order("updated_at", { ascending: false })
      .returns<DossierRow[]>(),
    loadSectorMap(),
  ]);

  if (dossiersRes.error || !dossiersRes.data) return [];

  const dossierRows = dossiersRes.data;
  const leadIds = Array.from(
    new Set(dossierRows.map((d) => d.lead_id).filter((x): x is string => Boolean(x))),
  );

  const docsByLead = new Map<string, CrmDocument[]>();
  if (leadIds.length > 0) {
    const { data: docsData } = await supabase
      .from("documents")
      .select(DOC_SELECT)
      .in("lead_id", leadIds)
      .returns<DocRow[]>();
    for (const row of docsData ?? []) {
      const doc = mapDoc(row);
      const arr = docsByLead.get(doc.leadId) ?? [];
      arr.push(doc);
      docsByLead.set(doc.leadId, arr);
    }
  }

  const out: DossierWithContext[] = [];
  for (const row of dossierRows) {
    if (!row.lead) continue;
    const docs = docsByLead.get(row.lead_id) ?? [];
    out.push({
      dossier: mapDossier(row),
      lead: mapLead(row.lead),
      technician: row.technician ? mapTechnician(row.technician, sectorMap) : undefined,
      devisDoc: docs.find((d) => d.type === "devis"),
      acompteDoc: docs.find((d) => d.type === "acompte"),
      finaleDoc: docs.find((d) => d.type === "finale"),
    });
  }
  return out;
}

export async function getAllTechnicians(): Promise<Technician[]> {
  const supabase = await supabaseServer();
  const [techRes, sectorMap] = await Promise.all([
    supabase
      .from("technicians")
      .select("id, name, initials, color, sectors")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<TechnicianRow[]>(),
    loadSectorMap(),
  ]);
  if (techRes.error || !techRes.data) return [];
  return techRes.data.map((t) => mapTechnician(t, sectorMap));
}
