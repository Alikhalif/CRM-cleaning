import Link from "next/link";
import { getAllEntities } from "@/lib/documents-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import EntitiesList from "./EntitiesList";
import styles from "./Entities.module.scss";

export const metadata = { title: "Sociétés émettrices" };

// Admin-only page. The RLS policy on legal_entities for write actions
// rejects non-admins server-side; we also gate the UI here so the page
// renders a friendly 403 instead of an empty form-shaped error.

export default async function EntitiesPage() {
  const [entities, user] = await Promise.all([
    getAllEntities(),
    getCurrentUserProfile(),
  ]);
  const isAdmin = (user?.roles ?? []).some((r) => r.slug === "admin");

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
        <Link href="/settings" className={styles.breadcrumbLink}>Paramètres</Link>
        <span aria-hidden="true">/</span>
        <span>Sociétés émettrices</span>
      </nav>

      <header className={styles.pageHeader}>
        <h1 className={styles.title}>Sociétés émettrices</h1>
        <p className={styles.subtitle}>
          Multi-entité (CDC §4.2) — gérez les sociétés qui peuvent émettre des devis et factures.
        </p>
      </header>

      {!isAdmin ? (
        <div className={styles.forbidden}>
          <p>
            <strong>Accès restreint</strong> — la gestion des sociétés est réservée aux comptes
            <strong> Admin</strong>. Vos rôles : {(user?.roles ?? []).map((r) => r.slug).join(", ") || "(aucun)"}.
          </p>
        </div>
      ) : (
        <EntitiesList entities={entities} />
      )}
    </div>
  );
}
