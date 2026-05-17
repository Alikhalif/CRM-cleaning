import "server-only";
import { supabaseServer } from "./supabase/server";
import { buildTimeline } from "./leads-shared";
import type {
  Commercial,
  CrmDocument,
  DocumentStatus,
  DocumentType,
  Lead,
  LeadStatus,
  Sector,
  Source,
  SubEnvoi,
  SubSignature,
  TimelineEvent,
} from "./leads";
import type { Json } from "./supabase/database.types";

// Server-side data layer for the lead detail page. Returns the same UI-shaped
// LeadDetail that lib/leads-mock.ts:getLeadDetail returns, so the page can
// swap data sources by changing one import.

export type LeadDetail = {
  lead: Lead;
  owner: Commercial | undefined;
  documents: CrmDocument[];
  timeline: TimelineEvent[];
};

// DB source slugs use snake_case (google_ads); UI uses kebab-case (google-ads).
// The two diverged before the seed was finalised — bridge here until we
// unify on one form.
const SOURCE_DB_TO_UI: Record<string, Source> = {
  google_ads: "google-ads",
  meta_ads: "meta-ads",
  site_web: "site-web",
  telephone: "telephone",
  recommandation: "recommandation",
};

type AddressJson = { line1?: string; postal_code?: string; city?: string };

function parseAddress(raw: Json | null): { address: string; postalCode: string; city: string } {
  const a = (raw as AddressJson | null) ?? {};
  return { address: a.line1 ?? "", postalCode: a.postal_code ?? "", city: a.city ?? "" };
}

type OwnerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  color: string | null;
};

function mapOwner(o: OwnerRow): Commercial {
  const name = `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || "Sans nom";
  const initials =
    ((o.first_name?.[0] ?? "") + (o.last_name?.[0] ?? "")).toUpperCase() || "??";
  return { id: o.id, name, initials, color: o.color ?? "#5b4bcc" };
}

// PostgREST returns embedded joins as objects (one-to-one) or arrays (one-to-many);
// for our nested-belongs-to relations here it's always object-or-null.
// Exported so lib/documents-server.ts can reuse the same join shape.
export type LeadRowJoined = {
  id: string;
  short_id: string;
  is_company: boolean;
  client_first_name: string | null;
  client_last_name: string | null;
  client_company: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: Json | null;
  estimated_amount: number | null;
  owner_id: string | null;
  status: LeadStatus;
  sub_envoi: SubEnvoi | null;
  sub_signature: SubSignature | null;
  received_at: string;
  last_action_label: string | null;
  last_action_at: string | null;
  next_followup_at: string | null;
  is_urgent: boolean;
  is_nrp: boolean;
  nrp_at: string | null;
  lost_reason: string | null;
  immob_travaux_annotation: string | null;
  activity: { slug: string } | null;
  source: { slug: string } | null;
  owner: OwnerRow | null;
};

export function mapLead(row: LeadRowJoined): Lead {
  const { address, postalCode, city } = parseAddress(row.client_address);
  const displayName = row.is_company
    ? row.client_company ?? "—"
    : `${row.client_first_name ?? ""} ${row.client_last_name ?? ""}`.trim();
  return {
    id: row.id,
    shortId: row.short_id,
    client: displayName || "Sans nom",
    isCompany: row.is_company,
    firstName: row.client_first_name ?? undefined,
    lastName: row.client_last_name ?? undefined,
    company: row.client_company ?? undefined,
    email: row.client_email ?? "",
    phone: row.client_phone ?? "",
    address,
    postalCode,
    city,
    sector: (row.activity?.slug ?? "nettoyage") as Sector,
    source: SOURCE_DB_TO_UI[row.source?.slug ?? ""] ?? "google-ads",
    amount: row.estimated_amount ?? 0,
    ownerId: row.owner_id ?? "",
    status: row.status,
    subEnvoi: row.sub_envoi,
    subSignature: row.sub_signature,
    receivedAt: row.received_at,
    lastActionLabel: row.last_action_label ?? "",
    lastActionAt: row.last_action_at ?? row.received_at,
    nextFollowupAt: row.next_followup_at ?? undefined,
    isUrgent: row.is_urgent || undefined,
    isNrp: row.is_nrp,
    nrpAt: row.nrp_at ?? undefined,
    lostReason: row.lost_reason ?? undefined,
    immobTravauxAnnotation: row.immob_travaux_annotation ?? undefined,
  };
}

type DocumentRow = {
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

function mapDocument(row: DocumentRow): CrmDocument {
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// All leads, ordered by most recent activity. Used by the /leads list page.
// Client-side filter/sort/search still happens in LeadsTable — for 16 leads
// that's free. Once volumes grow past ~1k rows we'll want server-side
// pagination + filter pushdown.
export async function getAllLeads(): Promise<Lead[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("leads")
    .select(
      `
        id, short_id, is_company,
        client_first_name, client_last_name, client_company,
        client_email, client_phone, client_address,
        estimated_amount, owner_id, status, sub_envoi, sub_signature,
        received_at, last_action_label, last_action_at, next_followup_at,
        is_urgent, is_nrp, nrp_at, lost_reason, immob_travaux_annotation,
        activity:activities(slug),
        source:lead_sources(slug),
        owner:users!leads_owner_id_fkey(id, first_name, last_name, color)
      `,
    )
    .order("last_action_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return (data as unknown as LeadRowJoined[]).map(mapLead);
}

// All commerciaux for the filter dropdown + owner avatars. Until Supabase
// Auth is wired and users have rows, this returns an empty list and the
// dropdown collapses to just "Tous les commerciaux" — which is what we want.
export async function getAllCommerciaux(): Promise<Commercial[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, color")
    .eq("is_active", true)
    .order("first_name", { ascending: true });

  if (error || !data) return [];
  return (data as OwnerRow[]).map(mapOwner);
}

export async function getLeadDetail(idOrShortId: string): Promise<LeadDetail | null> {
  const supabase = await supabaseServer();

  // Friendly URLs: accept both UUIDs and short_ids like "L-1035".
  const filter = UUID.test(idOrShortId)
    ? { id: idOrShortId }
    : { short_id: idOrShortId };

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select(
      `
        id, short_id, is_company,
        client_first_name, client_last_name, client_company,
        client_email, client_phone, client_address,
        estimated_amount, owner_id, status, sub_envoi, sub_signature,
        received_at, last_action_label, last_action_at, next_followup_at,
        is_urgent, is_nrp, nrp_at, lost_reason, immob_travaux_annotation,
        activity:activities(slug),
        source:lead_sources(slug),
        owner:users!leads_owner_id_fkey(id, first_name, last_name, color)
      `,
    )
    .match(filter)
    .maybeSingle<LeadRowJoined>();

  if (leadErr || !lead) return null;

  const { data: docs } = await supabase
    .from("documents")
    .select(
      "id, num, type, status, lead_id, total_ttc, issued_at, signed_at, paid_at, acompte_pct, acompte_amount",
    )
    .eq("lead_id", lead.id)
    .order("issued_at", { ascending: false });

  const uiLead = mapLead(lead);
  const uiDocs = (docs ?? []).map((d) => mapDocument(d as DocumentRow));
  const owner = lead.owner ? mapOwner(lead.owner) : undefined;
  const timeline = buildTimeline(uiLead, uiDocs);

  return { lead: uiLead, owner, documents: uiDocs, timeline };
}
