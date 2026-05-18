import { NextResponse } from "next/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications";

// Brevo inbound-parsing webhook. When a client replies to a transactional
// email sent via Brevo (e.g., the devis or facture they received), Brevo
// catches the reply on a configured subdomain and POSTs it here as JSON.
//
// Configure in Brevo dashboard → Inbound parsing:
//   1. Add a domain like inbound.cgkcrm.fr with the MX records Brevo provides
//   2. Configure the catch-all route to forward to:
//        https://<your-domain>/api/webhooks/brevo/inbound
//   3. Set BREVO_INBOUND_SECRET in env; configure same value in Brevo's
//      webhook secret field. We check it via the X-Brevo-Secret header.
//
// Matching strategy: parse the document number (DEV-2026-0042, FAC-XXXX,
// FA-XXXX) from the subject line. That document tells us the lead. If no
// match, the email is still logged on the global audit trail without a
// lead binding so it isn't silently dropped.

export const runtime = "nodejs";

// Tolerant match — works on French + English subjects ("Re: Devis DEV-...",
// "RE: Facture FAC-2026-0009 — CGK", etc.).
const DOC_NUM_REGEX = /\b((?:DEV|FA|FAC)-\d{4}-\d{4})\b/i;

type BrevoInboundPayload = {
  // Brevo's shape varies a bit by feature; we read defensively.
  From?: { Address?: string; Name?: string };
  To?: { Address?: string }[];
  Subject?: string;
  ReplyTo?: { Address?: string };
  RawHtmlBody?: string;
  RawTextBody?: string;
  ExtractedMarkdownMessage?: string;
};

export async function POST(request: Request) {
  const secret = process.env.BREVO_INBOUND_SECRET;
  if (secret) {
    const got = request.headers.get("X-Brevo-Secret") ?? "";
    if (got !== secret) {
      return NextResponse.json({ error: "invalid_secret" }, { status: 401 });
    }
  }

  let payload: BrevoInboundPayload;
  try {
    payload = (await request.json()) as BrevoInboundPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const from = payload.From?.Address ?? payload.ReplyTo?.Address ?? "";
  const subject = payload.Subject ?? "";
  const bodyPreview =
    (payload.ExtractedMarkdownMessage ?? payload.RawTextBody ?? "").slice(0, 500);

  // Try to bind the reply to a known lead via the document number in the
  // subject. Service-role bypass on the read so the webhook can match
  // even without an authenticated session.
  let leadId: string | null = null;
  let docNum: string | null = null;
  let ownerId: string | null = null;
  const match = subject.match(DOC_NUM_REGEX);
  if (match) {
    docNum = match[1].toUpperCase();
    const supabase = await supabaseServiceRole();
    const { data: doc } = await supabase
      .from("documents")
      .select("lead_id, leads(owner_id, client_first_name, client_last_name, client_company, is_company)")
      .eq("num", docNum)
      .maybeSingle<{
        lead_id: string | null;
        leads: {
          owner_id: string | null;
          client_first_name: string | null;
          client_last_name: string | null;
          client_company: string | null;
          is_company: boolean;
        } | null;
      }>();
    leadId = doc?.lead_id ?? null;
    ownerId = doc?.leads?.owner_id ?? null;

    // Push a notification to the lead's owner so the bell badge updates
    // and they don't miss the reply. Best-effort — failure is logged.
    if (leadId && ownerId) {
      const clientLabel = doc?.leads?.is_company
        ? (doc.leads.client_company ?? "(client)")
        : `${doc?.leads?.client_first_name ?? ""} ${doc?.leads?.client_last_name ?? ""}`.trim() || "(client)";
      await notify({
        userId: ownerId,
        kind: "email.reply",
        entityType: "lead",
        entityId: leadId,
        title: `Réponse de ${clientLabel}`,
        body: subject,
        href: `/leads/${leadId}`,
      });
    }
  }

  await auditLog({
    action: leadId ? "lead.email.reply" : "email.reply.unmatched",
    entityType: leadId ? "lead" : "user",
    entityId: leadId,
    after: {
      from,
      subject,
      matchedDocNum: docNum,
      bodyPreview,
    },
  });

  return NextResponse.json({ ok: true, matched: Boolean(leadId), leadId });
}
