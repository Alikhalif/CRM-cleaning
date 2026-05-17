import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseServer } from "@/lib/supabase/server";
import { getDocumentById } from "@/lib/documents-server";
import DocumentPdf from "@/lib/pdf/DocumentPdf";

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

  // Call DocumentPdf as a function — it returns the underlying React-PDF
  // <Document> element directly, which is exactly what renderToBuffer's
  // signature wants. Wrapping through React.createElement would lose the
  // DocumentProps type and fail to type-check.
  const buffer = await renderToBuffer(DocumentPdf({ detail }));

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // inline = opens in a new tab; switch to attachment to force download.
      "Content-Disposition": `inline; filename="${detail.doc.num}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
