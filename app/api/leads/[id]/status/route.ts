import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { supabaseServiceRole } from "@/lib/supabase/service";

// GET /api/leads/:id/status — tiny read-only endpoint used by the simple
// n8n WF2 workflow between each email send. Bearer-auth via N8N_TO_CRM_BEARER.
// Returns { status } so n8n's IF node can short-circuit the sequence when
// the lead has already moved to signe/perdu/encaisse.

export const runtime = "nodejs";

function bearerOk(req: NextRequest): boolean {
  const expected = process.env.N8N_TO_CRM_BEARER;
  if (!expected) return true;
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

export async function GET(
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
  const supabase = await supabaseServiceRole();
  const { data, error } = await supabase
    .from("leads")
    .select("status, sub_envoi")
    .eq("id", id)
    .maybeSingle<{ status: string; sub_envoi: string | null }>();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
  }
  // `active` is the single field the n8n workflow needs. It's false when
  // the lead reached a terminal state (signe/perdu/encaisse) OR when the
  // commercial flipped sub_envoi back to 'mano' — that's the "Manual" button
  // interrupting the auto-sequence.
  const terminal = ["signe", "perdu", "encaisse"];
  const active = !terminal.includes(data.status) && data.sub_envoi === "auto";
  return NextResponse.json({
    status: data.status,
    sub_envoi: data.sub_envoi,
    active,
  });
}
