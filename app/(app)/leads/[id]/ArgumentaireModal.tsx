"use client";

import { useEffect, useRef } from "react";
import Icon from "@/components/Icon/Icon";
import { montantLabel, type Pitch } from "@/lib/pricing/argumentaire";
import styles from "./ArgumentaireModal.module.scss";

// Assistant commercial de closing — UNE seule fenêtre, lue pendant l'appel.
//
// Ordre imposé par le client, et il ne change pas : le prix, pourquoi ce prix,
// comment l'annoncer, quoi répondre, comment conclure. Aucun calcul, aucun
// coefficient, aucun détail financier interne : le commercial défend un
// montant, il n'audite pas une grille.

type Props = {
  pitch: Pitch;
  conseille: number;
  min: number;
  max: number;
  vatRate: number | null;
  onClose: () => void;
};

export default function ArgumentaireModal({ pitch, conseille, min, max, vatRate, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    // La page de fond ne défile pas sous la fenêtre : sur téléphone, c'est la
    // différence entre « je lis » et « je cherche où j'en étais ».
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = avant;
    };
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="argumentaire-prix"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.sheet}>
        <header className={styles.head}>
          <div className={styles.headPrix}>
            <span className={styles.kicker}>💰 Prix estimatif recommandé</span>
            <strong className={styles.prix} id="argumentaire-prix">{montantLabel(conseille, vatRate)}</strong>
            <span className={styles.fourchette}>
              Fourchette recommandée : {min.toLocaleString("fr-FR")} – {montantLabel(max, vatRate)}
            </span>
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.bloc}>
            <h3 className={styles.h3}>✅ Pourquoi ce tarif ?</h3>
            {pitch.arguments.length === 0 ? (
              <p className={styles.vide}>
                Aucun élément n&apos;a encore été renseigné dans la découverte pour justifier ce montant.
              </p>
            ) : (
              <ul className={styles.args}>
                {pitch.arguments.map((a) => (
                  <li key={a.cle}>
                    <strong>{a.titre}</strong>
                    <span>{a.detail}</span>
                  </li>
                ))}
              </ul>
            )}
            {pitch.autres.length > 0 && (
              <p className={styles.autres}>
                <strong>Également pris en compte :</strong> {pitch.autres.join(" · ")}.
              </p>
            )}
          </section>

          <section className={styles.bloc}>
            <h3 className={styles.h3}>💬 Comment annoncer le prix ?</h3>
            <p className={styles.script}>{pitch.annonce}</p>
          </section>

          <section className={styles.bloc}>
            <h3 className={styles.h3}>🛡️ Si le client objecte</h3>
            <ul className={styles.objections}>
              {pitch.objections.map((o) => (
                <li key={o.titre}>
                  <strong className={styles.objTitre}>{o.titre}</strong>
                  <p className={styles.script}>{o.reponse}</p>
                  {o.precision && <p className={styles.precision}>{o.precision}</p>}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.bloc}>
            <h3 className={styles.h3}>🎯 Phrase de closing</h3>
            <p className={`${styles.script} ${styles.closing}`}>{pitch.closing}</p>
          </section>

          {pitch.reserves.length > 0 && (
            <p className={styles.reserves}>
              À garder en tête : {pitch.reserves.join(" · ")}. Cette estimation est calculée à partir de la
              découverte et ne vaut pas devis.
            </p>
          )}
        </div>

        <footer className={styles.foot}>
          <button type="button" className={styles.fermer} onClick={onClose}>Fermer</button>
        </footer>
      </div>
    </div>
  );
}
