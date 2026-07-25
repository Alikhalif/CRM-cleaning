import "server-only";
import { supabaseServer } from "./supabase/server";
import type { Country } from "./leads";

// Data layer for the admin "Landing Pages" settings page. RLS restricts writes
// to admins; reads are open to authenticated users.

export type LandingPageRow = {
  id: string;
  token: string;
  name: string;
  country: Country | null;
  entityId: string | null;
  entityName: string | null;
  activityId: string | null;
  activityLabel: string | null;
  sourceId: string | null;
  sourceLabel: string | null;
  isActive: boolean;
};

export type LpOptions = {
  entities: { id: string; name: string }[];
  activities: { id: string; label: string }[];
  sources: { id: string; label: string }[];
};

type LpJoined = {
  id: string;
  token: string;
  name: string;
  country: string | null;
  entity_id: string | null;
  activity_id: string | null;
  source_id: string | null;
  is_active: boolean;
  entity: { legal_name: string } | null;
  activity: { label: string } | null;
  source: { label: string } | null;
};

export async function getLandingPages(): Promise<LandingPageRow[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("landing_pages")
    .select(
      "id, token, name, country, entity_id, activity_id, source_id, is_active, " +
      "entity:legal_entities(legal_name), activity:activities(label), source:lead_sources(label)",
    )
    .order("name", { ascending: true })
    .returns<LpJoined[]>();
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    token: r.token,
    name: r.name,
    country: (r.country ?? null) as Country | null,
    entityId: r.entity_id,
    entityName: r.entity?.legal_name ?? null,
    activityId: r.activity_id,
    activityLabel: r.activity?.label ?? null,
    sourceId: r.source_id,
    sourceLabel: r.source?.label ?? null,
    isActive: r.is_active,
  }));
}

export async function getLpOptions(): Promise<LpOptions> {
  const supabase = await supabaseServer();
  const [ent, act, src] = await Promise.all([
    supabase.from("legal_entities").select("id, legal_name").order("legal_name").returns<{ id: string; legal_name: string }[]>(),
    supabase.from("activities").select("id, label").eq("is_active", true).order("label").returns<{ id: string; label: string }[]>(),
    supabase.from("lead_sources").select("id, label").order("label").returns<{ id: string; label: string }[]>(),
  ]);
  return {
    entities: (ent.data ?? []).map((e) => ({ id: e.id, name: e.legal_name })),
    activities: act.data ?? [],
    sources: src.data ?? [],
  };
}
