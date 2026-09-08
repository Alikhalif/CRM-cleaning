import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { getThresholds } from "./presence-server";

// Écriture de la présence. Appelée par l'endpoint /api/presence/* APRÈS
// vérification de la session (l'API passe l'user_id authentifié). On écrit en
// service-role : les tables présence n'ont pas de politique d'écriture
// utilisateur (lecture réservée admin), donc pas d'écriture directe navigateur.
// Best-effort : ne doit jamais faire échouer une action du CRM.

export async function recordHeartbeat(
  userId: string,
  opts: { active: boolean; page?: string | null; userAgent?: string | null },
): Promise<void> {
  const sb = await supabaseServiceRole();
  const th = await getThresholds(sb);
  const now = new Date();
  const nowIso = now.toISOString();
  const staleMs = th.offline_after_minutes * 60_000;

  // Session : réutiliser la session ouverte si le dernier battement est récent,
  // sinon en ouvrir une nouvelle (et clore l'ancienne).
  const { data: openSess } = await sb
    .from("user_sessions")
    .select("id, last_seen_at")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; last_seen_at: string }>();

  let sessionId = openSess?.id ?? null;
  if (openSess && now.getTime() - new Date(openSess.last_seen_at).getTime() > staleMs) {
    // trop ancienne → on la clôt et on repart sur une nouvelle session
    await sb.from("user_sessions").update({ ended_at: openSess.last_seen_at, ended_reason: "timeout" }).eq("id", openSess.id);
    sessionId = null;
  }
  if (!sessionId) {
    const { data: created } = await sb
      .from("user_sessions")
      .insert({ user_id: userId, started_at: nowIso, last_seen_at: nowIso, user_agent: opts.userAgent ?? null })
      .select("id")
      .single();
    sessionId = created?.id ?? null;
  } else {
    await sb.from("user_sessions").update({ last_seen_at: nowIso }).eq("id", sessionId);
  }

  // Snapshot présence : last_active_at ne bouge que si interaction réelle.
  const { data: prev } = await sb.from("user_presence").select("last_active_at").eq("user_id", userId).maybeSingle<{ last_active_at: string | null }>();
  await sb.from("user_presence").upsert(
    {
      user_id: userId,
      status: opts.active ? "active" : "inactive",
      last_seen_at: nowIso,
      last_active_at: opts.active ? nowIso : prev?.last_active_at ?? null,
      current_page: opts.page ?? null,
      session_id: sessionId,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );

  // Battement brut (base de la timeline + temps actif).
  await sb.from("presence_pings").insert({ user_id: userId, ts: nowIso, active: opts.active, page: opts.page ?? null });
}

// Fermeture propre (onglet fermé via sendBeacon, ou déconnexion).
export async function recordOffline(userId: string, reason: "logout" | "beacon"): Promise<void> {
  const sb = await supabaseServiceRole();
  const nowIso = new Date().toISOString();
  await sb.from("user_sessions").update({ ended_at: nowIso, ended_reason: reason }).eq("user_id", userId).is("ended_at", null);
  await sb.from("user_presence").update({ status: "offline", session_id: null, updated_at: nowIso }).eq("user_id", userId);
}

// Purge des battements bruts au-delà de N jours (l'agrégat journalier reste).
export async function purgePings(retentionDays = 90): Promise<number> {
  const sb = await supabaseServiceRole();
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const { count } = await sb.from("presence_pings").delete({ count: "exact" }).lt("ts", cutoff);
  return count ?? 0;
}
