"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { Database } from "@/lib/supabase/database.types";
import { APP_SETTING_KEYS } from "@/lib/app-settings";
import {
  COUNTRIES, MENTION_PAR_PAYS, controlerMention, type Country,
} from "@/lib/generation/mentions-produits";

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
 * Réglages des mentions de produits, PAR PAYS (C1 révisé, 2026-11-06).
 *
 * ── CE QUE CETTE ACTION ENREGISTRE, ET CE QU'ELLE N'ENREGISTRE PAS ──
 *
 * Elle n'enregistre pas « quelle mention appliquer » : c'est le pays de
 * l'entité émettrice qui décide, et la table de correspondance est figée dans
 * le code (`MENTION_PAR_PAYS`). Elle enregistre si l'entreprise ASSUME cette
 * allégation pour un pays donné, et une éventuelle adaptation du texte.
 *
 * Un pays désactivé est RETIRÉ de la carte : l'absence de clé et une
 * activation à faux doivent signifier la même chose, sans quoi un pays
 * désactivé réapparaîtrait au prochain enregistrement.
 *
 * Journalisé : c'est une allégation réglementaire qui partira sur des devis
 * signés, et il faut pouvoir dire qui l'a activée, pour quel pays, et quand.
 */
export async function enregistrerMentionsProduits(
  reglages: Record<string, { active: boolean; texte: string }>,
): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const propre: Record<string, { active: boolean; texte: string }> = {};
  for (const pays of COUNTRIES) {
    const r = reglages[pays];
    if (!r?.active) continue;
    const texte = (r.texte ?? "").trim();
    // Texte vide = formulation de référence du pays : on contrôle celle qui
    // partira réellement, pas la chaîne vide.
    const effectif = texte || MENTION_PAR_PAYS[pays];
    const c = controlerMention(effectif);
    if (!c.ok) return { ok: false, error: `${pays} — ${c.motif}` };
    propre[pays] = { active: true, texte };
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
    after: {
      key: APP_SETTING_KEYS.devisMentionsProduits,
      pays_actives: Object.keys(propre),
      // Le texte exact est journalisé : c'est lui qui engage l'entreprise.
      formulations: Object.fromEntries(
        Object.entries(propre).map(([k, v]) => [k, v.texte || MENTION_PAR_PAYS[k as Country]]),
      ),
    },
  });

  revalidatePath("/settings/integrations");
  return { ok: true };
}
