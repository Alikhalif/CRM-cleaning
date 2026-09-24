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
  return verify(token, hmac);
}

// Jeton de SIGNATURE (recette 2026-09-24 · correctif P1-5).
//
// Ancien format : `leadId.hmac(sign:leadId)` — déterministe, sans expiration,
// et NON lié à un devis précis (la signature s'attachait au « dernier » devis
// du lead → mésattribution possible, et rejouable indéfiniment).
//
// Nouveau format : `leadId~numero~ts.hmac(sign:leadId~numero~ts)`.
//   - lie le jeton au DEVIS précis (numero) émis → signe ce devis, pas « le dernier ».
//   - horodatage `ts` (ms) + fenêtre d'expiration (60 jours) → non rejouable ad vitam.
//   - namespace « sign: » distinct du pixel d'ouverture (verifyOpenToken).
// UUID et numéro (AAAA-NNNNN) ne contiennent ni `~` ni `.`, donc le parsing est
// sans ambiguïté. Les anciens liens (format leadId seul) deviennent invalides.
const SIGN_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 jours

function hmacSignPayload(payload: string): string {
  return crypto.createHmac("sha256", secret()).update("sign:" + payload).digest("hex");
}

export function signSignToken(leadId: string, numero: string): string {
  const payload = `${leadId}~${numero}~${Date.now()}`;
  return `${payload}.${hmacSignPayload(payload)}`;
}

export function verifySignToken(
  token: string,
): { leadId: string; numero: string; ts: number } | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(hmacSignPayload(payload), "utf8");
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const parts = payload.split("~");
  if (parts.length !== 3) return null;
  const [leadId, numero, tsStr] = parts;
  const ts = Number(tsStr);
  if (!leadId || !numero || !Number.isFinite(ts)) return null;
  if (Date.now() - ts > SIGN_TOKEN_TTL_MS) return null; // lien expiré
  return { leadId, numero, ts };
}

function verify(token: string, mac: (id: string) => string): string | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const leadId = token.slice(0, i);
  const sig = token.slice(i + 1);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(mac(leadId), "utf8");
  if (a.length !== b.length) return null;
  try {
    return crypto.timingSafeEqual(a, b) ? leadId : null;
  } catch {
    return null;
  }
}
