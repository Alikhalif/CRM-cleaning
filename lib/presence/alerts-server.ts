import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/database.types";
import { QUALIFYING_LEAD_ACTIONS, TREAT_ACTIONS, actionMeta, type AlertSeverity } from "./taxonomy";
import { parisDayRange, todayParis, getThresholds, listPresenceUsers, invalidateThresholdsCache } from "./presence-server";
import type { AlertRow, AlertRule, DashboardStats } from "./types";

type Sb = Awaited<ReturnType<typeof supabaseServiceRole>>;

// Une violation détectée = une alerte à ouvrir/maintenir.
type Violation = {
  ruleKey: string;
  severity: AlertSeverity;
  userId: string | null;
  entityType: string | null;
  entityId: string | null;
  title: string;
  context: Record<string, unknown>;
};

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

// ════════════════════════════════════════════════════════════════════════════
// LECTURES (dashboard / listes) — la page appelante vérifie déjà is_admin.
// ════════════════════════════════════════════════════════════════════════════

export async function getRules(): Promise<AlertRule[]> {
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("alert_rules").select("key, label, enabled, config").order("key");
  return (data ?? []) as AlertRule[];
}

export async function getThresholdsConfig(): Promise<Record<string, number>> {
  const sb = await supabaseServiceRole();
  const th = await getThresholds(sb);
  return th as unknown as Record<string, number>;
}

type AlertDbRow = {
  id: string; rule_key: string; severity: AlertSeverity; user_id: string | null;
  entity_type: string | null; entity_id: string | null; title: string;
  status: "open" | "resolved"; created_at: string; resolved_at: string | null;
  resolved_action: string | null; delay_seconds: number | null;
};

async function hydrateAlerts(sb: Sb, rows: AlertDbRow[]): Promise<AlertRow[]> {
  const [rules, users] = await Promise.all([getRules(), listPresenceUsers(sb)]);
  const ruleLbl = new Map(rules.map((r) => [r.key, r.label]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  // refs lisibles pour les leads
  const leadIds = [...new Set(rows.filter((r) => r.entity_type === "lead" && r.entity_id).map((r) => r.entity_id!))];
  const refs = new Map<string, string>();
  if (leadIds.length) {
    const { data } = await sb.from("leads").select("id, short_id").in("id", leadIds);
    for (const l of (data ?? []) as { id: string; short_id: string | null }[]) if (l.short_id) refs.set(l.id, l.short_id);
  }
  return rows.map((r) => ({
    id: r.id,
    ruleKey: r.rule_key,
    ruleLabel: ruleLbl.get(r.rule_key) ?? r.rule_key,
    severity: r.severity,
    userId: r.user_id,
    userName: r.user_id ? userName.get(r.user_id) ?? null : null,
    entityType: r.entity_type,
    entityId: r.entity_id,
    entityRef: r.entity_id ? refs.get(r.entity_id) ?? null : null,
    title: r.title,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolvedAction: r.resolved_action,
    delaySeconds: r.delay_seconds,
  }));
}

export async function getOpenAlerts(): Promise<AlertRow[]> {
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("alerts").select("*").eq("status", "open").order("created_at", { ascending: false }).returns<AlertDbRow[]>();
  return hydrateAlerts(sb, data ?? []);
}

export async function getUserAlerts(userId: string, day = todayParis()): Promise<AlertRow[]> {
  const sb = await supabaseServiceRole();
  const { start, end } = parisDayRange(day);
  const { data } = await sb.from("alerts").select("*").eq("user_id", userId).gte("created_at", start).lt("created_at", end).order("created_at", { ascending: false }).returns<AlertDbRow[]>();
  return hydrateAlerts(sb, data ?? []);
}

export async function getAlertHistory(opts: { day?: string; status?: "open" | "resolved"; limit?: number } = {}): Promise<AlertRow[]> {
  const sb = await supabaseServiceRole();
  let q = sb.from("alerts").select("*").order("created_at", { ascending: false }).limit(Math.min(opts.limit ?? 200, 500));
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.day) { const { start, end } = parisDayRange(opts.day); q = q.gte("created_at", start).lt("created_at", end); }
  const { data } = await q.returns<AlertDbRow[]>();
  return hydrateAlerts(sb, data ?? []);
}

export async function getDashboardStats(day = todayParis()): Promise<DashboardStats> {
  const sb = await supabaseServiceRole();
  const { start, end } = parisDayRange(day);
  const [th, presRes, alertsRes, leadsNewRes, leadsAuditRes] = await Promise.all([
    getThresholds(sb),
    sb.from("user_presence").select("last_seen_at, last_active_at"),
    sb.from("alerts").select("severity, rule_key").eq("status", "open"),
    sb.from("leads").select("id, status").gte("received_at", start).lt("received_at", end),
    sb.from("audit_logs").select("entity_id, action").eq("entity_type", "lead").in("action", QUALIFYING_LEAD_ACTIONS).gte("created_at", start).lt("created_at", end),
  ]);

  let active = 0, inactive = 0, offline = 0;
  const now = Date.now();
  for (const p of (presRes.data ?? []) as { last_seen_at: string | null; last_active_at: string | null }[]) {
    const seen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
    const act = p.last_active_at ? new Date(p.last_active_at).getTime() : 0;
    if (now - seen > th.offline_after_minutes * 60_000) offline += 1;
    else if (now - act > th.inactive_after_minutes * 60_000) inactive += 1;
    else active += 1;
  }

  const sev = { watch: 0, warn: 0, high: 0, critical: 0 };
  let expectedAbsent = 0;
  for (const a of (alertsRes.data ?? []) as { severity: AlertSeverity; rule_key: string }[]) {
    sev[a.severity] += 1;
    if (a.rule_key === "user_absent") expectedAbsent += 1;
  }

  const newLeads = (leadsNewRes.data ?? []) as { id: string; status: string }[];
  const treatedLeadIds = new Set((leadsAuditRes.data ?? []).map((r) => (r as { entity_id: string | null }).entity_id).filter(Boolean) as string[]);
  const treatedToday = newLeads.filter((l) => treatedLeadIds.has(l.id)).length;

  return {
    presence: { active, inactive, offline, expectedAbsent },
    leads: { newToday: newLeads.length, treated: treatedToday, pending: newLeads.filter((l) => l.status === "lead" && !treatedLeadIds.has(l.id)).length },
    alerts: { total: sev.watch + sev.warn + sev.high + sev.critical, critical: sev.critical, high: sev.high, warn: sev.warn, watch: sev.watch },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIG (écriture) — server-role ; l'action serveur appelante vérifie is_admin.
// ════════════════════════════════════════════════════════════════════════════

export async function updateRule(key: string, patch: { enabled?: boolean; config?: Record<string, unknown> }): Promise<void> {
  const sb = await supabaseServiceRole();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) row.enabled = patch.enabled;
  if (patch.config !== undefined) row.config = patch.config;
  await sb.from("alert_rules").update(row as never).eq("key", key);
}

export async function setThresholds(value: Record<string, number>): Promise<void> {
  const sb = await supabaseServiceRole();
  await sb.from("presence_config").upsert({ key: "thresholds", value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  invalidateThresholdsCache();
}

// ════════════════════════════════════════════════════════════════════════════
// ÉVALUATEUR — déclenché par cron (1–2 min). Requêtes BORNÉES sur données
// récentes. Recompose l'agrégat du jour, balaye la présence, évalue les règles,
// auto-résout. Aucune boucle lourde sur toute la base.
// ════════════════════════════════════════════════════════════════════════════

export async function evaluate(): Promise<{ ok: true; openAlerts: number; ranAt: string }> {
  const sb = await supabaseServiceRole();
  const day = todayParis();

  await recomputeDailySummaries(sb, day);
  await closeStaleSessions(sb);

  const { data: rules } = await sb.from("alert_rules").select("key, enabled, config").returns<{ key: string; enabled: boolean; config: Record<string, unknown> }[]>();
  const byKey = new Map((rules ?? []).map((r) => [r.key, r]));

  const handlers: Array<[string, (cfg: Record<string, unknown>) => Promise<Violation[]>]> = [
    ["lead_untreated", (c) => ruleLeadUntreated(sb, c)],
    ["user_absent", (c) => ruleUserAbsent(sb, c, day)],
    ["inactivity", (c) => ruleInactivity(sb, c)],
    ["devis_not_sent", (c) => ruleDevisNotSent(sb, c)],
    ["dossier_stuck", (c) => ruleDossierStuck(sb, c)],
  ];

  for (const [key, fn] of handlers) {
    const rule = byKey.get(key);
    if (!rule || !rule.enabled) {
      await reconcile(sb, key, []); // règle désactivée → résoudre ses alertes ouvertes
      continue;
    }
    try {
      const violations = await fn(rule.config ?? {});
      await reconcile(sb, key, violations);
    } catch (e) {
      console.error(`[presence.evaluate] règle ${key} échouée :`, (e as Error).message);
    }
  }

  const { count } = await sb.from("alerts").select("id", { count: "exact", head: true }).eq("status", "open");
  return { ok: true, openAlerts: count ?? 0, ranAt: new Date().toISOString() };
}

// ── Réconciliation : ouvre/maintient les violations, résout le reste ────────
async function reconcile(sb: Sb, ruleKey: string, violations: Violation[]): Promise<void> {
  const { data: open } = await sb.from("alerts").select("id, entity_id, user_id, severity, created_at").eq("rule_key", ruleKey).eq("status", "open").returns<{ id: string; entity_id: string | null; user_id: string | null; severity: AlertSeverity; created_at: string }[]>();
  const key = (e: string | null, u: string | null) => `${e ?? ""}|${u ?? ""}`;
  const openBy = new Map((open ?? []).map((a) => [key(a.entity_id, a.user_id), a]));

  const nowIso = new Date().toISOString();
  for (const v of violations) {
    const k = key(v.entityId, v.userId);
    const existing = openBy.get(k);
    if (existing) {
      openBy.delete(k);
      if (existing.severity !== v.severity) {
        await sb.from("alerts").update({ severity: v.severity, title: v.title, context: v.context as Json, escalated_at: nowIso }).eq("id", existing.id);
      }
    } else {
      await sb.from("alerts").insert({
        rule_key: v.ruleKey, severity: v.severity, user_id: v.userId,
        entity_type: v.entityType, entity_id: v.entityId, title: v.title, context: v.context as Json, status: "open",
      });
    }
  }
  // Alertes ouvertes restantes → action réalisée → résolution auto.
  for (const [, a] of openBy) {
    const delay = Math.round((Date.now() - new Date(a.created_at).getTime()) / 1000);
    await sb.from("alerts").update({ status: "resolved", resolved_at: nowIso, delay_seconds: delay, resolved_action: "action réalisée" }).eq("id", a.id);
  }
}

// ── Agrégat journalier (source des vues synthétiques) ───────────────────────
async function recomputeDailySummaries(sb: Sb, day: string): Promise<void> {
  const { start, end } = parisDayRange(day);
  const th = await getThresholds(sb);
  const [pingsRes, auditRes, sessRes] = await Promise.all([
    sb.from("presence_pings").select("user_id, ts, active").gte("ts", start).lt("ts", end).order("ts", { ascending: true }),
    sb.from("audit_logs").select("user_id, action, entity_type, entity_id").gte("created_at", start).lt("created_at", end),
    sb.from("user_sessions").select("user_id, started_at, ended_at, last_seen_at").gte("started_at", start).lt("started_at", end),
  ]);

  const pings = (pingsRes.data ?? []) as { user_id: string; ts: string; active: boolean }[];
  const audit = (auditRes.data ?? []) as { user_id: string | null; action: string; entity_type: string | null; entity_id: string | null }[];
  const sessions = (sessRes.data ?? []) as { user_id: string; started_at: string; ended_at: string | null; last_seen_at: string }[];

  const byUser = new Map<string, { pings: { ts: string; active: boolean }[] }>();
  for (const p of pings) {
    const g = byUser.get(p.user_id) ?? { pings: [] };
    g.pings.push({ ts: p.ts, active: p.active });
    byUser.set(p.user_id, g);
  }

  const sessBy = new Map<string, { count: number; seconds: number }>();
  for (const s of sessions) {
    const endMs = Math.min(new Date(s.ended_at ?? s.last_seen_at).getTime(), new Date(end).getTime());
    const startMs = Math.max(new Date(s.started_at).getTime(), new Date(start).getTime());
    const cur = sessBy.get(s.user_id) ?? { count: 0, seconds: 0 };
    cur.count += 1;
    cur.seconds += Math.max(0, Math.round((endMs - startMs) / 1000));
    sessBy.set(s.user_id, cur);
  }

  const auditBy = new Map<string, { counters: Record<string, number>; leads: Set<string>; total: number }>();
  for (const a of audit) {
    if (!a.user_id) continue;
    const g = auditBy.get(a.user_id) ?? { counters: {}, leads: new Set<string>(), total: 0 };
    g.total += 1;
    const meta = actionMeta(a.action);
    for (const c of meta.counters ?? []) g.counters[c] = (g.counters[c] ?? 0) + 1;
    if (a.entity_type === "lead" && a.entity_id && TREAT_ACTIONS.includes(a.action)) g.leads.add(a.entity_id);
    auditBy.set(a.user_id, g);
  }

  const step = th.heartbeat_seconds;
  const userIds = new Set<string>([...byUser.keys(), ...auditBy.keys(), ...sessBy.keys()]);
  const rows = [...userIds].map((uid) => {
    const g = byUser.get(uid);
    const ps = g?.pings ?? [];
    const activeSeconds = ps.filter((p) => p.active).length * step;
    const ab = auditBy.get(uid) ?? { counters: {}, leads: new Set<string>(), total: 0 };
    const sb2 = sessBy.get(uid) ?? { count: 0, seconds: 0 };
    return {
      user_id: uid,
      day,
      first_seen_at: ps[0]?.ts ?? null,
      last_seen_at: ps[ps.length - 1]?.ts ?? null,
      session_seconds: sb2.seconds || (ps.length ? Math.round((new Date(ps[ps.length - 1].ts).getTime() - new Date(ps[0].ts).getTime()) / 1000) : 0),
      active_seconds: activeSeconds,
      sessions_count: sb2.count,
      action_counts: { counters: ab.counters, leadsTreated: ab.leads.size, actionsTotal: ab.total },
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length) await sb.from("activity_daily_summary").upsert(rows, { onConflict: "user_id,day" });
}

async function closeStaleSessions(sb: Sb): Promise<void> {
  const th = await getThresholds(sb);
  const cutoff = new Date(Date.now() - th.offline_after_minutes * 60_000).toISOString();
  await sb.from("user_sessions").update({ ended_at: cutoff, ended_reason: "timeout" }).is("ended_at", null).lt("last_seen_at", cutoff);
}

// ── RÈGLES ──────────────────────────────────────────────────────────────────

async function ruleLeadUntreated(sb: Sb, cfg: Record<string, unknown>): Promise<Violation[]> {
  const watch = num(cfg.watch_minutes, 5), warn = num(cfg.warn_minutes, 10), crit = num(cfg.critical_minutes, 20);
  const lookback = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: leads } = await sb
    .from("leads")
    .select("id, short_id, owner_id, received_at, status")
    .eq("status", "lead")
    .gte("received_at", lookback)
    .returns<{ id: string; short_id: string | null; owner_id: string | null; received_at: string; status: string }[]>();
  const candidates = (leads ?? []).filter((l) => Date.now() - new Date(l.received_at).getTime() >= watch * 60_000);
  if (candidates.length === 0) return [];

  const ids = candidates.map((l) => l.id);
  const { data: acts } = await sb
    .from("audit_logs")
    .select("entity_id")
    .eq("entity_type", "lead")
    .in("entity_id", ids)
    .in("action", QUALIFYING_LEAD_ACTIONS)
    .returns<{ entity_id: string | null }[]>();
  const treated = new Set((acts ?? []).map((a) => a.entity_id).filter(Boolean) as string[]);

  const out: Violation[] = [];
  for (const l of candidates) {
    if (treated.has(l.id)) continue;
    const mins = Math.floor((Date.now() - new Date(l.received_at).getTime()) / 60_000);
    const severity: AlertSeverity = mins >= crit ? "critical" : mins >= warn ? "high" : "warn";
    out.push({
      ruleKey: "lead_untreated", severity, userId: l.owner_id, entityType: "lead", entityId: l.id,
      title: `Lead ${l.short_id ?? ""} non traité depuis ${mins} min`,
      context: { shortId: l.short_id, receivedAt: l.received_at, minutes: mins },
    });
  }
  return out;
}

async function ruleUserAbsent(sb: Sb, cfg: Record<string, unknown>, day: string): Promise<Violation[]> {
  const grace = num(cfg.grace_minutes, 5);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0=dim
  const [schedRes, absRes, presRes] = await Promise.all([
    sb.from("work_schedules").select("user_id, weekday, start_time").eq("weekday", weekday).returns<{ user_id: string; weekday: number; start_time: string | null }[]>(),
    sb.from("work_absences").select("user_id").eq("day", day).returns<{ user_id: string }[]>(),
    sb.from("user_presence").select("user_id, last_seen_at").returns<{ user_id: string; last_seen_at: string | null }[]>(),
  ]);
  const scheds = schedRes.data ?? [];
  if (scheds.length === 0) return [];
  const absent = new Set((absRes.data ?? []).map((a) => a.user_id));
  const { start } = parisDayRange(day);
  const seenToday = new Map<string, boolean>();
  for (const p of presRes.data ?? []) seenToday.set(p.user_id, Boolean(p.last_seen_at && new Date(p.last_seen_at).getTime() >= new Date(start).getTime()));
  const users = await listPresenceUsers(sb);
  const nameBy = new Map(users.map((u) => [u.id, u.name]));

  const out: Violation[] = [];
  for (const s of scheds) {
    if (!s.start_time || absent.has(s.user_id)) continue;
    const startMs = new Date(`${day}T${s.start_time}`).getTime();
    if (Number.isNaN(startMs)) continue;
    const dueMs = startMs + grace * 60_000;
    if (Date.now() < dueMs) continue; // pas encore l'heure + grâce
    if (seenToday.get(s.user_id)) continue; // déjà connecté aujourd'hui
    const mins = Math.floor((Date.now() - startMs) / 60_000);
    out.push({
      ruleKey: "user_absent", severity: "critical", userId: s.user_id, entityType: "user", entityId: s.user_id,
      title: `${nameBy.get(s.user_id) ?? "Utilisateur"} non connecté (attendu à ${s.start_time.slice(0, 5)})`,
      context: { expected: s.start_time, minutes: mins },
    });
  }
  return out;
}

async function ruleInactivity(sb: Sb, cfg: Record<string, unknown>): Promise<Violation[]> {
  const minutes = num(cfg.minutes, 20);
  const th = await getThresholds(sb);
  const { data: pres } = await sb.from("user_presence").select("user_id, last_seen_at, last_active_at").returns<{ user_id: string; last_seen_at: string | null; last_active_at: string | null }[]>();
  const users = await listPresenceUsers(sb);
  const nameBy = new Map(users.map((u) => [u.id, u.name]));
  const now = Date.now();
  const out: Violation[] = [];
  for (const p of pres ?? []) {
    const seen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
    const act = p.last_active_at ? new Date(p.last_active_at).getTime() : 0;
    const online = now - seen <= th.offline_after_minutes * 60_000; // session ouverte
    const idle = now - act >= minutes * 60_000;
    if (online && idle) {
      const mins = Math.floor((now - act) / 60_000);
      out.push({
        ruleKey: "inactivity", severity: "warn", userId: p.user_id, entityType: "user", entityId: p.user_id,
        title: `${nameBy.get(p.user_id) ?? "Utilisateur"} inactif depuis ${mins} min (session ouverte)`,
        context: { minutes: mins },
      });
    }
  }
  return out;
}

async function ruleDevisNotSent(sb: Sb, cfg: Record<string, unknown>): Promise<Violation[]> {
  const hours = num(cfg.hours, 24);
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data } = await sb
    .from("documents")
    .select("id, num, created_by, issued_at, status, type")
    .eq("type", "devis")
    .eq("status", "brouillon")
    .lt("issued_at", cutoff)
    .returns<{ id: string; num: string | null; created_by: string | null; issued_at: string; status: string }[]>();
  return (data ?? []).map((d) => ({
    ruleKey: "devis_not_sent", severity: "warn", userId: d.created_by, entityType: "document", entityId: d.id,
    title: `Devis ${d.num ?? ""} non envoyé (> ${hours} h)`, context: { num: d.num, issuedAt: d.issued_at },
  }));
}

async function ruleDossierStuck(sb: Sb, cfg: Record<string, unknown>): Promise<Violation[]> {
  const days = num(cfg.days, 7);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await sb
    .from("dossiers")
    .select("id, status, updated_at, planner_id, lead_id")
    .eq("status", "a_planifier")
    .lt("updated_at", cutoff)
    .returns<{ id: string; status: string; updated_at: string; planner_id: string | null; lead_id: string | null }[]>();
  return (data ?? []).map((d) => ({
    ruleKey: "dossier_stuck", severity: "warn", userId: d.planner_id, entityType: "dossier", entityId: d.id,
    title: `Dossier à planifier depuis > ${days} j`, context: { since: d.updated_at, leadId: d.lead_id },
  }));
}
