import LeadsTable from "./LeadsTable";
import styles from "./Leads.module.scss";

export const metadata = { title: "Leads & devis" };

export default function LeadsPage() {
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
      <LeadsTable />
    </div>
  );
}
