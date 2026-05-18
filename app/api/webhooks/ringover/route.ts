import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { verifyWebhookSignature, type RingoverCallEvent } from "@/lib/ringover";
import { supabaseServiceRole } from "@/lib/supabase/service";

// Ringover webhook receiver. Open endpoint — proxy.ts already whitelists
// /api/* as public so n8n / Ringover can reach us without an auth cookie.
// Authenticity is enforced by HMAC verification (RINGOVER_WEBHOOK_SECRET).
//
// Configure in Ringover dashboard → Integrations → Webhooks:
//   URL:    https://<your-domain>/api/webhooks/ringover
//   Events: call.ringing, call.answered, call.ended, call.missed
//   Secret: paste the value of RINGOVER_WEBHOOK_SECRET so HMAC matches.
//
// In dev (no secret set), all webhooks are accepted — useful for sending
// fake events via `curl`:
//   curl -X POST http://localhost:3000/api/webhooks/ringover \
//     -H 'Content-Type: application/json' \
//     -d '{"event":"call.ended","call_id":"fake_1","direction":"outbound",
//          "from_number":"+33...","to_number":"+33690337102",
//          "duration_seconds":42,"metadata":{"lead_id":"<uuid>"},
//          "timestamp":"2026-05-18T10:00:00Z"}'

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Read once — both for signature check + parsing.
  const rawBody = await request.text();
  const signature = request.headers.get("X-Ringover-Signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let event: RingoverCallEvent;
  try {
    event = JSON.parse(rawBody) as RingoverCallEvent;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Validate shape — Ringover-typed but the JSON could be anything in the
  // wild (misconfigured webhook, test traffic, etc.). Surface a clear 400
  // instead of crashing on .replace() of undefined.
  if (
    !event ||
    typeof event.event !== "string" ||
    typeof event.direction !== "string" ||
    typeof event.call_id !== "string"
  ) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  // Map Ringover event → CRM audit action namespace.
  // direction.event: e.g. "outbound.answered", "inbound.missed"
  const action = `lead.call.${event.direction}.${event.event.replace("call.", "")}`;

  await auditLog({
    action,
    entityType: "lead",
    entityId: event.metadata?.lead_id ?? null,
    after: {
      callId: event.call_id,
      from: event.from_number,
      to: event.to_number,
      durationSeconds: event.duration_seconds,
      agentId: event.agent_id,
      timestamp: event.timestamp,
    },
  });

  // Notify the lead owner for events that warrant attention:
  // - missed calls (both directions — outbound = client didn't pick up;
  //   inbound = we didn't pick up)
  // - inbound answered (FYI for the assigned commercial)
  // Other transitions (ringing/ended of answered calls) are logged but
  // don't generate notifications — would be noisy.
  const leadId = event.metadata?.lead_id;
  if (leadId && (event.event === "call.missed" || (event.direction === "inbound" && event.event === "call.answered"))) {
    const supabase = await supabaseServiceRole();
    const { data: lead } = await supabase
      .from("leads")
      .select("owner_id, client_first_name, client_last_name, client_company, is_company")
      .eq("id", leadId)
      .maybeSingle<{
        owner_id: string | null;
        client_first_name: string | null;
        client_last_name: string | null;
        client_company: string | null;
        is_company: boolean;
      }>();
    if (lead?.owner_id) {
      const clientLabel = lead.is_company
        ? (lead.client_company ?? "(client)")
        : `${lead.client_first_name ?? ""} ${lead.client_last_name ?? ""}`.trim() || "(client)";
      const phone = event.direction === "inbound" ? event.from_number : event.to_number;
      const kind = event.event === "call.missed" ? `call.missed.${event.direction}` : "call.inbound";
      const title =
        event.event === "call.missed"
          ? event.direction === "inbound"
            ? `Appel manqué de ${clientLabel}`
            : `${clientLabel} n'a pas répondu`
          : `Appel entrant de ${clientLabel}`;
      await notify({
        userId: lead.owner_id,
        kind,
        entityType: "lead",
        entityId: leadId,
        title,
        body: phone,
        href: `/leads/${leadId}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
