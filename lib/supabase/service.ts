import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service-role client. BYPASSES RLS — only use from webhooks / cron / other
// server-only contexts that have no authenticated session.
//
// CDC §8.2: this key must NEVER ship in the browser bundle. The "use
// server" + "server-only" import guards prevent that — adding this module
// to a client component is a compile-time error.
//
// Cached at module scope to avoid re-instantiating per request — Supabase's
// JS client is thread-safe and stateless in this configuration.

let cached: ReturnType<typeof createClient<Database>> | null = null;

export async function supabaseServiceRole() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — required for service-role client.",
    );
  }
  cached = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return cached;
}
