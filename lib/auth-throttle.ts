import "server-only";
import { supabaseServiceRole } from "./supabase/service";

// Anti-brute-force du login (CDC §Sécurité) : compteur de tentatives par clé
// (email) + verrouillage à backoff exponentiel. Écrit via service-role car le
// login n'a pas encore de session. Best-effort : une erreur d'infra ne doit
// jamais bloquer un login légitime → on échoue « ouvert » côté throttle.

const MAX_ATTEMPTS = 5;
const COUNT_WINDOW_MS = 15 * 60 * 1000; // fenêtre de comptage des échecs
const MAX_LOCK_MS = 30 * 60 * 1000;

function lockDurationMs(attempts: number): number {
  const over = Math.max(0, attempts - MAX_ATTEMPTS); // 0,1,2,…
  return Math.min(MAX_LOCK_MS, 60_000 * 2 ** over);   // 1min → 2 → 4 … → 30min
}

export function loginKey(email: string): string {
  return `login:${email.trim().toLowerCase()}`;
}

export async function checkLoginLock(key: string): Promise<{ locked: boolean; retryInSec: number }> {
  try {
    const admin = await supabaseServiceRole();
    const { data } = await admin
      .from("auth_throttle")
      .select("locked_until")
      .eq("throttle_key", key)
      .maybeSingle<{ locked_until: string | null }>();
    if (data?.locked_until) {
      const ms = new Date(data.locked_until).getTime() - Date.now();
      if (ms > 0) return { locked: true, retryInSec: Math.ceil(ms / 1000) };
    }
  } catch (e) {
    console.error("checkLoginLock failed:", e);
  }
  return { locked: false, retryInSec: 0 };
}

export async function recordLoginFailure(key: string): Promise<void> {
  try {
    const admin = await supabaseServiceRole();
    const now = Date.now();
    const { data } = await admin
      .from("auth_throttle")
      .select("attempts, first_attempt_at")
      .eq("throttle_key", key)
      .maybeSingle<{ attempts: number; first_attempt_at: string }>();

    let attempts = 1;
    let firstAt = new Date(now).toISOString();
    if (data) {
      const inWindow = now - new Date(data.first_attempt_at).getTime() < COUNT_WINDOW_MS;
      attempts = inWindow ? data.attempts + 1 : 1;
      firstAt = inWindow ? data.first_attempt_at : firstAt;
    }
    const lockedUntil = attempts >= MAX_ATTEMPTS
      ? new Date(now + lockDurationMs(attempts)).toISOString()
      : null;

    await admin.from("auth_throttle").upsert({
      throttle_key: key,
      attempts,
      first_attempt_at: firstAt,
      locked_until: lockedUntil,
      updated_at: new Date(now).toISOString(),
    } as never);
  } catch (e) {
    console.error("recordLoginFailure failed:", e);
  }
}

export async function resetLoginThrottle(key: string): Promise<void> {
  try {
    const admin = await supabaseServiceRole();
    await admin.from("auth_throttle").delete().eq("throttle_key", key);
  } catch (e) {
    console.error("resetLoginThrottle failed:", e);
  }
}
