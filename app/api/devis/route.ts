import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { genererDevisBuffer } from "@/lib/devis/render";
import { buildDevis, type DevisInput, type DocType } from "@/lib/devis/types";
import { allocateNumero } from "@/lib/devis/numero";
import { archiveDevis } from "@/lib/devis/archive";

// pdfkit + fontkit + fs (polices/images) → runtime Node obligatoire (pas Edge).
export const runtime = "nodejs";

type Body = {
  data?: DevisInput;
  mode?: "preview" | "final";
  affaire?: string | null;
  docType?: DocType;
};

// POST /api/devis — génère le PDF A4 du devis.
//  • mode "preview" : numéro FICTIF, aucune consommation de séquence ni archive
//    (l'aperçu est rafraîchi à chaque frappe, il ne doit pas brûler de numéros).
//  • mode "final"   : alloue un numéro gapless, archive le PDF exact, renvoie en
//    pièce jointe. Endpoint protégé : un générateur ouvert permettrait à
//    n'importe qui d'émettre un document au nom de l'entreprise.
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
  if (!input || typeof input !== "object" || !input.client) {
    return NextResponse.json({ ok: false, error: "missing_data" }, { status: 400 });
  }

  const mode = body.mode === "final" ? "final" : "preview";
  const docType: DocType =
    body.docType === "facture" || input.docType === "facture" ? "facture" : "devis";

  if (mode === "preview") {
    const devis = buildDevis({ ...input, docType }, input.numero || "APERÇU");
    const pdf = await genererDevisBuffer(devis);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="apercu-${docType}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // mode final
  if (!input.client.nom) {
    return NextResponse.json(
      { ok: false, error: "client_nom_required" },
      { status: 400 },
    );
  }
  const numero = await allocateNumero(docType);
  const devis = buildDevis({ ...input, docType }, numero);
  const pdf = await genererDevisBuffer(devis);
  await archiveDevis({
    devis,
    pdf,
    leadId: body.affaire ?? null,
    createdBy: user.id,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${docType}-${numero}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Devis-Numero": numero,
    },
  });
}
