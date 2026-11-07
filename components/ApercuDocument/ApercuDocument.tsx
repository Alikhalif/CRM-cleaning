"use client";

// Visualisation d'un document — la fenêtre, partagée par les trois écrans.
//
// ── POURQUOI UN COMPOSANT, ET PAS TROIS MODALES ──────────────────────
//
// La visualisation n'existait que dans l'éditeur de devis. Ailleurs, le
// document s'ouvrait dans un ONGLET : la fiche du devis et la comptabilité
// renvoyaient vers `/api/documents/[id]/preview-pdf` en `target="_blank"`.
// On quittait l'écran, et on y revenait à la main.
//
// La recopier trois fois aurait produit trois comportements qui divergent au
// premier correctif — exactement ce que le Lot B a supprimé côté rendu. Une
// seule fenêtre, donc : même barre, même raccourci clavier, même règle
// mobile, même document.
//
// ── CE QU'ELLE MONTRE ────────────────────────────────────────────────
//
// `/api/documents/[id]/preview-pdf`, c'est-à-dire le document FINAL, rendu
// par le point d'entrée unique du Lot B. Aucun moteur de rendu n'est
// dupliqué ici : la visualisation ne peut pas diverger de ce que le client
// recevra.
//
// ── CE QU'ELLE NE FAIT PAS ───────────────────────────────────────────
//
// Elle n'envoie rien, n'enregistre rien et ne modifie rien. `onActualiser`
// est fourni par l'appelant quand lui, et lui seul, sait comment rafraîchir
// le document — l'éditeur réenregistre son brouillon ; la fiche d'un devis
// déjà émis n'a rien à réenregistrer et ne passe donc pas ce rappel.

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import styles from "./ApercuDocument.module.scss";

export type ApercuDocumentProps = {
  /** Identifiant du document à afficher. `null` = fenêtre fermée. */
  documentId: string | null;
  /** Numéro affiché dans le titre, quand on le connaît. */
  numero?: string | null;
  /** Fermeture — clic hors du panneau, bouton de retour, touche Échap. */
  onFermer: () => void;
  /**
   * Rafraîchir le document affiché.
   *
   * Absent = pas de bouton « Actualiser ». C'est le cas d'un document déjà
   * émis : il ne bouge plus, et offrir de l'actualiser laisserait croire le
   * contraire.
   */
  onActualiser?: () => void;
  /** Vrai pendant une actualisation, pour désarmer le bouton. */
  actualisation?: boolean;
  /** Libellé du bouton de fermeture. Varie selon l'écran appelant. */
  libelleRetour?: string;
  /** Texte du pied. Absent = aucun pied. */
  pied?: React.ReactNode;
};

export default function ApercuDocument({
  documentId,
  numero,
  onFermer,
  onActualiser,
  actualisation = false,
  libelleRetour = "Fermer",
  pied,
}: ApercuDocumentProps) {
  // Change à chaque actualisation pour forcer le rechargement de l'iframe :
  // un simple `src` identique ne relit pas le document.
  const [cle, setCle] = useState(0);
  const panneau = useRef<HTMLDivElement>(null);

  // Échap ferme. Une fenêtre modale dont on ne sort qu'à la souris est une
  // fenêtre dont on ne sort pas au clavier.
  useEffect(() => {
    if (!documentId) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [documentId, onFermer]);

  // Le focus entre dans la fenêtre à son ouverture, sinon la tabulation
  // continue de parcourir l'écran qui est derrière.
  useEffect(() => {
    if (documentId) panneau.current?.focus();
  }, [documentId]);

  const actualiser = useCallback(() => {
    setCle((n) => n + 1);
    onActualiser?.();
  }, [onActualiser]);

  if (!documentId) return null;

  return (
    <div
      className={styles.fond}
      role="dialog"
      aria-modal="true"
      aria-label="Visualisation du document"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
    >
      <div className={styles.panneau} ref={panneau} tabIndex={-1}>
        <div className={styles.barre}>
          <h2 className={styles.titre}>
            Visualisation{numero ? ` — ${numero}` : ""} — le document tel que le
            client le recevra
          </h2>

          {onActualiser && (
            <button
              type="button"
              className={styles.btnFantome}
              disabled={actualisation}
              onClick={actualiser}
              title="Recharger le document"
            >
              {actualisation ? "Actualisation…" : "Actualiser"}
            </button>
          )}

          <a
            className={styles.btnFantome}
            href={`/api/documents/${documentId}/preview-pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="external-link" size={16} />
            Ouvrir dans un onglet
          </a>

          <button type="button" className={styles.btnSecondaire} onClick={onFermer}>
            {libelleRetour}
          </button>
        </div>

        {/* Le MÊME rendu que le document final : la route d'aperçu est celle
            qu'emploie l'envoi au client. Rien n'est réimplémenté ici, donc la
            visualisation ne peut pas diverger du PDF émis. */}
        <iframe
          key={cle}
          className={styles.cadre}
          src={`/api/documents/${documentId}/preview-pdf#toolbar=1`}
          title="Document en prévisualisation"
        />

        {pied && <p className={styles.pied}>{pied}</p>}
      </div>
    </div>
  );
}
