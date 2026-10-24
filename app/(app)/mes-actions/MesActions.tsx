"use client";

// « Mes actions » — une seule page, quatre espaces : bandeau de synthèse,
// liste centrale, planning, historique.
//
// Le module n'écrit que dans `commercial_tasks`. Les actions du moteur de
// relances sont lues et pilotées par les server actions qui existaient déjà.

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import {
  CATEGORIE_LABEL, ORDRE_CATEGORIES, PRIORITE_LABEL, TYPES_MANUELS,
  bornesDuJour, categorieDe, comparerItems, compteurs, estEnRetard,
  passeFiltre, passeRecherche, progression,
  type CleCompteur, type Categorie, type Item, type Priorite,
} from "@/lib/mes-actions/shared";
import { relativeFr } from "@/lib/commercial-actions/shared";
import type { ManagerData, CommercialRule, PhotoWaitingRow } from "@/lib/commercial-actions/read-server";
import {
  creerTache, terminerTache, reporterTache,
  terminerActionMoteur, reporterActionMoteur,
} from "./actions";
import { ManagerView, PhotoWaitingView } from "./VuesEquipe";
import styles from "./mes-actions.module.scss";

type Dossier = { id: string; ref: string | null; nom: string; activite: string | null };

type Props = {
  items: Item[];
  erreur: string | null;
  serverNow: number;
  dossiers: Dossier[];
  meName: string;
  isManager: boolean;
  isAdmin: boolean;
  manager: ManagerData | null;
  rules: CommercialRule[];
  photoWaiting: PhotoWaitingRow[];
  filtreInitial: string | null;
  ouvrirPhotos: boolean;
};

type Filtre = CleCompteur | "toutes";

const FILTRES: { cle: Filtre; label: string }[] = [
  { cle: "toutes", label: "Toutes" },
  { cle: "aujourdhui", label: "Aujourd'hui" },
  { cle: "en_retard", label: "En retard" },
  { cle: "urgentes", label: "Urgentes" },
  { cle: "a_venir", label: "À venir" },
  { cle: "terminees", label: "Terminées" },
];

const CARTES: { cle: CleCompteur; label: string; icone: Parameters<typeof Icon>[0]["name"]; ton: string }[] = [
  { cle: "en_retard", label: "En retard", icone: "alert", ton: "retard" },
  { cle: "urgentes", label: "Urgentes", icone: "zap", ton: "urgent" },
  { cle: "aujourdhui", label: "Aujourd'hui", icone: "checklist", ton: "jour" },
  { cle: "appels", label: "Appels à passer", icone: "phone", ton: "appel" },
  { cle: "a_venir", label: "À venir", icone: "calendar", ton: "venir" },
  { cle: "terminees", label: "Terminées", icone: "check", ton: "ok" },
];

const HEURE = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" });
const DATE_HEURE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
});

/** AAAA-MM-JJ d'un instant, en heure de Paris. */
const jourIso = (ms: number) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(ms));

export default function MesActions({
  items, erreur, serverNow, dossiers, meName,
  isManager, isAdmin, manager, rules, photoWaiting, filtreInitial, ouvrirPhotos,
}: Props) {
  // Horloge locale : les retards et les « dans 15 min » doivent avancer sans
  // recharger la page. On part de l'heure du SERVEUR pour que le premier
  // rendu soit cohérent entre le serveur et le navigateur.
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [filtre, setFiltre] = useState<Filtre>(
    FILTRES.some((f) => f.cle === filtreInitial) ? (filtreInitial as Filtre) : "toutes",
  );
  const [recherche, setRecherche] = useState("");
  const [creation, setCreation] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [surligne, setSurligne] = useState<string | null>(null);

  // Le message de confirmation s'efface seul : discret, jamais bloquant (§12).
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const nb = useMemo(() => compteurs(items, now), [items, now]);
  const prog = useMemo(() => progression(items, now), [items, now]);

  const visibles = useMemo(
    () =>
      items
        .filter((i) => passeFiltre(i, filtre, now) && passeRecherche(i, recherche))
        .sort((a, b) => comparerItems(a, b, now)),
    [items, filtre, recherche, now],
  );

  // Groupées par catégorie : chaque tâche n'apparaît qu'une fois, dans la
  // plus prioritaire qui la concerne (§6).
  const groupes = useMemo(() => {
    const m = new Map<Categorie, Item[]>();
    for (const it of visibles) {
      const c = categorieDe(it, now);
      const l = m.get(c) ?? [];
      l.push(it);
      m.set(c, l);
    }
    const ordre: Categorie[] = filtre === "terminees" ? ["terminee"] : ORDRE_CATEGORIES;
    return ordre.filter((c) => (m.get(c)?.length ?? 0) > 0).map((c) => ({ cat: c, list: m.get(c)! }));
  }, [visibles, now, filtre]);

  const actifs = useMemo(() => items.filter((i) => !i.termine), [items]);

  return (
    <div className={styles.page}>
      {/* ── En-tête : progression et création ───────────────────── */}
      <header className={styles.entete}>
        <div className={styles.titreBloc}>
          <h1 className={styles.h1}>Mes actions</h1>
          <p className={styles.sousTitre}>{meName}</p>
        </div>

        <div className={styles.progression}>
          <div className={styles.progLigne}>
            <span>Ma progression aujourd&apos;hui</span>
            <strong>
              {prog.total > 0 ? `${prog.faites} / ${prog.total}` : "—"}
              {prog.total > 0 && <span className={styles.progPct}> · {prog.pct} %</span>}
            </strong>
          </div>
          <div
            className={styles.progBarre}
            role="progressbar"
            aria-valuenow={prog.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression de la journée"
          >
            <span style={{ width: `${prog.pct}%` }} />
          </div>
        </div>

        <button type="button" className={styles.btnPrincipal} onClick={() => setCreation(true)}>
          <Icon name="plus" size={14} /> Nouvelle action
        </button>
      </header>

      {/* Chargement partiel : on le DIT, au lieu d'afficher un zéro trompeur. */}
      {erreur && (
        <p className={styles.erreur}>
          <Icon name="alert" size={14} /> {erreur} Les compteurs ci-dessous sont donc incomplets.
        </p>
      )}

      {toast && (
        <p className={styles.toast} role="status">
          <Icon name="check" size={14} /> {toast}
        </p>
      )}

      {/* ── ESPACE 1 — bandeau de synthèse ──────────────────────── */}
      <div className={styles.cartes}>
        {CARTES.map((c) => (
          <button
            key={c.cle}
            type="button"
            className={styles.carte}
            data-ton={c.ton}
            data-actif={filtre === c.cle ? "1" : undefined}
            aria-pressed={filtre === c.cle}
            onClick={() => setFiltre(filtre === c.cle ? "toutes" : c.cle)}
          >
            <Icon name={c.icone} size={15} />
            <span className={styles.carteVal}>{nb[c.cle]}</span>
            <span className={styles.carteLabel}>{c.label}</span>
          </button>
        ))}
      </div>

      {/* ── Filtres et recherche ────────────────────────────────── */}
      <div className={styles.barreFiltres}>
        <div className={styles.filtres}>
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              type="button"
              className={styles.filtre}
              data-actif={filtre === f.cle ? "1" : undefined}
              onClick={() => setFiltre(f.cle)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className={styles.recherche}>
          <Icon name="search" size={13} />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Client, type, activité, date…"
            aria-label="Rechercher une action"
          />
        </label>
      </div>

      <div className={styles.colonnes}>
        {/* ── ESPACE 2 — liste centrale ─────────────────────────── */}
        <section className={styles.liste} aria-label="Mes actions">
          {groupes.length === 0 ? (
            <div className={styles.vide}>
              <Icon name="check" size={24} />
              <p>
                {erreur
                  ? "Impossible d'afficher vos actions pour le moment."
                  : recherche.trim() || filtre !== "toutes"
                    ? "Aucune action ne correspond à ce filtre."
                    : "Vous n'avez aucune action programmée."}
              </p>
              {(recherche.trim() || filtre !== "toutes") && !erreur && (
                <button
                  type="button"
                  className={styles.btnLien}
                  onClick={() => { setFiltre("toutes"); setRecherche(""); }}
                >
                  Voir toutes mes actions
                </button>
              )}
            </div>
          ) : (
            groupes.map(({ cat, list }) => (
              <div key={cat} className={styles.groupe}>
                <h2 className={styles.groupeTitre} data-cat={cat}>
                  {CATEGORIE_LABEL[cat]}
                  <span className={styles.groupeCount}>{list.length}</span>
                </h2>
                <ul className={styles.lignes}>
                  {list.map((it) => (
                    <Ligne
                      key={`${it.source}:${it.id}`}
                      it={it}
                      now={now}
                      surligne={surligne === `${it.source}:${it.id}`}
                      onToast={setToast}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {/* ── ESPACE 3 — planning des prochaines actions ────────── */}
        <aside className={styles.planning} aria-label="Prochaines actions">
          <h2 className={styles.planningTitre}>
            <Icon name="calendar" size={13} /> Prochaines actions
          </h2>
          <Planning items={actifs} now={now} onCibler={setSurligne} />
        </aside>
      </div>

      {/* ── ESPACE 4 — historique ──────────────────────────────── */}
      <Historique items={items} now={now} />

      {/* ── Vues secondaires, inchangées ───────────────────────── */}
      {photoWaiting.length > 0 && (
        <details className={styles.repli} open={ouvrirPhotos}>
          <summary>
            <Icon name="image" size={13} /> Dossiers en attente de photos
            <span className={styles.groupeCount}>{photoWaiting.length}</span>
          </summary>
          <PhotoWaitingView rows={photoWaiting} now={now} showOwner={isManager} />
        </details>
      )}

      {isManager && manager && (
        <details className={styles.repli}>
          <summary>
            <Icon name="commerciaux" size={13} /> Pilotage de l&apos;équipe
          </summary>
          <ManagerView data={manager} now={now} isAdmin={isAdmin} rules={rules} />
        </details>
      )}

      {creation && (
        <ModaleCreation
          dossiers={dossiers}
          now={now}
          onFermer={() => setCreation(false)}
          onCree={(at) => {
            setCreation(false);
            setToast(`Nouvelle action enregistrée à ${HEURE.format(new Date(at))}`);
          }}
        />
      )}
    </div>
  );
}

// ── Une ligne de la liste ─────────────────────────────────────────────

function Ligne({
  it, now, surligne, onToast,
}: {
  it: Item; now: number; surligne: boolean; onToast: (m: string) => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [report, setReport] = useState(false);
  const retard = estEnRetard(it, now);
  const due = new Date(it.dueAt).getTime();
  const imminente = !retard && !it.termine && it.hasTime && due - now > 0 && due - now <= 30 * 60_000;

  const terminer = () => {
    demarrer(async () => {
      const r = it.source === "manuelle"
        ? await terminerTache(it.id)
        : await terminerActionMoteur(it.id);
      // Jamais de confirmation verte sur un échec.
      if (!r.ok) { onToast(`⚠️ ${r.error ?? "Action impossible."}`); return; }
      onToast(`Action terminée à ${HEURE.format(new Date(r.at ?? Date.now()))}`);
    });
  };

  return (
    <li className={styles.ligne} data-retard={retard ? "1" : undefined} data-cible={surligne ? "1" : undefined}>
      <div className={styles.ligneHaut}>
        <span className={styles.pastille} data-prio={it.priorite} data-retard={retard ? "1" : undefined} aria-hidden />
        <time className={styles.heure} dateTime={it.dueAt} title={DATE_HEURE.format(new Date(it.dueAt))}>
          {it.hasTime ? HEURE.format(new Date(it.dueAt)) : JOUR_COURT.format(new Date(it.dueAt))}
        </time>
        <span className={styles.titre}>{it.title}</span>
        {it.priorite === "urgente" && <span className={styles.badge} data-prio="urgente">Urgent</span>}
        {it.priorite === "importante" && <span className={styles.badge} data-prio="importante">Important</span>}
        {it.reportCount > 0 && (
          <span className={styles.badge} data-prio="report" title={`Reportée ${it.reportCount} fois`}>
            ↻ {it.reportCount}
          </span>
        )}
      </div>

      <div className={styles.ligneMeta}>
        {it.clientName ?? "Sans client"}
        {it.activite && <> · {it.activite}</>}
        {it.leadRef && <> · {it.leadRef}</>}
        <> · {it.typeLabel}</>
        {!it.hasTime && <> · dans la journée</>}
      </div>

      {it.description && <p className={styles.ligneDesc}>{it.description}</p>}

      {/* Notifications discrètes, jamais une fenêtre (§12). */}
      {retard && (
        <p className={styles.alerte} data-ton="retard">
          ⚠️ En retard — échéance {relativeFr(it.dueAt, now)}
        </p>
      )}
      {imminente && (
        <p className={styles.alerte} data-ton="imminent">
          ⏰ Prévue {relativeFr(it.dueAt, now)}
        </p>
      )}

      {!it.termine && (
        <div className={styles.boutons}>
          {it.phone && (
            // Lancer l'appel ne termine PAS la tâche : la validation dépend
            // du résultat réel de l'échange (§7).
            <a className={styles.btn} href={`tel:${it.phone}`} data-ton="appel">
              <Icon name="phone" size={12} /> Appeler
            </a>
          )}
          <button type="button" className={styles.btn} data-ton="ok" disabled={enCours} onClick={terminer}>
            <Icon name="check" size={12} /> {enCours ? "…" : "Terminer"}
          </button>
          <button type="button" className={styles.btn} disabled={enCours} onClick={() => setReport(true)}>
            <Icon name="calendar" size={12} /> Reporter
          </button>
          {it.leadId && (
            <Link className={styles.btn} href={`/leads/${it.leadId}`}>
              <Icon name="folder" size={12} /> Dossier
            </Link>
          )}
        </div>
      )}

      {it.termine && it.closedAt && (
        <p className={styles.alerte} data-ton="ok">
          ✓ Terminée à {HEURE.format(new Date(it.closedAt))}
        </p>
      )}

      {report && (
        <ModaleReport
          it={it}
          now={now}
          onFermer={() => setReport(false)}
          onReporte={(at) => {
            setReport(false);
            onToast(`Action reportée au ${DATE_HEURE.format(new Date(at))}`);
          }}
          onEchec={(m) => { setReport(false); onToast(`⚠️ ${m}`); }}
        />
      )}
    </li>
  );
}

// ── ESPACE 3 — planning ───────────────────────────────────────────────

function Planning({ items, now, onCibler }: { items: Item[]; now: number; onCibler: (c: string | null) => void }) {
  const groupes = useMemo(() => {
    const { fin } = bornesDuJour(now);
    const finDemain = fin + 86_400_000;
    const aujourdhui: Item[] = [], demain: Item[] = [], suite: Item[] = [];
    for (const it of items) {
      const d = new Date(it.dueAt).getTime();
      if (!Number.isFinite(d)) continue;
      if (d <= fin) aujourdhui.push(it);
      else if (d <= finDemain) demain.push(it);
      else suite.push(it);
    }
    const tri = (l: Item[]) => l.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    return [
      { titre: "Aujourd'hui", list: tri(aujourdhui) },
      { titre: "Demain", list: tri(demain) },
      { titre: "Prochains jours", list: tri(suite).slice(0, 8) },
    ].filter((g) => g.list.length > 0);
  }, [items, now]);

  if (groupes.length === 0) {
    return <p className={styles.planningVide}>Aucune action programmée.</p>;
  }

  return (
    <div className={styles.planningCorps}>
      {groupes.map((g) => (
        <div key={g.titre} className={styles.planningGroupe}>
          <h3 className={styles.planningJour}>{g.titre}</h3>
          <ul>
            {g.list.map((it) => (
              <li key={`${it.source}:${it.id}`}>
                <button
                  type="button"
                  className={styles.planningItem}
                  onClick={() => onCibler(`${it.source}:${it.id}`)}
                  title="Mettre en évidence dans la liste"
                >
                  <span className={styles.planningHeure}>
                    {it.hasTime ? HEURE.format(new Date(it.dueAt)) : JOUR_COURT.format(new Date(it.dueAt))}
                  </span>
                  <span className={styles.planningTexte}>
                    {it.clientName ?? it.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── ESPACE 4 — historique ─────────────────────────────────────────────

const PERIODES = [
  { cle: "aujourdhui", label: "Aujourd'hui" },
  { cle: "hier", label: "Hier" },
  { cle: "7j", label: "7 derniers jours" },
  { cle: "perso", label: "Date précise" },
] as const;
type Periode = (typeof PERIODES)[number]["cle"];

function Historique({ items, now }: { items: Item[]; now: number }) {
  const [periode, setPeriode] = useState<Periode>("aujourdhui");
  const [jour, setJour] = useState(() => jourIso(now));

  const lignes = useMemo(() => {
    const { debut, fin } = bornesDuJour(now);
    let a = debut, b = fin;
    if (periode === "hier") { a = debut - 86_400_000; b = fin - 86_400_000; }
    else if (periode === "7j") { a = debut - 6 * 86_400_000; b = fin; }
    else if (periode === "perso") {
      const ms = new Date(`${jour}T12:00:00Z`).getTime();
      if (!Number.isFinite(ms)) return [];
      ({ debut: a, fin: b } = bornesDuJour(ms));
    }
    return items
      .filter((i) => {
        if (!i.termine || !i.closedAt) return false;
        const c = new Date(i.closedAt).getTime();
        return Number.isFinite(c) && c >= a && c <= b;
      })
      // De la plus récente à la plus ancienne.
      .sort((x, y) => new Date(y.closedAt!).getTime() - new Date(x.closedAt!).getTime());
  }, [items, now, periode, jour]);

  return (
    <section className={styles.historique} aria-label="Historique des actions">
      <div className={styles.histHaut}>
        <h2 className={styles.histTitre}>
          <Icon name="check" size={13} /> Historique
          <span className={styles.groupeCount}>{lignes.length}</span>
        </h2>
        <div className={styles.filtres}>
          {PERIODES.map((p) => (
            <button
              key={p.cle}
              type="button"
              className={styles.filtre}
              data-actif={periode === p.cle ? "1" : undefined}
              onClick={() => setPeriode(p.cle)}
            >
              {p.label}
            </button>
          ))}
          {periode === "perso" && (
            <input
              type="date"
              className={styles.champDate}
              value={jour}
              onChange={(e) => setJour(e.target.value)}
              aria-label="Jour de l'historique"
            />
          )}
        </div>
      </div>

      {lignes.length === 0 ? (
        <p className={styles.planningVide}>Aucune action terminée sur cette période.</p>
      ) : (
        <ul className={styles.histListe}>
          {lignes.map((it) => (
            <li key={`${it.source}:${it.id}`}>
              <span className={styles.histHeure}>{HEURE.format(new Date(it.closedAt!))}</span>
              <span className={styles.histTexte}>
                <strong>{it.title}</strong>
                {" — "}
                {it.clientName ?? "sans client"}
                {it.activite && <> · {it.activite}</>}
              </span>
              {it.leadId && (
                <Link href={`/leads/${it.leadId}`} className={styles.histLien}>
                  Dossier
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Modale : nouvelle action ──────────────────────────────────────────

function ModaleCreation({
  dossiers, now, onFermer, onCree,
}: {
  dossiers: Dossier[]; now: number; onFermer: () => void; onCree: (at: string) => void;
}) {
  const [type, setType] = useState<string>(TYPES_MANUELS[0].value);
  const [titre, setTitre] = useState("");
  const [desc, setDesc] = useState("");
  const [leadId, setLeadId] = useState("");
  const [date, setDate] = useState(() => jourIso(now));
  const [heure, setHeure] = useState("");
  const [priorite, setPriorite] = useState<Priorite>("normale");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const envoyer = () => {
    setErreur(null);
    demarrer(async () => {
      const r = await creerTache({
        type, title: titre, description: desc, leadId: leadId || null, date,
        heure: heure || null, priorite,
      });
      if (!r.ok) { setErreur(r.error ?? "Enregistrement impossible."); return; }
      onCree(r.at ?? new Date().toISOString());
    });
  };

  return (
    <div className={styles.fond} role="dialog" aria-modal="true" aria-label="Nouvelle action" onClick={onFermer}>
      <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
        <header className={styles.modaleHaut}>
          <h2>Nouvelle action</h2>
          <button type="button" onClick={onFermer} aria-label="Fermer"><Icon name="x" size={16} /></button>
        </header>

        <div className={styles.modaleCorps}>
          <label className={styles.champ}>
            <span>Type d&apos;action</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES_MANUELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>

          <label className={styles.champ}>
            <span>Intitulé</span>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Rappeler Monsieur Martin"
              autoFocus
            />
          </label>

          <label className={styles.champ}>
            <span>Client ou prospect — facultatif</span>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              <option value="">Aucun dossier</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}{d.ref ? ` · ${d.ref}` : ""}{d.activite ? ` · ${d.activite}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.champ}>
            <span>Description — facultative</span>
            <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>

          <div className={styles.champGrille}>
            <label className={styles.champ}>
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className={styles.champ}>
              <span>Heure — facultative</span>
              <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
            </label>
          </div>

          <div className={styles.champ}>
            <span>Priorité</span>
            <div className={styles.filtres}>
              {(["normale", "importante", "urgente"] as Priorite[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={styles.filtre}
                  data-actif={priorite === p ? "1" : undefined}
                  onClick={() => setPriorite(p)}
                >
                  {PRIORITE_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          {erreur && <p className={styles.erreur}><Icon name="alert" size={13} /> {erreur}</p>}
        </div>

        <footer className={styles.modaleBas}>
          <button type="button" className={styles.btn} onClick={onFermer}>Annuler</button>
          <button
            type="button"
            className={styles.btnPrincipal}
            disabled={enCours || !titre.trim()}
            onClick={envoyer}
          >
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ── Modale : reporter ─────────────────────────────────────────────────

function ModaleReport({
  it, now, onFermer, onReporte, onEchec,
}: {
  it: Item; now: number;
  onFermer: () => void; onReporte: (at: string) => void; onEchec: (m: string) => void;
}) {
  const [date, setDate] = useState(() => jourIso(now + 86_400_000));
  const [heure, setHeure] = useState(it.hasTime ? HEURE.format(new Date(it.dueAt)).replace("h", ":") : "");
  const [enCours, demarrer] = useTransition();

  const envoyer = () => {
    demarrer(async () => {
      const r = it.source === "manuelle"
        ? await reporterTache(it.id, date, heure || null)
        : await reporterActionMoteur(it.id, date, heure || null);
      if (!r.ok) { onEchec(r.error ?? "Report impossible."); return; }
      onReporte(r.at ?? new Date().toISOString());
    });
  };

  return (
    <div className={styles.fond} role="dialog" aria-modal="true" aria-label="Reporter l'action" onClick={onFermer}>
      <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
        <header className={styles.modaleHaut}>
          <h2>Reporter</h2>
          <button type="button" onClick={onFermer} aria-label="Fermer"><Icon name="x" size={16} /></button>
        </header>
        <div className={styles.modaleCorps}>
          <p className={styles.ligneMeta}>
            {it.title} — échéance actuelle : {DATE_HEURE.format(new Date(it.dueAt))}
          </p>
          <div className={styles.champGrille}>
            <label className={styles.champ}>
              <span>Nouvelle date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className={styles.champ}>
              <span>Heure — facultative</span>
              <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
            </label>
          </div>
          <div className={styles.filtres}>
            {[
              { label: "Demain", j: 1 },
              { label: "Dans 2 jours", j: 2 },
              { label: "Dans une semaine", j: 7 },
            ].map((r) => (
              <button
                key={r.label}
                type="button"
                className={styles.filtre}
                onClick={() => setDate(jourIso(now + r.j * 86_400_000))}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <footer className={styles.modaleBas}>
          <button type="button" className={styles.btn} onClick={onFermer}>Annuler</button>
          <button type="button" className={styles.btnPrincipal} disabled={enCours} onClick={envoyer}>
            {enCours ? "Report…" : "Reporter"}
          </button>
        </footer>
      </div>
    </div>
  );
}
