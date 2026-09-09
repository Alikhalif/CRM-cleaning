import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import {
  DEFAULT_THRESHOLDS,
  actionMeta,
  type PresenceThresholds,
  type PresenceStatus,
} from "./taxonomy";
import type { TeamRow, UserDaySummary, TimelineSegment, ActionEvent } from "./types";

type Sb = Awaited<ReturnType<typeof supabaseServiceRole>>;

// ── Fenêtre d'un jour (Europe/Paris) exprimée en UTC ISO ────────────────────
function parisOffsetMinutes(dayISO: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "shortOffset",
  });
  const tzn =
    dtf.formatToParts(new Date(`${dayISO}T12:00:00Z`)).find((p) => p.type === "timeZoneName")?.value ??
    "GMT+1";
  const m = /GMT([+-]\d+)(?::(\d+))?/.exec(tzn);
  const h = m ? parseInt(m[1], 10) : 1;
  const min = m && m[2] ? parseInt(m[2], 10) : 0;
  return h * 60 + (h < 0 ? -min : min);
}
export function parisDayRange(dayISO: string): { start: string; end: string } {
  const off = parisOffsetMinutes(dayISO);
  const startMs = new Date(`${dayISO}T00:00:00Z`).getTime() - off * 60000;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + 86_400_000).toISOString(),
  };
}
export function todayParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

// ── Liste des utilisateurs suivis (léger : id, nom, rôles, actif) ──────────
export type UserLite = { id: string; name: string; roles: string[]; isActive: boolean };
export async function listPresenceUsers(client?: Sb): Promise<UserLite[]> {
  const sb = client ?? (await supabaseServiceRole());
  const [uRes, rRes] = await Promise.all([
    sb.from("users").select("id, first_name, last_name, email, is_active").order("first_name"),
    sb.from("user_roles").select("user_id, roles(slug)").returns<{ user_id: string; roles: { slug: string } | null }[]>(),
  ]);
  const rolesBy = new Map<string, string[]>();
  for (const r of rRes.data ?? []) {
    if (!r.roles) continue;
    const a = rolesBy.get(r.user_id) ?? [];
    a.push(r.roles.slug);
    rolesBy.set(r.user_id, a);
  }
  return ((uRes.data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; is_active: boolean | null }[]).map((u) => ({
    id: u.id,
    name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "Utilisateur",
    roles: rolesBy.get(u.id) ?? [],
    isActive: u.is_active !== false,
  }));
}

// ── Seuils (paramétrables) ──────────────────────────────────────────────────
// Cache mémoire court (30 s) : les seuils changent rarement mais getThresholds
// est appelé à chaque heartbeat (toutes les 45 s / utilisateur). Évite une
// requête DB par battement. Invalidé quand le Super Admin modifie les seuils.
let thCache: { at: number; val: PresenceThresholds } | null = null;
export function invalidateThresholdsCache(): void {
  thCache = null;
}
export async function getThresholds(client?: Sb): Promise<PresenceThresholds> {
  if (thCache && Date.now() - thCache.at < 30_000) return thCache.val;
  const sb = client ?? (await supabaseServiceRole());
  const { data } = await sb
    .from("presence_config")
    .select("value")
    .eq("key", "thresholds")
    .maybeSingle<{ value: Partial<PresenceThresholds> }>();
  const val = { ...DEFAULT_THRESHOLDS, ...(data?.value ?? {}) };
  thCache = { at: Date.now(), val };
  return val;
}

type PresenceRow = {
  user_id: string;
  status: string;
  last_seen_at: string | null;
  last_active_at: string | null;
};

// Statut effectif recalculé à la lecture (indépendant de l'écriture) selon les
// seuils : actif = interaction récente ; inactif = session ouverte mais rien
// depuis N min ; hors ligne = plus de battement depuis M min.
export function computeStatus(
  p: Pick<PresenceRow, "last_seen_at" | "last_active_at">,
  th: PresenceThresholds,
  now = Date.now(),
): PresenceStatus {
  const seen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
  const active = p.last_active_at ? new Date(p.last_active_at).getTime() : 0;
  if (now - seen > th.offline_after_minutes * 60_000) return "offline";
  if (now - active > th.inactive_after_minutes * 60_000) return "inactive";
  return "active";
}

// Structure stockée dans activity_daily_summary.action_counts.
type DailyCounts = {
  counters: Record<string, number>;
  leadsTreated: number;
  actionsTotal: number;
};

// ── VUE ÉQUIPE (jour) ───────────────────────────────────────────────────────
export async function getTeamToday(day = todayParis()): Promise<TeamRow[]> {
  const sb = await supabaseServiceRole();
  const [th, users, presenceRes, summaryRes, alertsRes] = await Promise.all([
    getThresholds(sb),
    listPresenceUsers(sb),
    sb.from("user_presence").select("user_id, status, last_seen_at, last_active_at"),
    sb.from("activity_daily_summary").select("*").eq("day", day),
    sb.from("alerts").select("user_id, severity").eq("status", "open"),
  ]);

  const presenceBy = new Map<string, PresenceRow>();
  for (const p of (presenceRes.data ?? []) as PresenceRow[]) presenceBy.set(p.user_id, p);
  const summaryBy = new Map<string, Record<string, unknown>>();
  for (const s of summaryRes.data ?? []) summaryBy.set(s.user_id as string, s);

  const rank = { watch: 1, warn: 2, high: 3, critical: 4 } as const;
  const alertsBy = new Map<string, { count: number; top: keyof typeof rank | null }>();
  for (const a of (alertsRes.data ?? []) as { user_id: string | null; severity: keyof typeof rank }[]) {
    if (!a.user_id) continue;
    const cur = alertsBy.get(a.user_id) ?? { count: 0, top: null };
    cur.count += 1;
    if (!cur.top || rank[a.severity] > rank[cur.top]) cur.top = a.severity;
    alertsBy.set(a.user_id, cur);
  }

  return users
    .filter((u) => u.isActive)
    .map((u): TeamRow => {
      const p = presenceBy.get(u.id);
      const s = summaryBy.get(u.id);
      const counts = (s?.action_counts as DailyCounts | undefined) ?? { counters: {}, leadsTreated: 0, actionsTotal: 0 };
      const al = alertsBy.get(u.id);
      return {
        userId: u.id,
        name: u.name,
        roles: u.roles,
        status: p ? computeStatus(p, th) : "offline",
        firstSeenAt: (s?.first_seen_at as string) ?? null,
        lastActiveAt: p?.last_active_at ?? null,
        activeSeconds: (s?.active_seconds as number) ?? 0,
        sessionSeconds: (s?.session_seconds as number) ?? 0,
        actionsCount: counts.actionsTotal ?? 0,
        leadsTreated: counts.leadsTreated ?? 0,
        openAlerts: al?.count ?? 0,
        topSeverity: al?.top ?? null,
      };
    })
    .sort((a, b) => b.actionsCount - a.actionsCount);
}

// ── FICHE UTILISATEUR (jour) ────────────────────────────────────────────────
export async function getUserDay(userId: string, day = todayParis()): Promise<UserDaySummary | null> {
  const sb = await supabaseServiceRole();
  const { start, end } = parisDayRange(day);
  const [th, userRes, summaryRes, pingsRes, presRes] = await Promise.all([
    getThresholds(sb),
    sb.from("users").select("first_name, last_name, email").eq("id", userId).maybeSingle<{ first_name: string | null; last_name: string | null; email: string | null }>(),
    sb.from("activity_daily_summary").select("*").eq("user_id", userId).eq("day", day).maybeSingle(),
    sb.from("presence_pings").select("ts, active").eq("user_id", userId).gte("ts", start).lt("ts", end).order("ts", { ascending: true }),
    sb.from("user_presence").select("last_seen_at, last_active_at").eq("user_id", userId).maybeSingle<PresenceRow>(),
  ]);
  if (!userRes.data) return null;

  const name = [userRes.data.first_name, userRes.data.last_name].filter(Boolean).join(" ") || userRes.data.email || "Utilisateur";
  const pings = (pingsRes.data ?? []) as { ts: string; active: boolean }[];
  const timeline = buildTimeline(pings, th);
  const activeSeconds = timeline.filter((t) => t.kind === "active").reduce((s, t) => s + t.seconds, 0);
  const s = summaryRes.data;
  const counts = (s?.action_counts as DailyCounts | undefined) ?? { counters: {}, leadsTreated: 0, actionsTotal: 0 };
  const sessionSeconds = (s?.session_seconds as number) ?? (pings.length ? Math.round((new Date(pings[pings.length - 1].ts).getTime() - new Date(pings[0].ts).getTime()) / 1000) : 0);

  return {
    userId,
    name,
    day,
    status: presRes.data && day === todayParis() ? computeStatus(presRes.data, th) : "offline",
    firstSeenAt: (s?.first_seen_at as string) ?? (pings[0]?.ts ?? null),
    lastSeenAt: (s?.last_seen_at as string) ?? (pings[pings.length - 1]?.ts ?? null),
    lastActiveAt: presRes.data?.last_active_at ?? null,
    sessionSeconds,
    activeSeconds,
    inactiveSeconds: Math.max(0, sessionSeconds - activeSeconds),
    sessionsCount: (s?.sessions_count as number) ?? 0,
    counters: { ...(counts.counters ?? {}), leads_traites: counts.leadsTreated ?? 0 },
    timeline,
  };
}

// Reconstruit la timeline présence (segments actif/inactif) à partir des pings.
// Un « trou » entre deux battements > seuil hors-ligne coupe la session.
export function buildTimeline(pings: { ts: string; active: boolean }[], th: PresenceThresholds): TimelineSegment[] {
  if (pings.length === 0) return [];
  const gap = th.offline_after_minutes * 60_000;
  const step = th.heartbeat_seconds * 1000;
  const segs: TimelineSegment[] = [];
  let curKind: "active" | "inactive" | null = null;
  let curStart = 0;
  let prev = 0;

  const push = (endMs: number) => {
    if (curKind && curStart) segs.push({ kind: curKind, start: new Date(curStart).toISOString(), end: new Date(endMs).toISOString(), seconds: Math.max(0, Math.round((endMs - curStart) / 1000)) });
  };

  for (const p of pings) {
    const t = new Date(p.ts).getTime();
    const kind: "active" | "inactive" = p.active ? "active" : "inactive";
    if (curKind === null) {
      curKind = kind; curStart = t; prev = t; continue;
    }
    if (t - prev > gap) {
      // coupure de session
      push(prev + step);
      curKind = kind; curStart = t; prev = t; continue;
    }
    if (kind !== curKind) {
      push(t); curKind = kind; curStart = t;
    }
    prev = t;
  }
  push(prev + step);
  return segs;
}

// ── ACTIONS (détail / recherche) — lecture directe de audit_logs ────────────
export type ActionFilters = {
  userId?: string | null;
  day?: string | null; // YYYY-MM-DD (sinon range explicite)
  from?: string | null; // ISO
  to?: string | null; // ISO
  category?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  limit?: number;
  offset?: number;
};

type AuditRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

export async function getActions(filters: ActionFilters): Promise<{ events: ActionEvent[]; total: number }> {
  const sb = await supabaseServiceRole();
  let range: { start: string; end: string } | null = null;
  if (filters.day) range = parisDayRange(filters.day);
  else if (filters.from && filters.to) range = { start: filters.from, end: filters.to };

  let q = sb.from("audit_logs").select("id, user_id, action, entity_type, entity_id, before, after, created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (filters.userId) q = q.eq("user_id", filters.userId);
  if (range) q = q.gte("created_at", range.start).lt("created_at", range.end);
  if (filters.entityType) q = q.eq("entity_type", filters.entityType);
  if (filters.entityId) q = q.eq("entity_id", filters.entityId);
  const limit = Math.min(filters.limit ?? 200, 500);
  q = q.range(filters.offset ?? 0, (filters.offset ?? 0) + limit - 1);

  const { data, count } = await q.returns<AuditRow[]>();
  let rows = data ?? [];
  if (filters.category) rows = rows.filter((r) => actionMeta(r.action).cat === filters.category);

  const refs = await resolveEntityRefs(sb, rows);
  const events: ActionEvent[] = rows.map((r) => {
    const meta = actionMeta(r.action);
    return {
      id: r.id,
      at: r.created_at,
      action: r.action,
      label: meta.label,
      verb: meta.verb,
      category: meta.cat,
      entityType: r.entity_type,
      entityId: r.entity_id,
      entityRef: r.entity_id ? refs.get(`${r.entity_type}:${r.entity_id}`) ?? null : null,
      before: r.before,
      after: r.after,
    };
  });
  return { events, total: count ?? events.length };
}

// « Qui a fait quoi sur le lead / dossier #X » (audit trail d'une entité).
export async function getEntityAudit(entityType: string, entityId: string): Promise<ActionEvent[]> {
  const { events } = await getActions({ entityType, entityId, limit: 500 });
  return events.slice().reverse(); // chronologique
}

// Résout les références lisibles (L-xxxx, DEV-/FAC-…) par lot.
async function resolveEntityRefs(sb: Sb, rows: AuditRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const leadIds = [...new Set(rows.filter((r) => r.entity_type === "lead" && r.entity_id).map((r) => r.entity_id!))];
  const docIds = [...new Set(rows.filter((r) => r.entity_type === "document" && r.entity_id).map((r) => r.entity_id!))];
  await Promise.all([
    leadIds.length
      ? sb.from("leads").select("id, short_id").in("id", leadIds).then(({ data }) => {
          for (const l of (data ?? []) as { id: string; short_id: string | null }[]) if (l.short_id) out.set(`lead:${l.id}`, l.short_id);
        })
      : Promise.resolve(),
    docIds.length
      ? sb.from("documents").select("id, num").in("id", docIds).then(({ data }) => {
          for (const d of (data ?? []) as { id: string; num: string | null }[]) if (d.num) out.set(`document:${d.id}`, d.num);
        })
      : Promise.resolve(),
  ]);
  return out;
}
