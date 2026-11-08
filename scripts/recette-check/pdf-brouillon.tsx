// D28 — le PDF d'une facture BROUILLON le dit ; celui d'une facture émise, non.
//
// Niveau de preuve : le document est RÉELLEMENT RENDU par @react-pdf (le même
// moteur que la production) — un style invalide ferait échouer ce contrôle.
// Le texte n'est pas extrait du PDF (polices sous-ensemblées) : la présence de
// la mention est vérifiée dans l'arbre que le moteur rend.

import { renderToBuffer } from "@react-pdf/renderer";
import DocumentPdf from "@/lib/pdf/DocumentPdf";
import type { DocumentDetail } from "@/lib/documents-shared";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}

// Tout le texte d'un arbre React, composants fonctionnels déroulés.
function textes(n: unknown): string[] {
  if (n === null || n === undefined || typeof n === "boolean") return [];
  if (typeof n === "string" || typeof n === "number") return [String(n)];
  if (Array.isArray(n)) return n.flatMap(textes);
  const el = n as { type?: unknown; props?: { children?: unknown } };
  if (typeof el.type === "function") {
    return textes((el.type as (p: unknown) => unknown)(el.props));
  }
  return textes(el.props?.children);
}

function fixture(status: "brouillon" | "envoye", num: string): DocumentDetail {
  return {
    doc: {
      id: "00000000-0000-4000-8000-000000000001",
      type: "finale",
      num,
      status,
      issuedAt: "2026-11-09T10:00:00Z",
      totalTtc: 1200, totalHt: 1000, totalVat: 200,
      lines: [{ label: "Prestation de test", quantity: 1, unit: "forfait", unitPriceHt: 1000, vatRate: 20, discountPct: 0, totalHt: 1000 }],
      paymentTermSlug: "comptant",
      leadId: "00000000-0000-4000-8000-000000000002",
    },
    entity: {
      id: "e", legalName: "SOCIÉTÉ FICTIVE", legalForm: "SAS", siret: "00000000000000",
      address: "1 rue du Test", postalCode: "75000", city: "Paris", country: "FR",
    },
    lead: {
      id: "l", shortId: "L-0001", client: "Client fictif", sector: "demenagement",
      email: "client@example.invalid", phone: "+33100000000", city: "Paris",
    },
  } as unknown as DocumentDetail;
}

const MENTION = "BROUILLON — FACTURE NON ÉMISE";

async function main() {
  console.log("\n1. Facture BROUILLON");
  const b = fixture("brouillon", "BROUILLON-8F3A2C91B0D4");
  const tb = textes(DocumentPdf({ detail: b })).join(" ");
  vrai("la mention « non émise, sans valeur » est rendue", tb.includes(MENTION));
  vrai("le numéro provisoire n'apparaît JAMAIS", !tb.includes("BROUILLON-8F3A2C91B0D4"));
  vrai("à sa place : « Brouillon — non numérotée »", tb.includes("Brouillon — non numérotée"));
  const pdfB = await renderToBuffer(DocumentPdf({ detail: b }));
  vrai("le PDF se rend réellement (moteur de production)", pdfB.length > 1000 && pdfB.subarray(0, 5).toString() === "%PDF-");

  console.log("\n2. Facture ÉMISE");
  const e = fixture("envoye", "FAC-2026-0042");
  const te = textes(DocumentPdf({ detail: e })).join(" ");
  vrai("aucune mention de brouillon", !te.includes(MENTION));
  vrai("son numéro définitif est imprimé", te.includes("FAC-2026-0042"));
  const pdfE = await renderToBuffer(DocumentPdf({ detail: e }));
  vrai("le PDF se rend réellement", pdfE.subarray(0, 5).toString() === "%PDF-");

  if (ko > 0) {
    console.log(`\n  ${ko} échec(s)`);
    process.exit(1);
  }
  console.log("\n  tout passe");
}

main().catch((err) => {
  console.error(`  ECHEC rendu : ${(err as Error).message}`);
  process.exit(1);
});
