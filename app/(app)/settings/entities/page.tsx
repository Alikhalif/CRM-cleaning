import Link from "next/link";
import { getAllEntities } from "@/lib/documents-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { historiqueBancaireParSociete } from "@/lib/entities/coordonnees-bancaires-server";
import { masquer } from "@/lib/entities/coordonnees-bancaires";
import EntitiesList from "./EntitiesList";
import CoordonneesBancaires from "./CoordonneesBancaires";
import SeriesFacturation from "./SeriesFacturation";
import { lireSeries } from "@/lib/facturation/series-server";
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
        <>
          <EntitiesList entities={entities} />

          {/* Coordonnées bancaires — bloc séparé, Super Admin seul.
              La page entière est déjà réservée aux admins (garde ci-dessus) ;
              l'action serveur le revérifie, parce qu'une garde d'interface ne
              protège rien.

              ⚠️ Les valeurs sont MASQUÉES ici : les envoyer en clair dans le
              HTML les ferait voyager dans la page, rester en cache et
              apparaître sur toute capture d'écran — pour rien, puisque
              modifier une coordonnée consiste à saisir la nouvelle. */}
          <CoordonneesBancaires
            societes={entities.map((e) => ({
              id: e.id,
              nom: e.legalName,
              pays: e.country,
              ibanMasque: masquer(e.iban),
              bicMasque: masquer(e.bic),
            }))}
            historique={Object.fromEntries(await historiqueBancaireParSociete())}
          />

          {/* D26 — séries de factures par société, Super Admin seul (la page
              l'est déjà ; l'action le revérifie). */}
          <SeriesFacturation {...await lireSeries()} />
        </>
      )}
    </div>
  );
}
