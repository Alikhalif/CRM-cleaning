import { notFound, redirect } from "next/navigation";
import DocumentView from "../../_shared/DocumentView";
import { getDocumentById } from "@/lib/leads-mock";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const detail = getDocumentById(id);
  return { title: detail ? `Devis ${detail.doc.num}` : "Devis introuvable" };
}

export default async function DevisPage({ params }: PageProps) {
  const { id } = await params;
  const detail = getDocumentById(id);
  if (!detail) notFound();
  // Documents share an ID space; route invoices through /factures so the URL
  // type matches the document type. CDC §A maps endpoints by document family.
  if (detail.doc.type !== "devis") redirect(`/factures/${id}`);
  return <DocumentView detail={detail} />;
}
