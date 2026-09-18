// Pure types + computations shared between server fetchers (documents-server.ts)
// and client components (Comptabilité, DocumentView). No data, no I/O, no
// "server-only" guard — safe to import from either runtime.

import type {
  CrmDocument,
  DocumentLine,
  Lead,
  LegalEntity,
  PaymentTermSlug,
} from "./leads";

// Denormalised row for the Comptabilité tables. Joins each document to its
// originating lead and issuing entity so the UI can render Client + Entity
// cells without per-row lookups. totalHt = le HT réellement stocké sur le
// document (exact, TVA mixte incluse) ; repli sur un strip TVA-secteur
// seulement pour d'anciens docs sans total_ht (voir documents-server.ts).
export type DocumentWithContext = {
  doc: CrmDocument;
  lead: Lead;
  entity: LegalEntity;
  totalHt: number;
  // Dossier-derived info — present when the lead has a dossier (i.e. it's
  // signed). Lets Comptabilité surface the assigned technician + intervention
  // status next to each devis/facture row.
  dossier?: {
    technicianId?: string;
    technicianName?: string;
    technicianInitials?: string;
    technicianColor?: string;
    status: "a_planifier" | "planifie" | "finalise" | "solde";
    plannedAt?: string;
  };
};

// Detail-view shape — adds line items and computed totals on top of CrmDocument.
export type DocumentDetail = {
  doc: CrmDocument & {
    lines: DocumentLine[];
    totalHt: number;
    totalVat: number;
    paymentTermSlug: PaymentTermSlug;
    notes?: string;
    relatedDevisNum?: string;
  };
  entity: LegalEntity;
  lead: Lead;
};

// CDC §4.8 KPI row. Pending = Envoyé/Ouvert/Brouillon/En retard for invoices;
// "CA encaissé (mois)" = HT des acompte + finale payés dans le mois FR courant
// (fuseau Europe/Paris ; des vues matérialisées SQL remplaceront ceci).
export type AccountingKpis = {
  devisPending: { count: number; amountTtc: number };
  acompteOutstanding: { count: number; amountTtc: number };
  finaleOutstanding: { count: number; amountTtc: number };
  caThisMonth: number;
};

// Année-mois dans le fuseau Europe/Paris (et non l'heure serveur / UTC), pour
// que le « CA du mois » range chaque paiement dans le bon mois calendaire FR,
// y compris en fin de mois. formatToParts est robuste quel que soit le locale.
const PARIS_YM = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
});
function parisYearMonth(d: Date): string {
  const parts = PARIS_YM.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  return `${y}-${m}`;
}

export function computeAccountingKpis(rows: DocumentWithContext[]): AccountingKpis {
  const ym = parisYearMonth(new Date());

  const devisPending = rows.filter(
    (r) => r.doc.type === "devis" && (r.doc.status === "envoye" || r.doc.status === "ouvert"),
  );
  const acompteOut = rows.filter(
    (r) =>
      r.doc.type === "acompte" &&
      (r.doc.status === "envoye" || r.doc.status === "brouillon" || r.doc.status === "retard"),
  );
  const finaleOut = rows.filter(
    (r) =>
      r.doc.type === "finale" &&
      (r.doc.status === "envoye" || r.doc.status === "brouillon" || r.doc.status === "retard"),
  );
  // « CA encaissé (mois) » = chiffre d'affaires HT (convention comptable FR),
  // pas TTC. On somme le HT réel (r.totalHt, exact depuis A10) des acomptes +
  // factures finales payés dont le paiement tombe dans le mois FR courant.
  const caThisMonth = rows
    .filter(
      (r) =>
        (r.doc.type === "acompte" || r.doc.type === "finale") &&
        r.doc.status === "paye" &&
        !!r.doc.paidAt &&
        parisYearMonth(new Date(r.doc.paidAt)) === ym,
    )
    .reduce((s, r) => s + r.totalHt, 0);

  return {
    devisPending: {
      count: devisPending.length,
      amountTtc: devisPending.reduce((s, r) => s + r.doc.totalTtc, 0),
    },
    acompteOutstanding: {
      count: acompteOut.length,
      amountTtc: acompteOut.reduce((s, r) => s + r.doc.totalTtc, 0),
    },
    finaleOutstanding: {
      count: finaleOut.length,
      amountTtc: finaleOut.reduce((s, r) => s + r.doc.totalTtc, 0),
    },
    caThisMonth,
  };
}
