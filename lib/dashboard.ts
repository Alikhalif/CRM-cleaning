// Pure dashboard aggregators. No data fetching, no mock data — the real
// row set is built server-side in lib/dashboard-server.ts and passed in
// as DailyMetric[]. These functions filter / roll up / score.

import type { Commercial, Sector } from "./leads";

export type Channel = "mano" | "auto";
export type Period = "7d" | "30d" | "90d";

export type DashboardFilter = {
  period: Period;
  sector: Sector | "all";
  channel: Channel | "all";
};

// A single bucket of activity: one date × sector × channel × owner. Buckets
// roll up by summation across whichever dimensions a given aggregator cares
// about. ownerId is nullable because some legacy rows (or unattributed leads)
// have no owner; top-commercial rankings exclude them, but they still count
// toward team-wide KPIs.
export type DailyMetric = {
  date: string; // YYYY-MM-DD UTC
  sector: Sector;
  channel: Channel;
  ownerId: string | null;
  leads: number;
  devisSent: number;
  devisSentAmount: number; // EUR — sum of total_ttc of the devis sent that day
  devisOpened: number; // count of devis that reached status ≥ "ouvert"
  devisSigned: number;
  caSigned: number; // EUR
  encaisse: number; // EUR (acomptes + finales paid)
  encaisseCount: number; // count of paid acompte/finale events (funnel stage)
};

const SECTORS: Sector[] = ["urgence", "nettoyage", "enr", "renovation"];

// "Today" pinned at module load so filterSeries is deterministic within a
// page render (the cutoff doesn't drift between memo recomputes).
const TODAY = (() => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
})();

// ── Real-data path ───────────────────────────────────────────────────
// Buckets a flat row set (leads + their documents) into DailyMetric[].
// Pure — server fetches live in lib/dashboard-server.ts.

export type RawLead = {
  receivedAt: string;
  sector: Sector;
  channel: Channel | null;
  ownerId: string | null;
  status: string;
  amount: number;
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
  const key = (date: string, sector: Sector, channel: Channel, ownerId: string | null) =>
    `${date}|${sector}|${channel}|${ownerId ?? ""}`;
  const bump = (
    date: string,
    sector: Sector,
    channel: Channel,
    ownerId: string | null,
    field: Exclude<keyof DailyMetric, "date" | "sector" | "channel" | "ownerId">,
    value: number,
  ) => {
    if (!date) return;
    const k = key(date, sector, channel, ownerId);
    let cell = map.get(k);
    if (!cell) {
      cell = {
        date, sector, channel, ownerId,
        leads: 0, devisSent: 0, devisSentAmount: 0,
        devisOpened: 0, devisSigned: 0,
        caSigned: 0, encaisse: 0, encaisseCount: 0,
      };
      map.set(k, cell);
    }
    cell[field] += value;
  };

  for (const lead of leads) {
    const channel: Channel = lead.channel ?? "mano";
    bump(lead.receivedAt.slice(0, 10), lead.sector, channel, lead.ownerId, "leads", 1);
  }

  for (const doc of docs) {
    const channel: Channel = doc.channel ?? "mano";
    if (doc.type === "devis") {
      bump(doc.issuedAt.slice(0, 10), doc.sector, channel, doc.ownerId, "devisSent", 1);
      bump(doc.issuedAt.slice(0, 10), doc.sector, channel, doc.ownerId, "devisSentAmount", doc.totalTtc);
      // "Opened" is monotone: once a devis reaches ouvert/signe, it counts.
      // Bucket on issuedAt so the funnel reads as a snapshot of the cohort
      // issued in the window, not as separate timelines per stage.
      if (doc.status === "ouvert" || doc.status === "signe") {
        bump(doc.issuedAt.slice(0, 10), doc.sector, channel, doc.ownerId, "devisOpened", 1);
      }
      if (doc.status === "signe" && doc.signedAt) {
        const d = doc.signedAt.slice(0, 10);
        bump(d, doc.sector, channel, doc.ownerId, "devisSigned", 1);
        bump(d, doc.sector, channel, doc.ownerId, "caSigned", doc.totalTtc);
      }
    } else if ((doc.type === "acompte" || doc.type === "finale") && doc.paidAt) {
      bump(doc.paidAt.slice(0, 10), doc.sector, channel, doc.ownerId, "encaisse", doc.totalTtc);
      bump(doc.paidAt.slice(0, 10), doc.sector, channel, doc.ownerId, "encaisseCount", 1);
    }
  }

  return [...map.values()];
}

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
  const devisSentAmount = sumBy(filtered, "devisSentAmount");
  const devisSigned = sumBy(filtered, "devisSigned");
  const caSigned = sumBy(filtered, "caSigned");
  const caEncaisse = sumBy(filtered, "encaisse");
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

// All five stages now read from real DB state. "Devis ouverts" counts devis
// whose status reached ouvert or beyond (monotone — once opened, always
// counted). "Encaissés" counts paid acompte/finale events; one signed devis
// can produce two encaissés (acompte then finale) so this stage can exceed
// "Signés" when the data window catches both payments.
export function funnel(filtered: DailyMetric[]): FunnelStage[] {
  return [
    { label: "Leads",         count: sumBy(filtered, "leads") },
    { label: "Devis envoyés", count: sumBy(filtered, "devisSent") },
    { label: "Devis ouverts", count: sumBy(filtered, "devisOpened") },
    { label: "Signés",        count: sumBy(filtered, "devisSigned") },
    { label: "Encaissés",     count: sumBy(filtered, "encaisseCount") },
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

// Aggregate the filtered series by actual owner_id. Commerciaux without any
// activity in the filter window still appear in the ranking with zeroed
// counters — easier to spot inactive sales than to silently hide them.
export function topCommerciaux(
  filtered: DailyMetric[],
  commerciaux: Commercial[],
): CommercialPerf[] {
  const byOwner = new Map<string, DailyMetric[]>();
  for (const m of filtered) {
    if (!m.ownerId) continue;
    const arr = byOwner.get(m.ownerId) ?? [];
    arr.push(m);
    byOwner.set(m.ownerId, arr);
  }

  return commerciaux
    .map((c) => {
      const rows = byOwner.get(c.id) ?? [];
      const leads = sumBy(rows, "leads");
      const signed = sumBy(rows, "devisSigned");
      const caSigned = sumBy(rows, "caSigned");
      const dailySpark = aggregateByDay(rows).slice(-30);
      return {
        id: c.id,
        name: c.name,
        initials: c.initials,
        color: c.color,
        leads,
        signed,
        caSigned,
        conversion: leads === 0 ? 0 : signed / leads,
        spark: dailySpark.map((d) => d.devisSigned),
      };
    })
    .sort((a, b) => b.caSigned - a.caSigned);
}

// ── helpers ─────────────────────────────────────────────────────────────
function sumBy<K extends keyof DailyMetric>(arr: DailyMetric[], key: K): number {
  return arr.reduce((s, d) => s + (d[key] as number), 0);
}
