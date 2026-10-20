"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { auditLog } from "@/lib/audit";
import type { Grid, GridMode, GridStatus } from "@/lib/pricing/grid-types";

// Les `as never` sur les écritures : database.types.ts est généré depuis la
// base et ne connaîtra pricing_grids qu'après la migration puis un
// `supabase gen types`. Cast au point de contact du SDK, comme pour les RPC
// de numérotation — à retirer à la prochaine régénération.

export type Result = { ok: true } | { ok: false; error: string };

// Toutes les écritures de ce module passent par là. La RLS n'autorise déjà que
// l'admin ; cette garde applicative donne un message clair plutôt qu'une erreur
// Postgres opaque, et sert de point unique pour l'audit.
async function requireAdminUser(): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const me = await getCurrentUserProfile();
  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");
  if (!me || !isAdmin) return { ok: false, error: "Réservé au Super Admin." };
  return { ok: true, id: me.id };
}

export type GridSettings = {
  mode: GridMode;
  majorationPct: number;
  fourchettePct: number;
  visibleToCommercial: boolean;
  visibleToSubcontractor: boolean;
  allowCommercialOverride: boolean;
  maxDiscountPct: number;
  floorPrice: number;
  positioningPct: number;
  vatRate: number | null;
  rounding: number;
};

// Enregistre le contenu de la grille et ses réglages. N'active RIEN : une
// grille reste dans son statut courant tant qu'on ne publie pas explicitement.
export async function saveGrid(
  activityId: string,
  grid: Grid,
  settings: GridSettings,
): Promise<Result> {
  const guard = await requireAdminUser();
  if (!guard.ok) return guard;
  const sb = await supabaseServer();

  const { error } = await sb
    .from("pricing_grids")
    .update({
      grid,
      mode_calcul: settings.mode,
      majoration_pct: settings.majorationPct,
      fourchette_pct: settings.fourchettePct,
      visible_to_commercial: settings.visibleToCommercial,
      visible_to_subcontractor: settings.visibleToSubcontractor,
      allow_commercial_override: settings.allowCommercialOverride,
      max_discount_pct: settings.maxDiscountPct,
      floor_price: settings.floorPrice,
      positioning_pct: settings.positioningPct,
      vat_rate: settings.vatRate,
      rounding: settings.rounding,
      updated_at: new Date().toISOString(),
      updated_by: guard.id,
    } as never)
    .eq("activity_id", activityId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/grilles-tarifaires");
  await auditLog({
    action: "pricing.grid.save",
    entityType: "user",
    entityId: activityId,
    after: {
      mode: settings.mode,
      majorationPct: settings.majorationPct,
      fourchettePct: settings.fourchettePct,
      visibleToCommercial: settings.visibleToCommercial,
      positioningPct: settings.positioningPct,
    },
  });
  return { ok: true };
}

// Publication : fige la version courante dans l'historique AVANT de basculer le
// statut. Un devis déjà émis garde ainsi son contexte tarifaire — une grille
// modifiée ne réécrit jamais le passé.
export async function publishGrid(activityId: string, note?: string): Promise<Result> {
  const guard = await requireAdminUser();
  if (!guard.ok) return guard;
  const sb = await supabaseServer();

  const { data: current, error: readErr } = await sb
    .from("pricing_grids")
    .select("version, grid, status")
    .eq("activity_id", activityId)
    .maybeSingle<{ version: number; grid: Grid; status: string }>();
  if (readErr || !current) return { ok: false, error: readErr?.message ?? "Grille introuvable." };

  const { error: histErr } = await sb.from("pricing_grid_history").insert({
    activity_id: activityId,
    version: current.version,
    status: "active",
    grid: current.grid,
    changed_by: guard.id,
    note: note ?? null,
  } as never);
  // L'historique est la trace d'une décision tarifaire : s'il échoue, on ne
  // publie pas. Publier sans trace vaut moins que ne pas publier.
  if (histErr) return { ok: false, error: `Historique : ${histErr.message}` };

  const { error } = await sb
    .from("pricing_grids")
    .update({
      status: "active",
      version: current.version + 1,
      published_at: new Date().toISOString(),
      published_by: guard.id,
      updated_at: new Date().toISOString(),
      updated_by: guard.id,
    } as never)
    .eq("activity_id", activityId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/grilles-tarifaires");
  revalidatePath("/leads");
  await auditLog({
    action: "pricing.grid.publish",
    entityType: "user",
    entityId: activityId,
    after: { version: current.version + 1 },
  });
  return { ok: true };
}

// Bascule active ↔ inactive. Ne touche pas aux brouillons : un brouillon se
// publie, il ne s'« active » pas.
export async function setGridStatus(activityId: string, status: GridStatus): Promise<Result> {
  const guard = await requireAdminUser();
  if (!guard.ok) return guard;
  if (status === "brouillon") {
    return { ok: false, error: "Une grille publiée ne revient pas en brouillon — désactivez-la." };
  }
  const sb = await supabaseServer();
  const { error } = await sb
    .from("pricing_grids")
    .update({ status, updated_at: new Date().toISOString(), updated_by: guard.id } as never)
    .eq("activity_id", activityId)
    .neq("status", "brouillon");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/grilles-tarifaires");
  revalidatePath("/leads");
  await auditLog({
    action: "pricing.grid.status",
    entityType: "user",
    entityId: activityId,
    after: { status },
  });
  return { ok: true };
}
