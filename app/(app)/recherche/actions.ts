"use server";

import { supabaseServer } from "@/lib/supabase/server";
import type { Sector } from "@/lib/leads";

// Global search (CDC §12): find a record by phone, name, prénom, email,
// address, ville, or numéro de dossier. RLS-scoped — a commercial searches
// only their own leads; admins search everything.

export type SearchLead = {
  id: string;
  shortId: string;
  client: string;
  phone: string;
  city: string;
  sector: Sector;
};

export type SearchDoc = { id: string; num: string; type: string; leadId: string };

export type SearchResults = { leads: SearchLead[]; documents: SearchDoc[] };

type LeadRow = {
  id: string;
  short_id: string;
  is_company: boolean;
  client_first_name: string | null;
  client_last_name: string | null;
  client_company: string | null;
  client_phone: string | null;
  client_address: { city?: string } | null;
  activity: { slug: string } | null;
};

export async function globalSearch(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return { leads: [], documents: [] };

  const supabase = await supabaseServer();
  const star = `*${q}*`;
  const like = `%${q}%`;

  const [leadsRes, docsRes] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, short_id, is_company, client_first_name, client_last_name, client_company, " +
        "client_phone, client_address, activity:activities(slug)",
      )
      .or(
        `client_first_name.ilike.${star},client_last_name.ilike.${star},` +
        `client_company.ilike.${star},client_email.ilike.${star},` +
        `client_phone.ilike.${star},short_id.ilike.${star},` +
        `client_address->>city.ilike.${star}`,
      )
      .order("received_at", { ascending: false })
      .limit(25)
      .returns<LeadRow[]>(),
    supabase
      .from("documents")
      .select("id, num, type, lead_id")
      .ilike("num", like)
      .limit(25)
      .returns<{ id: string; num: string; type: string; lead_id: string | null }[]>(),
  ]);

  const leads: SearchLead[] = (leadsRes.data ?? []).map((r) => ({
    id: r.id,
    shortId: r.short_id,
    client: r.is_company
      ? (r.client_company ?? "—")
      : `${r.client_first_name ?? ""} ${r.client_last_name ?? ""}`.trim() || "Sans nom",
    phone: r.client_phone ?? "",
    city: r.client_address?.city ?? "",
    sector: (r.activity?.slug ?? "nettoyage") as Sector,
  }));

  const documents: SearchDoc[] = (docsRes.data ?? [])
    .filter((d) => d.lead_id)
    .map((d) => ({ id: d.id, num: d.num, type: d.type, leadId: d.lead_id as string }));

  return { leads, documents };
}
