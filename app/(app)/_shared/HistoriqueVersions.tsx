"use client";

// M1 — l'historique des versions d'un devis, sur sa fiche.
//
// ── CE QU'IL RÉPOND ──────────────────────────────────────────────────
//
// « Qui a écrit ce texte, et quand ? » Le jour où un client contestera une
// formulation, il faudra montrer le texte EXACT qui lui a été envoyé, et
// distinguer ce que le moteur avait rédigé de ce qu'un commercial a repris
// par-dessus.
//
// ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────
//
// Il ne restaure pas. Un historique append-only qui se laisse rejouer n'est
// plus un historique : restaurer une version produirait une NOUVELLE version,
// et ce geste mérite d'être décidé, pas glissé dans un panneau de lecture.
// On lit, on compare, on copie.

import { useState } from "react";
import Icon from "@/components/Icon/Icon";
import {
  LIBELLE_ORIGINE, type Historique, type VersionDocument,
} from "@/lib/devis/versions-shared";
import styles from "./HistoriqueVersions.module.scss";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function quand(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : DATE.format(d);
}

type Props = { historique: Historique };

export default function HistoriqueVersions({ historique }: Props) {
  const [ouverte, setOuverte] = useState<string | null>(null);

  // La migration M1 n'est pas appliquée : on le DIT, au lieu d'afficher un
  // panneau vide qui se lirait comme « ce devis n'a jamais été modifié ».
  if (!historique.disponible) {
    return (
      <section className={styles.bloc}>
        <h2 className={styles.titre}>Historique des versions</h2>
        <p className={styles.indisponible}>
          <Icon name="alert" size={14} /> {historique.motif}
        </p>
      </section>
    );
  }

  if (historique.versions.length === 0) {
    return (
      <section className={styles.bloc}>
        <h2 className={styles.titre}>Historique des versions</h2>
        <p className={styles.vide}>
          Aucune version enregistrée pour ce document. L&apos;historique se
          remplit à la génération, à chaque enregistrement et à l&apos;envoi.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.bloc}>
      <h2 className={styles.titre}>
        Historique des versions
        <span className={styles.compte}>{historique.versions.length}</span>
      </h2>

      <ol className={styles.liste}>
        {historique.versions.map((v) => (
          <Ligne
            key={v.id}
            version={v}
            ouverte={ouverte === v.id}
            onBasculer={() => setOuverte(ouverte === v.id ? null : v.id)}
          />
        ))}
      </ol>
    </section>
  );
}

function Ligne({
  version, ouverte, onBasculer,
}: { version: VersionDocument; ouverte: boolean; onBasculer: () => void }) {
  const engage = version.origine === "emission";
  return (
    <li className={engage ? `${styles.ligne} ${styles.ligneEngage}` : styles.ligne}>
      <button
        type="button"
        className={styles.entete}
        onClick={onBasculer}
        aria-expanded={ouverte}
      >
        <span className={styles.numero}>v{version.version}</span>
        <span className={styles.origine} data-origine={version.origine}>
          {LIBELLE_ORIGINE[version.origine]}
        </span>
        <span className={styles.date}>{quand(version.creeLe)}</span>
        <Icon name={ouverte ? "chevron-up" : "chevron-down"} size={14} />
      </button>

      {/* La version d'émission est celle qui ENGAGE : c'est elle qu'on
          produira en cas de contestation. Elle se repère sans lire. */}
      {engage && (
        <p className={styles.engageNote}>
          Version envoyée au client{version.note ? ` — ${version.note}` : ""}.
          C&apos;est le texte qui engage.
        </p>
      )}

      {ouverte && (
        <div className={styles.detail}>
          {version.designation && (
            <p className={styles.designation}>{version.designation}</p>
          )}
          {version.regles.length > 0 && (
            <p className={styles.regles}>
              Fonctions employées : {version.regles.join(" · ")}
            </p>
          )}
          <pre className={styles.texte}>{version.notes || "(aucun descriptif)"}</pre>
        </div>
      )}
    </li>
  );
}
