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
// cells without per-row lookups. totalHt is derived from totalTtc by stripping
// the sector's default VAT rate; good enough for list views and matches
// what the detail-view returns to-the-cent.
export type DocumentWithContext = {
  doc: CrmDocument;
  lead: Lead;
  entity: LegalEntity;
  totalHt: number;
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
// "CA encaissé (mois)" sums acompte + finale paidAt in the current calendar
// month (Europe/Paris is fine; SQL materialised views will replace this).
export type AccountingKpis = {
  devisPending: { count: number; amountTtc: number };
  acompteOutstanding: { count: number; amountTtc: number };
  finaleOutstanding: { count: number; amountTtc: number };
  caThisMonth: number;
};

export function computeAccountingKpis(rows: DocumentWithContext[]): AccountingKpis {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

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
  const caThisMonth = rows
    .filter(
      (r) =>
        (r.doc.type === "acompte" || r.doc.type === "finale") &&
        r.doc.status === "paye" &&
        r.doc.paidAt?.startsWith(ym),
    )
    .reduce((s, r) => s + r.doc.totalTtc, 0);

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
