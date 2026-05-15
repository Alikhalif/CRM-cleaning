// Dashboard mock data + aggregations.
//
// Synthesises 90 days of daily metrics, sliced by sector × channel, so the
// global filter bar (période + secteur + canal) actually does something.
// The Pipeline/Leads pages still read MOCK_LEADS — this module is intentionally
// independent. When Supabase is wired both will hit the same DB views.

import type { Sector } from "./leads";
import { MOCK_COMMERCIAUX } from "./leads-mock";

export type Channel = "mano" | "auto";
export type Period = "7d" | "30d" | "90d";

export type DashboardFilter = {
  period: Period;
  sector: Sector | "all";
  channel: Channel | "all";
};

export type DailyMetric = {
  date: string; // YYYY-MM-DD UTC
  sector: Sector;
  channel: Channel;
  leads: number;
  devisSent: number;
  devisSigned: number;
  caSigned: number; // EUR
  encaisse: number; // EUR (CA effectively cashed)
};

const SECTORS: Sector[] = ["urgence", "nettoyage", "enr", "renovation"];
const CHANNELS: Channel[] = ["mano", "auto"];

// CDC §1.3 + §4.12.3: weights tuned to ~150 leads/month with realistic mix.
// avgTicket roughly aligns with the catalogue ranges per sector.
const SECTOR_PROFILE: Record<Sector, { weight: number; avgTicket: number }> = {
  urgence:    { weight: 0.20, avgTicket: 450 },
  nettoyage:  { weight: 0.45, avgTicket: 1500 },
  enr:        { weight: 0.20, avgTicket: 18000 },
  renovation: { weight: 0.15, avgTicket: 38000 },
};

// Linear-congruential PRNG. Seeded per day so the timeline is stable across
// reloads but still varies day-to-day.
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

// Anchor "today" once at module load — keeps everything deterministic within a session.
const TODAY = (() => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
})();

function buildSeries(): DailyMetric[] {
  const out: DailyMetric[] = [];
  for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
    const date = new Date(TODAY);
    date.setUTCDate(date.getUTCDate() - dayOffset);
    const iso = date.toISOString().slice(0, 10);
    const rng = seeded(Math.floor(date.getTime() / 86_400_000));

    // Slight weekend dampening so the chart "breathes" weekly.
    const dow = date.getUTCDay();
    const dowMult = dow === 0 || dow === 6 ? 0.55 : 1;

    for (const sector of SECTORS) {
      for (const channel of CHANNELS) {
        const profile = SECTOR_PROFILE[sector];
        const channelMult = channel === "mano" ? 0.55 : 0.45;
        const noise = 0.7 + rng() * 0.6;
        const baseLeads = 5 * profile.weight * channelMult * noise * dowMult;
        const leads = Math.round(baseLeads);
        const sentRate = 0.7 + rng() * 0.15;
        const signedRate = 0.2 + rng() * 0.15;
        const encRate = 0.85 + rng() * 0.1;
        const devisSent = Math.min(leads, Math.round(leads * sentRate));
        const devisSigned = Math.min(devisSent, Math.round(leads * signedRate));
        const ticketNoise = 0.85 + rng() * 0.3;
        const caSigned = Math.round(devisSigned * profile.avgTicket * ticketNoise);
        const encaisse = Math.round(caSigned * encRate);
        out.push({ date: iso, sector, channel, leads, devisSent, devisSigned, caSigned, encaisse });
      }
    }
  }
  return out;
}

export const DAILY_SERIES = buildSeries();

export function filterSeries(series: DailyMetric[], f: DashboardFilter): DailyMetric[] {
  const days = f.period === "7d" ? 7 : f.period === "30d" ? 30 : 90;
  const cutoff = new Date(TODAY);
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return series.filter(
    (d) =>
      d.date >= cutoffIso &&
      (f.sector === "all" || d.sector === f.sector) &&
      (f.channel === "all" || d.channel === f.channel),
  );
}

// ── KPIs ────────────────────────────────────────────────────────────────
export type Kpis = {
  leads: number;
  devisSent: number;
  devisSentAmount: number;
  devisSigned: number;
  caSigned: number;
  caEncaisse: number;
  conversionRate: number;
  averageBasket: number;
};

export function computeKpis(filtered: DailyMetric[]): Kpis {
  const leads = sumBy(filtered, "leads");
  const devisSent = sumBy(filtered, "devisSent");
  const devisSigned = sumBy(filtered, "devisSigned");
  const caSigned = sumBy(filtered, "caSigned");
  const caEncaisse = sumBy(filtered, "encaisse");
  // Approx the "envoyés" amount from the sector × avg-ticket mix.
  const devisSentAmount = SECTORS.reduce((s, sec) => {
    const sectorSent = filtered
      .filter((d) => d.sector === sec)
      .reduce((m, d) => m + d.devisSent, 0);
    return s + sectorSent * SECTOR_PROFILE[sec].avgTicket;
  }, 0);
  return {
    leads,
    devisSent,
    devisSentAmount,
    devisSigned,
    caSigned,
    caEncaisse,
    conversionRate: leads === 0 ? 0 : devisSigned / leads,
    averageBasket: devisSigned === 0 ? 0 : caSigned / devisSigned,
  };
}

// ── Daily roll-up for the evolution chart ──────────────────────────────
export type DailyTotals = {
  date: string;
  leads: number;
  devisSent: number;
  devisSigned: number;
  caSigned: number;
};

export function aggregateByDay(filtered: DailyMetric[]): DailyTotals[] {
  const map = new Map<string, DailyTotals>();
  for (const d of filtered) {
    const cur = map.get(d.date) ?? {
      date: d.date,
      leads: 0,
      devisSent: 0,
      devisSigned: 0,
      caSigned: 0,
    };
    cur.leads += d.leads;
    cur.devisSent += d.devisSent;
    cur.devisSigned += d.devisSigned;
    cur.caSigned += d.caSigned;
    map.set(d.date, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ── Funnel ──────────────────────────────────────────────────────────────
export type FunnelStage = { label: string; count: number };

export function funnel(filtered: DailyMetric[]): FunnelStage[] {
  const leads = sumBy(filtered, "leads");
  const sent = sumBy(filtered, "devisSent");
  // The synthesized series doesn't track "ouvert" — derive a plausible
  // open-rate figure (typical e-sign tracked-link open rate ~85%).
  const opened = Math.round(sent * 0.85);
  const signed = sumBy(filtered, "devisSigned");
  const enc = Math.round(signed * 0.92);
  return [
    { label: "Leads",         count: leads },
    { label: "Devis envoyés", count: sent },
    { label: "Devis ouverts", count: opened },
    { label: "Signés",        count: signed },
    { label: "Encaissés",     count: enc },
  ];
}

// ── Sector breakdown for donut ─────────────────────────────────────────
export function caBySector(filtered: DailyMetric[]): { sector: Sector; amount: number }[] {
  return SECTORS.map((sector) => ({
    sector,
    amount: filtered
      .filter((d) => d.sector === sector)
      .reduce((s, d) => s + d.caSigned, 0),
  }));
}

// ── Top commerciaux ────────────────────────────────────────────────────
export type CommercialPerf = {
  id: string;
  name: string;
  initials: string;
  color: string;
  leads: number;
  signed: number;
  caSigned: number;
  conversion: number;
  spark: number[]; // last 30 days, signed count
};

// Distribute team-wide totals across the 5 commerciaux with stable weights.
const OWNER_WEIGHTS = [0.27, 0.22, 0.2, 0.18, 0.13];

export function topCommerciaux(filtered: DailyMetric[]): CommercialPerf[] {
  const dailyTotals = aggregateByDay(filtered);
  const last30 = dailyTotals.slice(-30);
  return MOCK_COMMERCIAUX.map((c, idx) => {
    const w = OWNER_WEIGHTS[idx] ?? 0.1;
    const leads = dailyTotals.reduce((s, d) => s + d.leads * w, 0);
    const signed = dailyTotals.reduce((s, d) => s + d.devisSigned * w, 0);
    const caSigned = dailyTotals.reduce((s, d) => s + d.caSigned * w, 0);
    const spark = last30.map((d) => d.devisSigned * w);
    return {
      id: c.id,
      name: c.name,
      initials: c.initials,
      color: c.color,
      leads: Math.round(leads),
      signed: Math.round(signed),
      caSigned: Math.round(caSigned),
      conversion: leads === 0 ? 0 : signed / leads,
      spark,
    };
  }).sort((a, b) => b.caSigned - a.caSigned);
}

// ── helpers ─────────────────────────────────────────────────────────────
function sumBy<K extends keyof DailyMetric>(arr: DailyMetric[], key: K): number {
  return arr.reduce((s, d) => s + (d[key] as number), 0);
}
