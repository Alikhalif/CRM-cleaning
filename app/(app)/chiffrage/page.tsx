import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getConsultations } from "@/lib/consultations-server";
import ChiffrageList from "./ChiffrageList";

export const metadata = { title: "Demandes de chiffrage" };

export default async function ChiffragePage() {
  const [consultations, me] = await Promise.all([getConsultations(), getCurrentUserProfile()]);
  const roles = (me?.roles ?? []).map((r) => r.slug);
  const allowed = roles.includes("admin") || roles.includes("planification");

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <nav aria-label="Fil d'Ariane" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        <Link href="/settings/technicians" style={{ color: "var(--color-brand-500)", textDecoration: "none" }}>Intervenants</Link>
        <span aria-hidden="true"> / </span>
        <span>Demandes de chiffrage</span>
      </nav>

      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>Demandes de chiffrage</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Suivi des consultations envoyées aux intervenants — comparez les offres, relancez, attribuez la mission.
        </p>
      </header>

      {!allowed ? (
        <div style={{ padding: "16px 18px", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-muted)" }}>
          <strong>Accès restreint</strong> — réservé aux rôles <strong>Admin</strong> et <strong>Planification</strong>.
        </div>
      ) : (
        <ChiffrageList consultations={consultations} />
      )}
    </div>
  );
}
