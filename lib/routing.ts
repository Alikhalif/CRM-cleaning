import "server-only";
import { supabaseServiceRole } from "./supabase/service";

// Lead routing engine. Evaluates routing_rules (ordered by priority asc,
// active only) against a lead's attributes and returns the chosen
// owner_id, or null if no rule matches (caller falls back to its own
// default — e.g. the manual picker on /pipeline's Nouveau Lead modal,
// or the WF1 webhook's `assigned_to` payload field).
//
// Service-role read on routing_rules because the call path may run
// without an authenticated session (n8n webhook). RLS allows authenticated
// SELECT anyway; the bypass keeps it simple.

export type RoutingInput = {
  surfaceM2: number | null;
  sectorSlug: "urgence" | "nettoyage" | "enr" | "renovation" | "debarras" | "demenagement";
  sourceSlug: string;
  clientIsPremium: boolean;
  estimatedAmount: number | null;
  isExtreme: boolean; // "demande extrême" flag captured at lead creation
};

export type RoutingDecision = {
  ownerId: string;
  matchedRuleId: string;
  matchedRuleName: string;
  reason: string; // human-readable trace for the audit log
};

type RuleRow = {
  id: string;
  name: string;
  priority: number;
  conditions: Record<string, unknown>;
  action: Record<string, unknown>;
};

// ── Evaluate one rule's conditions against the lead. All conditions
// must match (AND semantics). Empty conditions = match everything.
function matchesConditions(input: RoutingInput, c: Record<string, unknown>): boolean {
  if (typeof c.surface_m2_gte === "number") {
    if (input.surfaceM2 === null || input.surfaceM2 < c.surface_m2_gte) return false;
  }
  if (typeof c.surface_m2_lt === "number") {
    if (input.surfaceM2 === null || input.surfaceM2 >= c.surface_m2_lt) return false;
  }
  if (typeof c.sector === "string") {
    if (input.sectorSlug !== c.sector) return false;
  }
  if (typeof c.source === "string") {
    if (input.sourceSlug !== c.source) return false;
  }
  if (typeof c.client_is_premium === "boolean") {
    if (input.clientIsPremium !== c.client_is_premium) return false;
  }
  if (typeof c.is_extreme === "boolean") {
    if (input.isExtreme !== c.is_extreme) return false;
  }
  if (typeof c.amount_gte === "number") {
    if (input.estimatedAmount === null || input.estimatedAmount < c.amount_gte) return false;
  }
  return true;
}

// ── Resolve the chosen owner from a rule's action. Two paths:
//   • assign_to_user_id → that user (validated to exist & be active)
//   • assign_to_premium → pick the premium commercial with the fewest
//     open leads (round-robin by current workload).
async function resolveAction(
  action: Record<string, unknown>,
): Promise<string | null> {
  const supabase = await supabaseServiceRole();

  if (typeof action.assign_to_user_id === "string" && action.assign_to_user_id) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("id", action.assign_to_user_id)
      .eq("is_active", true)
      .maybeSingle<{ id: string }>();
    return data?.id ?? null;
  }

  // Premium / extrême pools share the same round-robin logic — pick the
  // matching pool column, then the member with the fewest open leads.
  const poolColumn =
    action.assign_to_premium === true
      ? "is_premium"
      : action.assign_to_extreme === true
        ? "is_extreme"
        : null;
  if (poolColumn) {
    const { data: pool } = await supabase
      .from("users")
      .select("id")
      // is_extreme isn't in the generated types yet — cast to a known column.
      .eq(poolColumn as "is_premium", true)
      .eq("is_active", true)
      .returns<{ id: string }[]>();
    if (!pool || pool.length === 0) return null;

    // Per-user open-lead count. "Open" = not perdu/encaisse.
    const counts = await Promise.all(
      pool.map(async (u) => {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", u.id)
          .not("status", "in", "(perdu,encaisse)");
        return { userId: u.id, openCount: count ?? 0 };
      }),
    );
    counts.sort((a, b) => a.openCount - b.openCount);
    return counts[0]?.userId ?? null;
  }

  return null;
}

export async function resolveOwner(input: RoutingInput): Promise<RoutingDecision | null> {
  const supabase = await supabaseServiceRole();
  const { data: rules, error } = await supabase
    .from("routing_rules")
    .select("id, name, priority, conditions, action")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<RuleRow[]>();
  if (error || !rules) return null;

  for (const rule of rules) {
    if (!matchesConditions(input, rule.conditions)) continue;
    const ownerId = await resolveAction(rule.action);
    if (!ownerId) continue; // action didn't resolve (e.g. premium pool empty) — try next rule
    return {
      ownerId,
      matchedRuleId: rule.id,
      matchedRuleName: rule.name,
      reason: formatReason(rule.conditions, rule.action, ownerId),
    };
  }
  return null;
}

function formatReason(
  conditions: Record<string, unknown>,
  action: Record<string, unknown>,
  ownerId: string,
): string {
  const condBits = Object.entries(conditions)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
  const actDesc =
    action.assign_to_premium === true
      ? `premium pool → ${ownerId}`
      : action.assign_to_extreme === true
        ? `extrême pool → ${ownerId}`
        : typeof action.assign_to_user_id === "string"
          ? `user ${ownerId}`
          : `unknown action → ${ownerId}`;
  return `Conditions [${condBits || "*"}] → ${actDesc}`;
}
