import { NextResponse, type NextRequest } from "next/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { isDuplicateWebhook } from "@/lib/webhook-dedup";
import { markLeadDevisOuvert } from "@/lib/devis/status";

// Webhook des ÉVÉNEMENTS transactionnels Brevo (ouvertures d'e-mail).
// Quand le client OUVRE l'e-mail contenant son devis OPTIMIVV, Brevo notifie
// ici → on fait avancer le lead « Devis envoyé » → « Devis ouvert » (stade 3).
//
// Config Brevo : Transactionnel → Paramètres → Webhook → ajouter l'URL
//   https://<domaine>/api/webhooks/brevo/events?token=<BREVO_EVENTS_TOKEN>
// et cocher l'événement « Ouvert » (opened). Le token en query sert
// d'authentification (Brevo ne permet pas d'en-tête custom).
//
// Idempotent (doublons → 200 no-op) et MONOTONE (n'avance que depuis « envoye »,
// ne recule jamais un lead déjà signé/encaissé). Rapproche l'événement du lead
// via le destinataire archivé dans devis_optimivv.sent_to.

export const runtime = "nodejs";

const OPEN_EVENTS = new Set(["opened", "unique_opened", "open"]);

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.BREVO_EVENTS_TOKEN;
  if (!expected) {
    if (process.env.NODE_ENV === "production") return false; // fail-closed
    console.warn("[brevo.events] BREVO_EVENTS_TOKEN non défini — accepté (dev only)");
    return true;
  }
  return req.nextUrl.searchParams.get("token") === expected;
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const event = String(body.event ?? "").toLowerCase();
  if (!OPEN_EVENTS.has(event)) {
    // Delivered / clicked / etc. — non gérés ici.
    return NextResponse.json({ ok: true, ignored: event || "unknown" });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true, matched: false });

  const messageId = String(body["message-id"] ?? body.message_id ?? "");
  const eventKey = `open:${messageId || email}:${String(body.date ?? body.ts ?? "")}`;
  if (await isDuplicateWebhook("brevo_event", eventKey)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const sb = await supabaseServiceRole();

  // Rapproche l'ouverture du lead via le dernier DEVIS OPTIMIVV envoyé à cette
  // adresse (le plus récent = celui en cours).
  const { data: devis } = await sb
    .from("devis_optimivv")
    .select("lead_id, numero")
    .ilike("sent_to", email)
    .eq("doc_type", "devis")
    .not("lead_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ lead_id: string; numero: string }>();

  if (!devis?.lead_id) {
    return NextResponse.json({ ok: true, matched: false });
  }

  // Monotone + idempotent (n'avance que depuis « envoye »).
  const r = await markLeadDevisOuvert(devis.lead_id, "brevo_open");
  if (r === "error") {
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, advanced: r === "advanced" });
}
