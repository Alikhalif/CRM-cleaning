import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseServer } from "@/lib/supabase/server";
import { assemblerDocumentContrat } from "@/lib/sous-traitance/contrats-server";
import SousTraitancePdf from "@/lib/pdf/SousTraitancePdf";

// PDF d'un contrat de sous-traitance : le contrat, le bon de mission et le
// rapport de fin d'intervention, en un seul document de trois pages.
//
// React-PDF exige le runtime Node : pdf-lib et fontkit tirent Buffer et fs.
// Sans cette déclaration, Next 16 peut tenter un rendu sur l'edge et échouer.
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;

  // Garde explicite. La RLS du module (admin + planificatrice) renverrait de
  // toute façon zéro ligne à un commercial, mais un 401 et un 403 distincts
  // valent mieux qu'un PDF vide : ils disent ce qui s'est passé.
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: roles } = await supabase
    .from("user_roles").select("roles(slug)").eq("user_id", user.id)
    .returns<{ roles: { slug: string } | null }[]>();
  const autorise = (roles ?? []).some(
    (r) => r.roles?.slug === "admin" || r.roles?.slug === "planification",
  );
  // Le commercial ne doit jamais voir un prix d'achat : c'est la raison d'être
  // du cloisonnement, et un PDF est aussi bavard qu'un écran.
  if (!autorise) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const assemblage = await assemblerDocumentContrat(id);
  if (!assemblage.ok) {
    return NextResponse.json({ error: assemblage.error }, { status: 422 });
  }
  const d = assemblage.document;

  const buffer = await renderToBuffer(
    SousTraitancePdf({
      titre: d.titre,
      numero: d.ref,
      dateFr: new Date().toLocaleDateString("fr-FR"),
      modeleLabel: d.modeleLabel,
      version: d.version,
      parties: d.parties,
      articles: d.articles,
      montants: d.montants,
      bonMission: d.bonMission,
      rapport: d.rapport,
      signatures: d.signatures,
    }),
  );

  // Un brouillon n'a pas de numéro : le nom du fichier le dit, pour qu'un
  // projet ne se retrouve pas classé comme un contrat émis.
  const nom = d.ref ?? `projet-contrat-${id.slice(0, 8)}`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nom}.pdf"`,
      // Jamais en cache : le document porte des montants d'achat.
      "Cache-Control": "private, no-store",
    },
  });
}
