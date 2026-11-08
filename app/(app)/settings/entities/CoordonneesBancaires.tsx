"use client";

// Coordonnées bancaires des sociétés émettrices — Super Admin seul.
//
// ── POURQUOI UN BLOC SÉPARÉ DU FORMULAIRE DE SOCIÉTÉ ────────────────
//
// Les champs `iban` et `bic` avaient été retirés du formulaire le 2026-11-05
// parce qu'une fiche enregistrée sans eux les effaçait. Les y remettre
// reproduirait le défaut. Ils vivent donc dans un bloc à part, servi par une
// action qui n'écrit QUE ces deux colonnes.
//
// ── POURQUOI LA VALEUR N'EST AFFICHÉE QUE MASQUÉE ───────────────────
//
// Le Super Admin a le droit de la voir. Mais l'afficher en clair la ferait
// voyager dans le HTML de la page, y rester dans le cache du navigateur et
// apparaître sur toute capture d'écran — pour un bénéfice faible, puisque
// modifier une coordonnée consiste à saisir la NOUVELLE, pas à relire
// l'ancienne. Le masque garde les quatre premiers et derniers caractères :
// assez pour vérifier qu'on parle du bon compte.

import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import { modifierCoordonneesBancaires } from "./actions";
import {
  libelleCoordonnee,
  paysUtiliseIban,
  validerBic,
  validerCoordonnee,
} from "@/lib/entities/coordonnees-bancaires";
import { COUNTRY_LABEL, type Country } from "@/lib/leads";
import styles from "./Entities.module.scss";

export type SocieteBancaire = {
  id: string;
  nom: string;
  pays: Country | null;
  /** Déjà masqué côté serveur. Jamais la valeur en clair. */
  ibanMasque: string;
  bicMasque: string;
};

export type EntreeHistorique = {
  quand: string;
  qui: string | null;
  avant: string;
  apres: string;
  chiffre: boolean;
};

type Props = {
  societes: SocieteBancaire[];
  historique: Record<string, EntreeHistorique[]>;
};

export default function CoordonneesBancaires({ societes, historique }: Props) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [message, setMessage] = useState<{ ton: "ok" | "ko"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const ouvrir = (id: string) => {
    setOuverte(ouverte === id ? null : id);
    setIban("");
    setBic("");
    setMessage(null);
  };

  const enregistrer = (s: SocieteBancaire) => {
    setMessage(null);
    if (!s.pays) {
      setMessage({
        ton: "ko",
        texte:
          "Le pays de cette société n'est pas renseigné. Une coordonnée bancaire " +
          "se valide contre un pays : renseignez-le d'abord.",
      });
      return;
    }

    // La même validation qu'au serveur, jouée ici pour éviter un aller-retour.
    // ⚠️ Elle ne REMPLACE pas celle du serveur : l'action la rejoue, parce
    // qu'un contrôle côté navigateur ne protège rien.
    const vI = validerCoordonnee(iban, s.pays);
    if (!vI.ok) {
      setMessage({ ton: "ko", texte: `${libelleCoordonnee(s.pays)} — ${vI.motif}` });
      return;
    }
    const vB = validerBic(bic, s.pays);
    if (!vB.ok) {
      setMessage({ ton: "ko", texte: `BIC — ${vB.motif}` });
      return;
    }

    demarrer(async () => {
      const r = await modifierCoordonneesBancaires(s.id, { iban, bic });
      if (r.ok) {
        const avert = [vI.avertissement, vB.avertissement].filter(Boolean).join(" ");
        setMessage({
          ton: "ok",
          texte:
            "Coordonnées enregistrées, chiffrées et tracées. Elles seront reprises " +
            `sur les documents de ${s.nom}.` + (avert ? ` ⚠️ ${avert}` : ""),
        });
        setIban("");
        setBic("");
      } else {
        setMessage({ ton: "ko", texte: r.error });
      }
    });
  };

  return (
    <section className={styles.emptyCard} style={{ marginTop: "var(--sp-6)" }}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.h}>Coordonnées bancaires</h2>
          <p className={styles.subtitle}>
            Réservé au <strong>Super Admin</strong>. Chaque modification est{" "}
            <strong>chiffrée</strong>, <strong>tracée</strong> et{" "}
            <strong>historisée</strong>. Les coordonnées sont reprises
            automatiquement sur les documents de leur société émettrice.
          </p>
        </div>
      </div>

      <p className={styles.itemMetaAlert}>
        <Icon name="alert" size={14} /> Le <strong>Canada n&apos;utilise pas
        l&apos;IBAN</strong> : une société canadienne saisit ses coordonnées
        locales (institution, transit, compte), et ses documents impriment
        «&nbsp;Coordonnées bancaires&nbsp;» au lieu de «&nbsp;IBAN&nbsp;».
      </p>

      <ul className={styles.list}>
        {societes.map((s) => {
          const h = historique[s.id] ?? [];
          const estOuverte = ouverte === s.id;
          return (
            <li key={s.id} className={styles.item}>
              <div className={styles.itemBody}>
                <div className={styles.itemTitle}>{s.nom}</div>
                <div className={styles.itemMeta}>
                  {s.pays ? COUNTRY_LABEL[s.pays] : "pays non renseigné"}
                  {" · "}
                  {s.pays && !paysUtiliseIban(s.pays) ? "coordonnées locales" : "IBAN"}
                </div>
                <div className={styles.itemMetaMono}>
                  {s.pays ? libelleCoordonnee(s.pays) : "Coordonnées"} {s.ibanMasque}
                  {s.bicMasque !== "(vide)" ? ` · BIC ${s.bicMasque}` : ""}
                </div>
                {h.length > 0 && (
                  <div className={styles.itemMeta}>
                    {h.length} modification{h.length > 1 ? "s" : ""} —{" "}
                    dernière le {new Date(h[0].quand).toLocaleString("fr-FR")}
                    {h[0].qui ? ` par ${h[0].qui}` : ""}
                  </div>
                )}
              </div>

              <div className={styles.itemActions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => ouvrir(s.id)}
                  aria-expanded={estOuverte}
                >
                  {estOuverte ? "Fermer" : "Modifier"}
                </button>
              </div>

              {estOuverte && (
                <div className={styles.itemForm}>
                  <label>
                    {s.pays ? libelleCoordonnee(s.pays) : "Coordonnées bancaires"}
                    <input
                      type="text"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      placeholder={
                        s.pays && paysUtiliseIban(s.pays)
                          ? `${s.pays}76 1234 5678 9012 3456 7890 123`
                          : "institution + transit + compte"
                      }
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <label>
                    BIC
                    <input
                      type="text"
                      value={bic}
                      onChange={(e) => setBic(e.target.value)}
                      placeholder="8 ou 11 caractères"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <p className={styles.itemMeta}>
                    Laisser les deux champs vides <strong>efface</strong> les
                    coordonnées : les documents n&apos;imprimeront alors aucune
                    ligne bancaire.
                  </p>
                  <button
                    type="button"
                    className={styles.newBtn}
                    disabled={enCours}
                    onClick={() => enregistrer(s)}
                  >
                    {enCours ? "Enregistrement…" : "Enregistrer"}
                  </button>

                  {h.length > 0 && (
                    <div className={styles.itemMeta}>
                      <strong>Historique</strong>
                      <ul>
                        {h.slice(0, 8).map((e, i) => (
                          <li key={i}>
                            {new Date(e.quand).toLocaleString("fr-FR")} —{" "}
                            {e.avant} → {e.apres}
                            {e.qui ? ` · ${e.qui}` : ""}
                            {e.chiffre ? " · chiffré" : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {message && (
        <p className={message.ton === "ok" ? styles.itemMeta : styles.itemMetaAlert}>
          {message.texte}
        </p>
      )}
    </section>
  );
}
