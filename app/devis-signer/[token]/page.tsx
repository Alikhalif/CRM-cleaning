import { verifySignToken } from "@/lib/devis/tracking";
import { getDevisForSigning } from "@/lib/devis/sign";
import SignerDevis from "./SignerDevis";

export const metadata = { title: "Signature de votre devis — OPTIMIVV" };

// Page PUBLIQUE (proxy : /devis-signer/* whitelisté). Aucune session — l'accès
// est validé par le token signé côté serveur.
export default async function SignerDevisPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const leadId = verifySignToken(token);
  if (!leadId) {
    return (
      <State
        emoji="🔒"
        title="Lien invalide"
        text="Ce lien de signature est introuvable ou a été révoqué."
      />
    );
  }

  const ctx = await getDevisForSigning(leadId);
  if (!ctx) {
    return (
      <State
        emoji="📄"
        title="Devis introuvable"
        text="Aucun devis à signer n'est associé à ce lien."
      />
    );
  }
  if (ctx.alreadySigned) {
    return (
      <State
        emoji="✅"
        tone="success"
        title="Devis déjà signé"
        text={`Merci — le devis ${ctx.numero} a déjà été signé. Un exemplaire signé vous a été transmis.`}
      />
    );
  }

  return (
    <SignerDevis
      token={token}
      numero={ctx.numero}
      clientNom={ctx.clientNom}
      pdfUrl={ctx.pdfUrl}
    />
  );
}

function State({
  emoji,
  title,
  text,
  tone,
}: {
  emoji: string;
  title: string;
  text: string;
  tone?: "success";
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg-app, #0b0b16)",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          textAlign: "center",
          background: "var(--bg-elevated, #14141f)",
          border: "1px solid var(--border-subtle, #2a2a3a)",
          borderRadius: 16,
          padding: 40,
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden>
          {emoji}
        </div>
        <h1
          style={{
            fontSize: "1.4rem",
            fontWeight: 700,
            color:
              tone === "success"
                ? "var(--tone-success, #14c890)"
                : "var(--text-primary, #eee)",
            marginBottom: 10,
          }}
        >
          {title}
        </h1>
        <p style={{ color: "var(--text-muted, #9aa)", lineHeight: 1.6 }}>{text}</p>
      </div>
    </div>
  );
}
