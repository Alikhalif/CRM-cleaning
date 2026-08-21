import "server-only";
import crypto from "node:crypto";

// Jeton de suivi d'ouverture d'e-mail (pixel maison, sans Brevo Pro). On signe
// l'identifiant du lead en HMAC-SHA256 pour qu'un pixel ne puisse pas faire
// avancer un lead arbitraire. Format : `<leadId>.<hmacHex>`.
function secret(): string {
  return (
    process.env.DEVIS_TRACK_SECRET ||
    process.env.LEADS_INBOUND_SECRET ||
    "dev-insecure-devis-track-secret"
  );
}

function hmac(leadId: string): string {
  return crypto.createHmac("sha256", secret()).update(leadId).digest("hex");
}

export function signOpenToken(leadId: string): string {
  return `${leadId}.${hmac(leadId)}`;
}

export function verifyOpenToken(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const leadId = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = hmac(leadId);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  try {
    return crypto.timingSafeEqual(a, b) ? leadId : null;
  } catch {
    return null;
  }
}
