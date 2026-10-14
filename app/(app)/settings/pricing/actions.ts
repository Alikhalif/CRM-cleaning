"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { assertBackOffice } from "@/lib/access-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { auditLog } from "@/lib/audit";

export type Result = { ok: true } | { ok: false; error: string };

export type PricingPatch = {
  enabled: boolean;
  basePrice: number;
  unit: "none" | "m3" | "m2";
  pricePerUnit: number;
  includedKm: number;
  pricePerKm: number;
  pricePerFloorNoLift: number;
  urgencyPct: number;
  difficultyPct: number;
  options: Record<string, number>;
  minPrice: number;
  rangeLowPct: number;
  rangeHighPct: number;
};

// Enregistre le barème d'une activité. La RLS n'autorise l'écriture qu'à un
// admin ; cette garde applicative donne un message clair au lieu d'une erreur
// Postgres opaque.
export async function savePricingParams(activityId: string, patch: PricingPatch): Promise<Result> {
  const guard = await assertBackOffice();
  if (!guard.ok) return guard;
  const me = await getCurrentUserProfile();
  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");
  if (!isAdmin) return { ok: false, error: "Réservé au Super Admin." };

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("pricing_params")
    .update({
      enabled: patch.enabled,
      base_price: patch.basePrice,
      unit: patch.unit,
      price_per_unit: patch.pricePerUnit,
      included_km: patch.includedKm,
      price_per_km: patch.pricePerKm,
      price_per_floor_no_lift: patch.pricePerFloorNoLift,
      urgency_pct: patch.urgencyPct,
      difficulty_pct: patch.difficultyPct,
      options: patch.options,
      min_price: patch.minPrice,
      range_low_pct: patch.rangeLowPct,
      range_high_pct: patch.rangeHighPct,
      updated_at: new Date().toISOString(),
      updated_by: me?.id ?? null,
    } as never)
    .eq("activity_id", activityId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/pricing");
  // Un changement de barème modifie ce que les commerciaux annoncent : il doit
  // être traçable.
  await auditLog({
    action: "pricing.params.update",
    entityType: "user",
    entityId: activityId,
    after: { enabled: patch.enabled, basePrice: patch.basePrice, unit: patch.unit },
  });
  return { ok: true };
}
