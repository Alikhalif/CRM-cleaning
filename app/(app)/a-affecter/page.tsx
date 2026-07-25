import { getAllLeads, getAllCommerciaux } from "@/lib/leads-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import UnassignedList from "./UnassignedList";

export const metadata = { title: "Leads à affecter" };

// CDC §9 — file « Leads sans affectation ». Lists active leads with no owner
// (WF1 routing found no eligible commercial) so a responsable can assign or
// bulk-assign them. Admin-only: RLS lets only is_admin() update a null-owner
// lead, and only admin/planificateur can even see them.

export default async function AAffecterPage() {
  const [leads, commerciaux, me] = await Promise.all([
    getAllLeads(),
    getAllCommerciaux(),
    getCurrentUserProfile(),
  ]);
  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");
  const unassigned = leads.filter((l) => !l.ownerId && l.status !== "perdu");

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <header>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>
          Leads à affecter
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}> · {unassigned.length}</span>
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Leads reçus qu&apos;aucun commercial n&apos;a pris en charge (pool vide pour leur secteur/pays).
          Sélectionnez-les et attribuez-les.
        </p>
      </header>

      {!isAdmin ? (
        <div style={{ padding: "16px 18px", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", color: "var(--text-muted)" }}>
          <strong>Accès restreint</strong> — l&apos;attribution des leads est réservée aux comptes <strong>Admin</strong>.
        </div>
      ) : (
        <UnassignedList leads={unassigned} commerciaux={commerciaux} />
      )}
    </div>
  );
}
