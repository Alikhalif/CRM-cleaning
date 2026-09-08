import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getDossierCertHotteMeta, downloadCertHottePdf } from "@/lib/cert-hotte/archive";

export const runtime = "nodejs";

// GET /api/certificat-hotte/pdf?dossier=<id> — sert le dernier certificat archivé
// d'un dossier. Contrôle d'accès : on relit le dossier via la session (RLS) —
// si l'utilisateur n'y a pas droit, la lecture renvoie 0 ligne → 404.
export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const dossierId = new URL(request.url).searchParams.get("dossier");
  if (!dossierId) {
    return NextResponse.json({ ok: false, error: "dossier_required" }, { status: 400 });
  }

  // Vérif d'accès RLS : le dossier doit être visible par l'utilisateur.
  const { data: dossier } = await supabase
    .from("dossiers")
    .select("id")
    .eq("id", dossierId)
    .maybeSingle<{ id: string }>();
  if (!dossier) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const meta = await getDossierCertHotteMeta(dossierId);
  if (!meta) {
    return NextResponse.json({ ok: false, error: "no_certificate" }, { status: 404 });
  }
  const pdf = await downloadCertHottePdf(meta.pdfPath);
  if (!pdf) {
    return NextResponse.json({ ok: false, error: "download_failed" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificat-hotte-${meta.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
