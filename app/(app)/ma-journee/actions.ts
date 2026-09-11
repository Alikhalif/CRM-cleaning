"use server";

import { revalidatePath } from "next/cache";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { getCurrentUserProfile } from "@/lib/users-server";

// Mutations du module « Actions & Relances commerciales ». Le commercial agit
// sur SES actions ; l'admin/planificateur sur toutes. Écriture service-role
// APRÈS vérification de session + appartenance (la RLS reste la garde de fond).

type Guard = { userId: string; isManager: boolean };

async function guard(): Promise<Guard | null> {
  const profile = await getCurrentUserProfile();
  if (!profile) return null;
  const isManager = profile.roles.some((r) => r.slug === "admin" || r.slug === "planification");
  return { userId: profile.id, isManager };
}

// Vérifie que l'action existe et appartient au demandeur (ou qu'il est manager).
async function loadOwned(actionId: string, g: Guard) {
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("commercial_actions").select("id, owner_id, status").eq("id", actionId).maybeSingle<{ id: string; owner_id: string | null; status: string }>();
  if (!data) return null;
  if (!g.isManager && data.owner_id !== g.userId) return null;
  return data;
}

export async function completeAction(actionId: string, result?: string): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g) return { ok: false, error: "non authentifié" };
  const a = await loadOwned(actionId, g);
  if (!a) return { ok: false, error: "introuvable" };
  const sb = await supabaseServiceRole();
  const nowIso = new Date().toISOString();
  await sb.from("commercial_actions").update({
    status: "terminee", closed_at: nowIso, closed_reason: "manuel", result: result?.trim() || "fait",
  }).eq("id", actionId);
  await sb.from("commercial_action_events").insert({ action_id: actionId, kind: "closed", by_user: g.userId, detail: { reason: "manuel", result: result?.trim() || null } });
  revalidatePath("/ma-journee");
  return { ok: true };
}

// Reporter : masque l'action jusqu'à `hours` plus tard (report_count++).
export async function snoozeAction(actionId: string, hours: number): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g) return { ok: false, error: "non authentifié" };
  const a = await loadOwned(actionId, g);
  if (!a) return { ok: false, error: "introuvable" };
  const h = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 30) : 24;
  const sb = await supabaseServiceRole();
  const until = new Date(Date.now() + h * 3_600_000).toISOString();
  // report_count++ via lecture préalable (pas d'expression SQL côté client).
  const { data: cur } = await sb.from("commercial_actions").select("report_count").eq("id", actionId).maybeSingle<{ report_count: number }>();
  await sb.from("commercial_actions").update({ status: "reportee", snoozed_until: until, report_count: (cur?.report_count ?? 0) + 1 }).eq("id", actionId);
  await sb.from("commercial_action_events").insert({ action_id: actionId, kind: "reported", by_user: g.userId, detail: { until, hours: h } });
  revalidatePath("/ma-journee");
  return { ok: true };
}

// ── Config (Super Admin uniquement) : délais & activation des règles ────────
export async function updateCommercialRule(
  key: string,
  patch: { enabled?: boolean; config?: Record<string, number> },
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.roles.some((r) => r.slug === "admin") ?? false;
  if (!isAdmin) return { ok: false, error: "réservé au Super Admin" };
  const sb = await supabaseServiceRole();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) row.enabled = patch.enabled;
  if (patch.config !== undefined) row.config = patch.config;
  await sb.from("commercial_action_rules").update(row as never).eq("key", key);
  revalidatePath("/ma-journee");
  return { ok: true };
}

// Reprendre une action reportée (la remet « à faire » immédiatement).
export async function resumeAction(actionId: string): Promise<{ ok: boolean; error?: string }> {
  const g = await guard();
  if (!g) return { ok: false, error: "non authentifié" };
  const a = await loadOwned(actionId, g);
  if (!a) return { ok: false, error: "introuvable" };
  const sb = await supabaseServiceRole();
  await sb.from("commercial_actions").update({ status: "a_faire", snoozed_until: null }).eq("id", actionId);
  revalidatePath("/ma-journee");
  return { ok: true };
}
