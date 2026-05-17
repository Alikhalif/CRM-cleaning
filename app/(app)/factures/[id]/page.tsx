import { notFound, redirect } from "next/navigation";
import DocumentView from "../../_shared/DocumentView";
import { getDocumentById } from "@/lib/documents-server";
import { DOC_TYPE_LABEL } from "@/lib/leads";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const detail = await getDocumentById(id);
  return {
    title: detail ? `${DOC_TYPE_LABEL[detail.doc.type]} ${detail.doc.num}` : "Facture introuvable",
  };
}

export default async function FacturePage({ params }: PageProps) {
  const { id } = await params;
  const detail = await getDocumentById(id);
  if (!detail) notFound();
  if (detail.doc.type === "devis") redirect(`/devis/${id}`);
  return <DocumentView detail={detail} />;
}
