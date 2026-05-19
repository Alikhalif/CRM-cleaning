import "server-only";
import { supabaseServer } from "./supabase/server";

// Runtime feature flags + global config, flipped from /settings/integrations
// without a redeploy. Cheap enough to fetch on every server-side page load
// (single row by primary key). Falls back to a hardcoded default when the
// row is missing so first-deploy paths don't crash.

export const APP_SETTING_KEYS = {
  n8nSequenceEnabled: "n8n_sequence_enabled",
} as const;

// Defaults applied when the row is missing or the value is malformed.
const DEFAULTS: Record<string, unknown> = {
  [APP_SETTING_KEYS.n8nSequenceEnabled]: false,
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

// Convenience for the most common call site.
export async function isN8nSequenceEnabled(): Promise<boolean> {
  return getBooleanSetting(APP_SETTING_KEYS.n8nSequenceEnabled);
}
