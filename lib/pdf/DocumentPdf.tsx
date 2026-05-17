import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { DocumentDetail } from "@/lib/documents-shared";
import { DOC_TYPE_LABEL, PAYMENT_TERMS, formatEUR } from "@/lib/leads";

// Server-side PDF for devis + factures. Helvetica is the built-in default
// — it covers Latin-1 (French accents), no font registration needed.
// React-PDF uses its own DSL: flexbox-by-default, no CSS, styles are
// plain objects. Keep the layout boring & legal-French-invoice shaped.

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 60,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1f3a",
  },
  // ── Header ─────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  entityBlock: { flexDirection: "column", maxWidth: 280 },
  entityName: { fontSize: 14, fontWeight: 700 },
  entityForm: { fontSize: 8, color: "#666e8a", marginTop: 2 },
  entityLine: { fontSize: 8, color: "#3b4467", marginTop: 1 },
  docMeta: { flexDirection: "column", alignItems: "flex-end" },
  docTypeLabel: {
    fontSize: 16,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  docNum: { fontSize: 11, marginTop: 4 },
  docDate: { fontSize: 8, color: "#666e8a", marginTop: 2 },
  statusPill: {
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 3,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  // Accent stripe in the entity's brand color
  accentBar: { height: 3, marginVertical: 10, borderRadius: 1 },
  // ── To/From block ──────────────────────────────────────────────────
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  partyBox: { flexDirection: "column", maxWidth: 240 },
  partyLabel: {
    fontSize: 8,
    color: "#666e8a",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  partyName: { fontSize: 11, fontWeight: 700 },
  partyLine: { fontSize: 9, color: "#3b4467", marginTop: 1 },
  // ── Lines table ────────────────────────────────────────────────────
  table: { marginTop: 14 },
  tableHead: {
    flexDirection: "row",
    paddingBottom: 4,
    borderBottom: "1pt solid #1a1f3a",
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottom: "0.5pt solid #d8dbe8",
  },
  colDesc: { flex: 5, paddingRight: 6 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1, textAlign: "center", color: "#666e8a" },
  colUnitPrice: { flex: 1.4, textAlign: "right" },
  colVat: { flex: 0.8, textAlign: "right" },
  colTotal: { flex: 1.6, textAlign: "right" },
  // ── Totals box ─────────────────────────────────────────────────────
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totalsBox: { width: 220, flexDirection: "column" },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalLabel: { color: "#3b4467" },
  totalValue: { textAlign: "right" },
  totalTtcLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    marginTop: 4,
    borderTop: "1pt solid #1a1f3a",
    borderBottom: "1pt solid #1a1f3a",
    fontWeight: 700,
    fontSize: 11,
  },
  acompteLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    marginTop: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    fontWeight: 700,
  },
  // ── Notes + footer ─────────────────────────────────────────────────
  notesBlock: {
    marginTop: 18,
    padding: 10,
    backgroundColor: "#f4f5fa",
    borderRadius: 3,
    fontSize: 9,
    color: "#3b4467",
  },
  notesLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: "#666e8a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  paymentBlock: { marginTop: 14, fontSize: 9 },
  paymentLabel: { fontWeight: 700, color: "#1a1f3a" },
  paymentLine: { color: "#3b4467", marginTop: 2 },
  legalFooter: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#666e8a",
    textAlign: "center",
    paddingTop: 6,
    borderTop: "0.5pt solid #d8dbe8",
  },
});

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

type Props = { detail: DocumentDetail };

export default function DocumentPdf({ detail }: Props) {
  const { doc, entity, lead } = detail;
  const isInvoice = doc.type !== "devis";
  const isPaid = doc.status === "paye";
  const validUntil = new Date(doc.issuedAt);
  validUntil.setDate(validUntil.getDate() + 30);

  // Status pill colour — green if paid, amber if envoyé/ouvert, grey otherwise.
  const pillBg =
    doc.status === "paye" || doc.status === "signe"
      ? "#0f9d58"
      : doc.status === "envoye" || doc.status === "ouvert"
        ? "#f4a623"
        : "#888fa8";
  const pillFg = "#ffffff";

  const vatByRate = aggregateVat(doc.lines);
  const paymentTerm = PAYMENT_TERMS[doc.paymentTermSlug];

  return (
    <Document title={`${doc.num} — ${lead.client}`} author={entity.legalName}>
      <Page size="A4" style={styles.page}>
        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.entityBlock}>
            <Text style={styles.entityName}>{entity.legalName}</Text>
            <Text style={styles.entityForm}>
              {entity.legalForm} · SIRET {entity.siret} · APE {entity.apeCode}
            </Text>
            <Text style={styles.entityLine}>
              {entity.addressLine}, {entity.postalCode} {entity.city}
            </Text>
            <Text style={styles.entityLine}>TVA {entity.vatNumber}</Text>
          </View>
          <View style={styles.docMeta}>
            <Text style={styles.docTypeLabel}>{DOC_TYPE_LABEL[doc.type]}</Text>
            <Text style={styles.docNum}>{doc.num}</Text>
            <Text style={styles.docDate}>
              Émis le {DATE_FMT.format(new Date(doc.issuedAt))}
            </Text>
            {isPaid && (
              <Text style={{ ...styles.statusPill, backgroundColor: pillBg, color: pillFg }}>
                Payée
              </Text>
            )}
            {!isPaid && doc.status === "signe" && (
              <Text style={{ ...styles.statusPill, backgroundColor: pillBg, color: pillFg }}>
                Signé
              </Text>
            )}
          </View>
        </View>

        <View style={{ ...styles.accentBar, backgroundColor: entity.color }} />

        {/* ── Parties ───────────────────────────────────────────── */}
        <View style={styles.parties}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Émis par</Text>
            <Text style={styles.partyName}>{entity.legalName}</Text>
            <Text style={styles.partyLine}>{entity.contactEmail}</Text>
            <Text style={styles.partyLine}>{entity.contactPhone}</Text>
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Destinataire</Text>
            <Text style={styles.partyName}>{lead.client}</Text>
            {lead.address && <Text style={styles.partyLine}>{lead.address}</Text>}
            <Text style={styles.partyLine}>
              {lead.postalCode} {lead.city}
            </Text>
            {lead.email && <Text style={styles.partyLine}>{lead.email}</Text>}
            {lead.phone && <Text style={styles.partyLine}>{lead.phone}</Text>}
            {lead.siret && <Text style={styles.partyLine}>SIRET {lead.siret}</Text>}
          </View>
        </View>

        {/* ── Validity / due date ───────────────────────────────── */}
        <Text style={styles.entityLine}>
          {doc.type === "devis"
            ? `Devis valable jusqu'au ${DATE_FMT.format(validUntil)}`
            : `Échéance : ${DATE_FMT.format(validUntil)}`}
        </Text>

        {/* ── Lines table ───────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qté</Text>
            <Text style={styles.colUnit}>Unité</Text>
            <Text style={styles.colUnitPrice}>P.U. HT</Text>
            <Text style={styles.colVat}>TVA</Text>
            <Text style={styles.colTotal}>Total HT</Text>
          </View>
          {doc.lines.map((line) => (
            <View key={line.id} style={styles.tableRow}>
              <Text style={styles.colDesc}>{line.label}</Text>
              <Text style={styles.colQty}>{formatQty(line.quantity)}</Text>
              <Text style={styles.colUnit}>{line.unit}</Text>
              <Text style={styles.colUnitPrice}>{formatEUR(line.unitPriceHt)}</Text>
              <Text style={styles.colVat}>{line.vatRate}%</Text>
              <Text style={styles.colTotal}>{formatEUR(line.totalHt)}</Text>
            </View>
          ))}
        </View>

        {/* ── Totals ────────────────────────────────────────────── */}
        <View style={styles.totalsRow}>
          <View style={styles.totalsBox}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Total HT</Text>
              <Text style={styles.totalValue}>{formatEUR(doc.totalHt)}</Text>
            </View>
            {[...vatByRate.entries()].sort(([a], [b]) => a - b).map(([rate, amount]) => (
              <View key={rate} style={styles.totalLine}>
                <Text style={styles.totalLabel}>TVA {rate}%</Text>
                <Text style={styles.totalValue}>{formatEUR(amount)}</Text>
              </View>
            ))}
            <View style={styles.totalTtcLine}>
              <Text>Total TTC</Text>
              <Text>{formatEUR(doc.totalTtc)}</Text>
            </View>
            {doc.type === "devis" && doc.acomptePct && doc.acompteAmount && (
              <>
                <View style={{ ...styles.acompteLine, backgroundColor: entity.color, color: "#ffffff" }}>
                  <Text>Acompte ({doc.acomptePct}%)</Text>
                  <Text>{formatEUR(doc.acompteAmount)}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>Solde dû à la livraison</Text>
                  <Text style={styles.totalValue}>
                    {formatEUR(doc.totalTtc - doc.acompteAmount)}
                  </Text>
                </View>
              </>
            )}
            {doc.type === "finale" && doc.acomptePct != null && (
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>Acompte déjà versé</Text>
                <Text style={styles.totalValue}>
                  −{formatEUR(doc.totalTtc * (doc.acomptePct / 100))}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Notes ─────────────────────────────────────────────── */}
        {doc.notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text>{doc.notes}</Text>
          </View>
        )}

        {/* ── Payment terms + IBAN ──────────────────────────────── */}
        <View style={styles.paymentBlock}>
          <Text style={styles.paymentLabel}>
            Conditions de paiement : {paymentTerm.label}
          </Text>
          <Text style={styles.paymentLine}>
            Coordonnées bancaires — IBAN {entity.iban} · BIC {entity.bic}
          </Text>
          {doc.relatedDevisNum && (
            <Text style={styles.paymentLine}>
              Document lié : devis {doc.relatedDevisNum}
            </Text>
          )}
        </View>

        {/* ── Legal footer ──────────────────────────────────────── */}
        <Text style={styles.legalFooter} fixed>
          {entity.legalName} · {entity.legalForm} · SIRET {entity.siret} ·{" "}
          {isInvoice
            ? "TVA acquittée sur les encaissements"
            : "Devis non contractuel jusqu'à signature"}
          {entity.legalMentions ? ` · ${entity.legalMentions}` : ""}
        </Text>
      </Page>
    </Document>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function aggregateVat(lines: DocumentDetail["doc"]["lines"]): Map<number, number> {
  const map = new Map<number, number>();
  for (const l of lines) {
    const vat = (l.totalHt * l.vatRate) / 100;
    map.set(l.vatRate, (map.get(l.vatRate) ?? 0) + vat);
  }
  return map;
}

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(".", ",");
}
