import Link from "next/link";
import { getLandingPages, getLpOptions } from "@/lib/landing-pages-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import LandingPagesList from "./LandingPagesList";

export const metadata = { title: "Landing Pages" };

// Admin-only. Configure each landing page once: token → pays + société +
// secteur + source. WF1 resolves the token and the lead inherits these.

export default async function LandingPagesPage() {
  const [pages, options, me] = await Promise.all([
    getLandingPages(),
    getLpOptions(),
    getCurrentUserProfile(),
  ]);
  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <nav aria-label="Fil d'Ariane" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        <Link href="/settings" style={{ color: "var(--color-brand-500)", textDecoration: "none" }}>Paramètres</Link>
        <span aria-hidden="true"> / </span>
        <span>Landing Pages</span>
      </nav>

      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Landing Pages</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Chaque LP : un <strong>token</strong> → pays + société + secteur + source. Le formulaire n&apos;envoie
          que le token (champ <code>lp</code>) ; le lead hérite du reste automatiquement.
        </p>
      </header>

      {!isAdmin ? (
        <div style={{ padding: "16px 18px", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-muted)" }}>
          <strong>Accès restreint</strong> — la configuration des landing pages est réservée aux comptes <strong>Admin</strong>.
        </div>
      ) : (
        <LandingPagesList pages={pages} options={options} />
      )}
    </div>
  );
}
