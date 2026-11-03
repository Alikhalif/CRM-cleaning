import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import styles from "./BoutonDevisARealiser.module.scss";

// Bouton « DEVIS À RÉALISER — XX » (§2 du cahier du 2026-11-03).
//
// Un SEUL composant pour les trois emplacements demandés — tableau de bord,
// suivi commercial, cockpit de supervision. Trois copies auraient fini par
// afficher trois libellés, et surtout par diverger sur la règle d'affichage.
//
// Le compteur n'est pas un état : il est recalculé à chaque rendu de la page
// qui le porte, et ces pages sont en `force-dynamic`. Il ne peut donc pas
// rester figé sur une valeur périmée.
//
// Le bouton DISPARAÎT à zéro. Afficher « 0 devis à réaliser » occuperait une
// place permanente pour une information sans action — et le cahier demande
// l'inverse : « le compteur doit rester visible TANT QU'IL EXISTE des devis à
// réaliser ».

export default function BoutonDevisARealiser({
  total,
  enRetard = 0,
  /** `bandeau` pour le tableau de bord, `compact` à côté d'autres boutons. */
  variante = "compact",
}: {
  total: number;
  enRetard?: number;
  variante?: "bandeau" | "compact";
}) {
  if (total <= 0) return null;

  return (
    <Link
      href="/devis-a-realiser"
      className={variante === "bandeau" ? styles.bandeau : styles.compact}
      data-alerte={enRetard > 0 ? "1" : undefined}
    >
      <span className={styles.icone}><Icon name="document" size={variante === "bandeau" ? 18 : 15} /></span>
      <span className={styles.valeur}>{total}</span>
      <span className={styles.libelle}>
        devis à réaliser
        {enRetard > 0 && (
          <span className={styles.sous}>
            dont {enRetard} en retard — à traiter en priorité
          </span>
        )}
      </span>
      {variante === "bandeau" && (
        <span className={styles.cta}>
          Voir la liste <Icon name="chevron-down" size={13} />
        </span>
      )}
    </Link>
  );
}
