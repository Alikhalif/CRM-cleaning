"use client";

// Quel gabarit rend les devis d'une société, pour une activité — réglage du
// Super Admin (Lot B).
//
// ── POURQUOI CET ÉCRAN EXISTE ───────────────────────────────────────
//
// Le CRM porte quatre rendus de devis, écrits à des moments différents, et
// aucun n'était choisissable : chaque parcours appelait le sien en dur. Une
// société suisse n'avait aucun moyen d'obtenir la présentation du gabarit
// nettoyage, et OPTIMIVV aucun moyen d'obtenir le rendu générique.
//
// ── CE QU'IL NE FAIT PAS ────────────────────────────────────────────
//
// Il ne touche à aucun devis déjà émis. Un document est archivé au format
// qu'il avait le jour de son émission ; changer un réglage ici ne réécrit
// rien. Il ne règle pas non plus l'identité : celle-ci vient toujours de la
// fiche société, quel que soit le gabarit.
//
// ── LE DÉFAUT EST « AUCUN RÉGLAGE » ─────────────────────────────────
//
// Tant qu'aucune ligne n'est saisie, le rendu reste celui d'aujourd'hui. Une
// bascule de présentation est une décision, jamais l'effet de bord d'un
// déploiement.

import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import {
  GABARITS,
  gabaritConvientAuSecteur,
  gabaritParDefaut,
  resoudreGabarit,
  type GabaritId,
  type ReglageGabarits,
} from "@/lib/devis/gabarits";
import { SECTOR_LABEL, type Sector } from "@/lib/leads";
import { enregistrerGabaritsDevis } from "./actions";
import styles from "./Integrations.module.scss";

export type SocieteGabarit = { id: string; nom: string; pays: string | null };

type Props = {
  reglages: ReglageGabarits;
  societes: SocieteGabarit[];
  /** Secteurs réellement employés, pour ne pas proposer les neuf à l'aveugle. */
  secteurs: Sector[];
};

const ID_GABARITS = Object.keys(GABARITS) as GabaritId[];

export default function GabaritsDevis({ reglages, societes, secteurs }: Props) {
  const [etat, setEtat] = useState<ReglageGabarits>(reglages);
  const [message, setMessage] = useState<{ ton: "ok" | "ko"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const modifie = JSON.stringify(etat) !== JSON.stringify(reglages);

  // Une ligne par couple (société, activité) réellement possible, plus la
  // ligne « toutes sociétés » qui sert de règle générale.
  const lignes: { cle: string; societe: string; secteur: Sector }[] = [];
  for (const s of secteurs) {
    lignes.push({ cle: `*|${s}`, societe: "Toutes les sociétés", secteur: s });
    for (const soc of societes) {
      lignes.push({ cle: `${soc.id}|${s}`, societe: soc.nom, secteur: s });
    }
  }

  const choisir = (cle: string, valeur: string) => {
    const suite = { ...etat };
    if (valeur === "") delete suite[cle];
    else suite[cle] = valeur;
    setEtat(suite);
  };

  const enregistrer = () => {
    setMessage(null);
    demarrer(async () => {
      const r = await enregistrerGabaritsDevis(etat);
      setMessage(r.ok
        ? {
          ton: "ok",
          texte: "Réglages enregistrés. Ils s'appliquent aux prochains rendus ; "
            + "aucun devis déjà émis n'est modifié.",
        }
        : { ton: "ko", texte: r.error });
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>Gabarit des devis</h2>
          <p className={styles.cardDesc}>
            Choisissez la <strong>présentation</strong> du devis par société et par
            activité. L&apos;identité imprimée — dénomination, adresse, identifiant
            légal — vient toujours de la fiche société, quel que soit le gabarit.
            <strong> Sans réglage, la présentation actuelle est conservée.</strong>
          </p>
        </div>
      </div>

      <div className={styles.cardBody}>
        <p className={styles.hint}>
          <Icon name="alert" size={14} /> Le gabarit{" "}
          <strong>{GABARITS.optimivv_nettoyage.libelle}</strong> est un fichier PDF
          fourni par le client, qui portait l&apos;identité d&apos;OPTIMIVV dans son
          design. Pour une autre société, le CRM emploie une version{" "}
          <strong>neutralisée</strong> et redessine l&apos;identité réelle — sans quoi
          la dénomination et le SIRET d&apos;OPTIMIVV resteraient lisibles dans le
          texte du PDF, par copier-coller.
        </p>

        {societes.length === 0 && (
          <p className={styles.erreurMention}>
            <Icon name="alert" size={14} /> Aucune société émettrice enregistrée :
            il n&apos;y a rien à régler tant que Réglages › Sociétés émettrices est vide.
          </p>
        )}

        {lignes.map(({ cle, societe, secteur }) => {
          const choix = etat[cle] ?? "";
          const effectif = resoudreGabarit({
            entityId: cle.split("|")[0] === "*" ? null : cle.split("|")[0],
            secteur,
            type: "devis",
            reglages: etat,
          });
          const defaut = gabaritParDefaut(secteur, "devis");
          const inadapte = choix !== "" && !gabaritConvientAuSecteur(choix as GabaritId, secteur);
          return (
            <div key={cle} className={styles.champMention}>
              <label className={styles.ligneGabarit}>
                <span className={styles.labelMention}>
                  {societe}
                  <span className={styles.paysMention}>
                    {" · "}{SECTOR_LABEL[secteur]}
                  </span>
                </span>
                <select
                  className={styles.selectGabarit}
                  value={choix}
                  onChange={(e) => choisir(cle, e.target.value)}
                >
                  <option value="">
                    Par défaut — {GABARITS[defaut].libelle}
                  </option>
                  {ID_GABARITS.map((g) => (
                    <option key={g} value={g}>{GABARITS[g].libelle}</option>
                  ))}
                </select>
              </label>

              <div className={styles.ligneMention}>
                <span className={styles.compteurMention}>
                  {choix === ""
                    ? `appliqué : ${GABARITS[effectif.gabarit].libelle} (${effectif.origine})`
                    : GABARITS[choix as GabaritId].note}
                </span>
              </div>

              {inadapte && (
                <p className={styles.avertMention}>
                  <Icon name="alert" size={14} /> Ce gabarit n&apos;est pas prévu pour
                  l&apos;activité {SECTOR_LABEL[secteur]}. Il fonctionnera, mais sa
                  présentation a été dessinée pour d&apos;autres prestations.
                </p>
              )}
            </div>
          );
        })}

        {message && (
          <p className={message.ton === "ok" ? styles.okMention : styles.erreurMention}>
            {message.texte}
          </p>
        )}

        <button
          type="button"
          className={styles.btnMention}
          disabled={enCours || !modifie}
          onClick={enregistrer}
        >
          {enCours ? "Enregistrement…" : "Enregistrer les gabarits"}
        </button>
      </div>
    </section>
  );
}
