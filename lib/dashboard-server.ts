import "server-only";
import { supabaseServer } from "./supabase/server";
import {
  buildDailySeriesFromRows,
  type DailyMetric,
  type RawDoc,
  type RawLead,
} from "./dashboard";
import type { Sector } from "./leads";
import { currentUserHasImmobTravaux } from "./leads-server";

// Fetches raw leads + documents from Supabase and buckets them into the
// DailyMetric[] shape the Dashboard's existing aggregators consume.
// owner_id and source slug flow all the way through so per-commercial
// rankings and the phone/form acquisition split read from real data.

type LeadRow = {
  received_at: string;
  status: string;
  sub_envoi: "mano" | "auto" | null;
  estimated_amount: number | null;
  owner_id: string | null;
  activity: { slug: string } | null;
  source: { slug: string } | null;
};

type DocRow = {
  type: "devis" | "acompte" | "finale";
  status: string;
  issued_at: string;
  signed_at: string | null;
  paid_at: string | null;
  total_ttc: number;
  lead: {
    owner_id: string | null;
    sub_envoi: "mano" | "auto" | null;
    activity: { slug: string } | null;
  } | null;
};

export async function getDashboardSeries(): Promise<DailyMetric[]> {
  const supabase = await supabaseServer();

  const [leadsRes, docsRes] = await Promise.all([
    supabase
      .from("leads")
      .select(
        `received_at, status, sub_envoi, estimated_amount, owner_id,
         activity:activities(slug),
         source:lead_sources(slug)`,
      )
      .returns<LeadRow[]>(),
    supabase
      .from("documents")
      .select(
        `type, status, issued_at, signed_at, paid_at, total_ttc,
         lead:leads(owner_id, sub_envoi, activity:activities(slug))`,
      )
      .returns<DocRow[]>(),
  ]);

  const leads: RawLead[] = (leadsRes.data ?? [])
    .filter((l): l is LeadRow & { activity: { slug: string } } => l.activity !== null)
    .map((l) => ({
      receivedAt: l.received_at,
      sector: l.activity.slug as Sector,
      channel: l.sub_envoi,
      ownerId: l.owner_id,
      status: l.status,
      amount: Number(l.estimated_amount ?? 0),
      sourceKind: l.source?.slug === "telephone" ? "phone" : "form",
    }));

  const docs: RawDoc[] = (docsRes.data ?? [])
    .filter(
      (d): d is DocRow & { lead: { owner_id: string | null; sub_envoi: "mano" | "auto" | null; activity: { slug: string } } } =>
        d.lead?.activity != null,
    )
    .map((d) => ({
      type: d.type,
      status: d.status,
      issuedAt: d.issued_at,
      signedAt: d.signed_at,
      paidAt: d.paid_at,
      totalTtc: Number(d.total_ttc),
      sector: d.lead.activity.slug as Sector,
      channel: d.lead.sub_envoi,
      ownerId: d.lead.owner_id,
    }));

  return buildDailySeriesFromRows(leads, docs);
}

// ── Immobilier / Travaux annotations (CDC §3.5 — admin-only) ──────────
export type ImmobAnnotation = {
  leadId: string;
  shortId: string;
  client: string;
  segment: "immobilier" | "travaux" | "les_deux" | null;
  annotation: string;
  ownerName: string | null;
  ownerInitials: string | null;
  ownerColor: string | null;
  sectorSlug: Sector | null;
  amount: number;
  createdAt: string;
};

type AnnotRow = {
  id: string;
  short_id: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_company: string | null;
  is_company: boolean;
  immob_travaux_annotation: string | null;
  annotation_segment: string | null;
  estimated_amount: number | null;
  received_at: string;
  activity: { slug: string } | null;
  owner: { first_name: string | null; last_name: string | null; color: string | null } | null;
};

export async function getImmobAnnotations(): Promise<ImmobAnnotation[]> {
  // Confidentiel (CDC §3.5) : ne rien renvoyer sans la permission immob_travaux
  // (ni admin). Sinon un planificateur récupérait jusqu'à 50 annotations.
  if (!(await currentUserHasImmobTravaux())) return [];
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("leads")
    .select(
      `id, short_id, client_first_name, client_last_name, client_company, is_company,
       immob_travaux_annotation, annotation_segment, estimated_amount, received_at,
       activity:activities(slug),
       owner:users(first_name, last_name, color)`,
    )
    .not("immob_travaux_annotation", "is", null)
    .order("received_at", { ascending: false })
    .limit(50);

  // The .not() filter narrows postgrest's generic to `never`; cast at the
  // SDK boundary (same pattern used by leads-server.ts elsewhere). The
  // typed shape is captured by AnnotRow above.
  const rows = (data as AnnotRow[] | null) ?? [];

  return rows.map((r) => {
    const composed = r.is_company
      ? (r.client_company ?? "")
      : `${r.client_first_name ?? ""} ${r.client_last_name ?? ""}`.trim();
    const ownerFirst = r.owner?.first_name ?? "";
    const ownerLast = r.owner?.last_name ?? "";
    const ownerName = `${ownerFirst} ${ownerLast}`.trim() || null;
    const initials = ownerName ? ((ownerFirst[0] ?? "") + (ownerLast[0] ?? "")).toUpperCase() : null;
    const seg = r.annotation_segment;
    const normalisedSeg: ImmobAnnotation["segment"] =
      seg === "immobilier" || seg === "travaux" || seg === "les_deux" ? seg : null;
    return {
      leadId: r.id,
      shortId: r.short_id,
      client: composed || "Sans nom",
      segment: normalisedSeg,
      annotation: r.immob_travaux_annotation ?? "",
      ownerName,
      ownerInitials: initials,
      ownerColor: r.owner?.color ?? null,
      sectorSlug: (r.activity?.slug as Sector) ?? null,
      amount: Number(r.estimated_amount ?? 0),
      createdAt: r.received_at,
    };
  });
}
