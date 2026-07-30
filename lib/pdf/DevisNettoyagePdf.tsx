/* eslint-disable react/no-unescaped-entities */
import path from "node:path";
import { Document, Page, View, Text, Svg, Path, Circle, Font, StyleSheet } from "@react-pdf/renderer";
import type { DocumentDetail } from "@/lib/documents-shared";
import { formatEUR } from "@/lib/leads";

// Police cursive (slogan + « Bon pour accord »). Fichier embarqué dans public/.
Font.register({ family: "GreatVibes", src: path.join(process.cwd(), "public/fonts/GreatVibes-Regular.ttf") });

// Devis Nettoyage — design "OPTIMIVV" (vert forêt + or), multi-pages, rempli
// avec les vraies données du dossier. Emblème dessiné en SVG (pas d'asset).
// Slogan : « La propreté sans compromis ».

const GREEN = "#153a2b";
const GOLD = "#b8935a";
const GOLD_LT = "#c9a978";
const INK = "#2a2f2a";
const MUT = "#7b8079";
const CREAM = "#f3eee2";
const LINE = "#e4ded0";

const S = StyleSheet.create({
  page: { paddingTop: 26, paddingHorizontal: 30, paddingBottom: 54, fontFamily: "Helvetica", fontSize: 9, color: INK },
  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  wordmark: { fontSize: 21, fontWeight: 700, color: GREEN, letterSpacing: 3 },
  wordmarkSub: { fontSize: 10.5, fontWeight: 700, color: GOLD, letterSpacing: 5.5, marginTop: 1 },
  tagline: { fontSize: 7.5, color: MUT, marginTop: 4 },
  slogan: { fontSize: 16, color: GOLD, fontFamily: "GreatVibes", marginTop: 1 },
  docTitle: { fontSize: 30, fontWeight: 700, color: GREEN, letterSpacing: 1 },
  docNum: { fontSize: 13, color: GOLD, fontWeight: 700, marginTop: 2 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5, justifyContent: "flex-end" },
  metaText: { fontSize: 8, color: INK },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD },
  // Parties
  parties: { flexDirection: "row", gap: 12, marginTop: 16 },
  prestataire: { flex: 1, backgroundColor: GREEN, borderRadius: 8, padding: 14 },
  partyHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  partyHeadText: { color: GOLD_LT, fontSize: 9, fontWeight: 700, letterSpacing: 1 },
  presName: { color: "#ffffff", fontSize: 12, fontWeight: 700 },
  presLine: { color: "#dfe6df", fontSize: 8.5, marginTop: 2 },
  presStrong: { color: "#ffffff", fontSize: 8.5, fontWeight: 700, marginTop: 5 },
  presContact: { color: "#dfe6df", fontSize: 8.5, marginTop: 4, flexDirection: "row", alignItems: "center", gap: 5 },
  client: { flex: 1, backgroundColor: "#ffffff", borderRadius: 8, border: `1pt solid ${LINE}`, padding: 14 },
  clientHeadText: { color: GREEN, fontSize: 9, fontWeight: 700, letterSpacing: 1 },
  clientRow: { fontSize: 9, color: INK, marginTop: 7 },
  clientLabel: { color: MUT },
  clientVal: { color: INK, fontWeight: 700 },
  // Objet
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 18, marginBottom: 6 },
  sectionTitleText: { fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: 0.5 },
  objetText: { fontSize: 9, color: INK, lineHeight: 1.5 },
  infoBox: { marginTop: 12, flexDirection: "row", gap: 16, backgroundColor: CREAM, borderRadius: 8, padding: 11 },
  infoItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  infoLabel: { fontSize: 8, color: MUT, fontWeight: 700 },
  infoVal: { fontSize: 9, color: INK, fontWeight: 700 },
  // Table
  tableWrap: { marginTop: 16, borderRadius: 8, overflow: "hidden", border: `1pt solid ${LINE}` },
  tableTitle: { backgroundColor: GREEN, color: "#ffffff", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, padding: "8px 12px", textTransform: "uppercase" },
  tableHead: { flexDirection: "row", padding: "7px 12px", borderBottom: `1pt solid ${LINE}`, backgroundColor: "#faf8f2" },
  th: { fontSize: 8, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: 0.4 },
  row: { flexDirection: "row", padding: "7px 12px", borderBottom: `0.5pt solid ${LINE}` },
  cDesc: { flex: 4, paddingRight: 8 },
  cQty: { flex: 1, textAlign: "center", color: MUT },
  cAmt: { flex: 1.4, textAlign: "right" },
  vatNote: { fontSize: 7.5, color: MUT, marginTop: 5 },
  // Totals
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totalsBox: { width: 250, backgroundColor: CREAM, borderRadius: 8, padding: 12 },
  tLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  tLabel: { color: "#55594f" },
  ttc: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4, borderTop: `1.5pt solid ${GREEN}`, fontWeight: 700, fontSize: 12, color: GREEN },
  acompte: { flexDirection: "row", justifyContent: "space-between", backgroundColor: GOLD, color: "#ffffff", borderRadius: 4, padding: "4px 8px", marginTop: 7, fontWeight: 700 },
  // Badges footer bar
  badgeBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: GREEN, flexDirection: "row", alignItems: "center" },
  badge: { flex: 1, padding: "9px 8px", flexDirection: "row", alignItems: "center", gap: 6 },
  badgeText: { color: "#e8eee8", fontSize: 6.8, lineHeight: 1.25 },
  pageTag: { backgroundColor: GOLD, color: "#ffffff", fontSize: 8, fontWeight: 700, paddingVertical: 9, paddingHorizontal: 12, textAlign: "center" },
  // Generic footer (pages 2-3)
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: GREEN, flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "10px 16px" },
  footerText: { color: "#e8eee8", fontSize: 7.5 },
  // Conditions page
  colTitle: { fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 7 },
  para: { fontSize: 9, color: INK, lineHeight: 1.5, marginBottom: 5 },
  bullet: { flexDirection: "row", gap: 6, marginBottom: 4 },
  bulletText: { fontSize: 9, color: INK, flex: 1 },
  noteBox: { marginTop: 14, backgroundColor: CREAM, borderRadius: 8, padding: 12, flexDirection: "row", gap: 8 },
  noteLabel: { fontSize: 8, fontWeight: 700, color: GOLD, letterSpacing: 0.6, marginBottom: 3 },
  acceptBox: { marginTop: 12, border: `1pt solid ${LINE}`, borderRadius: 8, padding: 14, backgroundColor: "#faf8f2" },
  signLine: { fontSize: 9, color: INK, marginTop: 8 },
  bonPourAccord: { fontSize: 26, color: GOLD, fontFamily: "GreatVibes" },
});

function Emblem({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Circle cx="22" cy="22" r="16.5" stroke={GREEN} strokeWidth={3.4} fill="none" />
      <Path d="M13 27 C17 15 30 13 33 14 C31 27 20 31 13 27 Z" fill={GREEN} />
      <Path d="M15 27 C22 21 28 18 32 15" stroke={GOLD} strokeWidth={2.1} fill="none" />
    </Svg>
  );
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

type Props = { detail: DocumentDetail };

export default function DevisNettoyagePdf({ detail }: Props) {
  const { doc, entity, lead } = detail;
  const brand = entity.legalName.replace(/\s+(SAS|SARL|EURL|SASU|EI|SCI)$/i, "").toUpperCase();
  const validUntil = new Date(doc.issuedAt);
  validUntil.setDate(validUntil.getDate() + 30);

  const totalTva = doc.lines.reduce((s, l) => s + (l.totalHt * l.vatRate) / 100, 0);
  const franchise = totalTva < 0.01;

  const BADGES = [
    "Produits écoresponsables\nrespectueux de l'environnement",
    "Matériel professionnel\net techniques efficaces",
    "Équipe qualifiée\net expérimentée",
    "Satisfaction garantie",
  ];

  return (
    <Document title={`${doc.num} — ${lead.client}`} author={entity.legalName}>
      {/* ── PAGE 1 ─────────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View>
            <View style={S.brandRow}>
              <Emblem size={44} />
              <View>
                <Text style={S.wordmark}>{brand}</Text>
                <Text style={S.wordmarkSub}>NETTOYAGE</Text>
                <Text style={S.tagline}>Nettoyage professionnel • Désinfection • Décontamination</Text>
                <Text style={S.slogan}>La propreté sans compromis</Text>
              </View>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={S.docTitle}>DEVIS</Text>
            <Text style={S.docNum}>N° {doc.num.replace(/^DEV-?/i, "")}</Text>
            <View style={S.metaLine}>
              <View style={S.dot} />
              <Text style={S.metaText}>Date d'émission : {DATE_FMT.format(new Date(doc.issuedAt))}</Text>
            </View>
            <View style={S.metaLine}>
              <View style={S.dot} />
              <Text style={S.metaText}>Validité de l'offre : 30 jours</Text>
            </View>
          </View>
        </View>

        {/* Parties */}
        <View style={S.parties}>
          <View style={S.prestataire}>
            <View style={S.partyHead}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: GOLD }} />
              <Text style={S.partyHeadText}>PRESTATAIRE</Text>
            </View>
            <Text style={S.presName}>{entity.legalName}</Text>
            <Text style={S.presLine}>{entity.addressLine}</Text>
            <Text style={S.presLine}>{entity.postalCode} {entity.city}</Text>
            <Text style={S.presStrong}>SIRET : {entity.siret}</Text>
            <Text style={S.presContact}>{entity.contactPhone}</Text>
            <Text style={S.presContact}>{entity.contactEmail}</Text>
          </View>
          <View style={S.client}>
            <View style={S.partyHead}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: CREAM }} />
              <Text style={S.clientHeadText}>CLIENT</Text>
            </View>
            <Text style={S.clientRow}><Text style={S.clientLabel}>Nom / Société : </Text><Text style={S.clientVal}>{lead.client}</Text></Text>
            {lead.address ? <Text style={S.clientRow}><Text style={S.clientLabel}>Adresse : </Text><Text style={S.clientVal}>{lead.address}</Text></Text> : null}
            <Text style={S.clientRow}><Text style={S.clientLabel}>Ville : </Text><Text style={S.clientVal}>{lead.postalCode} {lead.city}</Text></Text>
            {lead.phone ? <Text style={S.clientRow}><Text style={S.clientLabel}>Téléphone : </Text><Text style={S.clientVal}>{lead.phone}</Text></Text> : null}
            {lead.email ? <Text style={S.clientRow}><Text style={S.clientLabel}>Email : </Text><Text style={S.clientVal}>{lead.email}</Text></Text> : null}
          </View>
        </View>

        {/* Objet */}
        <View style={S.sectionTitle}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: GREEN }} />
          <Text style={S.sectionTitleText}>OBJET DE LA PRESTATION</Text>
        </View>
        <Text style={S.objetText}>
          Réalisation d'une prestation de nettoyage conforme à votre demande. L'intervention sera effectuée
          avec des agents qualifiés, du matériel professionnel et des produits adaptés pour garantir un résultat optimal.
        </Text>

        <View style={S.infoBox}>
          <View style={S.infoItem}>
            <View style={S.dot} />
            <Text style={S.infoLabel}>LIEU D'INTERVENTION : </Text>
            <Text style={S.infoVal}>{[lead.address, lead.city].filter(Boolean).join(", ") || "à convenir"}</Text>
          </View>
          <View style={S.infoItem}>
            <View style={S.dot} />
            <Text style={S.infoLabel}>DATE PRÉVUE : </Text>
            <Text style={S.infoVal}>à convenir</Text>
          </View>
        </View>

        {/* Table */}
        <View style={S.tableWrap}>
          <Text style={S.tableTitle}>DESCRIPTION DE LA PRESTATION ET TARIF</Text>
          <View style={S.tableHead}>
            <Text style={{ ...S.th, ...S.cDesc }}>Description détaillée de la prestation</Text>
            <Text style={{ ...S.th, ...S.cQty }}>Qté</Text>
            <Text style={{ ...S.th, ...S.cAmt }}>Montant net HT</Text>
          </View>
          {doc.lines.map((l) => (
            <View key={l.id} style={S.row}>
              <Text style={S.cDesc}>{l.label}</Text>
              <Text style={S.cQty}>{formatQty(l.quantity)} {l.unit}</Text>
              <Text style={S.cAmt}>{formatEUR(l.totalHt)}</Text>
            </View>
          ))}
        </View>
        {franchise && <Text style={S.vatNote}>TVA non applicable, article 293 B du Code Général des Impôts (CGI).</Text>}

        {/* Totals */}
        <View style={S.totalsRow}>
          <View style={S.totalsBox}>
            <View style={S.tLine}><Text style={S.tLabel}>Total HT</Text><Text>{formatEUR(doc.totalHt)}</Text></View>
            {!franchise && <View style={S.tLine}><Text style={S.tLabel}>TVA</Text><Text>{formatEUR(totalTva)}</Text></View>}
            <View style={S.ttc}><Text>{franchise ? "Total à régler" : "Total TTC"}</Text><Text>{formatEUR(doc.totalTtc)}</Text></View>
            {doc.acomptePct && doc.acompteAmount ? (
              <>
                <View style={S.acompte}><Text>Acompte à la commande ({doc.acomptePct} %)</Text><Text>{formatEUR(doc.acompteAmount)}</Text></View>
                <View style={S.tLine}><Text style={S.tLabel}>Solde à la réalisation</Text><Text>{formatEUR(doc.totalTtc - doc.acompteAmount)}</Text></View>
              </>
            ) : null}
          </View>
        </View>

        {/* Badges bar */}
        <View style={S.badgeBar} fixed>
          {BADGES.map((b, i) => (
            <View key={i} style={S.badge}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD }} />
              <Text style={S.badgeText}>{b}</Text>
            </View>
          ))}
          <Text style={S.pageTag} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ── PAGE 2 : conditions + acceptation ──────────────────── */}
      <Page size="A4" style={S.page}>
        <View style={{ flexDirection: "row", gap: 24 }}>
          <View style={{ flex: 1 }}>
            <Text style={S.colTitle}>Conditions d'intervention</Text>
            <Text style={S.para}>La prestation sera réalisée à la date convenue entre les parties.</Text>
            <Text style={S.para}>
              Toute prestation supplémentaire demandée sur place ou tout élément non visible lors de l'établissement
              du devis pourra faire l'objet d'une facturation complémentaire après validation du client.
            </Text>
            <View style={S.noteBox}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: GOLD }} />
              <View style={{ flex: 1 }}>
                <Text style={S.noteLabel}>À NOTER</Text>
                <Text style={{ fontSize: 8.5, color: INK, lineHeight: 1.5 }}>
                  Ce devis est établi sur la base des informations communiquées par le client. En cas de modification
                  des conditions d'intervention (accès, surfaces, volumes…), un ajustement pourra être proposé.
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={S.colTitle}>Conditions de règlement</Text>
            <View style={S.bullet}><View style={{ ...S.dot, marginTop: 3 }} /><Text style={S.bulletText}>Acompte à la commande : {doc.acomptePct ?? 30} %</Text></View>
            <View style={S.bullet}><View style={{ ...S.dot, marginTop: 3 }} /><Text style={S.bulletText}>Solde à réception de la facture</Text></View>
            <View style={S.bullet}><View style={{ ...S.dot, marginTop: 3 }} /><Text style={S.bulletText}>Paiement par virement bancaire (RIB en pièce jointe) ou lien de paiement sécurisé</Text></View>
            <Text style={{ fontSize: 8, color: MUT, marginTop: 6 }}>IBAN {entity.iban} · BIC {entity.bic}</Text>

            <Text style={{ ...S.colTitle, marginTop: 18 }}>Acceptation du devis</Text>
            <Text style={S.para}>
              Le présent devis vaut contrat après signature du client accompagnée de la mention « Bon pour accord ».
            </Text>
            <View style={S.acceptBox}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text style={S.signLine}>Nom : ________________________</Text>
                  <Text style={S.signLine}>Date : ________________________</Text>
                  <Text style={S.signLine}>Signature & cachet :</Text>
                </View>
                <Text style={S.bonPourAccord}>Bon pour accord</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>{entity.legalName} · {entity.addressLine}, {entity.postalCode} {entity.city} · SIRET {entity.siret}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ── PAGE 3 : remerciement ──────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <View style={{ alignItems: "center", marginTop: 160 }}>
          <Emblem size={70} />
          <Text style={{ ...S.wordmark, marginTop: 12 }}>{brand}</Text>
          <Text style={S.wordmarkSub}>NETTOYAGE</Text>
          <Text style={{ ...S.slogan, marginTop: 4 }}>La propreté sans compromis</Text>
          <Text style={{ fontSize: 12, color: GREEN, fontWeight: 700, marginTop: 24 }}>Merci pour votre confiance.</Text>
          <Text style={{ fontSize: 9.5, color: INK, marginTop: 6 }}>Nous restons à votre disposition pour toute question.</Text>
          <Text style={{ fontSize: 8.5, color: MUT, marginTop: 4 }}>{entity.contactPhone} · {entity.contactEmail}</Text>
        </View>
        <View style={S.footer} fixed>
          <Text style={S.footerText}>{entity.legalName} · SIRET {entity.siret}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(".", ",");
}
