import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getMessageTemplates, getTemplateSectorOptions } from "@/lib/message-templates-server";
import TemplatesList from "./TemplatesList";

export const metadata = { title: "Templates mail & SMS" };

export default async function TemplatesPage() {
  const [templates, sectors, me] = await Promise.all([
    getMessageTemplates(),
    getTemplateSectorOptions(),
    getCurrentUserProfile(),
  ]);
  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <nav aria-label="Fil d'Ariane" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        <Link href="/settings" style={{ color: "var(--color-brand-500)", textDecoration: "none" }}>
          Paramètres
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Templates mail &amp; SMS</span>
      </nav>

      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Templates mail &amp; SMS</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Messages réutilisables, rangés par usage et ciblables par secteur. Variables dynamiques comme{" "}
          <code>{"{client.prenom}"}</code> interpolées à l&apos;envoi.
        </p>
      </header>

      {!isAdmin ? (
        <div style={{ padding: "16px 18px", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-muted)" }}>
          <strong>Accès restreint</strong> — la gestion des templates est réservée aux comptes <strong>Admin</strong>.
        </div>
      ) : (
        <TemplatesList templates={templates} sectors={sectors} />
      )}
    </div>
  );
}
