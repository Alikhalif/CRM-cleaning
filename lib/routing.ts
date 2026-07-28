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
  sectorSlug: "urgence" | "nettoyage" | "nettoyage_difficile" | "enr" | "renovation" | "debarras" | "demenagement" | "diogene";
  sourceSlug: string;
  clientIsPremium: boolean;
  estimatedAmount: number | null;
  isExtreme: boolean; // "demande extrême" flag captured at lead creation
  isUrgent: boolean;  // demande urgente (CDC §7 — Nettoyage urgent → Performant)
  country: string | null; // pays du lead (CDC §8/§10 — le commercial doit le couvrir)
  // Type de la landing page d'origine (Lot B). "generale" | "famille" | null
  // (null = pas de LP, ou LP sans type → traité comme "famille").
  lpType: "generale" | "famille" | null;
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
  // No explicit rule matched → fall through to the CDC §8 profile-based routing.
  return resolveByProfile(input);
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

// ── Profile-based routing (CDC §7/§8) ─────────────────────────────────
// The deterministic default when no explicit routing_rule matched: map the
// lead's secteur (+ urgence/surface) to a commercial profile, then pick a
// commercial in that pool who covers the lead's country, load-balanced.

const DEFAULT_PERFORMANT_THRESHOLD = 100;

async function getPerformantThreshold(
  supabase: Awaited<ReturnType<typeof supabaseServiceRole>>,
): Promise<number> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "performant_surface_threshold")
    .maybeSingle<{ value: unknown }>();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PERFORMANT_THRESHOLD;
}

// Lot B — secteur (catégorie) + type de LP (+ urgence / surface) → profil(s) cible.
// Renvoie une LISTE de profils éligibles (le pool est l'union) car certaines
// combinaisons sont partagées (ex. Famille-nettoyage → Appel entrant OU Divers).
// Règles :
//   • Diogène                        → diogene
//   • Débarras / Déménagement        → debarras_demenagement
//   • Nettoyage difficile            → performant
//   • Nettoyage (+ hérités) urgent   → performant
//   • Nettoyage (+ hérités) surf>seuil → performant
//   • Nettoyage Générale             → appel_entrant
//   • Nettoyage Famille / sans type  → appel_entrant OU nettoyage (Divers)
function targetProfiles(input: RoutingInput, threshold: number): string[] {
  const s = input.sectorSlug;
  if (s === "diogene") return ["diogene"];
  if (s === "debarras" || s === "demenagement") return ["debarras_demenagement"];
  if (s === "nettoyage_difficile") return ["performant"];

  // Famille "nettoyage" (nettoyage + secteurs hérités urgence/enr/renovation).
  if (input.isUrgent || (input.surfaceM2 != null && input.surfaceM2 > threshold)) return ["performant"];
  if (input.lpType === "generale") return ["appel_entrant"];
  return ["appel_entrant", "nettoyage"]; // Famille (ou sans type) → union des deux pools
}

// Pick from one or more profile pools: users holding ANY of the profiles,
// active, covering the lead's country (countries vide = couvre tout),
// least-loaded first.
async function pickFromPool(
  supabase: Awaited<ReturnType<typeof supabaseServiceRole>>,
  profiles: string[],
  country: string | null,
): Promise<string | null> {
  const { data: pool } = await supabase
    .from("users")
    .select("id, countries")
    .eq("is_active", true)
    .overlaps("commercial_profiles", profiles)
    .returns<{ id: string; countries: string[] | null }[]>();
  if (!pool || pool.length === 0) return null;

  const eligible = pool.filter(
    (u) => !country || !u.countries || u.countries.length === 0 || u.countries.includes(country),
  );
  if (eligible.length === 0) return null;

  const counts = await Promise.all(
    eligible.map(async (u) => {
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

export async function resolveByProfile(input: RoutingInput): Promise<RoutingDecision | null> {
  const supabase = await supabaseServiceRole();
  const threshold = await getPerformantThreshold(supabase);
  const profiles = targetProfiles(input, threshold);

  // Étapes 4-6 : pool des profils, couverture pays, round-robin par charge.
  let ownerId = await pickFromPool(supabase, profiles, input.country);
  let usedProfile = profiles.join("/");

  // Étape 7 : sinon, le pool « en attente » (débordement).
  if (!ownerId) {
    ownerId = await pickFromPool(supabase, ["en_attente"], input.country);
    usedProfile = "en_attente";
  }
  if (!ownerId) return null;

  return {
    ownerId,
    matchedRuleId: "profile",
    matchedRuleName: `profil:${usedProfile}`,
    reason: `Secteur ${input.sectorSlug}${input.lpType ? ` · LP ${input.lpType}` : ""} → profil ${usedProfile}${input.country ? ` · pays ${input.country}` : ""}`,
  };
}
