"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon/Icon";
import { SECTOR_LABEL, SECTOR_VAR, formatEUR, type Sector } from "@/lib/leads";
import {
  DAILY_SERIES,
  aggregateByDay,
  caBySector,
  computeKpis,
  filterSeries,
  funnel,
  topCommerciaux,
  type Channel,
  type DashboardFilter,
  type Period,
} from "@/lib/dashboard";
import { Donut, LineChart, Sparkline } from "./Charts";
import styles from "./Dashboard.module.scss";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d",  label: "7 jours"  },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
];

const SECTORS: Sector[] = ["urgence", "nettoyage", "enr", "renovation"];
const CHANNELS: Channel[] = ["mano", "auto"];

export default function Dashboard() {
  const [filter, setFilter] = useState<DashboardFilter>({
    period: "30d",
    sector: "all",
    channel: "all",
  });

  const filtered = useMemo(() => filterSeries(DAILY_SERIES, filter), [filter]);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const daily = useMemo(() => aggregateByDay(filtered), [filtered]);
  const stages = useMemo(() => funnel(filtered), [filtered]);
  const sectors = useMemo(() => caBySector(filtered), [filtered]);
  const top = useMemo(() => topCommerciaux(filtered), [filtered]);

  const series = useMemo(
    () => [
      { id: "leads",  label: "Leads reçus",     values: daily.map((d) => d.leads),       color: "var(--tone-info)" },
      { id: "sent",   label: "Devis envoyés",   values: daily.map((d) => d.devisSent),   color: "var(--color-brand-500)" },
      { id: "signed", label: "Devis signés",    values: daily.map((d) => d.devisSigned), color: "var(--tone-success)" },
    ],
    [daily],
  );

  const funnelMax = stages[0]?.count ?? 1;
  const periodLabel = PERIODS.find((p) => p.value === filter.period)?.label ?? "";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Vue de pilotage commercial · {periodLabel.toLowerCase()} · données simulées
          </p>
        </div>
      </header>

      <FilterBar filter={filter} setFilter={setFilter} />

      <section className={styles.kpis}>
        <KpiCard label="Leads reçus"       value={kpis.leads.toLocaleString("fr-FR")} hint={`sur ${periodLabel.toLowerCase()}`} />
        <KpiCard label="Devis envoyés"     value={kpis.devisSent.toLocaleString("fr-FR")} hint={formatEUR(kpis.devisSentAmount)} />
        <KpiCard label="Devis signés"      value={kpis.devisSigned.toLocaleString("fr-FR")} hint={formatEUR(kpis.caSigned)} />
        <KpiCard label="CA encaissé"       value={formatEUR(kpis.caEncaisse)} hint="acomptes + finales" />
        <KpiCard label="Taux de transfo."  value={`${(kpis.conversionRate * 100).toFixed(1)} %`} hint="signés / leads" />
        <KpiCard label="Panier moyen"      value={formatEUR(kpis.averageBasket)} hint="par devis signé" />
      </section>

      <section className={styles.grid}>
        <div className={`${styles.card} ${styles.cardLine}`}>
          <header className={styles.cardHeader}>
            <h2 className={styles.h2}>Évolution sur {periodLabel.toLowerCase()}</h2>
            <p className={styles.cardHint}>Leads, devis envoyés et signés</p>
          </header>
          <LineChart data={daily} series={series} />
        </div>

        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <h2 className={styles.h2}>Funnel de conversion</h2>
            <p className={styles.cardHint}>5 étapes du cycle</p>
          </header>
          <ul className={styles.funnel}>
            {stages.map((stage, i) => {
              const width = funnelMax === 0 ? 0 : (stage.count / funnelMax) * 100;
              const prev = stages[i - 1];
              const drop =
                prev && prev.count > 0
                  ? ((prev.count - stage.count) / prev.count) * 100
                  : 0;
              return (
                <li key={stage.label} className={styles.funnelRow}>
                  <div className={styles.funnelLabel}>
                    <span>{stage.label}</span>
                    <span className={styles.funnelCount}>
                      {stage.count.toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <div className={styles.funnelTrack}>
                    <div
                      className={styles.funnelBar}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  {i > 0 && (
                    <p className={styles.funnelDrop}>
                      −{drop.toFixed(0)} % vs. étape précédente
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <h2 className={styles.h2}>CA signé par secteur</h2>
            <p className={styles.cardHint}>{formatEUR(kpis.caSigned)} au total</p>
          </header>
          <Donut slices={sectors} />
        </div>

        <div className={`${styles.card} ${styles.cardTop}`}>
          <header className={styles.cardHeader}>
            <h2 className={styles.h2}>Top commerciaux</h2>
            <p className={styles.cardHint}>Classement par CA signé</p>
          </header>
          <ol className={styles.commerciaux}>
            {top.map((c, idx) => (
              <li key={c.id} className={styles.commercialRow}>
                <span className={styles.rank}>{idx + 1}</span>
                <span
                  className={styles.avatar}
                  style={{ ["--av" as string]: c.color }}
                  aria-hidden="true"
                >
                  {c.initials}
                </span>
                <div className={styles.commercialBody}>
                  <p className={styles.commercialName}>{c.name}</p>
                  <p className={styles.commercialMeta}>
                    {c.signed} signés · {(c.conversion * 100).toFixed(0)} % · {formatEUR(c.caSigned)}
                  </p>
                </div>
                <Sparkline values={c.spark} stroke="var(--color-brand-500)" />
              </li>
            ))}
          </ol>
        </div>

        <div className={`${styles.card} ${styles.cardMap}`}>
          <header className={styles.cardHeader}>
            <h2 className={styles.h2}>Couverture France</h2>
            <p className={styles.cardHint}>Par département · à venir</p>
          </header>
          <div className={styles.mapPlaceholder}>
            <Icon name="alert" size={20} />
            <p>
              Carte choroplèthe par département à brancher sur un GeoJSON FR.
              Différée le temps de choisir entre tracé inline et grille hexagonale.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

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
        <legend className={styles.filterLabel}>Période</legend>
        <div className={styles.segmented}>
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
        <legend className={styles.filterLabel}>Secteur</legend>
        <div className={styles.segmented}>
          <button
            type="button"
            className={`${styles.segment} ${filter.sector === "all" ? styles.segmentOn : ""}`}
            onClick={() => setFilter({ ...filter, sector: "all" })}
            aria-pressed={filter.sector === "all"}
          >
            Tous
          </button>
          {SECTORS.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.segment} ${filter.sector === s ? styles.segmentOn : ""}`}
              style={{ ["--sc" as string]: `var(${SECTOR_VAR[s]})` }}
              onClick={() => setFilter({ ...filter, sector: s })}
              aria-pressed={filter.sector === s}
              data-sector
            >
              {SECTOR_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.filterGroup}>
        <legend className={styles.filterLabel}>Canal</legend>
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

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={styles.kpiCard}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      <p className={styles.kpiHint}>{hint}</p>
    </div>
  );
}
