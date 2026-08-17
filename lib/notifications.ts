import "server-only";
import { supabaseServer } from "./supabase/server";
import { supabaseServiceRole } from "./supabase/service";
import type { Database } from "./supabase/database.types";

// In-app notifications. notify() always uses service-role because the
// inserting actor is usually different from the recipient (e.g., a manager
// reassigning a lead generates a notification for the receiver, not the
// manager). Best-effort: failures are logged, never thrown — a missing
// notification shouldn't break the calling action.

type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export type NotifyInput = {
  userId: string;
  kind: string;
  entityType?: string;
  entityId?: string;
  title: string;
  body?: string;
  href?: string;
};

export async function notify(input: NotifyInput): Promise<void> {
  try {
    const supabase = await supabaseServiceRole();
    const row: NotificationInsert = {
      user_id: input.userId,
      kind: input.kind,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    };
    await supabase.from("notifications").insert(row as never);
  } catch (err) {
    console.error("notify failed:", err);
  }
}

// Notifie TOUS les utilisateurs porteurs d'un rôle (ex. la planification).
// Lecture via service-role (contexte sessionless : webhooks). `excludeUserId`
// évite de doublonner la notification du propriétaire s'il détient aussi le rôle.
// Best-effort : renvoie le nombre de destinataires notifiés.
export async function notifyRole(
  roleSlug: string,
  input: Omit<NotifyInput, "userId">,
  excludeUserId?: string,
): Promise<number> {
  try {
    const supabase = await supabaseServiceRole();
    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("slug", roleSlug as never) // slug est un enum ; le param est libre
      .maybeSingle<{ id: string }>();
    if (!role) return 0;
    const { data: urs } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role_id", role.id)
      .returns<{ user_id: string }[]>();
    const ids = [...new Set((urs ?? []).map((r) => r.user_id))].filter((id) => id !== excludeUserId);
    await Promise.all(ids.map((userId) => notify({ ...input, userId })));
    return ids.length;
  } catch (err) {
    console.error("notifyRole failed:", err);
    return 0;
  }
}

// Count unread for the current user — used by the topbar badge. RLS scopes
// to user_id = auth.uid(), so a non-authenticated call returns 0 cleanly.
export async function getUnreadCount(): Promise<number> {
  try {
    const supabase = await supabaseServer();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (error) {
      console.error("getUnreadCount error:", error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error("getUnreadCount threw:", err);
    return 0;
  }
}

// Recent notifications (read + unread) for the /notifications list page.
// Limit kept low — pagination can come later.
export async function getRecentNotifications(limit = 50): Promise<NotificationRow[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, kind, entity_type, entity_id, title, body, href, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<NotificationRow[]>();
  if (error || !data) return [];
  return data;
}
