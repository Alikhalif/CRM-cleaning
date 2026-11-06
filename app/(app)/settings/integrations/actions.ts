"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { Database } from "@/lib/supabase/database.types";
import { APP_SETTING_KEYS } from "@/lib/app-settings";
import { controlerMention } from "@/lib/generation/mentions-produits";

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

/**
 * Mentions des produits d'entretien, par société (C1 du 2026-11-06).
 *
 * Écrites dans `app_settings` sous une seule clé — une carte
 * `legal_entities.id` → texte — donc sans aucune migration. Une société dont
 * le texte est vide est RETIRÉE de la carte : l'absence de clé et le texte
 * vide doivent signifier la même chose, sans quoi une mention effacée
 * réapparaîtrait au prochain enregistrement.
 *
 * Journalisé : c'est une affirmation commerciale qui partira sur des devis
 * signés, et il faut pouvoir dire qui l'a autorisée et quand.
 */
export async function enregistrerMentionsProduits(
  mentions: Record<string, string>,
): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const propre: Record<string, string> = {};
  for (const [entityId, texte] of Object.entries(mentions)) {
    const t = (texte ?? "").trim();
    if (!t) continue;
    const c = controlerMention(t);
    if (!c.ok) return { ok: false, error: c.motif };
    propre[entityId] = t;
  }

  const row: AppSettingInsert = {
    key: APP_SETTING_KEYS.devisMentionsProduits,
    value: propre as unknown as AppSettingInsert["value"],
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  const { error } = await supabase
    .from("app_settings")
    .upsert(row as never, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    action: "app_setting.change",
    entityType: "user",
    entityId: user.id,
    after: { key: APP_SETTING_KEYS.devisMentionsProduits, societes: Object.keys(propre) },
  });

  revalidatePath("/settings/integrations");
  return { ok: true };
}
