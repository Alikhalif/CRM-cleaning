import Link from "next/link";
import { notFound } from "next/navigation";
import { getSignatureRequestById } from "@/lib/signature-server";
import SignatureDetailView from "./SignatureDetailView";

export const metadata = { title: "Fiche signature" };

export default async function SignatureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getSignatureRequestById(id);
  if (!detail) notFound();

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <nav aria-label="Fil d'Ariane" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        <Link href="/signatures" style={{ color: "var(--color-brand-500)", textDecoration: "none" }}>Signatures</Link>
        <span aria-hidden="true"> / </span>
        <span>{detail.row.ref}</span>
      </nav>
      <SignatureDetailView detail={detail} />
    </div>
  );
}
