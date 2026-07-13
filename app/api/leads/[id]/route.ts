import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import type { Database } from "@/lib/supabase/database.types";

// Lead PATCH endpoint for n8n WF2 callbacks.
//
// Bearer-auth via N8N_TO_CRM_BEARER (compared timing-safely). The body is
// JSON; status transitions are MONOTONE — we silently no-op if n8n tries
// to move backward (n8n must never PATCH past `signe`; encaissement is
// driven by the CRM itself).
//
// The n8n PDF uses prefixed names (`devis_envoye`, `devis_ouvert`) while
// the DB enum uses the CDC short form (`envoye`, `ouvert`). We normalise
// on the way in.

export const runtime = "nodejs";

type LeadStatus = Database["public"]["Enums"]["lead_status"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

const STATUS_ORDER: Record<LeadStatus, number> = {
  lead: 0,
  envoye: 1,
  ouvert: 2,
  signe: 3,
  encaisse: 4,
  perdu: 99,
};

function normaliseStatus(raw: string | undefined | null): LeadStatus | null {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().replace(/^devis_/, "").trim();
  if (cleaned in STATUS_ORDER) return cleaned as LeadStatus;
  return null;
}

function bearerOk(req: NextRequest): boolean {
  const expected = process.env.N8N_TO_CRM_BEARER;
  if (!expected) {
    // Dev shortcut — same posture as the leads inbound webhook.
    console.warn("[leads PATCH] N8N_TO_CRM_BEARER unset — accepting all requests (dev only).");
    return true;
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type PatchBody = {
  status?: string;
  signed_at?: string;
  opened_at?: string;
  refused_at?: string;
  refusal_reason?: string;
  document_id?: string;
  source?: string;
  sequence_id?: string;
  event?: string;
  from_email?: string;
  subject?: string;
  preview?: string;
  notify_owner?: boolean;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!bearerOk(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "Invalid lead id" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await supabaseServiceRole();

  const { data: current, error: fetchErr } = await supabase
    .from("leads")
    .select("id, status, owner_id, client_first_name, client_last_name, short_id")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: LeadStatus;
      owner_id: string | null;
      client_first_name: string | null;
      client_last_name: string | null;
      short_id: string;
    }>();

  if (fetchErr || !current) {
    return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
  }

  const update: LeadUpdate = {};
  const audit: Record<string, unknown> = { source: body.source ?? "n8n", event: body.event };

  // Status transition — monotone, capped at `signe` from n8n side.
  const target = normaliseStatus(body.status);
  if (target) {
    if (target === "encaisse") {
      return NextResponse.json(
        { ok: false, error: "n8n cannot move a lead to encaisse — CRM owns that transition" },
        { status: 409 },
      );
    }
    const currentRank = STATUS_ORDER[current.status] ?? 0;
    const targetRank = STATUS_ORDER[target] ?? 0;
    if (target === "perdu" || targetRank > currentRank) {
      update.status = target;
      if (target === "envoye") update.sub_envoi = "auto";
      audit.status_from = current.status;
      audit.status_to = target;
    } else {
      // Already at or past — no-op but still 200 (idempotent).
      return NextResponse.json({
        ok: true,
        no_op: true,
        reason: `lead already at status=${current.status}, refusing backward move to ${target}`,
      });
    }
  }

  if (body.refusal_reason) {
    update.lost_reason = body.refusal_reason;
  }
  if (body.opened_at || body.signed_at || body.refused_at) {
    update.last_action_at = body.signed_at ?? body.opened_at ?? body.refused_at ?? null;
    if (body.event) update.last_action_label = body.event;
  }

  if (Object.keys(update).length > 0) {
    const { error: updErr } = await supabase
      .from("leads")
      .update(update as never)
      .eq("id", id);
    if (updErr) {
      return NextResponse.json(
        { ok: false, error: `Update failed: ${updErr.message}` },
        { status: 500 },
      );
    }
  }

  await auditLog({
    action: `lead.n8n.${body.event ?? "patch"}`,
    entityType: "lead",
    entityId: id,
    before: { status: current.status },
    after: audit,
  });

  // Notify owner on signature + reply.
  const shouldNotify =
    body.notify_owner === true ||
    target === "signe" ||
    target === "perdu" ||
    body.event === "reply_received";
  if (shouldNotify && current.owner_id) {
    const who = [current.client_first_name, current.client_last_name].filter(Boolean).join(" ").trim() || current.short_id;
    let title = "";
    let kind = "lead.update";
    if (target === "signe") {
      title = `Devis signé — ${who}`;
      kind = "lead.signed";
    } else if (target === "perdu") {
      title = `Devis refusé — ${who}`;
      kind = "lead.refused";
    } else if (body.event === "reply_received") {
      title = `Réponse client — ${who}`;
      kind = "lead.reply";
    }
    if (title) {
      await notify({
        userId: current.owner_id,
        kind,
        entityType: "lead",
        entityId: id,
        title,
        body: body.subject ?? body.preview ?? undefined,
        href: `/leads/${id}`,
      });
    }
  }

  return NextResponse.json({ ok: true, id, status: update.status ?? current.status });
}
