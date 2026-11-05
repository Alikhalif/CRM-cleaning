"use client";

import { useMemo, useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import {
  BRANCHES,
  COUNTRIES,
  COUNTRY_LABEL,
  DROITS_ORDONNES,
  DROIT_DETAIL,
  DROIT_LABEL,
  FAMILLES,
  perimetreConfigure,
  type BrancheSlug,
  type Country,
  type DroitIntervention,
} from "@/lib/supervision-perimetre";
import type { DonneesAdminPerimetres, SuperviseurAdmin } from "@/lib/supervision-perimetre-server";
import { enregistrerPerimetre, revoquerPerimetre } from "./actions";
import styles from "./Superviseurs.module.scss";

// Écran d'attribution des périmètres. L'interface n'est PAS la sécurité — tout
// est revalidé côté serveur (actions.ts) et la RLS refuse l'écriture à qui
// n'est pas admin. Ici on cherche une seule chose : qu'un périmètre se lise
// d'un coup d'œil, parce qu'un réglage de sécurité qu'on ne comprend pas est
// un réglage qu'on configure mal.

type Etat = {
  pays: string[];
  activityIds: string[];
  commerciauxIds: string[];
  inclureNonAttribues: boolean;
  droits: Record<DroitIntervention, boolean>;
};

const etatInitial = (s: SuperviseurAdmin): Etat => ({
  pays: [...s.pays],
  activityIds: [...s.activityIds],
  commerciauxIds: [...s.commerciauxIds],
  inclureNonAttribues: s.inclureNonAttribues,
  droits: { ...s.droits },
});

const bascule = (liste: string[], valeur: string): string[] =>
  liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];

const memesValeurs = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

export default function PerimetresSuperviseurs({ donnees }: { donnees: DonneesAdminPerimetres }) {
  const [ouvert, setOuvert] = useState<string | null>(
    // Le premier superviseur sans accès est ouvert d'emblée : c'est celui qui
    // attend quelque chose.
    donnees.superviseurs.find((s) => !s.configure)?.userId ?? null,
  );
  const [etats, setEtats] = useState<Record<string, Etat>>(() =>
    Object.fromEntries(donnees.superviseurs.map((s) => [s.userId, etatInitial(s)])),
  );
  const [message, setMessage] = useState<{ userId: string; ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const activitesParBranche = useMemo(() => {
    const out = new Map<BrancheSlug, DonneesAdminPerimetres["activites"]>();
    for (const f of FAMILLES) {
      for (const b of f.branches) {
        out.set(
          b,
          donnees.activites.filter((a) => BRANCHES[b].secteurs.includes(a.slug)),
        );
      }
    }
    return out;
  }, [donnees.activites]);

  const parId = useMemo(
    () => new Map(donnees.superviseurs.map((s) => [s.userId, s])),
    [donnees.superviseurs],
  );

  // L'état local est initialisé une seule fois. Si un rôle Superviseur est
  // attribué ailleurs entre deux rendus (revalidation après enregistrement),
  // la liste du serveur peut contenir un compte sans entrée locale : on
  // repart alors de ses valeurs en base plutôt que de lire `undefined`.
  const majEtat = (userId: string, patch: Partial<Etat>) =>
    setEtats((prec) => {
      const connu = parId.get(userId);
      const base = prec[userId] ?? (connu ? etatInitial(connu) : null);
      if (!base) return prec;
      return { ...prec, [userId]: { ...base, ...patch } };
    });

  const enregistrer = (s: SuperviseurAdmin) => {
    const etat = etats[s.userId] ?? etatInitial(s);
    setEnCours(s.userId);
    setMessage(null);
    startTransition(async () => {
      const res = await enregistrerPerimetre({
        userId: s.userId,
        pays: etat.pays,
        activityIds: etat.activityIds,
        commerciauxIds: etat.commerciauxIds,
        inclureNonAttribues: etat.inclureNonAttribues,
        droits: etat.droits,
      });
      setEnCours(null);
      setMessage(
        res.ok
          ? { userId: s.userId, ok: true, texte: "Périmètre enregistré." }
          : { userId: s.userId, ok: false, texte: res.error },
      );
    });
  };

  const revoquer = (s: SuperviseurAdmin) => {
    setEnCours(s.userId);
    setMessage(null);
    startTransition(async () => {
      const res = await revoquerPerimetre(s.userId);
      setEnCours(null);
      if (res.ok) {
        majEtat(s.userId, {
          pays: [],
          activityIds: [],
          commerciauxIds: [],
          inclureNonAttribues: false,
          droits: { ouvrirDossier: false, demanderAction: false, reaffecter: false, definirPriorite: false },
        });
      }
      setMessage(
        res.ok
          ? { userId: s.userId, ok: true, texte: "Accès retiré. Ce superviseur ne voit plus aucune donnée." }
          : { userId: s.userId, ok: false, texte: res.error },
      );
    });
  };

  return (
    <div className={styles.liste}>
      {donnees.superviseurs.map((s) => {
        const etat = etats[s.userId] ?? etatInitial(s);
        const actif = perimetreConfigure({
          portee: "superviseur",
          pays: etat.pays,
          activityIds: etat.activityIds,
          commerciauxIds: etat.commerciauxIds,
          inclureNonAttribues: etat.inclureNonAttribues,
          droits: etat.droits,
        });
        const modifie =
          !memesValeurs(etat.pays, s.pays) ||
          !memesValeurs(etat.activityIds, s.activityIds) ||
          !memesValeurs(etat.commerciauxIds, s.commerciauxIds) ||
          etat.inclureNonAttribues !== s.inclureNonAttribues ||
          DROITS_ORDONNES.some((d) => etat.droits[d] !== s.droits[d]);
        const estOuvert = ouvert === s.userId;
        const msg = message?.userId === s.userId ? message : null;
        const busy = enCours === s.userId;

        return (
          <article key={s.userId} className={styles.carte} data-actif={actif}>
            <button
              type="button"
              className={styles.entete}
              onClick={() => setOuvert(estOuvert ? null : s.userId)}
              aria-expanded={estOuvert}
            >
              <span className={styles.identite}>
                <strong>{s.nom}</strong>
                <span className={styles.email}>{s.email}</span>
              </span>
              <span className={styles.etat} data-actif={actif}>
                {actif ? "Périmètre actif" : "Aucun accès"}
              </span>
              <span className={styles.resume}>
                {actif
                  ? `${etat.pays.length} pays · ${etat.activityIds.length} activité${etat.activityIds.length > 1 ? "s" : ""} · ${etat.commerciauxIds.length} commercial${etat.commerciauxIds.length > 1 ? "aux" : ""}`
                  : "Rien ne lui est accessible"}
              </span>
              {modifie && <span className={styles.modifie}>non enregistré</span>}
              <Icon name="chevron-down" size={16} />
            </button>

            {estOuvert && (
              <div className={styles.corps}>
                {/* ── Pays ───────────────────────────────────────────── */}
                <Section
                  titre="Pays autorisés"
                  aide="Le pays du dossier doit figurer ici. Un dossier sans pays renseigné n'est visible que si les cinq pays sont cochés."
                  action={
                    <ToutRien
                      tout={() => majEtat(s.userId, { pays: [...COUNTRIES] })}
                      rien={() => majEtat(s.userId, { pays: [] })}
                      complet={COUNTRIES.every((c) => etat.pays.includes(c))}
                    />
                  }
                >
                  <div className={styles.cases}>
                    {COUNTRIES.map((c) => (
                      <Case
                        key={c}
                        label={COUNTRY_LABEL[c as Country]}
                        coche={etat.pays.includes(c)}
                        onChange={() => majEtat(s.userId, { pays: bascule(etat.pays, c) })}
                      />
                    ))}
                  </div>
                </Section>

                {/* ── Activités : deux familles, puis branches ───────── */}
                <Section
                  titre="Activités autorisées"
                  aide="Deux familles commerciales. Les activités hors de ces familles (dépannage, ENR, rénovation, TCE) sont exclues du module Superviseur et n'apparaissent pas ici."
                  action={
                    <ToutRien
                      tout={() => majEtat(s.userId, { activityIds: donnees.activites.map((a) => a.id) })}
                      rien={() => majEtat(s.userId, { activityIds: [] })}
                      complet={donnees.activites.every((a) => etat.activityIds.includes(a.id))}
                    />
                  }
                >
                  {FAMILLES.map((f) => {
                    const idsFamille = f.branches.flatMap((b) => (activitesParBranche.get(b) ?? []).map((a) => a.id));
                    const familleComplete = idsFamille.length > 0 && idsFamille.every((id) => etat.activityIds.includes(id));
                    return (
                      <div key={f.slug} className={styles.famille}>
                        <div className={styles.familleEntete}>
                          <Case
                            label={f.label}
                            fort
                            coche={familleComplete}
                            onChange={() =>
                              majEtat(s.userId, {
                                activityIds: familleComplete
                                  ? etat.activityIds.filter((id) => !idsFamille.includes(id))
                                  : [...new Set([...etat.activityIds, ...idsFamille])],
                              })
                            }
                          />
                        </div>
                        <div className={styles.branches}>
                          {f.branches.map((b) => {
                            const acts = activitesParBranche.get(b) ?? [];
                            const manque = donnees.branchesSansActivite.find((x) => x.slug === b);
                            const complete = acts.length > 0 && acts.every((a) => etat.activityIds.includes(a.id));
                            const partielle = !complete && acts.some((a) => etat.activityIds.includes(a.id));
                            if (manque) {
                              return (
                                <div key={b} className={styles.brancheAbsente}>
                                  <span className={styles.brancheNom}>{BRANCHES[b].label}</span>
                                  <span className={styles.brancheManque}>{manque.manque}</span>
                                </div>
                              );
                            }
                            return (
                              <div key={b} className={styles.branche} data-partielle={partielle}>
                                <Case
                                  label={BRANCHES[b].label}
                                  coche={complete}
                                  partielle={partielle}
                                  onChange={() =>
                                    majEtat(s.userId, {
                                      activityIds: complete
                                        ? etat.activityIds.filter((id) => !acts.some((a) => a.id === id))
                                        : [...new Set([...etat.activityIds, ...acts.map((a) => a.id)])],
                                    })
                                  }
                                />
                                {/* Une branche peut couvrir plusieurs secteurs
                                    (le nettoyage en a trois) : on les montre,
                                    pour pouvoir n'en autoriser qu'un. */}
                                {acts.length > 1 && (
                                  <div className={styles.secteurs}>
                                    {acts.map((a) => (
                                      <Case
                                        key={a.id}
                                        petit
                                        label={a.label}
                                        coche={etat.activityIds.includes(a.id)}
                                        onChange={() =>
                                          majEtat(s.userId, { activityIds: bascule(etat.activityIds, a.id) })
                                        }
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </Section>

                {/* ── Commerciaux ───────────────────────────────────── */}
                <Section
                  titre="Commerciaux supervisés"
                  aide="Seuls les dossiers appartenant à ces commerciaux seront visibles."
                  action={
                    <ToutRien
                      tout={() => majEtat(s.userId, { commerciauxIds: donnees.comptes.map((c) => c.id) })}
                      rien={() => majEtat(s.userId, { commerciauxIds: [] })}
                      complet={donnees.comptes.every((c) => etat.commerciauxIds.includes(c.id))}
                    />
                  }
                >
                  <div className={styles.comptes}>
                    {donnees.comptes.map((c) => (
                      <Case
                        key={c.id}
                        label={c.nom}
                        detail={c.roles.length ? c.roles.join(" · ") : "aucun rôle"}
                        coche={etat.commerciauxIds.includes(c.id)}
                        onChange={() => majEtat(s.userId, { commerciauxIds: bascule(etat.commerciauxIds, c.id) })}
                      />
                    ))}
                  </div>
                  <div className={styles.nonAttribues}>
                    <Case
                      label="Inclure les leads non attribués"
                      detail="Les leads sans commercial n'appartiennent à personne : aucune liste ci-dessus ne peut les couvrir. Sans cette case, ils restent invisibles à ce superviseur."
                      coche={etat.inclureNonAttribues}
                      onChange={() => majEtat(s.userId, { inclureNonAttribues: !etat.inclureNonAttribues })}
                    />
                  </div>
                </Section>

                {/* ── Droits d'intervention ─────────────────────────── */}
                <Section
                  titre="Droits d'intervention"
                  aide="Sans aucun droit, le superviseur consulte les indicateurs et les alertes de son périmètre, sans rien pouvoir y changer."
                >
                  <div className={styles.droits}>
                    {DROITS_ORDONNES.map((d) => (
                      <Case
                        key={d}
                        label={DROIT_LABEL[d]}
                        detail={DROIT_DETAIL[d]}
                        coche={etat.droits[d]}
                        onChange={() => majEtat(s.userId, { droits: { ...etat.droits, [d]: !etat.droits[d] } })}
                      />
                    ))}
                  </div>
                </Section>

                {!actif && (
                  <p className={styles.avertissement}>
                    <Icon name="alert" size={14} /> En l&apos;état, ce superviseur n&apos;aura accès à
                    aucune donnée : il faut au moins un pays, une activité, et un commercial (ou les
                    leads non attribués).
                  </p>
                )}

                {msg && (
                  <p className={msg.ok ? styles.succes : styles.erreur}>
                    <Icon name={msg.ok ? "check" : "alert"} size={14} /> {msg.texte}
                  </p>
                )}

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primaire}
                    onClick={() => enregistrer(s)}
                    disabled={busy || !modifie}
                  >
                    {busy ? "Enregistrement…" : "Enregistrer le périmètre"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaire}
                    onClick={() => majEtat(s.userId, etatInitial(s))}
                    disabled={busy || !modifie}
                  >
                    Annuler les modifications
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => revoquer(s)}
                    disabled={busy || !s.configure}
                  >
                    Retirer tout accès
                  </button>
                  {s.misAJourLe && (
                    <span className={styles.maj}>
                      Dernière modification&nbsp;:{" "}
                      {new Date(s.misAJourLe).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                    </span>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Section({
  titre,
  aide,
  action,
  children,
}: {
  titre: string;
  aide: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionEntete}>
        <h3 className={styles.sectionTitre}>{titre}</h3>
        {action}
      </div>
      <p className={styles.aide}>{aide}</p>
      {children}
    </section>
  );
}

function ToutRien({ tout, rien, complet }: { tout: () => void; rien: () => void; complet: boolean }) {
  return (
    <span className={styles.toutRien}>
      <button type="button" onClick={tout} disabled={complet}>
        Tout sélectionner
      </button>
      <button type="button" onClick={rien}>
        Tout décocher
      </button>
    </span>
  );
}

function Case({
  label,
  detail,
  coche,
  partielle,
  fort,
  petit,
  onChange,
}: {
  label: string;
  detail?: string;
  coche: boolean;
  partielle?: boolean;
  fort?: boolean;
  petit?: boolean;
  onChange: () => void;
}) {
  return (
    <label className={styles.case} data-fort={fort} data-petit={petit} data-partielle={partielle}>
      <input type="checkbox" checked={coche} onChange={onChange} />
      <span>
        <span className={styles.caseLabel}>{label}</span>
        {detail && <span className={styles.caseDetail}>{detail}</span>}
      </span>
    </label>
  );
}
