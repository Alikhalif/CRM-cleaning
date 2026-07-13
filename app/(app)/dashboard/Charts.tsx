"use client";

// Light-touch SVG chart primitives. Custom rather than a chart library to
// stay aligned with the rest of the codebase (no icon library, hand-rolled
// SCSS). Each component is self-contained and viewBox-based so it scales
// cleanly across viewports.

import { useId } from "react";
import { SECTOR_LABEL, SECTOR_VAR, type Sector } from "@/lib/leads";
import type { DailyTotals } from "@/lib/dashboard";
import styles from "./Charts.module.scss";

// ──────────────────────────────────────────────────────────────────────
// Sparkline
// Small inline trend line, used in the top-commerciaux ranking.
// ──────────────────────────────────────────────────────────────────────
type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
};

export function Sparkline({ values, width = 80, height = 24, stroke = "currentColor" }: SparklineProps) {
  if (values.length < 2) return <span className={styles.sparkEmpty}>—</span>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      className={styles.spark}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────
// LineChart — multi-series evolution chart with a simple x/y grid.
// ──────────────────────────────────────────────────────────────────────
type Series = { id: string; label: string; values: number[]; color: string };
type LineChartProps = {
  data: DailyTotals[];
  series: Series[];
};

export function LineChart({ data, series }: LineChartProps) {
  const W = 720;
  const H = 280;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 28;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const allValues = series.flatMap((s) => s.values);
  const maxY = Math.max(...allValues, 1);
  const yTicks = niceTicks(0, maxY, 4);
  const tickMax = yTicks[yTicks.length - 1];

  const x = (i: number) =>
    data.length === 1 ? PAD_L + innerW / 2 : PAD_L + (i / (data.length - 1)) * innerW;
  const y = (v: number) => PAD_T + innerH - (v / tickMax) * innerH;

  // Show ~6 evenly-spaced date labels on the x-axis, regardless of total length.
  const labelStep = Math.max(1, Math.floor(data.length / 6));
  const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });

  return (
    <div className={styles.lineWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.line} role="img" aria-label="Évolution">
        {/* Y grid + ticks */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} className={styles.gridLine} />
            <text x={PAD_L - 6} y={y(t)} className={styles.axisLabel} textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {data.map((d, i) =>
          i % labelStep === 0 || i === data.length - 1 ? (
            <text
              key={d.date}
              x={x(i)}
              y={H - 8}
              className={styles.axisLabel}
              textAnchor="middle"
            >
              {dateFmt.format(new Date(d.date))}
            </text>
          ) : null,
        )}

        {/* Series polylines */}
        {series.map((s) => {
          const points = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          return (
            <polyline
              key={s.id}
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      <ul className={styles.legend} aria-label="Légende">
        {series.map((s) => (
          <li key={s.id}>
            <span className={styles.swatch} style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// EvolutionChart — grouped bars per day. Leads (blue) + Devis (purple)
// + CA signé in k€ (green). The image's chart shape: thin bars side by
// side, daily axis underneath. Y axis stays on the left.
// ──────────────────────────────────────────────────────────────────────
type EvolutionProps = { data: DailyTotals[] };

export function EvolutionChart({ data }: EvolutionProps) {
  const W = 720;
  const H = 280;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 32;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  if (data.length === 0) {
    return <p className={styles.empty}>Aucune activité sur la période.</p>;
  }

  // Convert CA from € to k€ so the three series share the same y axis.
  const series = data.map((d) => ({
    date: d.date,
    leads: d.leads,
    devis: d.devisSent,
    caK: d.caSigned / 1000,
  }));

  const maxY = Math.max(
    ...series.map((d) => Math.max(d.leads, d.devis, d.caK)),
    1,
  );
  const yTicks = niceTicks(0, maxY, 4);
  const tickMax = yTicks[yTicks.length - 1];

  const groupW = innerW / series.length;
  const barW = Math.max(2, (groupW - 4) / 3);

  const yPx = (v: number) => PAD_T + innerH - (v / tickMax) * innerH;

  const labelStep = Math.max(1, Math.floor(series.length / 8));
  const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });

  return (
    <div className={styles.lineWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.line} role="img" aria-label="Évolution">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yPx(t)} y2={yPx(t)} className={styles.gridLine} />
            <text x={PAD_L - 6} y={yPx(t)} className={styles.axisLabel} textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
        {series.map((d, i) => {
          const x0 = PAD_L + i * groupW + (groupW - barW * 3) / 2;
          return (
            <g key={d.date}>
              <rect
                x={x0}
                y={yPx(d.leads)}
                width={barW}
                height={Math.max(0, PAD_T + innerH - yPx(d.leads))}
                fill="var(--tone-info)"
                rx="1"
              />
              <rect
                x={x0 + barW}
                y={yPx(d.devis)}
                width={barW}
                height={Math.max(0, PAD_T + innerH - yPx(d.devis))}
                fill="var(--color-brand-500)"
                rx="1"
              />
              <rect
                x={x0 + barW * 2}
                y={yPx(d.caK)}
                width={barW}
                height={Math.max(0, PAD_T + innerH - yPx(d.caK))}
                fill="var(--tone-success)"
                rx="1"
              />
            </g>
          );
        })}
        {series.map((d, i) =>
          i % labelStep === 0 || i === series.length - 1 ? (
            <text
              key={`lab-${d.date}`}
              x={PAD_L + i * groupW + groupW / 2}
              y={H - 10}
              className={styles.axisLabel}
              textAnchor="middle"
            >
              {dateFmt.format(new Date(d.date))}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

// "Nice" round tick values (1/2/5 × power-of-10).
function niceTicks(min: number, max: number, target: number): number[] {
  const range = max - min || 1;
  const rough = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * pow;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

// ──────────────────────────────────────────────────────────────────────
// Donut — sector breakdown of CA signé.
// ──────────────────────────────────────────────────────────────────────
type DonutProps = {
  slices: { sector: Sector; amount: number }[];
};

export function Donut({ slices }: DonutProps) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  const titleId = useId();

  if (total === 0) {
    return <p className={styles.empty}>Aucun CA signé sur la période.</p>;
  }

  // Standard dasharray pattern: each ring is a stroked circle whose
  // dasharray = (slice fraction, rest of circumference). Successive rings
  // rotate by the cumulative angle of preceding slices — pre-compute those
  // offsets so the render pass is a pure map.
  const R = 42;
  const C = 2 * Math.PI * R;
  const ringSpecs = slices.reduce<{ key: string; dash: number; offset: number; color: string }[]>(
    (acc, s) => {
      const frac = s.amount / total;
      if (frac === 0) return acc;
      const cumulative = acc.reduce((sum, r) => sum + r.dash / C, 0);
      acc.push({
        key: s.sector,
        dash: frac * C,
        offset: -cumulative * C,
        color: `var(${SECTOR_VAR[s.sector]})`,
      });
      return acc;
    },
    [],
  );

  return (
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 120 120" className={styles.donut} role="img" aria-labelledby={titleId}>
        <title id={titleId}>CA signé par secteur</title>
        <circle cx="60" cy="60" r={R} className={styles.donutBg} />
        {ringSpecs.map((r) => (
          <circle
            key={r.key}
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={r.color}
            strokeWidth="14"
            strokeDasharray={`${r.dash} ${C - r.dash}`}
            strokeDashoffset={r.offset}
            transform="rotate(-90 60 60)"
          />
        ))}
      </svg>

      <ul className={styles.donutLegend}>
        {slices.map((s) => {
          const pct = total === 0 ? 0 : (s.amount / total) * 100;
          return (
            <li key={s.sector}>
              <span
                className={styles.swatch}
                style={{ background: `var(${SECTOR_VAR[s.sector]})` }}
                aria-hidden="true"
              />
              <span className={styles.donutLabel}>{SECTOR_LABEL[s.sector]}</span>
              <span className={styles.donutValue}>{pct.toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
