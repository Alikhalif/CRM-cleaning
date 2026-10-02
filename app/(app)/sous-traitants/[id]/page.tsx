import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getSubcontractorDetail } from "@/lib/subcontractors-server";
import SubcontractorFiche from "./SubcontractorFiche";

export const metadata = { title: "Fiche sous-traitant" };
export const dynamic = "force-dynamic";

export default async function SousTraitantFichePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile();
  if (!profile) return null;

  const roles = profile.roles ?? [];
  const isAdmin = roles.some((r) => r.slug === "admin");
  const isPlanner = roles.some((r) => r.slug === "planification");
  if (!isAdmin && !isPlanner) {
    return (
      <div style={{ padding: "24px" }}>
        <div style={{ padding: "16px 18px", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-muted)" }}>
          <strong>Accès restreint</strong> — module réservé à la Planification et à l&apos;Admin.
        </div>
      </div>
    );
  }

  const { id } = await params;
  const detail = await getSubcontractorDetail(id);
  if (!detail) {
    return (
      <div style={{ padding: "24px" }}>
        <p style={{ color: "var(--text-muted)" }}>Sous-traitant introuvable. <Link href="/sous-traitants">Retour à la liste</Link></p>
      </div>
    );
  }

  return <SubcontractorFiche detail={detail} />;
}
