"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { Database, Json } from "@/lib/supabase/database.types";

type RuleInsert = Database["public"]["Tables"]["routing_rules"]["Insert"];
type RuleUpdate = Database["public"]["Tables"]["routing_rules"]["Update"];

export type RuleInput = {
  name: string;
  priority: number;
  isActive: boolean;
  // Conditions
  surfaceM2Gte: number | null;
  surfaceM2Lt: number | null;
  sector: "" | "urgence" | "nettoyage" | "enr" | "renovation" | "debarras";
  source: "" | "google_ads" | "meta_ads" | "site_web" | "telephone" | "recommandation";
  clientIsPremium: "any" | "true" | "false";
  demandeIsExtreme: "any" | "true" | "false";
  amountGte: number | null;
  // Action
  actionKind: "assign_to_user_id" | "assign_to_premium" | "assign_to_extreme";
  assignToUserId: string;
};

export type Result = { ok: true; id?: string } | { ok: false; error: string };

function buildConditions(input: RuleInput): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if (input.surfaceM2Gte !== null) c.surface_m2_gte = input.surfaceM2Gte;
  if (input.surfaceM2Lt !== null) c.surface_m2_lt = input.surfaceM2Lt;
  if (input.sector) c.sector = input.sector;
  if (input.source) c.source = input.source;
  if (input.clientIsPremium !== "any") c.client_is_premium = input.clientIsPremium === "true";
  if (input.demandeIsExtreme !== "any") c.is_extreme = input.demandeIsExtreme === "true";
  if (input.amountGte !== null) c.amount_gte = input.amountGte;
  return c;
}

function buildAction(input: RuleInput): Record<string, unknown> {
  if (input.actionKind === "assign_to_premium") return { assign_to_premium: true };
  if (input.actionKind === "assign_to_extreme") return { assign_to_extreme: true };
  return { assign_to_user_id: input.assignToUserId };
}

function validate(input: RuleInput): string | null {
  if (!input.name.trim()) return "Nom de la règle requis.";
  if (input.actionKind === "assign_to_user_id" && !input.assignToUserId) {
    return "Sélectionnez le commercial cible.";
  }
  return null;
}

export async function createRule(input: RuleInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const payload: RuleInsert = {
    name: input.name.trim(),
    priority: input.priority,
    conditions: buildConditions(input) as Json,
    action: buildAction(input) as Json,
    is_active: input.isActive,
    created_by: user?.id ?? null,
  };
  const { data, error } = await supabase
    .from("routing_rules")
    .insert(payload as never)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) return { ok: false, error: `Échec création : ${error?.message ?? "inconnu"}.` };
  revalidatePath("/settings/routing");
  await auditLog({ action: "routing_rule.create", entityType: "user", entityId: data.id, after: { name: input.name } });
  return { ok: true, id: data.id };
}

export async function updateRule(id: string, input: RuleInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const supabase = await supabaseServer();
  const payload: RuleUpdate = {
    name: input.name.trim(),
    priority: input.priority,
    conditions: buildConditions(input) as Json,
    action: buildAction(input) as Json,
    is_active: input.isActive,
  };
  const { error } = await supabase
    .from("routing_rules")
    .update(payload as never)
    .eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}.` };
  revalidatePath("/settings/routing");
  await auditLog({ action: "routing_rule.update", entityType: "user", entityId: id, after: { name: input.name } });
  return { ok: true };
}

export async function deleteRule(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("routing_rules").delete().eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}.` };
  revalidatePath("/settings/routing");
  await auditLog({ action: "routing_rule.delete", entityType: "user", entityId: id });
  return { ok: true };
}

export async function toggleRuleActive(id: string, isActive: boolean): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("routing_rules")
    .update({ is_active: isActive } as never)
    .eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}.` };
  revalidatePath("/settings/routing");
  await auditLog({ action: "routing_rule.toggle", entityType: "user", entityId: id, after: { isActive } });
  return { ok: true };
}
