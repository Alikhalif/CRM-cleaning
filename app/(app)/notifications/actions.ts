"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type NotificationUpdate = Database["public"]["Tables"]["notifications"]["Update"];

type Result = { ok: true } | { ok: false; error: string };

// Mark one notification as read. RLS enforces user_id = auth.uid() so a
// commercial can't accidentally (or maliciously) mark someone else's.
export async function markNotificationRead(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const updates: NotificationUpdate = { read_at: new Date().toISOString() };
  const { error } = await supabase
    .from("notifications")
    .update(updates as never)
    .eq("id", id)
    .is("read_at", null); // idempotent — no-op if already read
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}

// "Tout marquer comme lu" — bulk operation. RLS still scopes to the user.
export async function markAllRead(): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  const updates: NotificationUpdate = { read_at: new Date().toISOString() };
  const { error } = await supabase
    .from("notifications")
    .update(updates as never)
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}
