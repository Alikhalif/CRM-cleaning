import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { notify } from "@/lib/notifications";
import { TYPE_LABEL, type ActionType } from "./shared";

// ════════════════════════════════════════════════════════════════════════════
// MOTEUR « ACTIONS & RELANCES COMMERCIALES » — couche complémentaire.
//
// Observe le pipeline EXISTANT (audit_logs déjà tracés + statut des leads) et
// matérialise, PAR LEAD, l'action commerciale à mener pour ne jamais oublier un
// lead : découverte après un appel, devis après la découverte, relance d'un
// devis envoyé. Déclenché par le cron présence (toutes les 1–2 min), requêtes
// BORNÉES (leads actifs récents), patron reconcile/dedupe identique aux alertes.
//
// N'écrit dans AUCUNE table métier. N'émet aucun nouvel événement d'audit :
// il se contente de lire ce que le CRM trace déjà.
// ════════════════════════════════════════════════════════════════════════════

type Sb = Awaited<ReturnType<typeof supabaseServiceRole>>;

// Fenêtre de balayage : leads touchés dans les 60 derniers jours (borne).
const LOOKBACK_DAYS = 60;
// Statuts « en vie » côté commercial (avant/pendant devis, pas encore soldé/perdu).
const LIVE_STATUSES = ["lead", "envoye", "ouvert"];

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

type Cfg = {
  decouverteMinutes: number;
  devisHours: number;
  relanceFirstDays: number;
  relanceEveryDays: number;
  photosFirstHours: number;
  enabled: Record<ActionType, boolean>;
};

async function loadConfig(sb: Sb): Promise<Cfg> {
  const { data } = await sb
    .from("commercial_action_rules")
    .select("key, enabled, config")
    .returns<{ key: string; enabled: boolean; config: Record<string, unknown> }[]>();
  const by = new Map((data ?? []).map((r) => [r.key, r]));
  const dec = by.get("decouverte");
  const dev = by.get("devis");
  const rel = by.get("relance");
  const pho = by.get("photos");
  return {
    decouverteMinutes: num(dec?.config?.after_minutes, 10),
    devisHours: num(dev?.config?.after_hours, 24),
    relanceFirstDays: num(rel?.config?.first_after_days, 2),
    relanceEveryDays: num(rel?.config?.every_days, 3),
    photosFirstHours: num(pho?.config?.first_after_hours, 24),
    enabled: {
      decouverte: dec?.enabled !== false,
      photos: pho?.enabled !== false,
      devis: dev?.enabled !== false,
      relance: rel?.enabled !== false,
    },
  };
}

// ── Interprétation des actions audit déjà tracées ───────────────────────────
// Appel réellement passé/abouti (webphone → lead.call.outbound ; webhook
// Ringover → lead.call.*.answered). On ignore ringing/ended/missed.
function isCallEvent(action: string): boolean {
  return action === "lead.call.outbound" || action.endsWith(".answered");
}
function isDiscoveryEvent(action: string): boolean {
  return action === "lead.discovery.save" || action === "lead.discovery.record";
}
// Sortie de relance déjà effectuée (email/SMS/consultation/séquence, ou rappel).
const RELANCE_DONE = new Set([
  "lead.relance.email",
  "lead.sms.sent",
  "lead.consultation.sent",
  "lead.sequence.launch",
  "consultation.relance",
]);

type LeadAgg = {
  id: string;
  ownerId: string | null;
  status: string;
  ref: string | null;
  name: string | null;
  lastCallAt: number;
  lastDiscoveryAt: number;
  sentAt: number; // passage à « envoyé »
  lastRelanceAt: number;
  updatedAt: number;
  photosRequestedAt: number; // leads.photos_requested_at
  lastMediaAt: number; // dernière photo/vidéo rattachée (lead_media)
  lastClientReplyAt: number; // dernière réponse e-mail du client (lead.email.reply)
};

type Desired = {
  leadId: string;
  ownerId: string | null;
  type: ActionType;
  title: string;
  reason: string;
  dueAt: number; // ms
  originEvent: string;
  subtype?: string | null;
};

function clientLabel(l: { is_company: boolean | null; client_company: string | null; client_first_name: string | null; client_last_name: string | null }): string | null {
  if (l.is_company) return l.client_company?.trim() || null;
  const n = `${l.client_first_name ?? ""} ${l.client_last_name ?? ""}`.trim();
  return n || null;
}

// ════════════════════════════════════════════════════════════════════════════
// ÉVALUATION — appelée par le cron. Renvoie un petit bilan.
// ════════════════════════════════════════════════════════════════════════════
export async function evaluateCommercialActions(): Promise<{ ok: true; open: number; created: number; closed: number; ranAt: string }> {
  const sb = await supabaseServiceRole();
  const cfg = await loadConfig(sb);
  const now = Date.now();
  const cutoffIso = new Date(now - LOOKBACK_DAYS * 86_400_000).toISOString();

  // 1) Leads « en vie » touchés récemment (borné).
  const { data: leadRows } = await sb
    .from("leads")
    .select("id, short_id, owner_id, status, updated_at, photos_requested_at, is_company, client_company, client_first_name, client_last_name")
    .in("status", LIVE_STATUSES as never[])
    .is("deleted_at", null)
    .gte("updated_at", cutoffIso)
    .returns<
      {
        id: string; short_id: string | null; owner_id: string | null; status: string; updated_at: string; photos_requested_at: string | null;
        is_company: boolean | null; client_company: string | null; client_first_name: string | null; client_last_name: string | null;
      }[]
    >();

  const leads = leadRows ?? [];
  if (leads.length === 0) {
    // rien de vivant : refermer d'éventuelles actions ouvertes devenues obsolètes
    const closed = await reconcileAll(sb, [], now);
    const { count } = await sb.from("commercial_actions").select("id", { count: "exact", head: true }).neq("status", "terminee");
    return { ok: true, open: count ?? 0, created: 0, closed, ranAt: new Date().toISOString() };
  }

  const agg = new Map<string, LeadAgg>();
  for (const l of leads) {
    agg.set(l.id, {
      id: l.id,
      ownerId: l.owner_id,
      status: l.status,
      ref: l.short_id,
      name: clientLabel(l),
      lastCallAt: 0,
      lastDiscoveryAt: 0,
      sentAt: 0,
      lastRelanceAt: 0,
      updatedAt: new Date(l.updated_at).getTime(),
      photosRequestedAt: l.photos_requested_at ? new Date(l.photos_requested_at).getTime() : 0,
      lastMediaAt: 0,
      lastClientReplyAt: 0,
    });
  }

  // 2) Événements pertinents de ces leads (borné à la fenêtre + aux ids).
  const ids = [...agg.keys()];
  const { data: auditRows } = await sb
    .from("audit_logs")
    .select("action, entity_id, after, created_at")
    .eq("entity_type", "lead")
    .in("entity_id", ids)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .returns<{ action: string; entity_id: string | null; after: Record<string, unknown> | null; created_at: string }[]>();

  for (const a of auditRows ?? []) {
    if (!a.entity_id) continue;
    const g = agg.get(a.entity_id);
    if (!g) continue;
    const t = new Date(a.created_at).getTime();
    if (isCallEvent(a.action)) g.lastCallAt = Math.max(g.lastCallAt, t);
    else if (isDiscoveryEvent(a.action)) g.lastDiscoveryAt = Math.max(g.lastDiscoveryAt, t);
    else if (RELANCE_DONE.has(a.action)) g.lastRelanceAt = Math.max(g.lastRelanceAt, t);
    else if (a.action === "lead.email.reply") g.lastClientReplyAt = Math.max(g.lastClientReplyAt, t);
    else if (a.action === "lead.status.change" && (a.after?.status === "envoye" || a.after?.status === "ouvert")) {
      if (g.sentAt === 0) g.sentAt = t; // premier passage à « devis envoyé »
    }
  }

  // 2b) Photos rattachées au dossier (lead_media) — source de vérité du
  // « rattachement ». On ne garde que la plus récente par lead (borné aux ids).
  const { data: mediaRows } = await sb
    .from("lead_media")
    .select("lead_id, created_at")
    .in("lead_id", ids)
    .is("deleted_at", null)
    .returns<{ lead_id: string; created_at: string }[]>();
  for (const m of mediaRows ?? []) {
    const g = agg.get(m.lead_id);
    if (!g) continue;
    g.lastMediaAt = Math.max(g.lastMediaAt, new Date(m.created_at).getTime());
  }

  // 3) Actions désirées, par lead et par type.
  const desired: Desired[] = [];
  for (const g of agg.values()) {
    // ── Scénario 1 : découverte après un appel ──
    if (cfg.enabled.decouverte && g.status === "lead" && g.lastCallAt > 0 && g.lastDiscoveryAt < g.lastCallAt) {
      const due = g.lastCallAt + cfg.decouverteMinutes * 60_000;
      if (now >= due) {
        desired.push({
          leadId: g.id, ownerId: g.ownerId, type: "decouverte",
          title: `Compléter la découverte — ${g.ref ?? g.name ?? "lead"}`,
          reason: `Appel passé, découverte non enregistrée après ${cfg.decouverteMinutes} min.`,
          dueAt: due, originEvent: "lead.call.outbound",
        });
      }
    }
    // ── Scénario « photos » : demande faite, aucune photo rattachée ──
    // Bloque le devis tant que les photos manquent (Appel → découverte →
    // demande photos → réception → devis).
    const waitingPhotos =
      g.photosRequestedAt > 0 &&
      g.lastMediaAt < g.photosRequestedAt &&
      (g.status === "lead" || g.status === "envoye" || g.status === "ouvert");
    if (cfg.enabled.photos && waitingPhotos) {
      const due = g.photosRequestedAt + cfg.photosFirstHours * 3_600_000;
      if (now >= due) {
        const repliedSince = g.lastClientReplyAt > g.photosRequestedAt;
        desired.push({
          leadId: g.id, ownerId: g.ownerId, type: "photos",
          subtype: repliedSince ? "a_verifier" : "attente",
          title: `Relancer pour les photos — ${g.ref ?? g.name ?? "lead"}`,
          reason: repliedSince
            ? "Le client a répondu mais aucune photo n'est rattachée au dossier — vérifier le rattachement avant de relancer."
            : `Photos demandées, toujours aucune reçue après ${cfg.photosFirstHours} h.`,
          dueAt: due, originEvent: "lead.photos.request",
        });
      }
    }
    // ── Scénario 2 : devis après la découverte (bloqué si photos en attente) ──
    if (cfg.enabled.devis && g.status === "lead" && g.lastDiscoveryAt > 0 && !waitingPhotos) {
      const due = g.lastDiscoveryAt + cfg.devisHours * 3_600_000;
      if (now >= due) {
        desired.push({
          leadId: g.id, ownerId: g.ownerId, type: "devis",
          title: `Envoyer le devis — ${g.ref ?? g.name ?? "lead"}`,
          reason: `Découverte faite, devis non envoyé après ${cfg.devisHours} h.`,
          dueAt: due, originEvent: "lead.discovery.save",
        });
      }
    }
    // ── Scénario 3 : relance d'un devis envoyé non closé ──
    if (cfg.enabled.relance && (g.status === "envoye" || g.status === "ouvert")) {
      const sent = g.sentAt || g.updatedAt; // repli : dernière modif du lead
      const firstDue = sent + cfg.relanceFirstDays * 86_400_000;
      const nextDue = g.lastRelanceAt > sent ? g.lastRelanceAt + cfg.relanceEveryDays * 86_400_000 : firstDue;
      if (now >= nextDue) {
        const rank = g.lastRelanceAt > sent ? "Relancer à nouveau" : "Première relance";
        desired.push({
          leadId: g.id, ownerId: g.ownerId, type: "relance",
          title: `${rank} — ${g.ref ?? g.name ?? "lead"}`,
          reason: `Devis envoyé non signé. ${g.lastRelanceAt > sent ? "Relance précédente sans réponse." : "Aucune relance encore."}`,
          dueAt: nextDue, originEvent: "lead.status.change",
        });
      }
    }
  }

  // 4) Réconciliation par type.
  const { created, closed } = await reconcileWithCounts(sb, desired, now);
  const { count } = await sb.from("commercial_actions").select("id", { count: "exact", head: true }).neq("status", "terminee");
  return { ok: true, open: count ?? 0, created, closed, ranAt: new Date().toISOString() };
}

// Réconcilie tous les types (utilisé quand aucun lead vivant → tout fermer).
async function reconcileAll(sb: Sb, desired: Desired[], now: number): Promise<number> {
  const { closed } = await reconcileWithCounts(sb, desired, now);
  return closed;
}

// ── Réconciliation : ouvre les manquantes, ferme celles dont l'objectif est
// atteint (l'action attendue a eu lieu → l'action désirée disparaît). ─────────
async function reconcileWithCounts(sb: Sb, desired: Desired[], now: number): Promise<{ created: number; closed: number }> {
  const nowIso = new Date(now).toISOString();
  let created = 0;

  // Actions actuellement ouvertes (non terminées).
  const { data: openRows } = await sb
    .from("commercial_actions")
    .select("id, lead_id, owner_id, type, status, created_at, subtype, title")
    .neq("status", "terminee")
    .returns<{ id: string; lead_id: string; owner_id: string | null; type: string; status: string; created_at: string; subtype: string | null; title: string }[]>();

  const key = (leadId: string, type: string) => `${leadId}|${type}`;
  const openBy = new Map((openRows ?? []).map((r) => [key(r.lead_id, r.type), r]));

  for (const d of desired) {
    const k = key(d.leadId, d.type);
    const existing = openBy.get(k);
    if (existing) {
      openBy.delete(k); // déjà ouverte → pas de churn, sauf si le sous-type ou le
      // titre a évolué (ex. photos : attente → « rattachement à vérifier »).
      const subtype = d.subtype ?? null;
      if (existing.subtype !== subtype || existing.title !== d.title) {
        await sb.from("commercial_actions").update({ subtype, title: d.title, reason: d.reason }).eq("id", existing.id);
      }
      continue;
    }
    // Création (dedup garanti par l'index unique partiel ; on ignore un conflit).
    const { data: ins, error } = await sb
      .from("commercial_actions")
      .insert({
        lead_id: d.leadId,
        owner_id: d.ownerId,
        type: d.type,
        title: d.title,
        reason: d.reason,
        status: "a_faire",
        due_at: new Date(d.dueAt).toISOString(),
        origin_event: d.originEvent,
        subtype: d.subtype ?? null,
      })
      .select("id")
      .single();
    if (error || !ins) continue; // conflit d'unicité (course) → ignoré
    created += 1;
    await sb.from("commercial_action_events").insert({
      action_id: ins.id, kind: "created", detail: { type: d.type, dueAt: new Date(d.dueAt).toISOString(), origin: d.originEvent },
    });
    if (d.ownerId) {
      await notify({
        userId: d.ownerId,
        kind: "commercial_action",
        entityType: "lead",
        entityId: d.leadId,
        title: `${TYPE_LABEL[d.type]} à faire`,
        body: d.reason,
        href: `/leads/${d.leadId}`,
      });
    }
  }

  // Actions ouvertes restantes = objectif atteint (ou lead sorti du périmètre)
  // → clôture automatique. Pour les photos : la présence d'un média rattaché
  // depuis la demande est ce qui fait disparaître l'action → « photos reçues ».
  for (const [, a] of openBy) {
    const result = a.type === "photos" ? "photos reçues et rattachées" : "objectif atteint";
    await sb.from("commercial_actions").update({
      status: "terminee", closed_at: nowIso, closed_reason: "auto", result,
    }).eq("id", a.id);
    await sb.from("commercial_action_events").insert({ action_id: a.id, kind: "closed", detail: { reason: "auto", result, at: nowIso } });
  }

  return { created, closed: openBy.size };
}
