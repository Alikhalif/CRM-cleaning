// Pure lead-related helpers shared between server fetchers and client
// components. No data, no I/O, no "server-only" guard.

import type { CrmDocument, Lead, TimelineEvent } from "./leads";

function sourceLabel(s: Lead["source"]): string {
  return {
    "google-ads": "Google Ads",
    "meta-ads": "Meta Ads",
    "site-web": "Site web",
    telephone: "Téléphone",
    recommandation: "Recommandation",
  }[s];
}

// Build a reverse-chronological activity timeline for a lead from its
// documents + status. The lead-detail page renders this directly.
export function buildTimeline(lead: Lead, docs: CrmDocument[]): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: `${lead.id}_received`,
      kind: "received",
      at: lead.receivedAt,
      label: "Lead reçu",
      sublabel: `via ${sourceLabel(lead.source)}`,
    },
  ];

  for (const doc of docs) {
    if (doc.type === "devis") {
      events.push({
        id: `${doc.id}_issued`,
        kind: "doc-issued",
        at: doc.issuedAt,
        label: `Devis ${doc.num} émis`,
      });
      if (doc.signedAt) {
        events.push({
          id: `${doc.id}_signed`,
          kind: "doc-signed",
          at: doc.signedAt,
          label: `Devis ${doc.num} signé`,
        });
      }
    } else if (doc.type === "acompte") {
      events.push({
        id: `${doc.id}_issued`,
        kind: "doc-issued",
        at: doc.issuedAt,
        label: `Facture d'acompte ${doc.num} émise`,
      });
      if (doc.paidAt) {
        events.push({
          id: `${doc.id}_paid`,
          kind: "payment",
          at: doc.paidAt,
          label: `Acompte ${doc.num} encaissé`,
        });
      }
    } else if (doc.type === "finale") {
      events.push({
        id: `${doc.id}_issued`,
        kind: "doc-issued",
        at: doc.issuedAt,
        label: `Facture finale ${doc.num} émise`,
      });
      if (doc.paidAt) {
        events.push({
          id: `${doc.id}_paid`,
          kind: "payment",
          at: doc.paidAt,
          label: `Facture finale ${doc.num} encaissée`,
        });
      }
    }
  }

  if (lead.status === "perdu") {
    events.push({
      id: `${lead.id}_lost`,
      kind: "status",
      at: lead.lastActionAt,
      label: "Lead marqué perdu",
      sublabel: lead.lostReason,
    });
  }

  // Most recent first.
  events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return events;
}
