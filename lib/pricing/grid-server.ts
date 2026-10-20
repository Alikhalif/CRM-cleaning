import "server-only";
import { supabaseServer } from "../supabase/server";
import { getCurrentUserProfile } from "../users-server";
import {
  countConfigured, countLines,
  type Grid, type GridMode, type GridStatus, type PricingGrid,
} from "./grid-types";

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
  mode_calcul?: string | null;
  majoration_pct?: number | null;
  fourchette_pct?: number | null;
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

// Colonnes de la bibliothèque tarifaire. Elles sont lues à part : tant que la
// migration 20261020000001 n'est pas poussée, elles n'existent pas, et les
// réclamer ferait échouer TOUTE la lecture des grilles — donc plus aucun prix
// nulle part, sans message. Même repli que pour les colonnes `wanted_*` des
// leads, et pour la même raison : une migration en retard ne doit pas éteindre
// une fonctionnalité entière.
//
// `mode_calcul` et non `mode` : PostgreSQL expose un agrégat `mode()`, et
// PostgREST résout l'identifiant vers la fonction quand la colonne manque —
// l'erreur renvoyée parle alors de « WITHIN GROUP », ce qui n'aide personne.
let colonnesBiblioDisponibles = true;
const COLS_BIBLIO = "mode_calcul, majoration_pct, fourchette_pct, ";

const SELECT = () =>
  "activity_id, status, version, " +
  (colonnesBiblioDisponibles ? COLS_BIBLIO : "") +
  "grid, visible_to_commercial, visible_to_subcontractor, " +
  "allow_commercial_override, max_discount_pct, floor_price, positioning_pct, vat_rate, " +
  "rounding, updated_at, published_at";

const colonneAbsente = (e: { code?: string; message?: string } | null): boolean =>
  !!e && (e.code === "42703" || e.code === "42809" || (e.message ?? "").includes("mode_calcul"));

function map(r: Row, slug: string, label: string): PricingGrid {
  // Les colonnes de la bibliotheque peuvent etre absentes (migration non
  // poussee) : undefined est donc une valeur attendue, pas une anomalie.
  const n = (v: number | null | undefined, d = 0) => (v == null ? d : Number(v));
  return {
    activityId: r.activity_id,
    activitySlug: slug,
    activityLabel: label,
    status: (["brouillon", "active", "inactive"].includes(r.status) ? r.status : "brouillon") as GridStatus,
    version: r.version ?? 1,
    mode: (r.mode_calcul === "bibliotheque" ? "bibliotheque" : "fourchette") as GridMode,
    majorationPct: n(r.majoration_pct, 25),
    fourchettePct: n(r.fourchette_pct, 10),
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
  let gridsRes;
  const [actsRes, premier] = await Promise.all([
    sb.from("activities").select("id, slug, label").order("label")
      .returns<{ id: string; slug: string; label: string }[]>(),
    sb.from("pricing_grids").select(SELECT()).returns<Row[]>(),
  ]);
  gridsRes = premier;

  if (gridsRes.error && colonneAbsente(gridsRes.error) && colonnesBiblioDisponibles) {
    console.warn(
      "[getAllGrids] colonnes de la bibliothèque absentes — migration 20261020000001 non poussée. " +
      "Lecture dégradée : toutes les grilles sont lues en mode « fourchette ».",
    );
    colonnesBiblioDisponibles = false;
    gridsRes = await sb.from("pricing_grids").select(SELECT()).returns<Row[]>();
  }
  if (gridsRes.error) console.error("[getAllGrids] Supabase :", gridsRes.error.code, gridsRes.error.message);
  const byId = new Map((gridsRes.data ?? []).map((r) => [r.activity_id, r]));
  return (actsRes.data ?? []).map((a) => {
    const row = byId.get(a.id);
    const g = row
      ? map(row, a.slug, a.label)
      : map(
          {
            activity_id: a.id, status: "brouillon", version: 1, grid: {},
            mode_calcul: "fourchette", majoration_pct: 25, fourchette_pct: 10,
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

/**
 * Grille d'une activité, pour le CALCUL d'un prix dans une découverte.
 *
 * Applique la règle de diffusion décidée par le Super Admin : hors back-office,
 * une grille dont la diffusion commerciale n'est pas activée ne produit AUCUN
 * prix. Le contrôle est ici, côté serveur, et non dans l'interface — masquer un
 * montant dans le navigateur n'est pas une permission.
 *
 * `pourAdministration` : l'écran « Grilles tarifaires » lit la grille pour
 * l'éditer, pas pour chiffrer. Il n'est donc pas soumis à cette règle — son
 * propre garde (requireAdmin) s'en charge.
 */
export async function getGridBySlug(
  slug: string,
  pourAdministration = false,
): Promise<PricingGrid | null> {
  const sb = await supabaseServer();
  const { data: act } = await sb
    .from("activities").select("id, slug, label").eq("slug", slug)
    .maybeSingle<{ id: string; slug: string; label: string }>();
  if (!act) return null;
  let { data, error } = await sb
    .from("pricing_grids").select(SELECT()).eq("activity_id", act.id).maybeSingle<Row>();

  // Repli : tant que la migration de la bibliothèque n'est pas poussée, les
  // colonnes demandées n'existent pas. Sans ce rattrapage, la lecture échoue
  // et la découverte affiche « aucun barème » alors que la grille est là.
  if (error && colonneAbsente(error) && colonnesBiblioDisponibles) {
    console.warn(
      "[getGridBySlug] colonnes de la bibliothèque absentes — migration 20261020000001 " +
      "non poussée. Lecture en mode « fourchette ».",
    );
    colonnesBiblioDisponibles = false;
    ({ data, error } = await sb
      .from("pricing_grids").select(SELECT()).eq("activity_id", act.id).maybeSingle<Row>());
  }
  if (error) console.error("[getGridBySlug] Supabase :", error.code, error.message);
  if (error || !data) return null;

  const g = map(data, act.slug, act.label);
  if (pourAdministration) return g;

  // Back-office : admin, planification et supervision voient toujours le
  // calcul, c'est leur métier. Pour tous les autres, le drapeau décide.
  const me = await getCurrentUserProfile();
  const roles = (me?.roles ?? []).map((r) => r.slug);
  const backOffice = roles.includes("admin") || roles.includes("planification") || roles.includes("superviseur");
  // Le drapeau est baissé pour ce rôle : on renvoie la grille marquée NON
  // DIFFUSÉE plutôt que null. Le moteur refusera de chiffrer, mais la
  // découverte pourra dire pourquoi au lieu d'annoncer « aucun barème ».
  if (!backOffice && !g.visibleToCommercial) return { ...g, nonDiffusee: true };

  return g;
}
