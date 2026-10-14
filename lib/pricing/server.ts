import "server-only";
import { supabaseServer } from "../supabase/server";
import type { PricingParams } from "./compute";

// Lecture des paramètres tarifaires. RLS : lisible par tout utilisateur
// authentifié, modifiable par le Super Admin seul.

type Row = {
  activity_id: string;
  enabled: boolean;
  base_price: number | null;
  unit: string | null;
  price_per_unit: number | null;
  included_km: number | null;
  price_per_km: number | null;
  price_per_floor_no_lift: number | null;
  urgency_pct: number | null;
  difficulty_pct: number | null;
  options: Record<string, number> | null;
  min_price: number | null;
  range_low_pct: number | null;
  range_high_pct: number | null;
};

const SELECT =
  "activity_id, enabled, base_price, unit, price_per_unit, included_km, price_per_km, price_per_floor_no_lift, urgency_pct, difficulty_pct, options, min_price, range_low_pct, range_high_pct";

function map(r: Row): PricingParams {
  const n = (v: number | null, d = 0) => (v == null ? d : Number(v));
  return {
    enabled: r.enabled,
    basePrice: n(r.base_price),
    unit: (r.unit === "m3" || r.unit === "m2" ? r.unit : "none") as PricingParams["unit"],
    pricePerUnit: n(r.price_per_unit),
    includedKm: n(r.included_km),
    pricePerKm: n(r.price_per_km),
    pricePerFloorNoLift: n(r.price_per_floor_no_lift),
    urgencyPct: n(r.urgency_pct),
    difficultyPct: n(r.difficulty_pct),
    options: r.options ?? {},
    minPrice: n(r.min_price),
    rangeLowPct: n(r.range_low_pct, 10),
    rangeHighPct: n(r.range_high_pct, 15),
  };
}

// Paramètres d'UNE activité, pour la découverte. null si la table n'existe pas
// encore (migration non appliquée) : la découverte affiche alors « non
// configuré » au lieu de planter.
export async function getPricingParamsForActivity(
  activitySlug: string | null,
): Promise<PricingParams | null> {
  if (!activitySlug) return null;
  const sb = await supabaseServer();
  const { data: act } = await sb
    .from("activities").select("id").eq("slug", activitySlug).maybeSingle<{ id: string }>();
  if (!act) return null;
  const { data, error } = await sb
    .from("pricing_params").select(SELECT).eq("activity_id", act.id).maybeSingle<Row>();
  if (error || !data) return null;
  return map(data);
}

export type PricingParamsRow = PricingParams & {
  activityId: string;
  activitySlug: string;
  activityLabel: string;
};

// Toutes les activités + leurs paramètres, pour l'écran d'administration.
export async function getAllPricingParams(): Promise<PricingParamsRow[]> {
  const sb = await supabaseServer();
  const [actsRes, paramsRes] = await Promise.all([
    sb.from("activities").select("id, slug, label").order("label")
      .returns<{ id: string; slug: string; label: string }[]>(),
    sb.from("pricing_params").select(SELECT).returns<Row[]>(),
  ]);
  const byId = new Map((paramsRes.data ?? []).map((r) => [r.activity_id, r]));
  return (actsRes.data ?? []).map((a) => {
    const row = byId.get(a.id);
    const base: PricingParams = row
      ? map(row)
      : {
          enabled: false, basePrice: 0, unit: "none", pricePerUnit: 0,
          includedKm: 0, pricePerKm: 0, pricePerFloorNoLift: 0,
          urgencyPct: 0, difficultyPct: 0, options: {},
          minPrice: 0, rangeLowPct: 10, rangeHighPct: 15,
        };
    return { ...base, activityId: a.id, activitySlug: a.slug, activityLabel: a.label };
  });
}
