import "server-only";
import { supabaseServer } from "./supabase/server";
import {
  buildDailySeriesFromRows,
  type DailyMetric,
  type RawDoc,
  type RawLead,
} from "./dashboard";
import type { Sector } from "./leads";

// Fetches raw leads + documents from Supabase and buckets them into the
// DailyMetric[] shape the Dashboard's existing aggregators already consume.
// owner_id flows all the way through so topCommerciaux can rank by actual
// commercial instead of fake-distributing team totals.

type LeadRow = {
  received_at: string;
  status: string;
  sub_envoi: "mano" | "auto" | null;
  estimated_amount: number | null;
  owner_id: string | null;
  activity: { slug: string } | null;
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
         activity:activities(slug)`,
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
