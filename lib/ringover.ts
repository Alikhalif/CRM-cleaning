import "server-only";
import crypto from "node:crypto";

// Ringover (cloud phone) integration. Two surfaces:
//   1. initiateCall — POSTs to Ringover's click-to-call endpoint to ring
//      the agent's softphone, which then dials the target number.
//   2. verifyWebhookSignature — HMAC check on inbound call-event webhooks.
//
// Without RINGOVER_API_KEY + RINGOVER_API_BASE in the env, both run in
// FAKE MODE: initiateCall returns a synthetic callId without hitting the
// network, and webhook signature checks succeed if no secret is set. This
// lets the UI + webhook flow be developed/tested end-to-end before a real
// Ringover account is provisioned.

export type InitiateCallInput = {
  fromAgentId: string; // Ringover's internal agent/extension id
  toNumber: string;    // E.164 destination (e.g. +33690337102)
  leadId?: string;     // optional, echoed back on the webhook for matching
};

export type InitiateCallResult =
  | { ok: true; callId: string; fake: boolean }
  | { ok: false; error: string };

const RINGOVER_ENDPOINT = "/v2/callback"; // Ringover's documented click-to-call path

export async function initiateCall(input: InitiateCallInput): Promise<InitiateCallResult> {
  const apiKey = process.env.RINGOVER_API_KEY;
  const apiBase = process.env.RINGOVER_API_BASE;

  if (!apiKey || !apiBase) {
    // Fake mode — no network call, deterministic-ish callId so the audit
    // log + future webhook simulation can correlate.
    const fakeId = `fake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.info(
      `[ringover:fake] click-to-call: agent=${input.fromAgentId} → ${input.toNumber} (callId=${fakeId})`,
    );
    return { ok: true, callId: fakeId, fake: true };
  }

  // Ringover's /v2/callback expects from_number / to_number as INTEGERS in
  // international format without the leading "+" (e.g. +33690337102 → 33690337102).
  // The agent's Ringover line ("N° Ringover") must therefore be stored in
  // international format too — a national number (06…) will be rejected.
  const fromNumber = Number(String(input.fromAgentId).replace(/\D/g, ""));
  const toNumber = Number(input.toNumber.replace(/\D/g, ""));
  if (!Number.isSafeInteger(fromNumber) || fromNumber === 0) {
    return { ok: false, error: "N° Ringover de l'agent invalide (attendu : format international, ex. 33690337102)." };
  }
  if (!Number.isSafeInteger(toNumber) || toNumber === 0) {
    return { ok: false, error: "Numéro du lead invalide." };
  }

  try {
    const response = await fetch(`${apiBase}${RINGOVER_ENDPOINT}`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_number: fromNumber,
        to_number: toNumber,
        device: "ALL", // ring every device the agent has registered
      }),
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        // Ringover errors carry either { message } or { detail } (+ errors[]).
        const errBody = (await response.json()) as { message?: string; detail?: string };
        if (errBody.message) detail = errBody.message;
        else if (errBody.detail) detail = errBody.detail;
      } catch { /* not json */ }
      // Surface the numbers actually sent — invaluable while numbers change
      // during a portability window.
      return { ok: false, error: `${detail} (de ${fromNumber} vers ${toNumber})` };
    }
    const data = (await response.json()) as { call_id?: string; id?: string };
    return { ok: true, callId: data.call_id ?? data.id ?? "(unknown)", fake: false };
  } catch (err) {
    return {
      ok: false,
      error: `Ringover unreachable: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

// HMAC-SHA256 webhook signature validation. Ringover sends the signature
// in the `X-Ringover-Signature` header per their docs. In fake mode (no
// secret env var), we accept anything — only for local dev.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RINGOVER_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[ringover] no RINGOVER_WEBHOOK_SECRET set — accepting webhook without verification");
    return true;
  }
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // Constant-time comparison to avoid timing side-channel.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Shape Ringover delivers on the webhook (subset — we don't use every field).
export type RingoverCallEvent = {
  event: "call.ringing" | "call.answered" | "call.ended" | "call.missed";
  call_id: string;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  duration_seconds?: number;
  agent_id?: string;
  metadata?: { lead_id?: string };
  timestamp: string;
};
