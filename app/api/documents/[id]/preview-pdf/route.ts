import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getDocumentById } from "@/lib/documents-server";
import { rendreDocument } from "@/lib/devis/rendu-document-server";

// React-PDF needs the Node runtime — pdf-lib + fontkit pull in Buffer + fs.
// Without this opt-in, Next 16 may try to render on the edge and crash.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;

  // Auth gate. RLS would also return null for unauthenticated callers but
  // a clear 401 helps the UI surface "you got logged out" cleanly.
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const detail = await getDocumentById(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Rendu par le point d'entrée UNIQUE du Lot B : le gabarit employé ici est
  // exactement celui de la pièce jointe envoyée au client. Avant, les deux
  // appelaient react-pdf chacun de leur côté et pouvaient diverger.
  //
  // NON BLOQUANT à dessein. Cette route AFFICHE un document déjà créé :
  // refuser l'aperçu parce que la fiche société est incomplète rendrait
  // illisibles des documents existants, ce qui serait une régression. La
  // garde bloque à l'ÉMISSION, pas à la lecture.
  const rendu = await rendreDocument(detail);
  if (!rendu.ok) {
    return NextResponse.json({ error: "render_failed", message: rendu.error }, { status: 500 });
  }

  const entetes: Record<string, string> = {
    "Content-Type": "application/pdf",
    // inline = opens in a new tab; switch to attachment to force download.
    "Content-Disposition": `inline; filename="${detail.doc.num}.pdf"`,
    "Cache-Control": "private, no-store",
    "X-Devis-Gabarit": rendu.plan.gabarit,
  };
  // Les anomalies d'identité voyagent en en-tête : visibles au diagnostic,
  // jamais dans le PDF remis au client.
  const g = rendu.plan.verdict?.griefs ?? [];
  if (g.length > 0) {
    entetes["X-Devis-Identite-Griefs"] = String(g.length);
  }

  return new NextResponse(new Uint8Array(rendu.buffer), { status: 200, headers: entetes });
}
