import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { genererDevisBuffer } from "@/lib/devis/render";
import { buildDevis, type DevisInput, type DocType } from "@/lib/devis/types";
import { allocateNumero, peekNumero } from "@/lib/devis/numero";
import { verifierAvantCreation } from "@/lib/devis/garde-doublon";
import { archiveDevis } from "@/lib/devis/archive";

// pdfkit + fontkit + fs (polices/images) → runtime Node obligatoire (pas Edge).
export const runtime = "nodejs";

type Body = {
  data?: DevisInput;
  mode?: "preview" | "final";
  affaire?: string | null;
  /**
   * Le commercial a vu le devis existant et en veut un second (Lot A).
   *
   * Sans ce drapeau, la garde refuse une création sur un dossier qui porte
   * déjà un devis. Avec, elle s'efface : un devis rectificatif reste
   * possible, c'est une exigence explicite du client.
   */
  confirmerNouveau?: boolean;
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
    // L'aperçu affiche le PROCHAIN numéro de la série, lu sans l'incrémenter :
    // le commercial voit le numéro que portera le document, et la séquence
    // n'est pas brûlée par les régénérations à chaque frappe. Si la lecture
    // échoue, on retombe sur l'ancien libellé plutôt que de casser l'aperçu.
    const numeroApercu = input.numero || (await peekNumero(docType)) || "APERÇU";
    const devis = buildDevis({ ...input, docType }, numeroApercu);
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

  // ⚠️ GARDE CONTRE LE DOUBLON, AVANT D'ALLOUER LE NUMÉRO (Lot A).
  //
  // Cette route n'avait AUCUN contrôle : chaque appel allouait un numéro et
  // archivait un PDF. Un double-clic produisait deux devis numérotés sur la
  // même affaire, et consommait deux numéros d'une séquence sans trou —
  // qui, elle, ne se récupère pas.
  //
  // L'ordre est important : on vérifie AVANT `allocateNumero`, sinon le
  // numéro serait consommé par un appel qu'on refuse ensuite.
  if (body.affaire) {
    const verdict = await verifierAvantCreation(body.affaire, body.confirmerNouveau === true);
    if (!verdict.autorise) {
      return NextResponse.json(
        { ok: false, error: "devis_existant", message: verdict.motif, existants: verdict.existants },
        { status: 409 },
      );
    }
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
