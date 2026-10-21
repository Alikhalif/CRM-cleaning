"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { startCall } from "@/lib/ringover-webphone";
import type { SuiviData } from "@/lib/suivi-server";
import {
  ALERT_LABEL,
  ETAPES,
  SITUATION_TONE,
  QUICK_FILTERS,
  QUICK_LABEL,
  CATEGORIES,
  CATEGORIE_AIDE,
  CATEGORIE_LABEL,
  CATEGORIE_TONE,
  PERIODE_PRESETS,
  PERIODE_PRESET_LABEL,
  ROW_ACTION_LABEL,
  SITUATION_LABEL,
  TYPE_DATE_LABEL,
  TAB_LABEL,
  TABS,
  bornesPeriode,
  categorieDe,
  comparePriority,
  dansPeriode,
  dueLabel,
  libellePeriode,
  isRelancable,
  matchesQuick,
  matchesTab,
  momentComplet,
  momentCourt,
  rowActionFor,
  type PeriodePreset,
  type QuickFilter,
  type Situation,
  type TypeDate,
  type SuiviRow,
  type Tab,
} from "@/lib/suivi-shared";
import styles from "./SuiviCommercial.module.scss";

// « Suivi commercial » — remplace l'ancien tableau « Leads & devis ».
//
// Principe : un dossier = une situation claire + une prochaine action. Les
// échéances et les relances viennent du moteur d'actions commerciales (lib/
// commercial-actions), pas d'ici : cette vue LIT, elle ne crée aucune tâche.
// « Ma journée » et le Pipeline restent inchangés et indépendants.

const euro = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

type Props = SuiviData;

export default function SuiviCommercial({
  rows, now, sectors, isBackOffice, meName, canUseRingover, commerciaux,
}: Props) {
  const [tab, setTab] = useState<Tab>("tous");
  const [quick, setQuick] = useState<QuickFilter | null>(null);
  const [priorites, setPriorites] = useState(false);
  const [search, setSearch] = useState("");
  const [advOpen, setAdvOpen] = useState(false);
  const [fSector, setFSector] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fSituation, setFSituation] = useState("");
  const [fMin, setFMin] = useState("");
  const [fOrigin, setFOrigin] = useState("");
  const [fSociete, setFSociete] = useState("");
  const [fNrp, setFNrp] = useState(false);
  // ── Filtre calendrier ─────────────────────────────────────────────
  const [periode, setPeriode] = useState<PeriodePreset>("tout");
  const [typeDate, setTypeDate] = useState<TypeDate>("creation");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [calOuvert, setCalOuvert] = useState(false);

  // `now` vient du serveur : calculer les bornes avec Date.now() pendant le
  // rendu violerait la pureté de React et ferait diverger serveur et client.
  const bornes = useMemo(
    () => bornesPeriode(periode, now, dateDebut || undefined, dateFin || undefined),
    [periode, now, dateDebut, dateFin],
  );

  // ── Compteurs : calculés sur les MÊMES lignes que le tableau, donc jamais
  // en désaccord avec lui. Ils respectent les droits par construction : `rows`
  // est déjà filtré côté serveur (propriétaire + activités autorisées).
  const kpi = useMemo(() => {
    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);
    return {
      nouveaux: rows.filter((r) => r.situation === "nouveau").length,
      decouvertes: rows.filter((r) => r.situation === "decouverte_encours").length,
      aPreparer: rows.filter((r) => r.situation === "decouverte_faite").length,
      aRelancer: rows.filter((r) => isRelancable(r)).length,
      signes: rows.filter(
        (r) => r.situation === "signe" && new Date(r.receivedAt).getTime() >= debutMois.getTime(),
      ).length,
      retard: rows.filter((r) => r.overdue).length,
    };
  }, [rows]);

  const societes = useMemo(
    () => [...new Set(rows.map((r) => r.societe).filter((x): x is string => !!x))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = fMin.trim() ? Number(fMin) : null;
    let out = rows.filter((r) => {
      if (!priorites && !matchesTab(r, tab)) return false;
      if (priorites && (r.situation === "signe" || r.situation === "perdu")) return false;
      if (quick && !matchesQuick(r, quick, now)) return false;
      if (fSector && r.sector !== fSector) return false;
      if (fOwner && r.ownerId !== fOwner) return false;
      if (fSituation && r.situation !== fSituation) return false;
      if (min != null && !Number.isNaN(min) && (r.amount ?? 0) < min) return false;
      if (fOrigin && r.origin !== fOrigin) return false;
      if (fSociete && r.societe !== fSociete) return false;
      if (fNrp && !r.isNrp) return false;
      if (!dansPeriode(r, bornes, typeDate)) return false;
      if (q) {
        const hay = `${r.client} ${r.shortId} ${r.phone} ${r.sectorLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = priorites
      ? [...out].sort(comparePriority)
      : [...out].sort((a, b) => {
          // Hors « Mes priorités » : les retards d'abord, puis l'échéance la
          // plus proche, puis le dossier le plus récent.
          if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
          const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
          const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
          if (da !== db) return da - db;
          return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
        });
    return out;
  }, [rows, tab, quick, priorites, search, fSector, fOwner, fSituation, fMin, fOrigin, fSociete, fNrp, bornes, typeDate, now]);

  // Classement par ÉTAPE commerciale : le commercial lit son travail par
  // moment du cycle, pas par colonne de tableau. L'ordre interne de chaque
  // étape reste celui calculé plus haut (retards d'abord, puis échéance).
  // Deux niveaux : la catégorie que le commercial lit en premier, et l'étape
  // précise en dessous. L'ordre interne de chaque étape reste celui calculé
  // plus haut — retards d'abord, puis échéance.
  const parCategorie = useMemo(() => {
    const map = new Map<Situation, SuiviRow[]>();
    for (const r of filtered) {
      const list = map.get(r.situation) ?? [];
      list.push(r);
      map.set(r.situation, list);
    }
    return CATEGORIES.map((cat) => {
      const etapes = ETAPES
        .filter((e) => categorieDe(e) === cat && (map.get(e)?.length ?? 0) > 0)
        .map((e) => ({ etape: e, list: map.get(e)! }));
      const total = etapes.reduce((n, x) => n + x.list.length, 0);
      return { cat, etapes, total };
    }).filter((c) => c.total > 0);
  }, [filtered]);

  const onCard = (t: Tab, q: QuickFilter | null, situation?: string) => {
    setPriorites(false);
    setTab(t);
    setQuick(q);
    setFSituation(situation ?? "");
  };

  const reset = () => {
    setTab("tous"); setQuick(null); setPriorites(false); setSearch("");
    setFSector(""); setFOwner(""); setFSituation(""); setFMin(""); setFOrigin("");
    setFSociete(""); setFNrp(false);
    setPeriode("tout"); setDateDebut(""); setDateFin(""); setTypeDate("creation");
  };

  const exportCsv = () => {
    // « Reçu le » est ajouté EN FIN de ligne : les colonnes existantes gardent
    // leur position dans les tableurs déjà construits sur cet export.
    const head = ["Dossier", "Client", "Activité", "Montant", "Situation", "Prochaine action", "Échéance", "Commercial", "Reçu le"];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(";")];
    for (const r of filtered) {
      lines.push([
        r.shortId, r.client, r.sectorLabel,
        r.amount != null ? String(r.amount) : "",
        SITUATION_LABEL[r.situation], r.nextAction, dueLabel(r, now),
        r.ownerName ?? "", momentComplet(r.receivedAt),
      ].map((v) => esc(String(v))).join(";"));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suivi-commercial-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cards: { key: string; label: string; sub: string; value: number; tone?: string; go: () => void }[] = [
    { key: "nouveaux", label: "Nouveaux leads", sub: "À contacter", value: kpi.nouveaux, go: () => onCard("nouveaux", null, "nouveau") },
    { key: "decouvertes", label: "Découvertes", sub: "À compléter", value: kpi.decouvertes, go: () => onCard("nouveaux", null, "decouverte_encours") },
    { key: "preparer", label: "Devis à préparer", sub: "À envoyer", value: kpi.aPreparer, go: () => onCard("devis", null, "decouverte_faite") },
    { key: "relancer", label: "Devis à relancer", sub: "À relancer", value: kpi.aRelancer, tone: "relance", go: () => onCard("relances", null) },
    { key: "signes", label: "Devis signés", sub: "Ce mois-ci", value: kpi.signes, tone: "ok", go: () => onCard("signes", null) },
    { key: "retard", label: "Actions en retard", sub: "Prioritaires", value: kpi.retard, tone: "retard", go: () => onCard("tous", "retard") },
  ];

  return (
    <div className={styles.wrap}>
      {/* ── 1. Indicateurs ─────────────────────────────────────────── */}
      <div className={styles.cards}>
        {cards.map((c) => (
          <button key={c.key} type="button" className={styles.card} data-tone={c.tone} onClick={c.go}>
            <span className={styles.cardLabel}>{c.label}</span>
            <span className={styles.cardValue}>{c.value}</span>
            <span className={styles.cardSub}>{c.sub}</span>
          </button>
        ))}
      </div>

      {/* ── 2. Navigation + priorités + recherche ──────────────────── */}
      <div className={styles.navRow}>
        <nav className={styles.tabs} aria-label="Catégories de dossiers">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.tab} ${!priorites && tab === t ? styles.tabActive : ""}`}
              onClick={() => { setPriorites(false); setTab(t); }}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className={`${styles.prio} ${priorites ? styles.prioOn : ""}`}
          onClick={() => setPriorites((v) => !v)}
          title="Les dossiers à traiter, dans l'ordre"
        >
          <Icon name="zap" size={14} /> Mes priorités
        </button>
      </div>

      <div className={styles.filterRow}>
        <div className={styles.searchBox}>
          <Icon name="search" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, dossier, téléphone…"
            aria-label="Rechercher un dossier"
          />
        </div>
        {QUICK_FILTERS.map((q) => (
          <button
            key={q}
            type="button"
            className={`${styles.chip} ${quick === q ? styles.chipOn : ""}`}
            onClick={() => setQuick((v) => (v === q ? null : q))}
          >
            {QUICK_LABEL[q]}
          </button>
        ))}
        {/* ── Période ────────────────────────────────────────────── */}
        <div className={styles.calWrap}>
          <button
            type="button"
            className={`${styles.chip} ${bornes ? styles.chipOn : ""}`}
            onClick={() => setCalOuvert((v) => !v)}
            aria-expanded={calOuvert}
            title="Filtrer par période"
          >
            <Icon name="calendar" size={13} />{" "}
            {bornes ? libellePeriode(bornes) : "Période"} {calOuvert ? "▴" : "▾"}
          </button>

          {calOuvert && (
            <div className={styles.calPanel}>
              <div className={styles.calSection}>
                <span className={styles.calLabel}>Filtrer sur</span>
                <div className={styles.chips}>
                  {(Object.keys(TYPE_DATE_LABEL) as TypeDate[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.chip} ${typeDate === t ? styles.chipOn : ""}`}
                      onClick={() => setTypeDate(t)}
                    >
                      {TYPE_DATE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.calSection}>
                <span className={styles.calLabel}>Période</span>
                <div className={styles.chips}>
                  {PERIODE_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`${styles.chip} ${periode === p ? styles.chipOn : ""}`}
                      onClick={() => setPeriode(p)}
                    >
                      {PERIODE_PRESET_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>

              {periode === "perso" && (
                <div className={styles.calSection}>
                  <span className={styles.calLabel}>Du / au</span>
                  <div className={styles.calDates}>
                    <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} aria-label="Date de début" />
                    <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} aria-label="Date de fin" />
                  </div>
                </div>
              )}

              <div className={styles.calPied}>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => { setPeriode("tout"); setDateDebut(""); setDateFin(""); }}
                >
                  Effacer la période
                </button>
                <button type="button" className={styles.chip} onClick={() => setCalOuvert(false)}>
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>

        <button type="button" className={styles.chip} onClick={() => setAdvOpen((v) => !v)}>
          Filtres avancés {advOpen ? "▴" : "▾"}
        </button>
        <button type="button" className={styles.linkBtn} onClick={reset}>Réinitialiser</button>
        <button type="button" className={styles.linkBtn} onClick={exportCsv} style={{ marginLeft: "auto" }}>
          <Icon name="document" size={13} /> Exporter
        </button>
      </div>

      {advOpen && (
        <div className={styles.advanced}>
          {sectors.length > 1 && (
            <label>
              <span>Activité</span>
              <select value={fSector} onChange={(e) => setFSector(e.target.value)}>
                <option value="">Toutes mes activités</option>
                {sectors.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
              </select>
            </label>
          )}
          <label>
            <span>Situation</span>
            <select value={fSituation} onChange={(e) => setFSituation(e.target.value)}>
              <option value="">Toutes</option>
              {Object.entries(SITUATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>
            <span>Montant minimum</span>
            <input type="number" min={0} value={fMin} onChange={(e) => setFMin(e.target.value)} placeholder="€" />
          </label>
          {/* Commercial et Origine : back-office uniquement. L'origine est une
              donnée de PROVENANCE, jamais exposée à un commercial. */}
          {isBackOffice && commerciaux.length > 0 && (
            <label>
              <span>Commercial</span>
              <select value={fOwner} onChange={(e) => setFOwner(e.target.value)}>
                <option value="">Tous</option>
                {commerciaux.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          {societes.length > 1 && (
            <label>
              <span>Société</span>
              <select value={fSociete} onChange={(e) => setFSociete(e.target.value)}>
                <option value="">Toutes</option>
                {societes.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          )}
          <label className={styles.check}>
            <span>Injoignables</span>
            <button type="button" className={`${styles.chip} ${fNrp ? styles.chipOn : ""}`} onClick={() => setFNrp((v) => !v)}>
              NRP uniquement
            </button>
          </label>
          {isBackOffice && (
            <label>
              <span>Origine</span>
              <select value={fOrigin} onChange={(e) => setFOrigin(e.target.value)}>
                <option value="">Toutes</option>
                <option value="form">Formulaire</option>
                <option value="phone">Téléphone</option>
              </select>
            </label>
          )}
        </div>
      )}

      {/* ── 4. Dossiers : trois catégories, étapes en sous-niveau ──── */}
      {parCategorie.length === 0 ? (
        <p className={styles.empty}>Aucun dossier ne correspond. {meName && <>Vue de {meName}.</>}</p>
      ) : (
        parCategorie.map(({ cat, etapes, total }) => (
          <section key={cat} className={styles.categorie} data-tone={CATEGORIE_TONE[cat]}>
            <header className={styles.categorieHead}>
              <h2 className={styles.categorieTitre}>
                {CATEGORIE_LABEL[cat]}
                <span className={styles.categorieCount}>{total}</span>
              </h2>
              <span className={styles.categorieAide}>{CATEGORIE_AIDE[cat]}</span>
            </header>

            {etapes.map(({ etape, list }) => (
              <section key={etape} className={styles.etape}>
                <h3 className={styles.etapeHead} data-tone={SITUATION_TONE[etape]}>
                  {SITUATION_LABEL[etape]}
                  <span className={styles.etapeCount}>{list.length}</span>
                </h3>
                <ul className={styles.dossiers}>
                  {list.map((r) => (
                    <DossierCard key={r.leadId} row={r} isBackOffice={isBackOffice} canCall={canUseRingover} now={now} />
                  ))}
                </ul>
              </section>
            ))}
          </section>
        ))
      )}

      <p className={styles.count}>
        {filtered.length} dossier{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
        {priorites && " · classés par priorité"}
      </p>
    </div>
  );
}

function DossierCard({ row, isBackOffice, canCall, now }: { row: SuiviRow; isBackOffice: boolean; canCall: boolean; now: number }) {
  const kind = rowActionFor(row.situation);
  const href =
    kind === "devis"
      ? row.sector === "demenagement" || row.sector === "nettoyage"
        ? `/devis/nouveau?affaire=${row.leadId}`
        : `/devis/new?lead=${row.leadId}`
      : `/leads/${row.leadId}`;

  // « Appeler » passe par le webphone déjà monté dans le layout. Sans capacité
  // Ringover ou sans numéro, le bouton ouvre simplement le dossier.
  const callable = kind === "appeler" && canCall && !!row.phone;

  return (
    <li className={styles.dossier} data-tone={SITUATION_TONE[row.situation]} data-overdue={row.overdue ? "1" : undefined}>
      <div className={styles.dossierTop}>
        <Link href={`/leads/${row.leadId}`} className={styles.client}>{row.client}</Link>
        <span className={styles.origin} title={row.origin === "phone" ? "Appel entrant" : "Formulaire"}>
          {row.origin === "phone" ? "📞" : "📋"}
        </span>
        {row.alert && <span className={styles.badge} data-kind={row.alert}>{ALERT_LABEL[row.alert]}</span>}
        {/* Heure d'arrivée du dossier. Sur un nouveau lead, c'est le chrono de
            la prise en charge : le commercial doit le lire sans ouvrir la fiche. */}
        <time
          className={styles.recu}
          dateTime={row.receivedAt}
          title={`Reçu le ${momentComplet(row.receivedAt)}`}
        >
          {momentCourt(row.receivedAt, now)}
        </time>
      </div>

      <div className={styles.dossierMeta}>
        {row.sectorLabel} · {row.shortId}
        {row.amount != null && <> · {euro(row.amount)}{row.amountIsEstimate && " est."}</>}
        {isBackOffice && row.ownerName && <> · {row.ownerName}</>}
      </div>

      {row.lastActionLabel && (
        <div className={styles.lastAction} title={momentComplet(row.lastActionAt)}>
          Dernière action : {row.lastActionLabel} · {momentCourt(row.lastActionAt, now)}
        </div>
      )}

      <div className={styles.dossierNext}>
        <span className={styles.nextLabel}>{row.nextAction}</span>
        <span className={styles.due} data-due={row.overdue ? "retard" : undefined}>{dueLabel(row, now)}</span>
      </div>

      <div className={styles.actions}>
        {callable ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => startCall({ phone: row.phone, name: row.client, sublabel: row.sectorLabel })}
          >
            <Icon name="phone" size={13} /> {ROW_ACTION_LABEL.appeler}
          </button>
        ) : (
          <Link href={href} className={styles.action}>
            {ROW_ACTION_LABEL[kind === "appeler" ? "ouvrir" : kind]}
          </Link>
        )}
        {/* Étape 1 : le cahier des charges demande DEUX boutons — appeler, puis
            entrer dans la découverte. Les deux mènent à des gestes différents. */}
        {row.situation === "nouveau" && (
          <Link href={`/leads/${row.leadId}#decouverte`} className={styles.actionGhost}>
            Commencer la découverte
          </Link>
        )}
      </div>
    </li>
  );
}
