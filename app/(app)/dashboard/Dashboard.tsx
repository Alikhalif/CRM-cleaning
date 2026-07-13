"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon/Icon";
import NewLeadModal from "@/app/(app)/pipeline/NewLeadModal";
import {
  SECTOR_LABEL,
  SECTOR_VAR,
  formatKEUR,
  type Commercial,
  type Sector,
} from "@/lib/leads";
import {
  aggregateByDay,
  caBySector,
  channelStats,
  computeKpis,
  filterPrevious,
  filterSeries,
  funnel,
  pctDelta,
  performanceScore,
  periodWindow,
  topCommerciaux,
  type Channel,
  type DailyMetric,
  type DashboardFilter,
  type Period,
} from "@/lib/dashboard";
import type { ImmobAnnotation } from "@/lib/dashboard-server";
import { Donut, EvolutionChart } from "./Charts";
import styles from "./Dashboard.module.scss";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d",  label: "7 derniers jours"  },
  { value: "30d", label: "30 derniers jours" },
  { value: "90d", label: "90 derniers jours" },
  { value: "mtd", label: "Ce mois-ci" },
  { value: "qtd", label: "Ce trimestre" },
  { value: "ytd", label: "Cette année" },
  { value: "12m", label: "12 derniers mois" },
];

const SECTORS: Sector[] = ["urgence", "nettoyage", "enr", "renovation", "debarras"];
const CHANNELS: Channel[] = ["mano", "auto"];

type Props = {
  series: DailyMetric[];
  commerciaux: Commercial[];
  annotations: ImmobAnnotation[];
  firstName: string;
  currentUserId: string;
  isAdmin: boolean;
};

export default function Dashboard({
  series: dailySeries,
  commerciaux,
  annotations,
  firstName,
  currentUserId,
  isAdmin,
}: Props) {
  const [filter, setFilter] = useState<DashboardFilter>({
    period: "30d",
    sector: "all",
    channel: "all",
  });
  const [newLeadOpen, setNewLeadOpen] = useState(false);

  const filtered = useMemo(() => filterSeries(dailySeries, filter), [dailySeries, filter]);
  const previous = useMemo(() => filterPrevious(dailySeries, filter), [dailySeries, filter]);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const kpisPrev = useMemo(() => computeKpis(previous), [previous]);
  const daily = useMemo(() => aggregateByDay(filtered), [filtered]);
  const stages = useMemo(() => funnel(filtered), [filtered]);
  const sectors = useMemo(() => caBySector(filtered), [filtered]);
  const channels = useMemo(() => channelStats(filtered), [filtered]);
  const top = useMemo(
    () => topCommerciaux(filtered, previous, commerciaux),
    [filtered, previous, commerciaux],
  );

  const score = performanceScore(kpis.caSigned, kpisPrev.caSigned);
  const w = useMemo(() => periodWindow(filter.period), [filter.period]);
  const wPrev = useMemo(() => {
    const start = new Date(`${w.startIso}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 1);
    const prevEnd = start.toISOString().slice(0, 10);
    const prevStart = new Date(start);
    prevStart.setUTCDate(start.getUTCDate() - (w.lengthDays - 1));
    return { startIso: prevStart.toISOString().slice(0, 10), endIso: prevEnd };
  }, [w]);

  return (
    <div className={styles.page}>
      {/* ── Greeting header ──────────────────────────────────────── */}
      <header className={styles.greetHeader}>
        <div>
          <div className={styles.realtime}>
            <span className={styles.realtimeDot} aria-hidden="true" />
            Données en temps réel <span className={styles.realtimeMuted}>· Mis à jour à l&apos;instant</span>
          </div>
          <h1 className={styles.greetTitle}>
            Bonjour {firstName || "—"} <span aria-hidden="true">👋</span>
          </h1>
          <p className={styles.greetRange}>
            {formatRange(w.startIso, w.endIso)}
            <span className={styles.muted}> comparé à {formatShortRange(wPrev.startIso, wPrev.endIso)}</span>
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => exportCsv({ kpis, daily, top, channels, w, filter })}
            title="Télécharger le rapport au format CSV"
          >
            <Icon name="document" size={14} /> Exporter
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setNewLeadOpen(true)}
          >
            <Icon name="plus" size={14} /> Nouveau lead
          </button>
        </div>
      </header>

      {newLeadOpen && (
        <NewLeadModal
          commerciaux={commerciaux}
          defaultOwnerId={currentUserId}
          onClose={() => setNewLeadOpen(false)}
        />
      )}

      {/* ── Filter bar ───────────────────────────────────────────── */}
      <FilterBar filter={filter} setFilter={setFilter} />

      {/* ── Section 1 · Acquisition de leads ─────────────────────── */}
      <Section
        kicker="Acquisition de leads"
        subtitle="Répartition par canal d'origine"
      >
        <div className={styles.acquisition}>
          <AcqCard
            accent="brand"
            iconName="leads"
            label="Leads — Total"
            sub="Toutes sources confondues"
            value={kpis.leads}
            delta={pctDelta(kpis.leads, kpisPrev.leads)}
            footer={
              <>
                <span className={styles.acqFootChip}><Icon name="phone" size={11} /> {kpis.leadsPhone}</span>
                <span className={styles.acqFootChip}><Icon name="document" size={11} /> {kpis.leadsForm}</span>
              </>
            }
          />
          <AcqCard
            accent="warning"
            iconName="phone"
            label="Leads téléphone"
            sub="Appels entrants"
            value={kpis.leadsPhone}
            delta={pctDelta(kpis.leadsPhone, kpisPrev.leadsPhone)}
            footer={
              <span className={styles.acqFootText}>
                <strong>{pctOf(kpis.leadsPhone, kpis.leads)}%</strong> du total
              </span>
            }
          />
          <AcqCard
            accent="info"
            iconName="document"
            label="Leads formulaire"
            sub="Google · Meta · Site · Reco"
            value={kpis.leadsForm}
            delta={pctDelta(kpis.leadsForm, kpisPrev.leadsForm)}
            footer={
              <div className={styles.acqProgress}>
                <div className={styles.acqProgressBar} style={{ width: `${pctOf(kpis.leadsForm, kpis.leads)}%` }} />
                <span className={styles.acqFootText}><strong>{pctOf(kpis.leadsForm, kpis.leads)}%</strong> du total</span>
              </div>
            }
          />
        </div>
      </Section>

      {/* ── Section 2 · Activité commerciale ─────────────────────── */}
      <Section
        kicker="Activité commerciale"
        subtitle="Volume de leads, devis et conversions sur la période"
      >
        <div className={styles.kpiRow}>
          <KpiCard
            accent="info"
            label="LEADS"
            value={kpis.leads.toLocaleString("fr-FR")}
            delta={pctDelta(kpis.leads, kpisPrev.leads)}
          />
          <KpiCard
            accent="warning"
            label="DEVIS ENVOYÉ"
            value={kpis.devisSent.toLocaleString("fr-FR")}
            delta={pctDelta(kpis.devisSent, kpisPrev.devisSent)}
          />
          <KpiCard
            accent="success"
            label="DEVIS SIGNÉS"
            value={kpis.devisSigned.toLocaleString("fr-FR")}
            delta={pctDelta(kpis.devisSigned, kpisPrev.devisSigned)}
          />
          <KpiCard
            accent="brand"
            label="TAUX DE TRANSFO."
            value={`${(kpis.conversionRate * 100).toFixed(1)} %`}
            delta={(kpis.conversionRate - kpisPrev.conversionRate) * 100}
            deltaUnit="pts"
          />
        </div>
      </Section>

      {/* ── Section 3 · Performance financière ───────────────────── */}
      <Section
        kicker="Performance financière"
        subtitle="CA généré, facturé et panier moyen"
      >
        <div className={styles.kpiRow}>
          <KpiCard
            accent="brand"
            label="CA SIGNÉ"
            value={formatKEUR(kpis.caSigned)}
            delta={pctDelta(kpis.caSigned, kpisPrev.caSigned)}
          />
          <KpiCard
            accent="success"
            label="CA ENCAISSÉ"
            value={formatKEUR(kpis.caEncaisse)}
            delta={pctDelta(kpis.caEncaisse, kpisPrev.caEncaisse)}
          />
          <KpiCard
            accent="warning"
            label="CA RESTANT À FACTURER"
            value={formatKEUR(kpis.caRestant)}
            delta={pctDelta(kpis.caRestant, kpisPrev.caRestant)}
          />
          <KpiCard
            accent="info"
            label="PANIER MOYEN"
            value={formatKEUR(kpis.averageBasket)}
            delta={pctDelta(kpis.averageBasket, kpisPrev.averageBasket)}
          />
        </div>
      </Section>

      {/* ── Section 4 · Performance vs période précédente ────────── */}
      <PerformanceCard
        current={kpis.caSigned}
        previous={kpisPrev.caSigned}
        score={score}
        windowLabel={`${formatShortRange(w.startIso, w.endIso)} · précédent ${formatShortRange(wPrev.startIso, wPrev.endIso)}`}
        caEncaisseFinale={kpis.caEncaisseFinale}
        caEncaisseFinalePrev={kpisPrev.caEncaisseFinale}
        encaisseAcompteCount={kpis.encaisseAcompteCount}
        caRestant={kpis.caRestant}
        caRestantPrev={kpisPrev.caRestant}
        devisSigned={kpis.devisSigned}
      />

      {/* ── Évolution + Funnel ───────────────────────────────────── */}
      <section className={styles.grid2}>
        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <h2 className={styles.h2}>Évolution sur la période</h2>
              <p className={styles.cardHint}>Leads, devis et CA signé (k€) · Granularité : Jour</p>
            </div>
            <ul className={styles.legend} aria-label="Légende">
              <li><span className={styles.swatch} style={{ background: "var(--tone-info)" }} /> Leads</li>
              <li><span className={styles.swatch} style={{ background: "var(--color-brand-500)" }} /> Devis</li>
              <li><span className={styles.swatch} style={{ background: "var(--tone-success)" }} /> CA signé (k€)</li>
            </ul>
          </header>
          <EvolutionChart data={daily} />
        </div>

        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <h2 className={styles.h2}>Funnel</h2>
            <p className={styles.cardHint}>Conversion sur la période</p>
          </header>
          <FunnelMoney stages={stages} />
        </div>
      </section>

      {/* ── Classement commerciaux ──────────────────────────────── */}
      <CommerciauxTable rows={top} />

      {/* ── Sector donut + Canal Mano/Auto ───────────────────────── */}
      <section className={styles.grid2Eq}>
        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <h2 className={styles.h2}>CA signé par activité</h2>
          </header>
          <Donut slices={sectors} />
        </div>

        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <div>
              <h2 className={styles.h2}>Canal d&apos;envoi · Mano vs Auto</h2>
              <p className={styles.cardHint}>Performance comparée des deux canaux sur la période</p>
            </div>
            <span className={styles.legendInline}>
              {channels.reduce((s, c) => s + c.devisCount, 0)} devis tracés
            </span>
          </header>
          <MaunoVsAutoCards stats={channels} />
        </div>
      </section>

      {/* ── Annotations (admin only) ─────────────────────────────── */}
      {isAdmin && annotations.length > 0 && <AnnotationsCard annotations={annotations} />}
    </div>
  );
}

// ── Section helper ────────────────────────────────────────────────────
function Section({
  kicker,
  subtitle,
  children,
}: {
  kicker: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>
          <Icon name="check" size={14} /> {kicker}
        </p>
        {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

// ── FilterBar ────────────────────────────────────────────────────────
function FilterBar({
  filter,
  setFilter,
}: {
  filter: DashboardFilter;
  setFilter: (f: DashboardFilter) => void;
}) {
  return (
    <div className={styles.filterBar} role="toolbar" aria-label="Filtres dashboard">
      <fieldset className={styles.filterGroup}>
        <legend className={styles.filterLabel}>PÉRIODE</legend>
        <div className={styles.segmentedScroll}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`${styles.segment} ${filter.period === p.value ? styles.segmentOn : ""}`}
              onClick={() => setFilter({ ...filter, period: p.value })}
              aria-pressed={filter.period === p.value}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.filterGroup}>
        <legend className={styles.filterLabel}>ACTIVITÉS</legend>
        <select
          className={styles.filterSelect}
          value={filter.sector}
          onChange={(e) =>
            setFilter({ ...filter, sector: (e.target.value as Sector | "all") })
          }
        >
          <option value="all">Toutes les activités</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>{SECTOR_LABEL[s]}</option>
          ))}
        </select>
      </fieldset>

      <fieldset className={styles.filterGroup}>
        <legend className={styles.filterLabel}>CANAL D&apos;ENVOI</legend>
        <div className={styles.segmented}>
          <button
            type="button"
            className={`${styles.segment} ${filter.channel === "all" ? styles.segmentOn : ""}`}
            onClick={() => setFilter({ ...filter, channel: "all" })}
            aria-pressed={filter.channel === "all"}
          >
            Tous
          </button>
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.segment} ${filter.channel === c ? styles.segmentOn : ""}`}
              onClick={() => setFilter({ ...filter, channel: c })}
              aria-pressed={filter.channel === c}
            >
              {c === "mano" ? "Mano" : "Auto"}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

// ── Acquisition card ─────────────────────────────────────────────────
type Accent = "brand" | "success" | "info" | "warning";

function AcqCard({
  accent,
  iconName,
  label,
  sub,
  value,
  delta,
  footer,
}: {
  accent: Accent;
  iconName: React.ComponentProps<typeof Icon>["name"];
  label: string;
  sub: string;
  value: number;
  delta: number;
  footer?: React.ReactNode;
}) {
  return (
    <div className={`${styles.acqCard} ${styles[`acqCard_${accent}`]}`}>
      <div className={styles.acqHead}>
        <span className={styles.acqIcon}><Icon name={iconName} size={18} /></span>
        <div>
          <p className={styles.acqLabel}>{label}</p>
          <p className={styles.acqSub}>{sub}</p>
        </div>
        <DeltaPill value={delta} />
      </div>
      <p className={styles.acqValue}>{value.toLocaleString("fr-FR")}</p>
      {footer && <div className={styles.acqFooter}>{footer}</div>}
    </div>
  );
}

// ── KPI card with delta ──────────────────────────────────────────────
function KpiCard({
  accent,
  label,
  value,
  delta,
  deltaUnit = "%",
}: {
  accent: Accent;
  label: string;
  value: string;
  delta: number;
  deltaUnit?: "%" | "pts";
}) {
  return (
    <div className={`${styles.kpiCard} ${styles[`kpiCard_${accent}`]}`}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      <p className={styles.kpiDelta}>
        <DeltaInline value={delta} unit={deltaUnit} /> vs préc.
      </p>
    </div>
  );
}

// ── Delta UI ─────────────────────────────────────────────────────────
function DeltaPill({ value }: { value: number }) {
  if (!isFinite(value)) {
    return <span className={`${styles.delta} ${styles.deltaUp}`}>↑ —</span>;
  }
  const cls = value >= 0 ? styles.deltaUp : styles.deltaDown;
  const arrow = value >= 0 ? "↑" : "↓";
  return (
    <span className={`${styles.delta} ${cls}`}>
      {arrow}{Math.abs(value).toFixed(0)}%
    </span>
  );
}

function DeltaInline({ value, unit }: { value: number; unit: "%" | "pts" }) {
  if (!isFinite(value)) {
    return <span className={styles.deltaInlineUp}>—</span>;
  }
  const up = value >= 0;
  return (
    <span className={up ? styles.deltaInlineUp : styles.deltaInlineDown}>
      {up ? "↗" : "↘"}{up ? "+" : ""}{value.toFixed(unit === "pts" ? 1 : 0)}{unit === "%" ? "%" : " pts"}
    </span>
  );
}

// ── Performance card ─────────────────────────────────────────────────
function PerformanceCard({
  current,
  previous,
  score,
  windowLabel,
  caEncaisseFinale,
  caEncaisseFinalePrev,
  encaisseAcompteCount,
  caRestant,
  caRestantPrev,
  devisSigned,
}: {
  current: number;
  previous: number;
  score: number;
  windowLabel: string;
  caEncaisseFinale: number;
  caEncaisseFinalePrev: number;
  encaisseAcompteCount: number;
  caRestant: number;
  caRestantPrev: number;
  devisSigned: number;
}) {
  const delta = pctDelta(current, previous);
  const absolute = current - previous;
  const total = current;
  const encaissePct = total > 0 ? (caEncaisseFinale / total) * 100 : 0;
  const scoreLabel =
    score >= 75 ? "Excellent" : score >= 55 ? "En croissance" : score >= 40 ? "Stable" : "En recul";

  return (
    <section className={`${styles.card} ${styles.perfCard}`}>
      <div className={styles.perfTop}>
        <div className={styles.perfBig}>
          <p className={styles.perfKicker}>
            <span className={styles.perfRedBar} aria-hidden="true" />
            PERFORMANCE CA · VS MÊME PÉRIODE PRÉCÉDENTE
          </p>
          <p className={styles.perfValue}>
            {formatKEUR(current)}
            <span className={delta < 0 ? styles.perfDeltaDown : styles.perfDeltaUp}>
              {delta < 0 ? " ↓" : " ↑"} {Math.abs(delta).toFixed(1)}%
            </span>
          </p>
          <p className={styles.perfRange}>{windowLabel}</p>
        </div>

        <div className={styles.perfAbs}>
          <p className={styles.perfMiniLabel}>ÉCART ABSOLU</p>
          <p className={`${styles.perfAbsValue} ${absolute < 0 ? styles.deltaInlineDown : styles.deltaInlineUp}`}>
            {absolute >= 0 ? "+" : ""}{formatKEUR(absolute)}
          </p>
          <p className={styles.perfMiniHint}>
            {absolute >= 0 ? "au-dessus de" : "en-dessous de"} la période préc.
          </p>
        </div>

        <div className={styles.perfScore}>
          <p className={styles.perfMiniLabel}>SCORE PERFORMANCE · 0 — 100 (50 = parité)</p>
          <div className={styles.scoreTrack}>
            <div className={styles.scoreFill} style={{ width: `${score}%` }} />
            <span className={styles.scoreMarker} style={{ left: "50%" }} aria-hidden="true" />
          </div>
          <p className={styles.scoreRow}>
            <span className={styles.scoreBadge}>
              <Icon name="alert" size={11} /> {scoreLabel}
            </span>
            <span className={styles.scoreNum}>{score}<span className={styles.muted}>/100</span></span>
          </p>
        </div>
      </div>

      <div className={styles.perfBottom}>
        <div className={`${styles.perfMini} ${styles.perfMini_success}`}>
          <p className={styles.perfMiniLabel}>CA ENCAISSÉ</p>
          <p className={styles.perfMiniValue}>{formatKEUR(caEncaisseFinale)}</p>
          <p className={styles.perfMiniHint}>
            {encaisseAcompteCount} devis · <DeltaInline value={pctDelta(caEncaisseFinale, caEncaisseFinalePrev)} unit="%" /> vs préc.
          </p>
        </div>
        <div className={`${styles.perfMini} ${styles.perfMini_warning}`}>
          <p className={styles.perfMiniLabel}>SOLDE À ENCAISSER</p>
          <p className={styles.perfMiniValue}>{formatKEUR(caRestant)}</p>
          <p className={styles.perfMiniHint}>
            {devisSigned} devis signés · <DeltaInline value={pctDelta(caRestant, caRestantPrev)} unit="%" /> vs préc.
          </p>
        </div>
        <div className={styles.perfSplit}>
          <p className={styles.perfMiniLabel}>RÉPARTITION DU CA SIGNÉ · total {formatKEUR(total)}</p>
          <div className={styles.splitTrack}>
            <div
              className={styles.splitEncaisse}
              style={{ width: `${encaissePct}%` }}
              title={`Encaissé : ${formatKEUR(caEncaisseFinale)}`}
            >
              <span>{encaissePct.toFixed(0)}%</span>
            </div>
            <div className={styles.splitRest}>
              <span>{formatKEUR(caRestant)} À encaisser</span>
            </div>
          </div>
          <p className={styles.splitLegend}>
            <span><i className={styles.dotEncaisse} /> Encaissé {formatKEUR(caEncaisseFinale)}</span>
            <span><i className={styles.dotRest} /> À encaisser {formatKEUR(caRestant)}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Funnel with € ────────────────────────────────────────────────────
function FunnelMoney({ stages }: { stages: ReturnType<typeof funnel> }) {
  const max = stages[0]?.amount ?? 0;
  return (
    <ul className={styles.funnelMoney}>
      {stages.map((stage, i) => {
        const width = max === 0 ? 0 : Math.max(8, (stage.amount / max) * 100);
        const prev = stages[i - 1];
        const drop =
          prev && prev.amount > 0
            ? ((prev.amount - stage.amount) / prev.amount) * 100
            : 0;
        return (
          <li key={stage.key} className={styles.funnelRow2}>
            <span className={styles.funnelDot} data-stage={stage.key} aria-hidden="true" />
            <span className={styles.funnelName}>{stage.label}</span>
            <span className={styles.funnelAmount}>
              {stage.amount >= 1_000_000
                ? `${(stage.amount / 1_000_000).toFixed(1)} M€`
                : formatKEUR(stage.amount)}
            </span>
            {i > 0 ? (
              <span className={styles.funnelDelta}>↘ -{drop.toFixed(0)}%</span>
            ) : (
              <span className={styles.funnelDelta} aria-hidden="true" />
            )}
            <div className={styles.funnelTrack2} aria-hidden="true">
              <div className={styles.funnelBar2} style={{ width: `${width}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Commerciaux ranking table ────────────────────────────────────────
function CommerciauxTable({ rows }: { rows: ReturnType<typeof topCommerciaux> }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.h2}>Classement commerciaux</h2>
          <p className={styles.cardHint}>Performance détaillée et tendance individuelle sur la période sélectionnée</p>
        </div>
        <span className={styles.legendInline}>{rows.length} commerciaux actifs</span>
      </header>
      <div className={styles.tableWrap}>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>COMMERCIAL</th>
              <th>LEADS</th>
              <th>DEVIS</th>
              <th>SIGNÉS</th>
              <th>PERDUS</th>
              <th>TAUX</th>
              <th>PANIER MOYEN</th>
              <th>CA SIGNÉ</th>
              <th>VS PRÉC.</th>
              <th>CANAL</th>
              <th>TENDANCE &amp; SCORE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id}>
                <td>
                  <span className={styles.rank}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                  </span>
                </td>
                <td className={styles.tdCommercial}>
                  <span
                    className={styles.avatar}
                    style={{ ["--av" as string]: r.color }}
                    aria-hidden="true"
                  >
                    {r.initials}
                  </span>
                  <div>
                    <p className={styles.commercialName}>{r.name}</p>
                    <p className={styles.commercialRole}>Commercial</p>
                  </div>
                </td>
                <td className={styles.tnum}>{r.leads}</td>
                <td className={styles.tnum}>{r.devis}</td>
                <td className={`${styles.tnum} ${styles.tnumGood}`}>{r.signed}</td>
                <td className={`${styles.tnum} ${r.lost > 0 ? styles.tnumBad : ""}`}>{r.lost}</td>
                <td className={styles.tnum}>{(r.conversion * 100).toFixed(1)} %</td>
                <td className={styles.tnum}>{formatKEUR(r.averageBasket)}</td>
                <td className={styles.tnum}>{formatKEUR(r.caSigned)}</td>
                <td>
                  <DeltaInline value={r.caSignedDeltaPct} unit="%" />
                </td>
                <td>
                  <span className={styles.channelChip} title="Mano">
                    <Icon name="phone" size={11} /> {r.manoCount}
                  </span>{" "}
                  <span className={styles.channelChip} title="Auto">
                    <Icon name="zap" size={11} /> {r.autoCount}
                  </span>
                </td>
                <td>
                  <ScoreBar value={r.score} delta={r.caSignedDeltaPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScoreBar({ value, delta }: { value: number; delta: number }) {
  const up = delta >= 0;
  return (
    <div className={styles.scoreCell}>
      <span className={up ? styles.deltaInlineUp : styles.deltaInlineDown}>
        {up ? "↑" : "↓"}{Math.abs(delta).toFixed(0)}%
      </span>
      <span className={styles.scoreNum2}>{value}<span className={styles.muted}>/100</span></span>
    </div>
  );
}

// ── Mano vs Auto comparison ──────────────────────────────────────────
function MaunoVsAutoCards({ stats }: { stats: ReturnType<typeof channelStats> }) {
  return (
    <div className={styles.channels}>
      {stats.map((s) => (
        <div key={s.channel} className={styles.channelCard} data-channel={s.channel}>
          <header className={styles.channelHead}>
            <span className={styles.channelTitle}>
              <Icon name={s.channel === "mano" ? "phone" : "zap"} size={14} />
              {s.channel === "mano" ? "Mano" : "Auto"}
            </span>
            <span className={styles.channelCount}>{s.devisCount} devis</span>
          </header>
          <p className={styles.channelSub}>
            {s.channel === "mano" ? "Envoi commercial après appel" : "Séquence email n8n"}
          </p>
          <div className={styles.channelKpis}>
            <div>
              <p className={styles.miniKpiLabel}>CA</p>
              <p className={styles.miniKpiValue}>{formatKEUR(s.caSigned)}</p>
            </div>
            <div>
              <p className={styles.miniKpiLabel}>SIGNÉS</p>
              <p className={styles.miniKpiValue}>{s.signed}</p>
            </div>
            <div>
              <p className={styles.miniKpiLabel}>PERDUS</p>
              <p className={styles.miniKpiValue}>{s.lost}</p>
            </div>
            <div>
              <p className={styles.miniKpiLabel}>TRANSFO</p>
              <p className={styles.miniKpiValue}>{(s.conversion * 100).toFixed(1)} %</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Annotations Immobilier/Travaux ──────────────────────────────────
function AnnotationsCard({ annotations }: { annotations: ImmobAnnotation[] }) {
  const [tab, setTab] = useState<"all" | "immobilier" | "travaux" | "les_deux">("all");
  const filtered = useMemo(() => {
    if (tab === "all") return annotations;
    return annotations.filter((a) => a.segment === tab);
  }, [annotations, tab]);
  const counts = {
    all: annotations.length,
    immobilier: annotations.filter((a) => a.segment === "immobilier").length,
    travaux: annotations.filter((a) => a.segment === "travaux").length,
    les_deux: annotations.filter((a) => a.segment === "les_deux").length,
  };

  return (
    <section className={`${styles.card} ${styles.annotCard}`}>
      <header className={styles.annotHeader}>
        <div>
          <p className={styles.annotKicker}>
            <Icon name="alert" size={14} /> Annotations<br />
            Immobilier / Travaux <span className={styles.annotBadge}>Confidentiel · Super Admin</span>
          </p>
          <p className={styles.cardHint}>
            Contexte immobilier ou travaux remonté par les commerciaux sur leurs prospects / clients · {annotations.length} annotations sur la période
          </p>
        </div>
        <div className={styles.annotTabs}>
          <button type="button" className={`${styles.annotTab} ${tab === "all" ? styles.annotTabOn : ""}`} onClick={() => setTab("all")}>
            Toutes ({counts.all})
          </button>
          <button type="button" className={`${styles.annotTab} ${tab === "immobilier" ? styles.annotTabOn : ""}`} onClick={() => setTab("immobilier")}>
            🏠 Immo ({counts.immobilier})
          </button>
          <button type="button" className={`${styles.annotTab} ${tab === "travaux" ? styles.annotTabOn : ""}`} onClick={() => setTab("travaux")}>
            🔧 Travaux ({counts.travaux})
          </button>
          <button type="button" className={`${styles.annotTab} ${tab === "les_deux" ? styles.annotTabOn : ""}`} onClick={() => setTab("les_deux")}>
            Les deux ({counts.les_deux})
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.annotTable}>
          <thead>
            <tr>
              <th>CLIENT / CONTACT</th>
              <th>TYPE</th>
              <th>ANNOTATION</th>
              <th>COMMERCIAL</th>
              <th>ACTIVITÉ</th>
              <th>MONTANT</th>
              <th>CRÉÉ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr
                key={a.leadId}
                className={styles.annotRow}
                onClick={() => { window.location.href = `/leads/${a.leadId}`; }}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    window.location.href = `/leads/${a.leadId}`;
                  }
                }}
              >
                <td>
                  <Link href={`/leads/${a.leadId}`} className={styles.annotLink} onClick={(e) => e.stopPropagation()}>
                    <p className={styles.annotClient}>{a.client}</p>
                    <p className={styles.annotShortId}>{a.shortId}</p>
                  </Link>
                </td>
                <td>
                  <span className={`${styles.annotType} ${styles[`annotType_${a.segment ?? "none"}`]}`}>
                    {a.segment === "immobilier" && "🏠 Immo"}
                    {a.segment === "travaux" && "🔧 Travaux"}
                    {a.segment === "les_deux" && "🏠🔧 Les deux"}
                    {!a.segment && "—"}
                  </span>
                </td>
                <td className={styles.annotText}>« {a.annotation} »</td>
                <td className={styles.tdCommercial}>
                  {a.ownerInitials && (
                    <span
                      className={styles.avatar}
                      style={{ ["--av" as string]: a.ownerColor ?? "var(--color-brand-500)" }}
                      aria-hidden="true"
                    >
                      {a.ownerInitials}
                    </span>
                  )}
                  <span>{a.ownerName ?? "—"}</span>
                </td>
                <td>
                  {a.sectorSlug && (
                    <span
                      className={styles.sectorPill}
                      style={{ ["--sc" as string]: `var(${SECTOR_VAR[a.sectorSlug]})` }}
                    >
                      ● {SECTOR_LABEL[a.sectorSlug]}
                    </span>
                  )}
                </td>
                <td className={styles.tnum}>{formatKEUR(a.amount)}</td>
                <td className={styles.tnum}>{formatRelative(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── helpers ──────────────────────────────────────────────────────────
function pctOf(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function formatRange(startIso: string, endIso: string): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return `${fmt.format(new Date(startIso))} → ${fmt.format(new Date(endIso))}`;
}

function formatShortRange(startIso: string, endIso: string): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `${fmt.format(new Date(startIso))} – ${fmt.format(new Date(endIso))}`;
}

// CSV export — composes 4 sections (KPIs, per-day series, ranking,
// canal stats). Browser-only: builds an in-memory Blob and triggers a
// download via a synthetic anchor click. UTF-8 BOM at the top so Excel
// on Windows opens it without mangling accents.
function exportCsv(input: {
  kpis: ReturnType<typeof computeKpis>;
  daily: ReturnType<typeof aggregateByDay>;
  top: ReturnType<typeof topCommerciaux>;
  channels: ReturnType<typeof channelStats>;
  w: { startIso: string; endIso: string };
  filter: DashboardFilter;
}) {
  const { kpis, daily, top, channels, w, filter } = input;
  const periodLabel = PERIODS.find((p) => p.value === filter.period)?.label ?? filter.period;
  const sectorLabel = filter.sector === "all" ? "Toutes" : SECTOR_LABEL[filter.sector];
  const channelLabel = filter.channel === "all" ? "Tous" : filter.channel === "mano" ? "Mano" : "Auto";

  const esc = (v: string | number) => {
    const s = String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row = (cells: (string | number)[]) => cells.map(esc).join(";");
  const blank = "";

  const lines: string[] = [];
  lines.push(row(["Rapport Dashboard CGK CRM"]));
  lines.push(row(["Période", periodLabel]));
  lines.push(row(["Du", w.startIso, "au", w.endIso]));
  lines.push(row(["Activité", sectorLabel]));
  lines.push(row(["Canal d'envoi", channelLabel]));
  lines.push(blank);

  lines.push(row(["KPIs"]));
  lines.push(row(["Métrique", "Valeur"]));
  lines.push(row(["Leads total", kpis.leads]));
  lines.push(row(["Leads téléphone", kpis.leadsPhone]));
  lines.push(row(["Leads formulaire", kpis.leadsForm]));
  lines.push(row(["Leads perdus", kpis.lost]));
  lines.push(row(["Devis envoyés", kpis.devisSent]));
  lines.push(row(["Devis signés", kpis.devisSigned]));
  lines.push(row(["Taux de transformation", `${(kpis.conversionRate * 100).toFixed(2)} %`]));
  lines.push(row(["CA signé (€)", kpis.caSigned.toFixed(2)]));
  lines.push(row(["CA encaissé acompte (€)", kpis.caEncaisseAcompte.toFixed(2)]));
  lines.push(row(["CA encaissé final (€)", kpis.caEncaisseFinale.toFixed(2)]));
  lines.push(row(["CA restant à facturer (€)", kpis.caRestant.toFixed(2)]));
  lines.push(row(["Panier moyen (€)", kpis.averageBasket.toFixed(2)]));
  lines.push(blank);

  lines.push(row(["Évolution par jour"]));
  lines.push(row(["Date", "Leads", "Devis envoyés", "Devis signés", "CA signé (€)"]));
  for (const d of daily) {
    lines.push(row([d.date, d.leads, d.devisSent, d.devisSigned, d.caSigned.toFixed(2)]));
  }
  lines.push(blank);

  lines.push(row(["Classement commerciaux"]));
  lines.push(row(["#", "Commercial", "Leads", "Devis", "Signés", "Perdus", "Taux", "Panier moyen (€)", "CA signé (€)", "CA précédent (€)", "Vs préc. (%)", "Mano", "Auto", "Score"]));
  top.forEach((c, i) => {
    lines.push(
      row([
        i + 1,
        c.name,
        c.leads,
        c.devis,
        c.signed,
        c.lost,
        `${(c.conversion * 100).toFixed(2)} %`,
        c.averageBasket.toFixed(2),
        c.caSigned.toFixed(2),
        c.caSignedPrev.toFixed(2),
        isFinite(c.caSignedDeltaPct) ? c.caSignedDeltaPct.toFixed(2) : "n/a",
        c.manoCount,
        c.autoCount,
        c.score,
      ]),
    );
  });
  lines.push(blank);

  lines.push(row(["Canal d'envoi · Mano vs Auto"]));
  lines.push(row(["Canal", "Devis", "Signés", "Perdus", "Transfo", "CA signé (€)"]));
  for (const c of channels) {
    lines.push(
      row([
        c.channel === "mano" ? "Mano" : "Auto",
        c.devisCount,
        c.signed,
        c.lost,
        `${(c.conversion * 100).toFixed(2)} %`,
        c.caSigned.toFixed(2),
      ]),
    );
  }

  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-${w.startIso}_au_${w.endIso}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}
