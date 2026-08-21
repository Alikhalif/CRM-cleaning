import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";

export const runtime = "nodejs";

// GET /api/devis/pdf?lead=<id> — sert le dernier devis OPTIMIVV archivé du lead
// (version SIGNÉE si le devis a été signé, sinon la version émise). Session
// requise + contrôle d'accès RLS au lead (un commercial ne récupère pas le
// devis d'un lead qui n'est pas le sien).
export async function GET(req: Request) {
  const leadId = new URL(req.url).searchParams.get("lead") || "";
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
    return NextResponse.json({ error: "bad_lead" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Contrôle d'accès : le lead doit être visible par l'utilisateur (RLS).
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = await supabaseServiceRole();
  const { data: devis } = await admin
    .from("devis_optimivv")
    .select("numero, pdf_path")
    .eq("lead_id", leadId)
    .eq("doc_type", "devis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ numero: string; pdf_path: string }>();
  if (!devis) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const dl = await admin.storage.from("devis-optimivv").download(devis.pdf_path);
  if (dl.error || !dl.data) {
    return NextResponse.json({ error: "pdf_missing" }, { status: 404 });
  }
  const buf = Buffer.from(await dl.data.arrayBuffer());

  const signed = devis.pdf_path.includes("/signed-");
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="devis-${signed ? "signe-" : ""}${devis.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
