import { getSignatureRequests } from "@/lib/signature-server";
import SignaturesList from "./SignaturesList";

export const metadata = { title: "Signatures" };

export default async function SignaturesPage() {
  const rows = await getSignatureRequests();
  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Signatures électroniques</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Suivi des demandes de signature de devis — envoi, consultation, signature, preuve.
        </p>
      </header>
      <SignaturesList rows={rows} />
    </div>
  );
}
