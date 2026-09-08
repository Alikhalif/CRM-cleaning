import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { listPresenceUsers } from "./presence-server";

// Horaires attendus (minimal) — sert uniquement à savoir si un utilisateur est
// « censé présent » (règle d'alerte absence). Pas un logiciel RH.

export type ScheduleEntry = { weekday: number; start: string | null; end: string | null };
export type SchedulesData = {
  users: { id: string; name: string }[];
  // userId -> weekday -> {start,end}
  schedules: Record<string, Record<number, { start: string; end: string }>>;
};

const hm = (t: string | null): string => (t ? t.slice(0, 5) : ""); // "HH:MM:SS" -> "HH:MM"

export async function getSchedulesData(): Promise<SchedulesData> {
  const sb = await supabaseServiceRole();
  const [users, rowsRes] = await Promise.all([
    listPresenceUsers(sb),
    sb.from("work_schedules").select("user_id, weekday, start_time, end_time").returns<{ user_id: string; weekday: number; start_time: string | null; end_time: string | null }[]>(),
  ]);
  const schedules: SchedulesData["schedules"] = {};
  for (const r of rowsRes.data ?? []) {
    if (!r.start_time || !r.end_time) continue;
    (schedules[r.user_id] ??= {})[r.weekday] = { start: hm(r.start_time), end: hm(r.end_time) };
  }
  return { users: users.filter((u) => u.isActive).map((u) => ({ id: u.id, name: u.name })), schedules };
}

// Remplace l'intégralité de l'emploi du temps d'un utilisateur (7 jours).
export async function setUserSchedule(userId: string, entries: ScheduleEntry[]): Promise<void> {
  const sb = await supabaseServiceRole();
  await sb.from("work_schedules").delete().eq("user_id", userId);
  const rows = entries
    .filter((e) => e.start && e.end)
    .map((e) => ({ user_id: userId, weekday: e.weekday, start_time: e.start, end_time: e.end }));
  if (rows.length) await sb.from("work_schedules").insert(rows);
}
