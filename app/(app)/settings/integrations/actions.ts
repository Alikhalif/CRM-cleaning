"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { Database } from "@/lib/supabase/database.types";

type AppSettingInsert = Database["public"]["Tables"]["app_settings"]["Insert"];
type Result = { ok: true } | { ok: false; error: string };

// Admin-only — RLS on app_settings enforces is_admin() for writes. We
// also audit-log the change since this is a global config flip that
// affects every commercial.
export async function setBooleanSetting(key: string, value: boolean): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const row: AppSettingInsert = {
    key,
    value: value as unknown as Database["public"]["Tables"]["app_settings"]["Insert"]["value"],
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  // Upsert — first toggle creates the row, subsequent ones update value.
  const { error } = await supabase
    .from("app_settings")
    .upsert(row as never, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    action: "app_setting.change",
    entityType: "user",
    entityId: user.id,
    after: { key, value },
  });

  // Refresh every page whose UI depends on the toggle.
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/settings/integrations");
  return { ok: true };
}
