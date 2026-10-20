import styles from "./PageSkeleton.module.scss";

// Squelette affiché pendant qu'une page se charge.
//
// POURQUOI — sans `loading.tsx`, une navigation vers une page rendue côté
// serveur ne produit AUCUN retour visuel : le navigateur reste sur l'ancienne
// page, figé, jusqu'à ce que la nouvelle soit entièrement prête. Même une page
// de 400 ms paraît alors cassée, et le commercial reclique.
//
// Avec un `loading.tsx`, Next affiche ce squelette immédiatement et remplace
// le contenu dès qu'il arrive (React Suspense). Le temps serveur ne change
// pas — c'est la perception qui change, et c'est elle qui fait dire « c'est
// lent ».
//
// Aucune donnée ici : ce composant doit rester le plus léger possible.

type Props = {
  /** Nombre de tuiles d'indicateurs en tête de page. 0 = aucune. */
  cartes?: number;
  /** Nombre de lignes de liste simulées. */
  lignes?: number;
  /** Afficher une barre de filtres sous le titre. */
  filtres?: boolean;
};

export default function PageSkeleton({ cartes = 4, lignes = 6, filtres = true }: Props) {
  return (
    <div className={styles.page} aria-busy="true" aria-live="polite">
      <span className={styles.srOnly}>Chargement de la page…</span>

      <div className={styles.entete}>
        <div className={`${styles.bloc} ${styles.titre}`} />
        <div className={`${styles.bloc} ${styles.sousTitre}`} />
      </div>

      {cartes > 0 && (
        <div className={styles.cartes}>
          {Array.from({ length: cartes }).map((_, i) => (
            <div key={i} className={`${styles.bloc} ${styles.carte}`} />
          ))}
        </div>
      )}

      {filtres && <div className={`${styles.bloc} ${styles.filtres}`} />}

      <div className={styles.liste}>
        {Array.from({ length: lignes }).map((_, i) => (
          <div key={i} className={`${styles.bloc} ${styles.ligne}`} />
        ))}
      </div>
    </div>
  );
}
