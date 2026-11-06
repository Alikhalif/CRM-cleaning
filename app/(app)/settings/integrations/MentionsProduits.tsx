"use client";

// Saisie de la mention des produits d'entretien, PAR SOCIÉTÉ (C1, 2026-11-06).
//
// ── POURQUOI CET ÉCRAN EXISTE ───────────────────────────────────────
//
// La phrase « Intervention réalisée avec des produits de nettoyage 100 %
// français et écoresponsables » était écrite EN DUR dans le moteur. Elle
// partait donc sur les devis des sept sociétés du CRM, dans les cinq pays,
// sans qu'aucune règle métier ne l'autorise et sans que personne puisse la
// retirer.
//
// C'est une affirmation sur l'origine et sur le caractère environnemental
// d'un produit : elle engage la société qui l'écrit, devis après devis. Elle
// se saisit donc ici, société par société, et son absence est le défaut.

import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import {
  LONGUEUR_MAX_MENTION,
  SUGGESTION_HISTORIQUE,
  controlerMention,
} from "@/lib/generation/mentions-produits";
import { enregistrerMentionsProduits } from "./actions";
import styles from "./Integrations.module.scss";

export type SocieteMention = {
  id: string;
  nom: string;
  pays: string | null;
  mention: string;
};

export default function MentionsProduits({ societes }: { societes: SocieteMention[] }) {
  const [etat, setEtat] = useState<Record<string, string>>(
    Object.fromEntries(societes.map((s) => [s.id, s.mention])),
  );
  const [message, setMessage] = useState<{ ton: "ok" | "ko"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const initial = Object.fromEntries(societes.map((s) => [s.id, s.mention]));
  const modifie = societes.some((s) => (etat[s.id] ?? "") !== (initial[s.id] ?? ""));

  const enregistrer = () => {
    setMessage(null);
    // Contrôle avant envoi : un texte trop long ou fait d'espaces est refusé
    // ici plutôt qu'au retour du serveur, pour que le champ fautif soit
    // encore sous les yeux de celui qui l'a saisi.
    for (const s of societes) {
      const t = (etat[s.id] ?? "").trim();
      if (!t) continue;
      const c = controlerMention(t);
      if (!c.ok) {
        setMessage({ ton: "ko", texte: `${s.nom} — ${c.motif}` });
        return;
      }
    }
    demarrer(async () => {
      const r = await enregistrerMentionsProduits(etat);
      setMessage(r.ok
        ? { ton: "ok", texte: "Mentions enregistrées. Elles s'appliquent aux prochains devis générés." }
        : { ton: "ko", texte: r.error });
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>Mention des produits d&apos;entretien</h2>
          <p className={styles.cardDesc}>
            Phrase ajoutée au descriptif des devis de nettoyage, <strong>société par
            société</strong>. Un champ vide signifie <strong>aucune mention</strong> —
            c&apos;est le réglage par défaut.
          </p>
        </div>
      </div>

      <div className={styles.cardBody}>
        <p className={styles.hint}>
          <Icon name="alert" size={14} /> Jusqu&apos;au 6 novembre 2026, la phrase
          «&nbsp;produits 100&nbsp;% français et écoresponsables&nbsp;» était écrite en dur
          dans le moteur et partait sur les devis des <strong>sept sociétés</strong>, dans
          les <strong>cinq pays</strong>. Elle a été retirée : une affirmation sur
          l&apos;origine ou l&apos;écoresponsabilité d&apos;un produit engage la société
          qui l&apos;écrit. Ne la rétablissez que pour les sociétés dont les produits
          réellement employés le justifient.
        </p>

        {societes.length === 0 && (
          <p className={styles.hint}>
            Aucune société émettrice enregistrée. Créez-en une dans Réglages ›
            Sociétés émettrices.
          </p>
        )}

        {societes.map((s) => {
          const valeur = etat[s.id] ?? "";
          const c = valeur.trim() ? controlerMention(valeur) : null;
          return (
            <div key={s.id} className={styles.champMention}>
              <label>
                <span className={styles.labelMention}>
                  {s.nom}
                  {s.pays ? <span className={styles.paysMention}> · {s.pays}</span> : null}
                </span>
                <textarea
                  className={styles.textareaMention}
                  rows={2}
                  maxLength={LONGUEUR_MAX_MENTION}
                  value={valeur}
                  placeholder="Aucune mention — laissez vide si rien n'est à affirmer"
                  onChange={(e) => setEtat({ ...etat, [s.id]: e.target.value })}
                />
              </label>
              <div className={styles.ligneMention}>
                <span className={styles.compteurMention}>
                  {valeur.length} / {LONGUEUR_MAX_MENTION}
                </span>
                {!valeur.trim() && (
                  <button
                    type="button"
                    className={styles.lienMention}
                    onClick={() => setEtat({ ...etat, [s.id]: SUGGESTION_HISTORIQUE })}
                  >
                    Reprendre le texte historique
                  </button>
                )}
              </div>
              {/* L'avertissement ne BLOQUE pas : c'est à la société d'assumer son
                  affirmation. Il force seulement à la lire avant d'enregistrer. */}
              {c?.ok && c.avertissement && (
                <p className={styles.avertMention}>
                  <Icon name="alert" size={14} /> {c.avertissement}
                </p>
              )}
              {c && !c.ok && (
                <p className={styles.erreurMention}>
                  <Icon name="alert" size={14} /> {c.motif}
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

        {societes.length > 0 && (
          <button
            type="button"
            className={styles.btnMention}
            disabled={enCours || !modifie}
            onClick={enregistrer}
          >
            {enCours ? "Enregistrement…" : "Enregistrer les mentions"}
          </button>
        )}
      </div>
    </section>
  );
}
