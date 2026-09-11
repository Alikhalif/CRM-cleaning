import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { bucketOf, priorityOf, isActionable, type ActionType, type CommercialAction, type PhotoSubtype } from "./shared";

// Lectures du module (pages RSC). La page appelante a déjà vérifié la session ;
// on lit en service-role puis on filtre explicitement par propriétaire (Ma
// journée) ou sans filtre pour le manager. La RLS reste la garde de fond
// (owner = auth.uid() OU admin/planificateur).

type Sb = Awaited<ReturnType<typeof supabaseServiceRole>>;

type ActionDbRow = {
  id: string; lead_id: string; owner_id: string | null; type: string; title: string;
  reason: string | null; status: string; created_at: string; due_at: string;
  snoozed_until: string | null; report_count: number; closed_at: string | null;
  closed_reason: string | null; result: string | null; subtype: string | null;
};

export type CommercialRule = { key: string; label: string; enabled: boolean; config: Record<string, number> };

export async function getCommercialRules(): Promise<CommercialRule[]> {
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("commercial_action_rules").select("key, label, enabled, config").order("key").returns<{ key: string; label: string; enabled: boolean; config: Record<string, number> }[]>();
  return (data ?? []) as CommercialRule[];
}

export async function getUrgentAfterHours(sb?: Sb): Promise<number> {
  const c = sb ?? (await supabaseServiceRole());
  const { data } = await c.from("commercial_action_rules").select("config").eq("key", "priority").maybeSingle<{ config: Record<string, unknown> }>();
  const v = data?.config?.urgent_after_hours;
  return typeof v === "number" && Number.isFinite(v) ? v : 48;
}

// Hydrate les références lisibles du lead + le nom du propriétaire.
async function hydrate(sb: Sb, rows: ActionDbRow[]): Promise<CommercialAction[]> {
  const leadIds = [...new Set(rows.map((r) => r.lead_id))];
  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean) as string[])];
  const leadBy = new Map<string, { ref: string | null; name: string | null }>();
  const ownerBy = new Map<string, string>();

  await Promise.all([
    leadIds.length
      ? sb.from("leads").select("id, short_id, is_company, client_company, client_first_name, client_last_name").in("id", leadIds).then(({ data }) => {
          for (const l of (data ?? []) as { id: string; short_id: string | null; is_company: boolean | null; client_company: string | null; client_first_name: string | null; client_last_name: string | null }[]) {
            const name = l.is_company ? (l.client_company?.trim() || null) : (`${l.client_first_name ?? ""} ${l.client_last_name ?? ""}`.trim() || null);
            leadBy.set(l.id, { ref: l.short_id, name });
          }
        })
      : Promise.resolve(),
    ownerIds.length
      ? sb.from("users").select("id, first_name, last_name, email").in("id", ownerIds).then(({ data }) => {
          for (const u of (data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]) {
            ownerBy.set(u.id, [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "Utilisateur");
          }
        })
      : Promise.resolve(),
  ]);

  return rows.map((r) => {
    const l = leadBy.get(r.lead_id);
    return {
      id: r.id,
      leadId: r.lead_id,
      leadRef: l?.ref ?? null,
      leadName: l?.name ?? null,
      ownerId: r.owner_id,
      ownerName: r.owner_id ? ownerBy.get(r.owner_id) ?? null : null,
      type: r.type as ActionType,
      title: r.title,
      reason: r.reason,
      status: r.status as CommercialAction["status"],
      createdAt: r.created_at,
      dueAt: r.due_at,
      snoozedUntil: r.snoozed_until,
      reportCount: r.report_count,
      closedAt: r.closed_at,
      closedReason: r.closed_reason,
      result: r.result,
      subtype: (r.subtype as PhotoSubtype | null) ?? null,
    };
  });
}

// ── Ma journée : actions actives du commercial + terminées récentes ─────────
export async function getMyActions(userId: string): Promise<{ actions: CommercialAction[]; urgentAfterHours: number }> {
  const sb = await supabaseServiceRole();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString(); // terminées des 7 derniers jours
  const [activeRes, doneRes, urgentAfterHours] = await Promise.all([
    sb.from("commercial_actions").select("*").eq("owner_id", userId).neq("status", "terminee").order("due_at", { ascending: true }).returns<ActionDbRow[]>(),
    sb.from("commercial_actions").select("*").eq("owner_id", userId).eq("status", "terminee").gte("closed_at", since).order("closed_at", { ascending: false }).limit(100).returns<ActionDbRow[]>(),
    getUrgentAfterHours(sb),
  ]);
  const actions = await hydrate(sb, [...(activeRes.data ?? []), ...(doneRes.data ?? [])]);
  return { actions, urgentAfterHours };
}

// Compteur pour le badge de navigation « Ma journée ».
export async function getMyActionableCount(userId: string): Promise<number> {
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("commercial_actions").select("due_at, snoozed_until, status").eq("owner_id", userId).neq("status", "terminee").returns<{ due_at: string; snoozed_until: string | null; status: string }[]>();
  const now = Date.now();
  return (data ?? []).filter((r) => isActionable({ dueAt: r.due_at, snoozedUntil: r.snoozed_until, status: r.status as CommercialAction["status"] }, now)).length;
}

// ── Bloc « Prochaine action » sur la fiche lead ─────────────────────────────
export async function getNextActionForLead(leadId: string): Promise<CommercialAction | null> {
  const sb = await supabaseServiceRole();
  const { data } = await sb.from("commercial_actions").select("*").eq("lead_id", leadId).neq("status", "terminee").order("due_at", { ascending: true }).limit(1).returns<ActionDbRow[]>();
  if (!data || data.length === 0) return null;
  const [a] = await hydrate(sb, data);
  return a ?? null;
}

// ── Vue manager (admin / planificateur) ─────────────────────────────────────
export type ManagerData = {
  urgentAfterHours: number;
  totals: { a_faire: number; en_retard: number; urgent: number; termineesToday: number };
  byType: Record<ActionType, { open: number; en_retard: number }>;
  byOwner: { ownerId: string | null; ownerName: string; open: number; en_retard: number; urgent: number }[];
  avgDelays: { decouverte: number | null; photos: number | null; devis: number | null; relance: number | null }; // heures moyennes de traitement (manuel)
  actions: CommercialAction[]; // actives, pour le tableau
};

export async function getManagerData(): Promise<ManagerData> {
  const sb = await supabaseServiceRole();
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [activeRes, doneTodayRes, doneMonthRes, urgentAfterHours] = await Promise.all([
    sb.from("commercial_actions").select("*").neq("status", "terminee").order("due_at", { ascending: true }).returns<ActionDbRow[]>(),
    sb.from("commercial_actions").select("id", { count: "exact", head: true }).eq("status", "terminee").gte("closed_at", todayStart.toISOString()),
    sb.from("commercial_actions").select("type, created_at, closed_at, closed_reason").eq("status", "terminee").gte("closed_at", new Date(now - 30 * 86_400_000).toISOString()).returns<{ type: string; created_at: string; closed_at: string | null; closed_reason: string | null }[]>(),
    getUrgentAfterHours(sb),
  ]);

  const actions = await hydrate(sb, activeRes.data ?? []);

  const totals = { a_faire: 0, en_retard: 0, urgent: 0, termineesToday: doneTodayRes.count ?? 0 };
  const byType: Record<ActionType, { open: number; en_retard: number }> = {
    decouverte: { open: 0, en_retard: 0 }, photos: { open: 0, en_retard: 0 }, devis: { open: 0, en_retard: 0 }, relance: { open: 0, en_retard: 0 },
  };
  const ownerMap = new Map<string, { ownerId: string | null; ownerName: string; open: number; en_retard: number; urgent: number }>();

  for (const a of actions) {
    const bucket = bucketOf(a, now);
    const prio = priorityOf(a, urgentAfterHours, now);
    if (bucket === "en_retard") totals.en_retard += 1;
    else if (bucket === "a_faire") totals.a_faire += 1;
    if (prio === "urgent") totals.urgent += 1;
    byType[a.type].open += 1;
    if (bucket === "en_retard") byType[a.type].en_retard += 1;

    const okey = a.ownerId ?? "—";
    const o = ownerMap.get(okey) ?? { ownerId: a.ownerId, ownerName: a.ownerName ?? "Non attribué", open: 0, en_retard: 0, urgent: 0 };
    o.open += 1;
    if (bucket === "en_retard") o.en_retard += 1;
    if (prio === "urgent") o.urgent += 1;
    ownerMap.set(okey, o);
  }

  // Délai moyen de traitement (création → clôture) sur 30 j, par type.
  const sums: Record<string, { total: number; n: number }> = {};
  for (const d of doneMonthRes.data ?? []) {
    if (!d.closed_at) continue;
    const hrs = (new Date(d.closed_at).getTime() - new Date(d.created_at).getTime()) / 3_600_000;
    if (hrs < 0) continue;
    const s = sums[d.type] ?? { total: 0, n: 0 };
    s.total += hrs; s.n += 1; sums[d.type] = s;
  }
  const avg = (t: string) => (sums[t]?.n ? Math.round((sums[t].total / sums[t].n) * 10) / 10 : null);

  return {
    urgentAfterHours,
    totals,
    byType,
    byOwner: [...ownerMap.values()].sort((a, b) => b.en_retard - a.en_retard || b.open - a.open),
    avgDelays: { decouverte: avg("decouverte"), photos: avg("photos"), devis: avg("devis"), relance: avg("relance") },
    actions,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// « CLIENTS EN ATTENTE DE PHOTOS » — vue transverse (dashboard + onglet Photos).
// Source de vérité : leads.photos_requested_at posé + AUCUN média rattaché
// (lead_media) depuis la demande. Indépendant de l'existence d'une action (la
// liste s'affiche dès la demande ; l'action de relance n'apparaît qu'après le
// délai). Borné aux dossiers vivants ayant une demande récente.
// ════════════════════════════════════════════════════════════════════════════
export type PhotoWaitingRow = {
  leadId: string;
  leadRef: string | null;
  leadName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  requestedAt: string;
  channel: "email" | "sms" | null;
  lastContactAt: string | null;
  status: PhotoSubtype; // attente | a_verifier
  nextRelanceAt: string | null;
};

const PHOTO_LIVE_STATUSES = ["lead", "envoye", "ouvert"];
// Événements qui comptent comme « dernier contact » avec le client.
const CONTACT_ACTIONS = new Set(["lead.photos.request", "lead.relance.email", "lead.sms.sent", "lead.email.reply", "lead.call.outbound"]);
function isContactAction(a: string): boolean {
  return CONTACT_ACTIONS.has(a) || a.startsWith("lead.call.outbound");
}

export async function getPhotoWaiting(opts: { ownerId?: string } = {}): Promise<PhotoWaitingRow[]> {
  const sb = await supabaseServiceRole();
  const now = Date.now();
  const firstHours = await getPhotosFirstHours(sb);
  const recentIso = new Date(now - 90 * 86_400_000).toISOString();

  // 1) Dossiers vivants avec une demande de photos récente.
  let q = sb
    .from("leads")
    .select("id, short_id, owner_id, status, photos_requested_at, is_company, client_company, client_first_name, client_last_name")
    .not("photos_requested_at", "is", null)
    .in("status", PHOTO_LIVE_STATUSES as never[])
    .is("deleted_at", null)
    .gte("photos_requested_at", recentIso);
  if (opts.ownerId) q = q.eq("owner_id", opts.ownerId);
  const { data: leads } = await q.returns<
    { id: string; short_id: string | null; owner_id: string | null; status: string; photos_requested_at: string; is_company: boolean | null; client_company: string | null; client_first_name: string | null; client_last_name: string | null }[]
  >();
  if (!leads || leads.length === 0) return [];

  const ids = leads.map((l) => l.id);
  const reqAt = new Map(leads.map((l) => [l.id, new Date(l.photos_requested_at).getTime()]));

  // 2) Médias rattachés (pour écarter ceux déjà reçus depuis la demande).
  const [mediaRes, auditRes, actionsRes, ownersRes] = await Promise.all([
    sb.from("lead_media").select("lead_id, created_at").in("lead_id", ids).is("deleted_at", null).returns<{ lead_id: string; created_at: string }[]>(),
    sb.from("audit_logs").select("action, entity_id, after, created_at").eq("entity_type", "lead").in("entity_id", ids).order("created_at", { ascending: true }).returns<{ action: string; entity_id: string | null; after: Record<string, unknown> | null; created_at: string }[]>(),
    sb.from("commercial_actions").select("lead_id, due_at, snoozed_until").eq("type", "photos").neq("status", "terminee").in("lead_id", ids).returns<{ lead_id: string; due_at: string; snoozed_until: string | null }[]>(),
    (async () => {
      const oids = [...new Set(leads.map((l) => l.owner_id).filter(Boolean) as string[])];
      if (!oids.length) return new Map<string, string>();
      const { data } = await sb.from("users").select("id, first_name, last_name, email").in("id", oids);
      return new Map(((data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]).map((u) => [u.id, [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "Utilisateur"]));
    })(),
  ]);

  const lastMediaAt = new Map<string, number>();
  for (const m of mediaRes.data ?? []) lastMediaAt.set(m.lead_id, Math.max(lastMediaAt.get(m.lead_id) ?? 0, new Date(m.created_at).getTime()));

  const channelBy = new Map<string, "email" | "sms" | null>();
  const lastContactBy = new Map<string, number>();
  const repliedSince = new Map<string, boolean>();
  for (const a of auditRes.data ?? []) {
    if (!a.entity_id) continue;
    const t = new Date(a.created_at).getTime();
    if (a.action === "lead.photos.request") {
      const ch = a.after?.channel;
      channelBy.set(a.entity_id, ch === "email" || ch === "sms" ? ch : null);
    }
    if (isContactAction(a.action)) lastContactBy.set(a.entity_id, Math.max(lastContactBy.get(a.entity_id) ?? 0, t));
    if (a.action === "lead.email.reply" && t >= (reqAt.get(a.entity_id) ?? 0)) repliedSince.set(a.entity_id, true);
  }

  const nextRelanceBy = new Map<string, string>();
  for (const ac of actionsRes.data ?? []) {
    const due = ac.snoozed_until && new Date(ac.snoozed_until).getTime() > new Date(ac.due_at).getTime() ? ac.snoozed_until : ac.due_at;
    nextRelanceBy.set(ac.lead_id, due);
  }
  const ownerBy = ownersRes;

  const rows: PhotoWaitingRow[] = [];
  for (const l of leads) {
    const req = reqAt.get(l.id) ?? 0;
    if ((lastMediaAt.get(l.id) ?? 0) >= req) continue; // photo déjà rattachée depuis la demande → pas en attente
    const name = l.is_company ? (l.client_company?.trim() || null) : (`${l.client_first_name ?? ""} ${l.client_last_name ?? ""}`.trim() || null);
    rows.push({
      leadId: l.id,
      leadRef: l.short_id,
      leadName: name,
      ownerId: l.owner_id,
      ownerName: l.owner_id ? ownerBy.get(l.owner_id) ?? null : null,
      requestedAt: l.photos_requested_at,
      channel: channelBy.get(l.id) ?? null,
      lastContactAt: lastContactBy.has(l.id) ? new Date(lastContactBy.get(l.id)!).toISOString() : null,
      status: repliedSince.get(l.id) ? "a_verifier" : "attente",
      nextRelanceAt: nextRelanceBy.get(l.id) ?? new Date(req + firstHours * 3_600_000).toISOString(),
    });
  }
  // Les plus anciennes demandes d'abord (les plus « bloquantes »).
  rows.sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  return rows;
}

async function getPhotosFirstHours(sb: Sb): Promise<number> {
  const { data } = await sb.from("commercial_action_rules").select("config").eq("key", "photos").maybeSingle<{ config: Record<string, unknown> }>();
  const v = data?.config?.first_after_hours;
  return typeof v === "number" && Number.isFinite(v) ? v : 24;
}

// Compteur pour l'indicateur dashboard « Clients en attente de photos ».
export async function getPhotoWaitingCount(ownerId?: string): Promise<number> {
  return (await getPhotoWaiting(ownerId ? { ownerId } : {})).length;
}
