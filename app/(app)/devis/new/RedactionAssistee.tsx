"use client";

// Rédaction assistée — les huit fonctions du §17 du master prompt.
//
// ── LA RÈGLE DE SÉCURITÉ DU §17 ───────────────────────────────────────
//
//   « Ne jamais écraser silencieusement une modification humaine.
//     Prévoir un historique des versions.
//     Prévoir une confirmation avant remplacement. »
//
// Tenue en trois temps :
//
//   1. L'action serveur NE FAIT QUE PROPOSER. Rien n'est écrit en base ici —
//      c'est le bouton « Enregistrer » du devis qui écrit, comme avant.
//   2. Avant tout remplacement, on compare le texte courant à la dernière
//      proposition. S'il en diffère, c'est qu'un humain y a touché : on
//      demande confirmation, en nommant ce qui va être remplacé.
//   3. La valeur précédente est conservée, et « Annuler le remplacement » la
//      restitue. L'annulation reste disponible tant que l'éditeur est ouvert.
//
// ⚠️ LIMITE ASSUMÉE : cet historique vit dans l'éditeur, pas en base. Fermer
// l'onglet avant d'enregistrer perd les versions intermédiaires — mais jamais
// le contenu enregistré, puisque rien n'est écrit sans action explicite. Un
// historique durable demande une table et une décision ; il est listé comme
// tel dans le journal du module.

import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import {
  corrigerRepetitionsDevis,
  redigerDevis,
  type ModeRedaction,
} from "./redaction-actions";
import styles from "./RedactionAssistee.module.scss";

type Props = {
  /** Brouillon repris. `null` → la rédaction assistée n'est pas proposée. */
  brouillonId: string | null;
  /** Texte courant des notes (les trois blocs du devis). */
  notes: string;
  /** Libellé courant de la première ligne de prestation, qui porte le titre. */
  titre: string;
  onNotes: (texte: string) => void;
  onTitre: (titre: string) => void;
};

type Precedent = { notes: string; titre: string; quoi: string } | null;

const BOUTONS: {
  cle: string;
  libelle: string;
  aide: string;
  mode?: ModeRedaction;
  /** Ce que le bouton remplace, pour la demande de confirmation. */
  cible: "tout" | "titre" | "reserves" | "repetitions";
}[] = [
  {
    cle: "generer", libelle: "Générer le devis", mode: "complet", cible: "tout",
    aide: "Rédige le contenu depuis la découverte : titre, introduction, sections et réserves.",
  },
  {
    cle: "ameliorer", libelle: "Améliorer le descriptif", mode: "developper", cible: "tout",
    aide: "Reprend la rédaction au niveau de détail le plus élevé.",
  },
  {
    cle: "developper", libelle: "Développer les prestations", mode: "developper", cible: "tout",
    aide: "Enrichit chaque section des opérations complémentaires du référentiel.",
  },
  {
    cle: "repetitions", libelle: "Corriger les répétitions", cible: "repetitions",
    aide: "Retire les puces en double du texte courant et renumérote les sections. Ne régénère rien.",
  },
  {
    cle: "titre", libelle: "Régénérer le titre", mode: "titre", cible: "titre",
    aide: "Recompose le titre depuis la découverte, sans toucher au descriptif.",
  },
  {
    cle: "reserves", libelle: "Régénérer les réserves", mode: "reserves", cible: "reserves",
    aide: "Recompose le bloc RÉSERVES, sans toucher au descriptif.",
  },
  {
    cle: "tout", libelle: "Régénérer le devis", mode: "complet", cible: "tout",
    aide: "Produit une proposition complète et neuve. Remplace titre, descriptif et réserves.",
  },
];

const LIBELLE_CIBLE: Record<string, string> = {
  tout: "le titre, le descriptif et les réserves",
  titre: "le titre",
  reserves: "le bloc RÉSERVES",
  repetitions: "les puces en double du descriptif",
};

export default function RedactionAssistee({
  brouillonId, notes, titre, onNotes, onTitre,
}: Props) {
  const [enCours, setEnCours] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [manquant, setManquant] = useState<string[]>([]);
  const [alertes, setAlertes] = useState<string[]>([]);
  const [precedent, setPrecedent] = useState<Precedent>(null);
  /** Dernière valeur que NOUS avons posée : sert à détecter une saisie humaine. */
  const [poseParNous, setPoseParNous] = useState<{ notes: string; titre: string }>({
    notes: "", titre: "",
  });

  if (!brouillonId) return null;

  /**
   * Le texte a-t-il été modifié à la main depuis notre dernière proposition ?
   *
   * Un champ vide n'est pas une modification humaine : il n'y a rien à
   * préserver, donc rien à confirmer.
   */
  const modifieParUnHumain = (cible: string): boolean => {
    if (cible === "titre") {
      return titre.trim().length > 0 && titre !== poseParNous.titre;
    }
    return notes.trim().length > 0 && notes !== poseParNous.notes;
  };

  const confirmerRemplacement = (cible: string, libelle: string): boolean => {
    if (!modifieParUnHumain(cible)) return true;
    return window.confirm(
      `« ${libelle} » va remplacer ${LIBELLE_CIBLE[cible]}.\n\n`
      + "Le texte actuel comporte des modifications qui ne viennent pas de la "
      + "rédaction automatique. Elles seront remplacées.\n\n"
      + "Vous pourrez annuler ce remplacement juste après, et rien n'est "
      + "enregistré avant que vous ne cliquiez sur « Enregistrer ».",
    );
  };

  const reinitialiserMessages = () => {
    setErreur(null);
    setInfo(null);
    setManquant([]);
    setAlertes([]);
  };

  const lancer = (b: (typeof BOUTONS)[number]) => {
    if (!confirmerRemplacement(b.cible, b.libelle)) return;
    reinitialiserMessages();
    setEnCours(b.cle);

    startTransition(async () => {
      // §17.4 — transformation pure du texte courant, sans relire la découverte.
      if (b.cible === "repetitions") {
        const r = await corrigerRepetitionsDevis(notes);
        setEnCours(null);
        if (r.retirees === 0) {
          setInfo("Aucune répétition trouvée : le descriptif est déjà propre.");
          return;
        }
        setPrecedent({ notes, titre, quoi: b.libelle });
        onNotes(r.texte);
        setPoseParNous({ notes: r.texte, titre });
        setInfo(`${r.retirees} puce${r.retirees > 1 ? "s" : ""} en double retirée${r.retirees > 1 ? "s" : ""}.`);
        return;
      }

      const r = await redigerDevis(brouillonId, b.mode!);
      setEnCours(null);
      if (!r.ok) { setErreur(r.error); return; }

      setPrecedent({ notes, titre, quoi: b.libelle });

      let nouvellesNotes = notes;
      let nouveauTitre = titre;

      if (b.cible === "titre") {
        nouveauTitre = r.designation;
        onTitre(nouveauTitre);
      } else if (b.cible === "reserves") {
        // On remplace le seul bloc RÉSERVES, en conservant tout ce qui précède.
        const i = notes.indexOf("RÉSERVES");
        nouvellesNotes = i >= 0
          ? `${notes.slice(0, i)}RÉSERVES\n\n${r.reserves}`
          : `${notes.trim()}\n\nRÉSERVES\n\n${r.reserves}`;
        onNotes(nouvellesNotes);
      } else {
        nouvellesNotes = r.notes;
        nouveauTitre = r.designation;
        onNotes(nouvellesNotes);
        onTitre(nouveauTitre);
      }

      setPoseParNous({ notes: nouvellesNotes, titre: nouveauTitre });
      setManquant(r.manquant);
      setAlertes(r.alertes);
      setInfo(
        `Rédaction ${b.cible === "titre" ? "du titre" : b.cible === "reserves" ? "des réserves" : "complète"} `
        + `· niveau de détail ${r.niveau}/3`,
      );
    });
  };

  const annuler = () => {
    if (!precedent) return;
    onNotes(precedent.notes);
    onTitre(precedent.titre);
    setPoseParNous({ notes: precedent.notes, titre: precedent.titre });
    setInfo(`« ${precedent.quoi} » annulé : le texte précédent est rétabli.`);
    setManquant([]);
    setAlertes([]);
    setPrecedent(null);
  };

  return (
    <section className={styles.panneau} aria-label="Rédaction assistée">
      <header className={styles.tete}>
        <h2 className={styles.h2}>
          <Icon name="edit" size={14} /> Rédaction assistée
        </h2>
        <p className={styles.sousTitre}>
          Le texte reste entièrement modifiable à la main. Rien n&apos;est enregistré
          ni envoyé sans votre action.
        </p>
      </header>

      <div className={styles.boutons}>
        {BOUTONS.map((b) => (
          <button
            key={b.cle}
            type="button"
            className={styles.bouton}
            title={b.aide}
            disabled={enCours !== null}
            onClick={() => lancer(b)}
          >
            {enCours === b.cle ? "…" : b.libelle}
          </button>
        ))}
      </div>

      {precedent && (
        <button type="button" className={styles.annuler} onClick={annuler}>
          <Icon name="x" size={13} /> Annuler « {precedent.quoi} »
        </button>
      )}

      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {info && !erreur && <p className={styles.info}>{info}</p>}

      {manquant.length > 0 && (
        <div className={styles.bloc} data-tone="warning">
          <strong>Informations absentes de la découverte</strong>
          <p>
            Le texte ne les a pas inventées. Complétez la découverte puis
            régénérez, ou ajoutez-les à la main.
          </p>
          <ul>{manquant.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}

      {alertes.length > 0 && (
        <div className={styles.bloc} data-tone="danger">
          <strong>Formulations à corriger avant envoi</strong>
          <ul>{alertes.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
