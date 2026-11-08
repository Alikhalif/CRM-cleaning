"use client";

// Mentions des produits d'entretien, PAR PAYS — réglage du Super Admin.
//
// ── POURQUOI PAR PAYS, ET PAS PAR SOCIÉTÉ ───────────────────────────
//
// Une mention sur les produits est une allégation réglementaire. « 100 %
// français » relève du droit français de la consommation ; « conforme aux
// normes européennes » n'a pas de sens au Canada ; et la conformité
// européenne ne dispense pas des obligations suisses. Le pays de la société
// qui signe est donc le seul axe défendable — et c'est la décision du client
// du 2026-11-06.
//
// La première version de cet écran demandait une saisie par société : le
// Super Admin devait recopier la même phrase pour chaque société d'un même
// pays, et rien n'empêchait d'écrire la mention française sur une société
// suisse.
//
// ── CE QUE CET ÉCRAN FAIT, ET CE QU'IL NE FAIT PAS ──────────────────
//
// Il n'autorise PAS à choisir quelle mention s'applique : c'est le pays de
// l'entité qui décide, automatiquement, et le commercial n'y touche jamais.
// Il sert à ACTIVER, pays par pays, l'allégation que l'entreprise assume,
// justificatifs en main. Tant qu'un pays n'est pas activé, aucune mention ne
// part sur ses devis.

import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import {
  AVERTISSEMENT_PAYS,
  COUNTRIES,
  COUNTRY_LABEL,
  LONGUEUR_MAX_MENTION,
  MENTION_PAR_PAYS,
  controlerMention,
  type Country,
  type ReglagePays,
} from "@/lib/generation/mentions-produits";
import { enregistrerMentionsProduits } from "./actions";
import styles from "./Integrations.module.scss";

export type SocietePays = { id: string; nom: string; pays: string | null };

type Props = {
  reglages: Partial<Record<Country, ReglagePays>>;
  /** Couche PAR SOCIÉTÉ : identifiant d'entité → réglages par pays. */
  reglagesSocietes: Record<string, Partial<Record<Country, ReglagePays>>>;
  societes: SocietePays[];
};

export default function MentionsProduits({ reglages, reglagesSocietes, societes }: Props) {
  const [etat, setEtat] = useState<Record<string, ReglagePays>>(
    Object.fromEntries(
      COUNTRIES.map((p) => [p, reglages[p] ?? { active: false, texte: "" }]),
    ),
  );
  // État de la couche société. Clé « <entityId>|<pays> » : plate, donc
  // comparable et sérialisable sans parcours imbriqué.
  const cle = (id: string, pays: Country) => `${id}|${pays}`;
  const initialSoc = Object.fromEntries(
    societes.flatMap((s) =>
      COUNTRIES.map((p) => [cle(s.id, p), reglagesSocietes[s.id]?.[p]?.active ?? false]),
    ),
  ) as Record<string, boolean>;
  const [etatSoc, setEtatSoc] = useState<Record<string, boolean>>(initialSoc);

  const [message, setMessage] = useState<{ ton: "ok" | "ko"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const initial = Object.fromEntries(
    COUNTRIES.map((p) => [p, reglages[p] ?? { active: false, texte: "" }]),
  );
  const modifie = COUNTRIES.some((p) =>
    (etat[p]?.active ?? false) !== (initial[p]?.active ?? false)
    || (etat[p]?.texte ?? "") !== (initial[p]?.texte ?? ""))
    || Object.keys(initialSoc).some((k) => (etatSoc[k] ?? false) !== (initialSoc[k] ?? false));

  // Sociétés sans pays exploitable : leurs devis ne porteront JAMAIS de
  // mention, quoi qu'on active. Il faut le dire ici, sinon le Super Admin
  // active la France et ne comprend pas pourquoi rien ne sort.
  const sansPays = societes.filter(
    (s) => !(COUNTRIES as string[]).includes((s.pays ?? "").toUpperCase()),
  );
  const parPays = new Map<string, SocietePays[]>();
  for (const s of societes) {
    const p = (s.pays ?? "").toUpperCase();
    if (!(COUNTRIES as string[]).includes(p)) continue;
    parPays.set(p, [...(parPays.get(p) ?? []), s]);
  }

  const enregistrer = () => {
    setMessage(null);
    for (const p of COUNTRIES) {
      const r = etat[p];
      if (!r?.active) continue;
      const t = (r.texte || MENTION_PAR_PAYS[p]).trim();
      const c = controlerMention(t);
      if (!c.ok) {
        setMessage({ ton: "ko", texte: `${COUNTRY_LABEL[p]} — ${c.motif}` });
        return;
      }
    }
    // La couche société reprend la formulation de son pays : on n'offre pas
    // un texte libre par société. Une allégation par société ET par texte
    // libre multiplierait les formulations opposables par sept.
    const parSociete: Record<string, Record<string, { active: boolean; texte: string }>> = {};
    for (const s of societes) {
      for (const p of COUNTRIES) {
        if (!etatSoc[cle(s.id, p)]) continue;
        parSociete[s.id] = { ...(parSociete[s.id] ?? {}), [p]: { active: true, texte: "" } };
      }
    }

    demarrer(async () => {
      const r = await enregistrerMentionsProduits(etat, parSociete);
      setMessage(r.ok
        ? { ton: "ok", texte: "Réglages enregistrés. Ils s'appliquent aux prochains devis générés." }
        : { ton: "ko", texte: r.error });
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>Mentions des produits d&apos;entretien</h2>
          <p className={styles.cardDesc}>
            La mention est choisie <strong>automatiquement d&apos;après le pays de la
            société émettrice</strong> du devis. Vous décidez ici, pays par pays, si
            l&apos;entreprise assume cette allégation. <strong>Un pays non activé
            n&apos;affiche aucune mention</strong> — c&apos;est le réglage par défaut.
          </p>
        </div>
      </div>

      <div className={styles.cardBody}>
        <p className={styles.hint}>
          <Icon name="alert" size={14} /> Jusqu&apos;au 6 novembre 2026, la phrase
          «&nbsp;produits 100&nbsp;% français et écoresponsables&nbsp;» était écrite en dur
          dans le moteur et partait sur les devis des <strong>sept sociétés</strong>, dans
          les <strong>cinq pays</strong>. Ces affirmations sont opposables : elles
          exigent des justificatifs sur chaque produit réellement employé.
        </p>

        {sansPays.length > 0 && (
          <p className={styles.erreurMention}>
            <Icon name="alert" size={14} />{" "}
            {sansPays.length === 1 ? "Une société n'a pas" : `${sansPays.length} sociétés n'ont pas`}{" "}
            de pays renseigné ({sansPays.map((s) => s.nom).join(", ")}). Leurs devis ne
            porteront <strong>aucune mention</strong>, quoi que vous activiez ici : le
            pays est renseigné dans Réglages › Sociétés émettrices.
          </p>
        )}

        {COUNTRIES.map((pays) => {
          const r = etat[pays] ?? { active: false, texte: "" };
          const effectif = r.texte || MENTION_PAR_PAYS[pays];
          const c = r.active ? controlerMention(effectif) : null;
          const concernees = parPays.get(pays) ?? [];
          return (
            <div key={pays} className={styles.champMention}>
              <label className={styles.interrupteurPays}>
                <span className={styles.labelMention}>
                  {COUNTRY_LABEL[pays]}
                  <span className={styles.paysMention}>
                    {" · "}
                    {concernees.length === 0
                      ? "aucune société"
                      : concernees.length === 1
                        ? "1 société"
                        : `${concernees.length} sociétés`}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={r.active}
                  onChange={(e) => setEtat({ ...etat, [pays]: { ...r, active: e.target.checked } })}
                />
              </label>

              {/* La formulation de référence est toujours visible, activée ou
                  non : c'est elle qui partira, et il faut pouvoir la lire
                  avant de cocher. */}
              <textarea
                className={styles.textareaMention}
                rows={2}
                maxLength={LONGUEUR_MAX_MENTION}
                value={r.texte}
                placeholder={MENTION_PAR_PAYS[pays]}
                disabled={!r.active}
                onChange={(e) => setEtat({ ...etat, [pays]: { ...r, texte: e.target.value } })}
              />
              <div className={styles.ligneMention}>
                <span className={styles.compteurMention}>
                  {r.texte
                    ? `${r.texte.length} / ${LONGUEUR_MAX_MENTION} — formulation adaptée`
                    : "formulation de référence"}
                </span>
                {r.texte && (
                  <button
                    type="button"
                    className={styles.lienMention}
                    onClick={() => setEtat({ ...etat, [pays]: { ...r, texte: "" } })}
                  >
                    Revenir à la formulation de référence
                  </button>
                )}
              </div>

              {/* ── La couche SOCIÉTÉ ─────────────────────────────────
                  Jusqu'au 8 novembre 2026, activer un pays faisait porter
                  l'allégation par TOUTES ses sociétés. Chacune l'assume
                  désormais pour elle-même. */}
              {concernees.length > 0 && (
                <div className={styles.ligneMention}>
                  <span className={styles.compteurMention}>
                    Sociétés qui assument cette mention
                    {r.active && " — les non cochées l'héritent du pays tant qu'il est activé"}
                  </span>
                </div>
              )}
              {concernees.map((s) => {
                const coche = etatSoc[cle(s.id, pays)] ?? false;
                return (
                  <label key={s.id} className={styles.interrupteurPays}>
                    <span className={styles.labelMention}>
                      {s.nom}
                      <span className={styles.paysMention}>
                        {" · "}
                        {coche
                          ? "assume la mention"
                          : r.active
                            ? "hérite du réglage par pays — à confirmer"
                            : "aucune mention"}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={(e) =>
                        setEtatSoc({ ...etatSoc, [cle(s.id, pays)]: e.target.checked })
                      }
                    />
                  </label>
                );
              })}

              {AVERTISSEMENT_PAYS[pays] && (
                <p className={styles.avertMention}>
                  <Icon name="alert" size={14} /> {AVERTISSEMENT_PAYS[pays]}
                </p>
              )}
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

        <button
          type="button"
          className={styles.btnMention}
          disabled={enCours || !modifie}
          onClick={enregistrer}
        >
          {enCours ? "Enregistrement…" : "Enregistrer les réglages"}
        </button>
      </div>
    </section>
  );
}
