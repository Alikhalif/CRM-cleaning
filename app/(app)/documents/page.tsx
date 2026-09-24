import { getCurrentUserProfile } from "@/lib/users-server";
import { getDocumentsDashboard } from "@/lib/documents/dashboard-server";
import DocumentsDashboard from "./DocumentsDashboard";

export const metadata = { title: "Documents & Contrats" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) return null; // le proxy garde déjà l'accès

  // Recette 2026-09-24 · Correctif P1 (S1) : cette page lit le tableau de bord
  // Documents & Contrats via le service-role (donc SANS RLS, tous clients
  // confondus). Elle DOIT être réservée au back-office (admin / planificateur) —
  // sinon un commercial y verrait les contrats/certificats de tous les clients.
  const roles = profile.roles ?? [];
  const isAdmin = roles.some((r) => r.slug === "admin");
  const isPlanner = roles.some((r) => r.slug === "planification");
  if (!isAdmin && !isPlanner) {
    return (
      <div style={{ padding: "24px" }}>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            color: "var(--text-muted)",
          }}
        >
          <strong>Accès restreint</strong> — le module Documents &amp; Contrats est réservé aux
          comptes <strong>Admin</strong> et <strong>Planification</strong>.
        </div>
      </div>
    );
  }

  const data = await getDocumentsDashboard();
  return <DocumentsDashboard data={data} />;
}
