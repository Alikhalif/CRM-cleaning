import styles from "./LeadDetail.module.scss";

// Écran d'attente de la fiche lead.
//
// La fiche lance dix-sept lectures en parallèle ; sans ce fichier, le
// navigateur restait sur la liste, figé, jusqu'à ce que tout soit prêt. Le
// commercial cliquait sur un dossier et croyait l'application bloquée.
//
// Le squelette reprend la forme réelle de la page — colonne principale large,
// colonne latérale — pour que le contenu ne saute pas à l'arrivée.
export default function Loading() {
  return (
    <div className={styles.page} aria-busy="true" aria-live="polite">
      <span className={styles.srOnly}>Chargement du dossier…</span>
      <div className={styles.skelHead}>
        <div className={`${styles.skel} ${styles.skelTitre}`} />
        <div className={`${styles.skel} ${styles.skelSous}`} />
      </div>
      <div className={styles.skelOnglets}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${styles.skel} ${styles.skelOnglet}`} />
        ))}
      </div>
      <div className={styles.skelLayout}>
        <div className={styles.skelCol}>
          <div className={`${styles.skel} ${styles.skelBloc}`} />
          <div className={`${styles.skel} ${styles.skelBlocCourt}`} />
          <div className={`${styles.skel} ${styles.skelBloc}`} />
        </div>
        <div className={styles.skelCol}>
          <div className={`${styles.skel} ${styles.skelBlocCourt}`} />
          <div className={`${styles.skel} ${styles.skelBlocCourt}`} />
        </div>
      </div>
    </div>
  );
}
