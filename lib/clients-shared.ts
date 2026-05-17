// Pure client-related types + computations shared between server fetchers
// (clients-server.ts) and any client-side component. No data, no I/O.

import type { Client, CrmDocument } from "./leads";

export type ClientStats = {
  documents: CrmDocument[];
  caEncaisse: number;
  caSigne: number;
  lastActivityAt: string;
};

// Pure logic — pass the docs already filtered to this client's source lead.
// The CA figures only count paid acomptes/finales (encaisse) and signed
// devis (signe); unpaid invoices and unsigned devis are excluded by design
// because they don't represent committed revenue.
export function computeClientStats(client: Client, leadDocs: CrmDocument[]): ClientStats {
  if (!client.sourceLeadId) {
    return {
      documents: [],
      caEncaisse: 0,
      caSigne: 0,
      lastActivityAt: client.createdAt,
    };
  }
  const documents = [...leadDocs].sort(
    (a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt),
  );
  const caEncaisse = documents
    .filter((d) => (d.type === "acompte" || d.type === "finale") && d.status === "paye")
    .reduce((s, d) => s + d.totalTtc, 0);
  const caSigne = documents
    .filter((d) => d.type === "devis" && d.status === "signe")
    .reduce((s, d) => s + d.totalTtc, 0);
  const lastActivityAt = documents.reduce((max, d) => {
    const candidate = d.paidAt ?? d.signedAt ?? d.issuedAt;
    return candidate > max ? candidate : max;
  }, client.createdAt);
  return { documents, caEncaisse, caSigne, lastActivityAt };
}
