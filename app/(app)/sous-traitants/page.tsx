import { getCurrentUserProfile } from "@/lib/users-server";
import { getSubcontractorsOverview } from "@/lib/subcontractors-server";
import SubcontractorsList from "./SubcontractorsList";

export const metadata = { title: "Sous-traitants" };
export const dynamic = "force-dynamic";

export default async function SousTraitantsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) return null; // le proxy garde déjà l'accès

  // Module réservé au back-office : planificatrice (responsable opérationnel) +
  // Super Admin (visibilité totale). Les commerciaux n'y ont AUCUN accès.
  const roles = profile.roles ?? [];
  const isAdmin = roles.some((r) => r.slug === "admin");
  const isPlanner = roles.some((r) => r.slug === "planification");
  if (!isAdmin && !isPlanner) {
    return (
      <div style={{ padding: "24px" }}>
        <div style={{ padding: "16px 18px", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-muted)" }}>
          <strong>Accès restreint</strong> — le module Sous-traitants est réservé aux comptes{" "}
          <strong>Planification</strong> et <strong>Admin</strong>.
        </div>
      </div>
    );
  }

  const rows = await getSubcontractorsOverview();
  return <SubcontractorsList rows={rows} />;
}
