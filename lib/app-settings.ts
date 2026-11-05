import "server-only";
import { supabaseServer } from "./supabase/server";

// Runtime feature flags + global config, flipped from /settings/integrations
// without a redeploy. Cheap enough to fetch on every server-side page load
// (single row by primary key). Falls back to a hardcoded default when the
// row is missing so first-deploy paths don't crash.

export const APP_SETTING_KEYS = {
  // Seuils d'ancienneté de la vue « Devis à réaliser », en heures (§6 du
  // cahier du 2026-11-03). Ce sont des seuils d'AFFICHAGE : les modifier
  // change une couleur, jamais un montant.
  devisSeuilVertH: "devis_a_realiser_seuil_vert_h",
  devisSeuilOrangeH: "devis_a_realiser_seuil_orange_h",
} as const;

// Defaults applied when the row is missing or the value is malformed.
const DEFAULTS: Record<string, unknown> = {
  [APP_SETTING_KEYS.devisSeuilVertH]: 2,
  [APP_SETTING_KEYS.devisSeuilOrangeH]: 24,
};

export async function getBooleanSetting(key: string): Promise<boolean> {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle<{ value: unknown }>();
    if (error || !data) return Boolean(DEFAULTS[key] ?? false);
    return data.value === true || data.value === "true";
  } catch (err) {
    console.error(`getBooleanSetting(${key}) failed:`, err);
    return Boolean(DEFAULTS[key] ?? false);
  }
}

/**
 * Réglage numérique. Une valeur absente, non numérique ou négative retombe
 * sur le défaut : un seuil absurde ne doit pas rendre une colonne illisible.
 *
 * La valeur est stockée en `jsonb`, donc elle peut arriver en nombre ou en
 * chaîne selon la façon dont la ligne a été écrite. Les deux sont acceptées.
 */
export async function getNumberSetting(key: string): Promise<number> {
  const defaut = Number(DEFAULTS[key] ?? 0);
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle<{ value: unknown }>();
    if (error || !data) return defaut;
    const n = typeof data.value === "number" ? data.value : Number(data.value);
    return Number.isFinite(n) && n > 0 ? n : defaut;
  } catch (err) {
    console.error(`getNumberSetting(${key}) failed:`, err);
    return defaut;
  }
}

// Le drapeau `n8n_sequence_enabled` et son lecteur `isN8nSequenceEnabled()`
// ont été retirés le 2026-11-04 avec l'envoi automatique des devis. La ligne
// correspondante reste en base, sans lecteur : aucune migration n'est
// nécessaire, et rien ne la consulte plus.
