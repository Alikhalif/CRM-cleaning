import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getTechniciansAdmin, getSectorOptions } from "@/lib/technicians-server";
import TechniciansList from "./TechniciansList";

export const metadata = { title: "Intervenants" };

export default async function TechniciansPage() {
  const [technicians, sectors, me] = await Promise.all([
    getTechniciansAdmin(),
    getSectorOptions(),
    getCurrentUserProfile(),
  ]);
  const roles = (me?.roles ?? []).map((r) => r.slug);
  const allowed = roles.includes("admin") || roles.includes("planification");

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <nav aria-label="Fil d'Ariane" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        <Link href="/settings" style={{ color: "var(--color-brand-500)", textDecoration: "none" }}>Paramètres</Link>
        <span aria-hidden="true"> / </span>
        <span>Intervenants</span>
      </nav>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Intervenants (sous-traitants)</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            Carnet des intervenants avec leur email — utilisé pour l&apos;envoi des mails de mission depuis la planification.
          </p>
        </div>
        {allowed && (
          <Link href="/chiffrage" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: "var(--r-sm)", background: "var(--color-brand-500)", color: "#fff", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
            📋 Demandes de chiffrage
          </Link>
        )}
      </header>

      {!allowed ? (
        <div style={{ padding: "16px 18px", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-muted)" }}>
          <strong>Accès restreint</strong> — réservé aux rôles <strong>Admin</strong> et <strong>Planification</strong>.
        </div>
      ) : (
        <TechniciansList technicians={technicians} sectors={sectors} />
      )}
    </div>
  );
}
