import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { DocumentDetail } from "@/lib/documents-shared";
import { DOC_TYPE_LABEL, PAYMENT_TERMS, formatEUR, type Sector } from "@/lib/leads";
import DevisNettoyagePdf from "./DevisNettoyagePdf";

// Server-side PDF for devis + factures. Two professional themes driven by the
// lead's secteur:
//   • DESIGN 1 "Propreté" (nettoyage / nettoyage difficile / urgence / enr /
//     rénovation) — airy, coloured header band, light accent tints.
//   • DESIGN 2 "Logistique" (déménagement / diogène / débarras) — bold, dark
//     header with an accent side-stripe, dark table head + totals card.
// Helvetica is the built-in default (covers French accents, no registration).

const INK = "#1a1f3a";
const DARK = "#141a33";
const MUTED = "#6b7396";
const LINE = "#dfe2ee";

// Teinte par secteur (alignée sur les tokens --sector-*).
const SECTOR_ACCENT: Record<Sector, string> = {
  urgence: "#ef4444",
  nettoyage: "#0ea5e9",
  nettoyage_difficile: "#6366f1",
  enr: "#14c890",
  renovation: "#f59e0b",
  debarras: "#8b5cf6",
  demenagement: "#ec4899",
  diogene: "#0d9488",
};

const SECTOR_TAGLINE: Record<Sector, string> = {
  urgence: "Dépannage d'urgence",
  nettoyage: "Nettoyage professionnel",
  nettoyage_difficile: "Nettoyage difficile · conditions lourdes",
  enr: "Énergies renouvelables",
  renovation: "Rénovation du bâtiment",
  debarras: "Débarras & évacuation",
  demenagement: "Déménagement",
  diogene: "Nettoyage extrême · Diogène",
};

const BOLD_SECTORS = new Set<Sector>(["demenagement", "diogene", "debarras"]);

// hex #rrggbb + alpha → rgba() string (react-pdf accepts rgba()).
function rgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingHorizontal: 38,
    paddingBottom: 60,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
  },
  entityForm: { fontSize: 7.5, marginTop: 5 },
  entityLine: { fontSize: 7.5, marginTop: 1 },
  statusPill: {
    marginTop: 7,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 3,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#ffffff",
  },
  parties: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginVertical: 14 },
  partyBox: { flex: 1, padding: 10, borderRadius: 5 },
  partyLabel: {
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    fontWeight: 700,
  },
  partyName: { fontSize: 11, fontWeight: 700 },
  partyLine: { fontSize: 9, color: "#3b4467", marginTop: 1 },
  validity: { fontSize: 8, color: MUTED, marginBottom: 4 },
  table: { marginTop: 6 },
  tableHead: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottom: `0.5pt solid ${LINE}`,
  },
  colDesc: { flex: 5, paddingRight: 6 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1, textAlign: "center", color: MUTED },
  colUnitPrice: { flex: 1.4, textAlign: "right" },
  colVat: { flex: 0.8, textAlign: "right" },
  colTotal: { flex: 1.6, textAlign: "right" },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  totalsBox: { width: 236, padding: 12, borderRadius: 6 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalLabel: { color: "#3b4467" },
  ttcLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 5,
    fontWeight: 700,
    fontSize: 12,
  },
  acompteLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 7,
    borderRadius: 3,
    fontWeight: 700,
    color: "#ffffff",
  },
  notesBlock: { marginTop: 18, padding: 10, borderRadius: 4, fontSize: 9, color: "#3b4467" },
  notesLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  paymentBlock: { marginTop: 14, fontSize: 9 },
  paymentLabel: { fontWeight: 700 },
  paymentLine: { color: "#3b4467", marginTop: 2 },
  legalFooter: {
    position: "absolute",
    bottom: 28,
    left: 38,
    right: 38,
    fontSize: 7,
    color: MUTED,
    textAlign: "center",
    paddingTop: 6,
    borderTop: `0.5pt solid ${LINE}`,
  },
});

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

type Props = { detail: DocumentDetail };

const LOGISTIQUE = new Set<Sector>(["demenagement", "diogene", "debarras"]);

export default function DocumentPdf({ detail }: Props) {
  const { doc, entity, lead } = detail;

  // Devis "propreté" (nettoyage & apparentés) → design dédié OPTIMIVV.
  if (doc.type === "devis" && !LOGISTIQUE.has(lead.sector)) {
    return <DevisNettoyagePdf detail={detail} />;
  }

  const isInvoice = doc.type !== "devis";
  const isPaid = doc.status === "paye";
  const validUntil = new Date(doc.issuedAt);
  validUntil.setDate(validUntil.getDate() + 30);

  const accent = SECTOR_ACCENT[lead.sector] ?? "#0ea5e9";
  const bold = BOLD_SECTORS.has(lead.sector);
  const tagline = SECTOR_TAGLINE[lead.sector] ?? "";

  const pillBg =
    doc.status === "paye" || doc.status === "signe"
      ? "#0f9d58"
      : doc.status === "envoye" || doc.status === "ouvert"
        ? "#f4a623"
        : "#888fa8";

  const vatByRate = aggregateVat(doc.lines);
  const paymentTerm = PAYMENT_TERMS[doc.paymentTermSlug];

  // Theme tokens resolved per design.
  const headBg = bold ? DARK : accent;
  const headSub = rgba("#ffffff", bold ? 0.7 : 0.85);
  const partyBg = bold ? "#f6f7fb" : rgba(accent, 0.07);
  const partyBorder = bold
    ? { borderTop: `2pt solid ${accent}`, border: `0.5pt solid ${LINE}` }
    : { borderLeft: `3pt solid ${accent}` };
  const tableHeadStyle = bold
    ? { backgroundColor: DARK, color: "#ffffff" }
    : { backgroundColor: rgba(accent, 0.12), color: accent };
  const totalsBoxStyle = bold
    ? { backgroundColor: DARK, color: "#ffffff" }
    : { border: `0.5pt solid ${LINE}`, backgroundColor: "#ffffff" };
  const ttcStyle = bold
    ? { color: accent, borderTop: `1pt solid ${rgba("#ffffff", 0.25)}` }
    : { color: accent, borderTop: `1.5pt solid ${accent}`, borderBottom: `1.5pt solid ${accent}` };
  const totalLabelColor = bold ? rgba("#ffffff", 0.8) : "#3b4467";

  return (
    <Document title={`${doc.num} — ${lead.client}`} author={entity.legalName}>
      <Page size="A4" style={styles.page}>
        {/* ── Header band ─────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            borderRadius: 8,
            overflow: "hidden",
            backgroundColor: headBg,
          }}
        >
          {bold && <View style={{ width: 9, backgroundColor: accent }} />}
          <View
            style={{
              flex: 1,
              padding: 16,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View style={{ maxWidth: 300 }}>
              {bold && (
                <Text style={{ color: accent, fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 3 }}>
                  {tagline}
                </Text>
              )}
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: 700 }}>{entity.legalName}</Text>
              {!bold && (
                <Text style={{ color: headSub, fontSize: 8, marginTop: 2 }}>{tagline}</Text>
              )}
              <Text style={{ ...styles.entityForm, color: headSub }}>
                {entity.legalForm} · SIRET {entity.siret} · APE {entity.apeCode}
              </Text>
              <Text style={{ ...styles.entityLine, color: headSub }}>
                {entity.addressLine}, {entity.postalCode} {entity.city}
              </Text>
              <Text style={{ ...styles.entityLine, color: headSub }}>TVA {entity.vatNumber}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>
                {DOC_TYPE_LABEL[doc.type]}
              </Text>
              <Text style={{ color: bold ? accent : "#ffffff", fontSize: 11, marginTop: 4, fontWeight: 700 }}>{doc.num}</Text>
              <Text style={{ color: headSub, fontSize: 8, marginTop: 2 }}>
                Émis le {DATE_FMT.format(new Date(doc.issuedAt))}
              </Text>
              {(isPaid || doc.status === "signe") && (
                <Text style={{ ...styles.statusPill, backgroundColor: pillBg }}>
                  {isPaid ? "Payée" : "Signé"}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Parties ───────────────────────────────────────────── */}
        <View style={styles.parties}>
          <View style={{ ...styles.partyBox, backgroundColor: partyBg, ...partyBorder }}>
            <Text style={{ ...styles.partyLabel, color: accent }}>Émis par</Text>
            <Text style={styles.partyName}>{entity.legalName}</Text>
            <Text style={styles.partyLine}>{entity.contactEmail}</Text>
            <Text style={styles.partyLine}>{entity.contactPhone}</Text>
          </View>
          <View style={{ ...styles.partyBox, backgroundColor: partyBg, ...partyBorder }}>
            <Text style={{ ...styles.partyLabel, color: accent }}>Destinataire</Text>
            <Text style={styles.partyName}>{lead.client}</Text>
            {lead.address && <Text style={styles.partyLine}>{lead.address}</Text>}
            <Text style={styles.partyLine}>{lead.postalCode} {lead.city}</Text>
            {lead.email && <Text style={styles.partyLine}>{lead.email}</Text>}
            {lead.phone && <Text style={styles.partyLine}>{lead.phone}</Text>}
            {lead.siret && <Text style={styles.partyLine}>SIRET {lead.siret}</Text>}
          </View>
        </View>

        <Text style={styles.validity}>
          {doc.type === "devis"
            ? `Devis valable jusqu'au ${DATE_FMT.format(validUntil)}`
            : `Échéance : ${DATE_FMT.format(validUntil)}`}
        </Text>

        {/* ── Lines table ───────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={{ ...styles.tableHead, ...tableHeadStyle }}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qté</Text>
            <Text style={{ ...styles.colUnit, color: bold ? rgba("#ffffff", 0.75) : accent }}>Unité</Text>
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

        {/* ── Totals card ───────────────────────────────────────── */}
        <View style={styles.totalsRow}>
          <View style={{ ...styles.totalsBox, ...totalsBoxStyle }}>
            <View style={styles.totalLine}>
              <Text style={{ color: totalLabelColor }}>Total HT</Text>
              <Text>{formatEUR(doc.totalHt)}</Text>
            </View>
            {[...vatByRate.entries()].sort(([a], [b]) => a - b).map(([rate, amount]) => (
              <View key={rate} style={styles.totalLine}>
                <Text style={{ color: totalLabelColor }}>TVA {rate}%</Text>
                <Text>{formatEUR(amount)}</Text>
              </View>
            ))}
            <View style={{ ...styles.ttcLine, ...ttcStyle }}>
              <Text>Total TTC</Text>
              <Text>{formatEUR(doc.totalTtc)}</Text>
            </View>
            {doc.type === "devis" && doc.acomptePct && doc.acompteAmount && (
              <>
                <View style={{ ...styles.acompteLine, backgroundColor: accent }}>
                  <Text>Acompte ({doc.acomptePct}%)</Text>
                  <Text>{formatEUR(doc.acompteAmount)}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={{ color: totalLabelColor }}>Solde dû à la livraison</Text>
                  <Text>{formatEUR(doc.totalTtc - doc.acompteAmount)}</Text>
                </View>
              </>
            )}
            {doc.type === "finale" && doc.acomptePct != null && (
              <View style={styles.totalLine}>
                <Text style={{ color: totalLabelColor }}>Acompte déjà versé</Text>
                <Text>−{formatEUR(doc.totalTtc * (doc.acomptePct / 100))}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Notes ─────────────────────────────────────────────── */}
        {doc.notes && (
          <View style={{ ...styles.notesBlock, backgroundColor: rgba(accent, 0.06) }}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text>{doc.notes}</Text>
          </View>
        )}

        {/* ── Payment terms + IBAN ──────────────────────────────── */}
        <View style={styles.paymentBlock}>
          <Text style={styles.paymentLabel}>Conditions de paiement : {paymentTerm.label}</Text>
          <Text style={styles.paymentLine}>
            Coordonnées bancaires — IBAN {entity.iban} · BIC {entity.bic}
          </Text>
          {doc.relatedDevisNum && (
            <Text style={styles.paymentLine}>Document lié : devis {doc.relatedDevisNum}</Text>
          )}
        </View>

        {/* ── Legal footer ──────────────────────────────────────── */}
        <Text style={styles.legalFooter} fixed>
          {entity.legalName} · {entity.legalForm} · SIRET {entity.siret} ·{" "}
          {isInvoice ? "TVA acquittée sur les encaissements" : "Devis non contractuel jusqu'à signature"}
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
