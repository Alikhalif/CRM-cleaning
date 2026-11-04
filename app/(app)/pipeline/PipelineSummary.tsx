"use client";

import { useMemo } from "react";
import { resumePipeline, type LeadPourResume } from "@/lib/pipeline-summary";
import styles from "./PipelineSummary.module.scss";

// Résumé horizontal du pipeline commercial : quatre blocs, quatre couleurs,
// quatre chiffres, reliés par des flèches de progression.
//
// Il ne remplace rien : le Kanban et la vue Liste restent dessous, inchangés.
// Et ce n'est pas le Suivi commercial, qui vit sur /leads et n'est pas touché.
//
// Les quatre chiffres portent sur le MÊME ensemble de dossiers que la liste
// affichée au-dessous — celui que l'appelant a déjà filtré. Le résumé ne
// filtre rien de son côté, pour qu'il ne puisse jamais raconter autre chose
// que ce que l'écran montre.

export default function PipelineSummary({ leads }: { leads: LeadPourResume[] }) {
  const resume = useMemo(() => resumePipeline(leads), [leads]);

  return (
    <section
      className={styles.resume}
      aria-label="Résumé du pipeline commercial"
    >
      <ol className={styles.etapes}>
        {resume.etapes.map((e, i) => (
          <li key={e.cle} className={styles.item}>
            <div
              className={styles.bloc}
              /* La teinte de l'étape voyage par variable CSS : une seule
                 déclaration de style, quatre couleurs. */
              style={{ ["--teinte" as string]: `var(${e.token})` }}
            >
              <span className={styles.nombre}>{e.nombre}</span>
              <span className={styles.libelle}>{e.libelle}</span>

              {e.conversion === null ? (
                /* Première étape : rien avant elle. Afficher « 100 % »
                   laisserait croire à une conversion mesurée. */
                <span className={styles.conversionVide}>point d&apos;entrée</span>
              ) : (
                <span
                  className={styles.conversion}
                  data-anomalie={e.depassePrecedente ? "true" : undefined}
                  title={
                    e.depassePrecedente
                      ? "Plus de dossiers qu'à l'étape précédente : des devis sont partis sans découverte enregistrée."
                      : "Conversion depuis l'étape précédente"
                  }
                >
                  {e.conversion} % de l&apos;étape précédente
                </span>
              )}
            </div>

            {/* Flèche de progression. Décorative : l'ordre est déjà porté par
                la liste ordonnée, un lecteur d'écran n'a pas à l'entendre. */}
            {i < resume.etapes.length - 1 && (
              <span className={styles.fleche} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <path
                    d="M4 12h14m0 0-5-5m5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </li>
        ))}
      </ol>

      {resume.conversionGlobale !== null && (
        <p className={styles.global}>
          Conversion de bout en bout :{" "}
          <strong>{resume.conversionGlobale} %</strong> des leads reçus ont signé.
        </p>
      )}
    </section>
  );
}
