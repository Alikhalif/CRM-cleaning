"use client";

// Déclaration d'appel — D1 du 2026-11-06, un clic sur la fiche lead.
//
// ── POURQUOI CETTE CARTE EXISTE ─────────────────────────────────────
//
// L'audit du Superviseur a mesuré, sur les 712 leads de production : DIX
// appels journalisés, ZÉRO lead marqué NRP. La ligne Ringover n'est pas
// portée, et rien d'autre ne trace un appel. Conséquence : « lead contacté »
// ne pouvait pas être calculé, et le cockpit comptait 650 leads « traités »
// dont 601 sur la seule existence d'une tâche à faire.
//
// Sans ce geste, le Superviseur dira toujours « on ne sait pas ».
//
// ── CE QU'ELLE N'EST PAS ────────────────────────────────────────────
//
// ⚠️ Un clic ici est une DÉCLARATION du commercial, pas une preuve d'appel.
// C'est écrit sur la carte, en clair, parce que le superviseur lira ces
// chiffres et doit savoir ce qu'ils valent. Le jour où Ringover remontera les
// appels, ils seront distingués — jamais additionnés.
//
// ── POURQUOI QUATRE BOUTONS ET PAS UN FORMULAIRE ────────────────────
//
// Le commercial déclare entre deux appels. Un formulaire à ouvrir, remplir et
// valider ne serait pas rempli : c'est précisément ce qui s'est passé avec
// les dix appels journalisés en six mois. Un clic suffit ; la note est
// facultative et se replie.

import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import { declarerAppel, type ResultatAppelDeclare } from "@/app/(app)/pipeline/actions";
import styles from "./LeadDetail.module.scss";

type Props = {
  leadId: string;
  /** Dernier appel connu, pour ne pas déclarer deux fois le même. */
  dernierAppel?: { le: string; resultat: string; source: string } | null;
};

const CHOIX: { cle: ResultatAppelDeclare; libelle: string; aide: string }[] = [
  {
    cle: "joint",
    libelle: "Client joint",
    aide: "Le client a répondu. C'est le seul résultat qui vaut « contact établi ».",
  },
  {
    cle: "sans_reponse",
    libelle: "Sans réponse",
    aide: "Ça a sonné, personne. Le dossier reste à faire.",
  },
  {
    cle: "rappel",
    libelle: "À rappeler",
    aide: "Joint mais pas disponible, ou occupé. Le dossier reste à faire.",
  },
  {
    cle: "injoignable",
    libelle: "Numéro injoignable",
    aide: "Numéro invalide ou hors service. Marque aussi le dossier NRP.",
  },
];

export default function DeclarerAppelCard({ leadId, dernierAppel }: Props) {
  const [note, setNote] = useState("");
  const [noteOuverte, setNoteOuverte] = useState(false);
  const [message, setMessage] = useState<{ ton: "ok" | "ko"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const [choisi, setChoisi] = useState<ResultatAppelDeclare | null>(null);

  const declarer = (resultat: ResultatAppelDeclare) => {
    setMessage(null);
    setChoisi(resultat);
    demarrer(async () => {
      const r = await declarerAppel(leadId, resultat, note);
      setChoisi(null);
      if (!r.ok) { setMessage({ ton: "ko", texte: r.error }); return; }
      setNote("");
      setNoteOuverte(false);
      setMessage({
        ton: "ok",
        texte: resultat === "joint"
          ? "Contact enregistré. Le dossier passe en « client joint »."
          : "Appel enregistré. Le dossier reste à faire.",
      });
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.h}>
          <Icon name="phone" size={15} /> Déclarer un appel
        </h2>
      </div>

      {dernierAppel && (
        <p className={styles.muted}>
          Dernier appel enregistré <RelativeTime iso={dernierAppel.le} /> —{" "}
          {dernierAppel.resultat}
          {dernierAppel.source === "ringover" ? " (confirmé par Ringover)" : " (déclaré)"}
        </p>
      )}

      <div className={styles.actions}>
        {CHOIX.map((c) => (
          <button
            key={c.cle}
            type="button"
            className={styles.btn}
            disabled={enCours}
            title={c.aide}
            onClick={() => declarer(c.cle)}
          >
            {enCours && choisi === c.cle ? "…" : c.libelle}
          </button>
        ))}
      </div>

      {!noteOuverte ? (
        <button
          type="button"
          className={styles.link}
          onClick={() => setNoteOuverte(true)}
        >
          Ajouter une note à l&apos;appel
        </button>
      ) : (
        <textarea
          className={styles.notesArea}
          rows={2}
          value={note}
          maxLength={500}
          placeholder="Note facultative — ex. rappeler après 18 h"
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {message && (
        <p className={message.ton === "ok" ? styles.savedBadge : styles.errorMessage}>{message.texte}</p>
      )}

      {/* Dit en clair ce que valent ces chiffres. Le superviseur les lira. */}
      <p className={styles.muted}>
        Une déclaration est la parole du commercial, pas une preuve d&apos;appel.
        Les appels confirmés par la téléphonie seront comptés à part.
      </p>
    </section>
  );
}
