import "server-only";

// Thin wrapper over Brevo's transactional email REST API. No SDK dep — the
// surface we need (one POST with attachments) is small enough that a fetch
// wrapper is cheaper than pulling in @getbrevo/brevo.
//
// Brevo prerequisites:
//   1. BREVO_API_KEY env var with a "Transactional emails" scoped key.
//   2. The sender email must be verified in Brevo dashboard → Senders.
//      Unverified senders → API returns 400 "Sender not valid".
//   3. SPF/DKIM on the sender domain if it's not @gmail.com / @outlook.com —
//      otherwise mails will land in spam, not fail the API call.

export type SendEmailInput = {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  // Expéditeur personnalisé (sinon défaut BREVO_SENDER_EMAIL). Doit être un
  // expéditeur vérifié dans Brevo.
  senderEmail?: string;
  senderName?: string;
  // Attachment as raw bytes — wrapper handles base64 encoding.
  attachment?: { name: string; bytes: Buffer | Uint8Array };
};

// Expéditeur des emails de PLANIFICATION (confirmations client) et des mails
// aux INTERVENANTS. Configurable via PLANIF_SENDER_EMAIL, défaut ci-dessous.
export const PLANIF_SENDER = {
  email: process.env.PLANIF_SENDER_EMAIL ?? "devis@planningproservices.com",
  name: process.env.PLANIF_SENDER_NAME ?? "Planning Pro Services",
};

export type BrevoSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export async function sendBrevoEmail(input: SendEmailInput): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY non configurée." };

  const senderEmail = input.senderEmail ?? process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) {
    return { ok: false, error: "Expéditeur email non configuré (BREVO_SENDER_EMAIL)." };
  }
  const senderName = input.senderName ?? process.env.BREVO_SENDER_NAME ?? "CGK CRM";

  const body: Record<string, unknown> = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: input.to, name: input.toName ?? input.to }],
    subject: input.subject,
    htmlContent: input.htmlContent,
  };

  if (input.attachment) {
    body.attachment = [
      {
        name: input.attachment.name,
        // Buffer.from copy → base64. Uint8Array also works via Buffer.from(view).
        content: Buffer.from(input.attachment.bytes).toString("base64"),
      },
    ];
  }

  let response: Response;
  try {
    response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, error: `Brevo unreachable: ${err instanceof Error ? err.message : "unknown"}` };
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errorBody = (await response.json()) as { message?: string; code?: string };
      if (errorBody.message) detail = `${errorBody.code ?? "brevo"}: ${errorBody.message}`;
    } catch {
      // body wasn't JSON; keep the HTTP code
    }
    return { ok: false, error: detail };
  }

  const data = (await response.json()) as { messageId?: string };
  return { ok: true, messageId: data.messageId ?? "(unknown)" };
}

// ── Transactional SMS ────────────────────────────────────────────────
// Brevo's transactional SMS endpoint. Used for the "demande de photos" SMS
// (call 2026-07-11). Same API key as email; the account must have an SMS
// credit balance. Sender must be ≤ 11 alphanumeric chars (BREVO_SMS_SENDER).

const BREVO_SMS_ENDPOINT = "https://api.brevo.com/v3/transactionalSMS/sms";

// Brevo wants a country-code-prefixed number with no "+" or separators
// (e.g. "33612345678"). Leads store E.164 ("+33…"); normalise here. French
// national "0X…" also handled as a convenience.
function normalizeSmsRecipient(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0") && digits.length === 10) return `33${digits.slice(1)}`;
  return digits;
}

export async function sendBrevoSms(input: {
  to: string;
  content: string;
}): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY non configurée." };

  const recipient = normalizeSmsRecipient(input.to);
  if (!recipient) return { ok: false, error: "Numéro de destinataire invalide." };

  const sender = (process.env.BREVO_SMS_SENDER ?? "CGK").slice(0, 11);

  let response: Response;
  try {
    response = await fetch(BREVO_SMS_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ sender, recipient, content: input.content, type: "transactional" }),
    });
  } catch (err) {
    return { ok: false, error: `Brevo unreachable: ${err instanceof Error ? err.message : "unknown"}` };
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errorBody = (await response.json()) as { message?: string; code?: string };
      if (errorBody.message) detail = `${errorBody.code ?? "brevo"}: ${errorBody.message}`;
    } catch {
      // body wasn't JSON; keep the HTTP code
    }
    return { ok: false, error: detail };
  }

  const data = (await response.json()) as { reference?: string; messageId?: string | number };
  return { ok: true, messageId: String(data.reference ?? data.messageId ?? "(unknown)") };
}
