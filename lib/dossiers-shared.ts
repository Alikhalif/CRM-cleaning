// Pure types + computations shared between the dossiers server fetcher and
// the Planification client component. No data, no I/O, no "server-only".

import type {
  CrmDocument,
  Dossier,
  Lead,
  Technician,
} from "./leads";

// Denormalised dossier for the list view — joins each dossier to its lead,
// the assigned technician (if any), and the related devis/acompte/finale
// documents so the table doesn't need per-row lookups.
export type DossierWithContext = {
  dossier: Dossier;
  lead: Lead;
  technician?: Technician;
  devisDoc?: CrmDocument;
  acompteDoc?: CrmDocument;
  finaleDoc?: CrmDocument;
};

export type PlanificationKpis = {
  byStatus: Record<Dossier["status"], number>;
  acompteOutstanding: { count: number; amountTtc: number };
  interventionsThisWeek: number;
};

export function computePlanificationKpis(rows: DossierWithContext[]): PlanificationKpis {
  const byStatus: Record<Dossier["status"], number> = {
    a_planifier: 0,
    planifie: 0,
    finalise: 0,
    solde: 0,
  };
  for (const r of rows) byStatus[r.dossier.status]++;

  const outstanding = rows.filter(
    (r): r is DossierWithContext & { acompteDoc: CrmDocument } =>
      r.acompteDoc !== undefined &&
      r.acompteDoc.status !== "paye" &&
      (r.dossier.paymentStatus === "acompte_non_paye" ||
        r.dossier.paymentStatus === "en_attente"),
  );

  const now = Date.now();
  const weekFromNow = now + 7 * 24 * 3_600_000;
  const interventionsThisWeek = rows.filter((r) => {
    if (!r.dossier.plannedAt || r.dossier.status === "solde") return false;
    const t = +new Date(r.dossier.plannedAt);
    return t >= now && t <= weekFromNow;
  }).length;

  return {
    byStatus,
    acompteOutstanding: {
      count: outstanding.length,
      amountTtc: outstanding.reduce((s, r) => s + r.acompteDoc.totalTtc, 0),
    },
    interventionsThisWeek,
  };
}

// Surface unpaid-acompte rows for the "Acomptes à encaisser" encart (CDC §4.7).
export function getOutstandingAcomptes(rows: DossierWithContext[]): DossierWithContext[] {
  return rows.filter(
    (r) =>
      r.acompteDoc &&
      r.acompteDoc.status !== "paye" &&
      r.dossier.paymentStatus !== "solde",
  );
}
