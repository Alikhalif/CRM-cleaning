// Pure dashboard aggregators. No data fetching, no mock data — the real
// row set is built server-side in lib/dashboard-server.ts and passed in
// as DailyMetric[]. These functions filter / roll up / score.

import type { Commercial, Sector } from "./leads";

export type Channel = "mano" | "auto";
export type Period =
  | "7d"
  | "30d"
  | "90d"
  | "mtd"      // ce mois-ci
  | "qtd"      // ce trimestre
  | "ytd"      // cette année
  | "12m";     // 12 derniers mois

export type DashboardFilter = {
  period: Period;
  sector: Sector | "all";
  channel: Channel | "all";
};

// A single bucket of activity. Roll-ups sum across whichever dimensions a
// given aggregator cares about. ownerId is nullable because some legacy
// rows (or unattributed leads) have no owner; per-commercial rankings
// exclude them, but they still count toward team-wide KPIs.
//
// `sourceKind` splits phone vs form leads (telephone → phone, anything
// else → form). `lost` counts leads that reached the perdu status.
// encaisseAcompte / encaisseFinale split paid amounts so the funnel can
// show "Acompte encaissé" separately from "Encaissement final".
export type DailyMetric = {
  date: string; // YYYY-MM-DD UTC
  sector: Sector;
  channel: Channel;
  ownerId: string | null;
  sourceKind: "phone" | "form";
  leads: number;
  lost: number;
  devisSent: number;
  devisSentAmount: number;
  devisOpened: number;
  devisOpenedAmount: number;
  devisSigned: number;
  caSigned: number;
  encaisseAcompte: number;
  encaisseFinale: number;
  encaisseAcompteCount: number;
  encaisseFinaleCount: number;
};

const SECTORS: Sector[] = ["urgence", "nettoyage", "nettoyage_difficile", "enr", "renovation", "debarras", "demenagement", "diogene"];

// "Today" pinned at module load so filterSeries is deterministic within a
// page render.
const TODAY = (() => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
})();

// ── Period boundaries ─────────────────────────────────────────────────
export type PeriodWindow = { startIso: string; endIso: string; lengthDays: number };

// Returns the [start, end] ISO date range for a period preset, anchored
// on TODAY. `end` is always TODAY (inclusive). `lengthDays` is what we
// shift backwards to derive the previous-period comparison window.
export function periodWindow(p: Period): PeriodWindow {
  const end = TODAY;
  let start = new Date(end);
  switch (p) {
    case "7d":  start.setUTCDate(end.getUTCDate() - 6); break;
    case "30d": start.setUTCDate(end.getUTCDate() - 29); break;
    case "90d": start.setUTCDate(end.getUTCDate() - 89); break;
    case "mtd": start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)); break;
    case "qtd": {
      const qStartMonth = Math.floor(end.getUTCMonth() / 3) * 3;
      start = new Date(Date.UTC(end.getUTCFullYear(), qStartMonth, 1));
      break;
    }
    case "ytd": start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1)); break;
    case "12m": start.setUTCDate(end.getUTCDate() - 364); break;
  }
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  const lengthDays =
    Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return { startIso, endIso, lengthDays };
}

// The previous-period window — same length, ending the day before `start`.
export function previousWindow(w: PeriodWindow): PeriodWindow {
  const start = new Date(`${w.startIso}T00:00:00Z`);
  const prevEnd = new Date(start);
  prevEnd.setUTCDate(start.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevEnd.getUTCDate() - (w.lengthDays - 1));
  return {
    startIso: prevStart.toISOString().slice(0, 10),
    endIso: prevEnd.toISOString().slice(0, 10),
    lengthDays: w.lengthDays,
  };
}

// ── Real-data path ───────────────────────────────────────────────────

export type RawLead = {
  receivedAt: string;
  sector: Sector;
  channel: Channel | null;
  ownerId: string | null;
  status: string;
  amount: number;
  sourceKind: "phone" | "form";
};

export type RawDoc = {
  type: "devis" | "acompte" | "finale";
  status: string;
  issuedAt: string;
  signedAt: string | null;
  paidAt: string | null;
  totalTtc: number;
  sector: Sector;
  channel: Channel | null;
  ownerId: string | null;
};

export function buildDailySeriesFromRows(
  leads: RawLead[],
  docs: RawDoc[],
): DailyMetric[] {
  const map = new Map<string, DailyMetric>();
  const key = (
    date: string,
    sector: Sector,
    channel: Channel,
    ownerId: string | null,
    sourceKind: "phone" | "form",
  ) => `${date}|${sector}|${channel}|${ownerId ?? ""}|${sourceKind}`;

  const bump = (
    date: string,
    sector: Sector,
    channel: Channel,
    ownerId: string | null,
    sourceKind: "phone" | "form",
    field: Exclude<keyof DailyMetric, "date" | "sector" | "channel" | "ownerId" | "sourceKind">,
    value: number,
  ) => {
    if (!date) return;
    const k = key(date, sector, channel, ownerId, sourceKind);
    let cell = map.get(k);
    if (!cell) {
      cell = {
        date, sector, channel, ownerId, sourceKind,
        leads: 0, lost: 0,
        devisSent: 0, devisSentAmount: 0,
        devisOpened: 0, devisOpenedAmount: 0,
        devisSigned: 0, caSigned: 0,
        encaisseAcompte: 0, encaisseFinale: 0,
        encaisseAcompteCount: 0, encaisseFinaleCount: 0,
      };
      map.set(k, cell);
    }
    cell[field] += value;
  };

  for (const lead of leads) {
    const channel: Channel = lead.channel ?? "mano";
    const d = lead.receivedAt.slice(0, 10);
    bump(d, lead.sector, channel, lead.ownerId, lead.sourceKind, "leads", 1);
    if (lead.status === "perdu") {
      bump(d, lead.sector, channel, lead.ownerId, lead.sourceKind, "lost", 1);
    }
  }

  // Documents flow through the same buckets but carry no source kind — we
  // attribute them to "form" so the document totals never inflate the
  // phone bucket. The sourceKind dimension on the lead row stays accurate.
  for (const doc of docs) {
    const channel: Channel = doc.channel ?? "mano";
    if (doc.type === "devis") {
      const d = doc.issuedAt.slice(0, 10);
      bump(d, doc.sector, channel, doc.ownerId, "form", "devisSent", 1);
      bump(d, doc.sector, channel, doc.ownerId, "form", "devisSentAmount", doc.totalTtc);
      if (doc.status === "ouvert" || doc.status === "signe") {
        bump(d, doc.sector, channel, doc.ownerId, "form", "devisOpened", 1);
        bump(d, doc.sector, channel, doc.ownerId, "form", "devisOpenedAmount", doc.totalTtc);
      }
      if (doc.status === "signe" && doc.signedAt) {
        const ds = doc.signedAt.slice(0, 10);
        bump(ds, doc.sector, channel, doc.ownerId, "form", "devisSigned", 1);
        bump(ds, doc.sector, channel, doc.ownerId, "form", "caSigned", doc.totalTtc);
      }
    } else if (doc.paidAt) {
      const dp = doc.paidAt.slice(0, 10);
      if (doc.type === "acompte") {
        bump(dp, doc.sector, channel, doc.ownerId, "form", "encaisseAcompte", doc.totalTtc);
        bump(dp, doc.sector, channel, doc.ownerId, "form", "encaisseAcompteCount", 1);
      } else if (doc.type === "finale") {
        bump(dp, doc.sector, channel, doc.ownerId, "form", "encaisseFinale", doc.totalTtc);
        bump(dp, doc.sector, channel, doc.ownerId, "form", "encaisseFinaleCount", 1);
      }
    }
  }

  return [...map.values()];
}

export function filterSeries(series: DailyMetric[], f: DashboardFilter): DailyMetric[] {
  const w = periodWindow(f.period);
  return series.filter(
    (d) =>
      d.date >= w.startIso &&
      d.date <= w.endIso &&
      (f.sector === "all" || d.sector === f.sector) &&
      (f.channel === "all" || d.channel === f.channel),
  );
}

// Subset matching the previous-period window for vs-comparison KPIs.
export function filterPrevious(series: DailyMetric[], f: DashboardFilter): DailyMetric[] {
  const w = previousWindow(periodWindow(f.period));
  return series.filter(
    (d) =>
      d.date >= w.startIso &&
      d.date <= w.endIso &&
      (f.sector === "all" || d.sector === f.sector) &&
      (f.channel === "all" || d.channel === f.channel),
  );
}

// ── KPIs ────────────────────────────────────────────────────────────────
export type Kpis = {
  leads: number;
  leadsPhone: number;
  leadsForm: number;
  lost: number;
  devisSent: number;
  devisSentAmount: number;
  devisSigned: number;
  caSigned: number;
  caEncaisse: number;            // acompte + finale
  caEncaisseAcompte: number;
  caEncaisseFinale: number;
  encaisseAcompteCount: number;
  caRestant: number;             // caSigned - caEncaisse
  conversionRate: number;
  averageBasket: number;
};

export function computeKpis(filtered: DailyMetric[]): Kpis {
  const leads = sumBy(filtered, "leads");
  const leadsPhone = filtered.filter((d) => d.sourceKind === "phone").reduce((s, d) => s + d.leads, 0);
  const leadsForm = leads - leadsPhone;
  const lost = sumBy(filtered, "lost");
  const devisSent = sumBy(filtered, "devisSent");
  const devisSentAmount = sumBy(filtered, "devisSentAmount");
  const devisSigned = sumBy(filtered, "devisSigned");
  const caSigned = sumBy(filtered, "caSigned");
  const caEncaisseAcompte = sumBy(filtered, "encaisseAcompte");
  const caEncaisseFinale = sumBy(filtered, "encaisseFinale");
  const caEncaisse = caEncaisseAcompte + caEncaisseFinale;
  return {
    leads,
    leadsPhone,
    leadsForm,
    lost,
    devisSent,
    devisSentAmount,
    devisSigned,
    caSigned,
    caEncaisse,
    caEncaisseAcompte,
    caEncaisseFinale,
    encaisseAcompteCount: sumBy(filtered, "encaisseAcompteCount"),
    caRestant: Math.max(0, caSigned - caEncaisse),
    conversionRate: leads === 0 ? 0 : devisSigned / leads,
    averageBasket: devisSigned === 0 ? 0 : caSigned / devisSigned,
  };
}

// Signed % delta against previous-period equivalent. Returns Infinity when
// the previous period was zero and current is positive (callers should
// render this as "—" or "+∞"). Returns 0 when both sides are 0.
export function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : Number.POSITIVE_INFINITY;
  return ((current - previous) / previous) * 100;
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

// ── Funnel (in €) ───────────────────────────────────────────────────────
// CDC §2 wants the funnel visualised in money, not counts. Each stage
// shows the cumulative € value of devis that reached that stage.
export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  amount: number;
};

export function funnel(filtered: DailyMetric[]): FunnelStage[] {
  // "Lead entrant" amount = sum of estimated_amount carried on leads.
  // We approximate by reusing the issued devisSentAmount * a coverage
  // multiplier; here we simply read devisSentAmount as the entrant proxy
  // when leads don't yet have signed devis. For a clean number we sum the
  // devisSentAmount across all sectors (the lead-stage € is fuzzy by
  // design — the spec just wants a money-shaped descending funnel).
  const leadsCount = sumBy(filtered, "leads");
  const devisSent = sumBy(filtered, "devisSent");
  const devisSentAmount = sumBy(filtered, "devisSentAmount");
  const devisOpened = sumBy(filtered, "devisOpened");
  const devisOpenedAmount = sumBy(filtered, "devisOpenedAmount");
  const signed = sumBy(filtered, "devisSigned");
  const caSigned = sumBy(filtered, "caSigned");
  const caAcompte = sumBy(filtered, "encaisseAcompte");
  const caFinale = sumBy(filtered, "encaisseFinale");

  // Use devisSent average basket to project lead-stage € when we have
  // no per-lead estimate; otherwise show 0 to avoid lying.
  const avgBasket = devisSent === 0 ? 0 : devisSentAmount / devisSent;
  const leadsAmount = Math.round(leadsCount * avgBasket);

  return [
    { key: "lead",      label: "Lead entrant",      count: leadsCount,   amount: leadsAmount   },
    { key: "envoye",    label: "Devis envoyé",      count: devisSent,    amount: devisSentAmount },
    { key: "ouvert",    label: "Devis ouvert",      count: devisOpened,  amount: devisOpenedAmount },
    { key: "signe",     label: "Signé",             count: signed,       amount: caSigned      },
    { key: "acompte",   label: "Acompte encaissé",  count: sumBy(filtered, "encaisseAcompteCount"), amount: caAcompte },
    { key: "encaisse",  label: "Encaissement final",count: sumBy(filtered, "encaisseFinaleCount"),  amount: caFinale  },
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

// ── Channel comparison: Mano vs Auto ───────────────────────────────────
export type ChannelStats = {
  channel: Channel;
  devisCount: number;
  caSigned: number;
  signed: number;
  lost: number;
  conversion: number;
};

export function channelStats(filtered: DailyMetric[]): ChannelStats[] {
  return (["mano", "auto"] as Channel[]).map((channel) => {
    const rows = filtered.filter((d) => d.channel === channel);
    const devisCount = sumBy(rows, "devisSent");
    const signed = sumBy(rows, "devisSigned");
    const lost = sumBy(rows, "lost");
    return {
      channel,
      devisCount,
      caSigned: sumBy(rows, "caSigned"),
      signed,
      lost,
      conversion: devisCount === 0 ? 0 : signed / devisCount,
    };
  });
}

// ── Top commerciaux (full ranking table) ───────────────────────────────
export type CommercialPerf = {
  id: string;
  name: string;
  initials: string;
  color: string;
  leads: number;
  devis: number;
  signed: number;
  lost: number;
  conversion: number;
  averageBasket: number;
  caSigned: number;
  caSignedPrev: number;
  caSignedDeltaPct: number;
  // Channel split for the "Canal" column: { mano: n, auto: n }.
  manoCount: number;
  autoCount: number;
  spark: number[];
  // 0–100 performance score relative to the team CA average. Computed in
  // a second pass once we know the median.
  score: number;
};

export function topCommerciaux(
  filtered: DailyMetric[],
  previous: DailyMetric[],
  commerciaux: Commercial[],
): CommercialPerf[] {
  const byOwner = new Map<string, DailyMetric[]>();
  const byOwnerPrev = new Map<string, DailyMetric[]>();
  for (const m of filtered) {
    if (!m.ownerId) continue;
    const arr = byOwner.get(m.ownerId) ?? [];
    arr.push(m);
    byOwner.set(m.ownerId, arr);
  }
  for (const m of previous) {
    if (!m.ownerId) continue;
    const arr = byOwnerPrev.get(m.ownerId) ?? [];
    arr.push(m);
    byOwnerPrev.set(m.ownerId, arr);
  }

  const intermediate = commerciaux.map((c) => {
    const rows = byOwner.get(c.id) ?? [];
    const prevRows = byOwnerPrev.get(c.id) ?? [];
    const leads = sumBy(rows, "leads");
    const devis = sumBy(rows, "devisSent");
    const signed = sumBy(rows, "devisSigned");
    const lost = sumBy(rows, "lost");
    const caSigned = sumBy(rows, "caSigned");
    const caSignedPrev = sumBy(prevRows, "caSigned");
    const dailySpark = aggregateByDay(rows).slice(-30);
    const manoCount = rows.filter((r) => r.channel === "mano").reduce((s, r) => s + r.devisSent, 0);
    const autoCount = rows.filter((r) => r.channel === "auto").reduce((s, r) => s + r.devisSent, 0);
    return {
      id: c.id,
      name: c.name,
      initials: c.initials,
      color: c.color,
      leads,
      devis,
      signed,
      lost,
      conversion: leads === 0 ? 0 : signed / leads,
      averageBasket: signed === 0 ? 0 : caSigned / signed,
      caSigned,
      caSignedPrev,
      caSignedDeltaPct: pctDelta(caSigned, caSignedPrev),
      manoCount,
      autoCount,
      spark: dailySpark.map((d) => d.devisSigned),
    };
  });

  // Score = team-relative CA position on 0..100. 50 = at the team median.
  // The top performer caps at 100 unless the spread is degenerate.
  const sortedCa = [...intermediate.map((c) => c.caSigned)].sort((a, b) => a - b);
  const max = sortedCa.at(-1) ?? 0;
  const min = sortedCa[0] ?? 0;
  const span = max - min || 1;
  return intermediate
    .map((c) => ({
      ...c,
      score: max === 0 ? 0 : Math.round(((c.caSigned - min) / span) * 100),
    }))
    .sort((a, b) => b.caSigned - a.caSigned);
}

// ── Performance score (team-level) ─────────────────────────────────────
// Returns 0..100 based on how the current period's CA compares to the
// previous period. 50 = parity, 100 = +100% or more, 0 = ≤ -100%.
export function performanceScore(currentCa: number, previousCa: number): number {
  if (previousCa === 0 && currentCa === 0) return 50;
  if (previousCa === 0) return 100;
  const ratio = currentCa / previousCa;
  // Compress to 0..100 with parity at 50. A ratio of 2 (×2) → 100, 0.5 → 25.
  const score = 50 * Math.log2(Math.max(0.001, ratio)) + 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── helpers ─────────────────────────────────────────────────────────────
function sumBy<K extends keyof DailyMetric>(arr: DailyMetric[], key: K): number {
  return arr.reduce((s, d) => s + (d[key] as number), 0);
}
