import "server-only";
import { supabaseServer } from "../supabase/server";
import { countConfigured, countLines, type Grid, type GridStatus, type PricingGrid } from "./grid-types";

// Accès aux grilles tarifaires.
//
// ⚠️ La RLS autorise la LECTURE à tout authentifié : le calcul de la fourchette
// se fait côté serveur et a besoin de la grille. Ce qu'on RENVOIE au navigateur
// est filtré ici — un commercial ne reçoit jamais la grille, seulement le
// résultat du calcul.

type Row = {
  activity_id: string;
  status: string;
  version: number;
  grid: Grid | null;
  visible_to_commercial: boolean;
  visible_to_subcontractor: boolean;
  allow_commercial_override: boolean;
  max_discount_pct: number | null;
  floor_price: number | null;
  positioning_pct: number | null;
  vat_rate: number | null;
  rounding: number | null;
  updated_at: string | null;
  published_at: string | null;
};

const SELECT =
  "activity_id, status, version, grid, visible_to_commercial, visible_to_subcontractor, " +
  "allow_commercial_override, max_discount_pct, floor_price, positioning_pct, vat_rate, " +
  "rounding, updated_at, published_at";

function map(r: Row, slug: string, label: string): PricingGrid {
  const n = (v: number | null, d = 0) => (v == null ? d : Number(v));
  return {
    activityId: r.activity_id,
    activitySlug: slug,
    activityLabel: label,
    status: (["brouillon", "active", "inactive"].includes(r.status) ? r.status : "brouillon") as GridStatus,
    version: r.version ?? 1,
    grid: r.grid ?? {},
    visibleToCommercial: Boolean(r.visible_to_commercial),
    visibleToSubcontractor: Boolean(r.visible_to_subcontractor),
    allowCommercialOverride: Boolean(r.allow_commercial_override),
    maxDiscountPct: n(r.max_discount_pct),
    floorPrice: n(r.floor_price),
    positioningPct: n(r.positioning_pct, 75),
    vatRate: r.vat_rate == null ? null : Number(r.vat_rate),
    rounding: n(r.rounding, 50),
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
  };
}

// Toutes les grilles + métadonnées d'affichage, pour le module Super Admin.
export async function getAllGrids(): Promise<(PricingGrid & { configured: number; total: number })[]> {
  const sb = await supabaseServer();
  const [actsRes, gridsRes] = await Promise.all([
    sb.from("activities").select("id, slug, label").order("label")
      .returns<{ id: string; slug: string; label: string }[]>(),
    sb.from("pricing_grids").select(SELECT).returns<Row[]>(),
  ]);
  const byId = new Map((gridsRes.data ?? []).map((r) => [r.activity_id, r]));
  return (actsRes.data ?? []).map((a) => {
    const row = byId.get(a.id);
    const g = row
      ? map(row, a.slug, a.label)
      : map(
          {
            activity_id: a.id, status: "brouillon", version: 1, grid: {},
            visible_to_commercial: false, visible_to_subcontractor: false,
            allow_commercial_override: false, max_discount_pct: 0, floor_price: 0,
            positioning_pct: 75, vat_rate: null, rounding: 50,
            updated_at: null, published_at: null,
          },
          a.slug, a.label,
        );
    return { ...g, configured: countConfigured(g.grid), total: countLines(g.grid) };
  });
}

export async function getGridBySlug(slug: string): Promise<PricingGrid | null> {
  const sb = await supabaseServer();
  const { data: act } = await sb
    .from("activities").select("id, slug, label").eq("slug", slug)
    .maybeSingle<{ id: string; slug: string; label: string }>();
  if (!act) return null;
  const { data, error } = await sb
    .from("pricing_grids").select(SELECT).eq("activity_id", act.id).maybeSingle<Row>();
  if (error || !data) return null;
  return map(data, act.slug, act.label);
}
