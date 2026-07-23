import "server-only";
import crypto from "node:crypto";

// Password policy (CDC §8): 12-char minimum + a HaveIBeenPwned "Pwned
// Passwords" check so users can't pick a password known from a breach.

export const MIN_PASSWORD_LENGTH = 12;

export function passwordLengthError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  return null;
}

// HaveIBeenPwned range API with k-anonymity: only the first 5 hex chars of the
// SHA-1 are sent; the rest is matched locally, so the password (and its full
// hash) never leaves this server. Padding requested to hide the count.
//
// Fails OPEN (returns false) on any network/parse error — a HIBP outage must
// never block a legitimate signup.
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return false;

    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false; // fail open
  }
}
