"use client";

import { useState } from "react";
import type { SuiviRow } from "@/lib/suivi-shared";
import PipelineCompact from "./PipelineCompact";
import styles from "./PipelineCompact.module.scss";

// Deux vues du même pipeline, un seul bouton pour basculer.
//
// La vue COMPACTE est la vue par défaut : c'est celle demandée — lecture
// immédiate, quatre cases, une action. Le KANBAN existant est conservé derrière
// le bouton : il porte le glisser-déposer, les sous-statuts Mano/Auto et
// Sans/Avec acompte, le lancement de séquence et l'affectation en masse. Le
// supprimer aurait retiré des fonctionnalités que personne n'a demandé de
// retirer.
export default function PipelineShell({
  rows,
  kanban,
}: {
  rows: SuiviRow[];
  kanban: React.ReactNode;
}) {
  const [vue, setVue] = useState<"compact" | "kanban">("compact");

  return (
    <>
      <div className={styles.filters} style={{ marginBottom: "var(--sp-3)" }}>
        <button type="button" className={`${styles.chip} ${vue === "compact" ? styles.chipOn : ""}`} onClick={() => setVue("compact")}>
          Vue rapide
        </button>
        <button type="button" className={`${styles.chip} ${vue === "kanban" ? styles.chipOn : ""}`} onClick={() => setVue("kanban")}>
          Kanban détaillé
        </button>
      </div>
      {vue === "compact" ? <PipelineCompact rows={rows} /> : kanban}
    </>
  );
}
