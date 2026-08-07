import LeadsTable from "./LeadsTable";
import styles from "./Leads.module.scss";
import { getAllCommerciaux, getAllLeads } from "@/lib/leads-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { visibleSectorsForUser } from "@/lib/leads";

export const metadata = { title: "Leads & devis" };

export default async function LeadsPage() {
  // Server-side fetch — runs once per request, ships rendered HTML to the
  // client which then takes over for filter/sort/search interactions.
  const [leads, commerciaux, me] = await Promise.all([
    getAllLeads(),
    getAllCommerciaux(),
    getCurrentUserProfile(),
  ]);

  // Restriction commerciale par activité : ne montrer que les secteurs affectés.
  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");
  const isPlanner = (me?.roles ?? []).some((r) => r.slug === "planification");
  const visibleSectors = visibleSectorsForUser({ isAdmin, isPlanner, activities: me?.activities ?? [] });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Leads &amp; devis</h1>
          <p className={styles.subtitle}>
            Vue tableau dense · recherche, tri, filtres statut/commercial/source · export CSV
          </p>
        </div>
      </header>
      <LeadsTable leads={leads} commerciaux={commerciaux} visibleSectors={visibleSectors} />
    </div>
  );
}
