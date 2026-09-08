"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/presence/guard";
import { updateRule, setThresholds, evaluate } from "@/lib/presence/alerts-server";

type Result = { ok: boolean; error?: string };

// Toutes les écritures de config sont réservées au Super Admin.
export async function updateRuleAction(
  key: string,
  patch: { enabled?: boolean; config?: Record<string, number | string | boolean> },
): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès réservé au Super Admin." };
  await updateRule(key, patch);
  revalidatePath("/presence/parametres");
  return { ok: true };
}

export async function setThresholdsAction(value: Record<string, number>): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès réservé au Super Admin." };
  await setThresholds(value);
  revalidatePath("/presence/parametres");
  return { ok: true };
}

// Déclenchement manuel de l'évaluateur (bouton « Rafraîchir »).
export async function evaluateNowAction(): Promise<Result & { openAlerts?: number }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès réservé au Super Admin." };
  const r = await evaluate();
  revalidatePath("/presence");
  return { ok: true, openAlerts: r.openAlerts };
}
