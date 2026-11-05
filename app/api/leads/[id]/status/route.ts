import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { supabaseServiceRole } from "@/lib/supabase/service";

// GET /api/leads/:id/status — endpoint en lecture seule interrogé par le
// workflow n8n WF2 entre deux envois d'e-mail. Authentification Bearer via
// N8N_TO_CRM_BEARER.
//
// ⚠️ COUPE-CIRCUIT (2026-11-04). L'envoi automatique des devis n'est plus
// retenu : `active` renvoie désormais TOUJOURS false. Toute séquence encore
// en vol chez n8n s'arrêtera d'elle-même à sa prochaine interrogation, sans
// qu'il faille toucher au workflow.
//
// L'endpoint est conservé plutôt que supprimé : un 404 ferait boucler ou
// échouer bruyamment un workflow résiduel, là où un « inactif » franc le fait
// sortir proprement.

export const runtime = "nodejs";

function bearerOk(req: NextRequest): boolean {
  const expected = process.env.N8N_TO_CRM_BEARER;
  if (!expected) {
    // Fail-closed en production ; raccourci « accepter tout » réservé au dev.
    if (process.env.NODE_ENV === "production") return false;
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
    .select("status")
    .eq("id", id)
    .maybeSingle<{ status: string }>();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
  }
  // `active` est le seul champ dont le workflow a besoin pour décider s'il
  // continue. Il vaut false en toutes circonstances : plus aucun devis ne
  // part automatiquement. Le statut réel reste renvoyé à titre informatif.
  return NextResponse.json({
    status: data.status,
    active: false,
    stopped_reason: "automatic_sending_disabled",
  });
}
