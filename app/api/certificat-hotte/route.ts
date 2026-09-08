import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { genererCertHotteBuffer } from "@/lib/cert-hotte/render";
import { archiveCertHotte } from "@/lib/cert-hotte/archive";
import { allocateCertHotteNumero } from "@/lib/cert-hotte/numero";
import { buildCert, type CertHotteInput } from "@/lib/cert-hotte/types";

// @react-pdf/renderer + fontkit + fs (police cursive) → runtime Node.
export const runtime = "nodejs";

type Body = {
  data?: CertHotteInput;
  mode?: "preview" | "final";
  dossierId?: string | null;
  leadId?: string | null;
};

// POST /api/certificat-hotte — génère le PDF A4 du certificat de conformité.
//  • mode "preview" : numéro FICTIF, aucune séquence consommée ni archive
//    (l'aperçu se rafraîchit à chaque interaction).
//  • mode "final"   : alloue un numéro gapless, archive le PDF exact, renvoie
//    la pièce en pièce jointe. Endpoint protégé (session requise).
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const input = body.data;
  if (!input || !input.client || !input.client.etablissement) {
    return NextResponse.json(
      { ok: false, error: "etablissement_required" },
      { status: 400 },
    );
  }

  const mode = body.mode === "final" ? "final" : "preview";

  if (mode === "preview") {
    const cert = buildCert(input, input.numero || "CERT-HOTTE-APERÇU");
    const pdf = await genererCertHotteBuffer(cert);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="apercu-certificat-hotte.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  }

  // mode final
  const numero = await allocateCertHotteNumero();
  const cert = buildCert(input, numero);
  const pdf = await genererCertHotteBuffer(cert);
  await archiveCertHotte({
    cert,
    pdf,
    leadId: body.leadId ?? null,
    dossierId: body.dossierId ?? null,
    createdBy: user.id,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificat-hotte-${numero}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Cert-Numero": numero,
    },
  });
}
