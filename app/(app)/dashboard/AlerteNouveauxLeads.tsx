import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import type { LeadsNonTraites } from "@/lib/leads-non-traites-server";
import styles from "./AlerteNouveauxLeads.module.scss";

// Bandeau « NOUVEAU LEAD — À RAPPELER » du tableau de bord.
//
// PERSISTANT PAR CONSTRUCTION : il n'y a aucun état « lu », aucun bouton pour
// le masquer, aucune mémoire locale. Il est rendu à chaque fois depuis les
// données réelles, donc il ne part que lorsque les leads sont RÉELLEMENT pris
// en charge — un appel, un SMS, une découverte, un changement de statut.
// Ouvrir la fiche ne suffit pas (cf. lib/leads-non-traites-server.ts).

type Props = {
  nonTraites: LeadsNonTraites;
  /** Un manager voit le périmètre de tous les commerciaux : il faut le dire. */
  isBackOffice: boolean;
};

// « depuis 3 jours », « depuis 2 h », « depuis 25 min ».
function depuis(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `depuis ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `depuis ${h} h`;
  const j = Math.floor(h / 24);
  return `depuis ${j} jour${j > 1 ? "s" : ""}`;
}

export default function AlerteNouveauxLeads({ nonTraites, isBackOffice }: Props) {
  // Lecture dégradée : on ne montre rien plutôt qu'un compteur faux. Le cas
  // est tracé côté serveur, pas transformé en fausse bonne nouvelle.
  if (nonTraites.degrade || nonTraites.total === 0) return null;

  const n = nonTraites.total;
  const anciennete = depuis(nonTraites.plusAncienLe);

  return (
    <aside className={styles.bandeau} role="alert">
      <span className={styles.compteur} aria-hidden="true">
        {n > 99 ? "99+" : n}
      </span>

      <div className={styles.corps}>
        <p className={styles.titre}>
          <Icon name="alert" size={16} />
          {n > 1 ? `${n} NOUVEAUX LEADS — À RAPPELER` : "NOUVEAU LEAD — À RAPPELER"}
        </p>
        <p className={styles.detail}>
          {isBackOffice
            ? "Tous commerciaux — aucun appel, SMS, e-mail ni découverte tracé sur ces dossiers."
            : "Aucun appel, SMS, e-mail ni découverte tracé sur ces dossiers."}
          {anciennete && <> Le plus ancien attend <strong>{anciennete}</strong>.</>}
        </p>
      </div>

      <Link href="/leads" className={styles.action}>
        Voir les dossiers
      </Link>
    </aside>
  );
}
