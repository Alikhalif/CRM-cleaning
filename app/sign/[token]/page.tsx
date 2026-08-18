import { headers } from "next/headers";
import { getSignatureRequestByToken, recordSignatureOpen } from "@/lib/signature-server";
import SignFlow from "./SignFlow";

export const metadata = { title: "Signature du document" };

// Page PUBLIQUE (proxy : /sign/* whitelisté). Aucune session — l'accès est
// validé par le token côté serveur.
export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getSignatureRequestByToken(token);

  // Trace l'ouverture du lien (IP/UA côté serveur) — best-effort.
  if (view) {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    await recordSignatureOpen(token, "SIGNATURE_LINK_OPENED", { ip, userAgent: h.get("user-agent") || null });
  }

  if (!view) return <StateScreen emoji="🔒" title="Lien invalide" text="Ce lien de signature est introuvable ou a été révoqué." />;
  if (view.status === "signe") return <StateScreen emoji="✅" title="Document déjà signé" text={`Ce devis a déjà été signé. Référence ${view.ref}.`} tone="success" />;
  if (view.status === "annule") return <StateScreen emoji="🚫" title="Demande annulée" text="Cette demande de signature a été annulée par l'émetteur." />;
  if (view.status === "refuse") return <StateScreen emoji="✋" title="Signature refusée" text="Cette demande a été marquée comme refusée." />;
  if (view.expired || view.status === "expire") {
    return <StateScreen emoji="⌛" title="Lien expiré" text="Ce lien de signature a expiré. Demandez à votre interlocuteur d'en générer un nouveau." />;
  }

  return <SignFlow token={token} view={view} />;
}

function StateScreen({ emoji, title, text, tone }: { emoji: string; title: string; text: string; tone?: "success" }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg-app, #0b0b16)" }}>
      <div style={{ maxWidth: 460, textAlign: "center", background: "var(--bg-elevated, #14141f)", border: "1px solid var(--border-subtle, #2a2a3a)", borderRadius: 16, padding: 40 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden>{emoji}</div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: tone === "success" ? "var(--tone-success, #14c890)" : "var(--text-primary, #eee)", marginBottom: 10 }}>{title}</h1>
        <p style={{ color: "var(--text-muted, #9aa)", lineHeight: 1.6 }}>{text}</p>
      </div>
    </div>
  );
}
