/* eslint-disable react/no-unescaped-entities */
import path from "node:path";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  Rect,
  Line,
  Circle,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  CERT_OPERATIONS,
  OP_LABEL,
  PRESTATAIRE_CERT,
  type CertHotte,
  type OpState,
} from "@/lib/cert-hotte/types";

// Police cursive (cachet « Bon pour conformité »). Fichier déjà embarqué.
Font.register({
  family: "GreatVibes",
  src: path.join(process.cwd(), "public/fonts/GreatVibes-Regular.ttf"),
});

const GREEN2 = "#0E3B2C";
const GOLD = "#b8935a";
const INK = "#22271f";
const MUT = "#7b8079";
const FAINT = "#9aa094";
const CREAM = "#f6f2e8";
const LINE = "#e4ded0";
const OK = "#1E7A4D";
const NR = "#B23B2E";

const S = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingHorizontal: 36,
    paddingBottom: 26,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
  },
  // header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  wordmark: { fontSize: 16, fontFamily: "Helvetica-Bold", color: GREEN2, letterSpacing: 1.5 },
  wordmarkSub: { fontSize: 16, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 1.5 },
  tagline: { fontSize: 7, color: MUT, marginTop: 3 },
  refBox: { alignItems: "flex-end" },
  refLabel: { fontSize: 7.5, color: MUT, letterSpacing: 0.4 },
  refNum: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: GREEN2, marginTop: 1 },
  refDate: { fontSize: 7.5, color: MUT, marginTop: 2 },
  rule: { height: 2.4, marginTop: 12, borderRadius: 2, flexDirection: "row" },
  ruleGreen: { flex: 62, backgroundColor: GREEN2 },
  ruleGold: { flex: 38, backgroundColor: GOLD },
  // title
  titleWrap: { alignItems: "center", marginTop: 16, marginBottom: 4 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#12261E", textAlign: "center", letterSpacing: 0.3 },
  subtitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 2.4, marginTop: 5, textTransform: "uppercase" },
  // section label
  secLbl: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 15, marginBottom: 6 },
  secLblText: { fontSize: 9, fontFamily: "Helvetica-Bold", color: GREEN2, letterSpacing: 1 },
  secLblRule: { flex: 1, height: 1, backgroundColor: LINE },
  // établissement
  estab: { backgroundColor: CREAM, border: `1pt solid ${LINE}`, borderRadius: 7, padding: "11px 14px", flexDirection: "row", flexWrap: "wrap" },
  estabRow: { width: "50%", flexDirection: "row", gap: 5, paddingVertical: 2.5, paddingRight: 10 },
  estabRowWide: { width: "100%", flexDirection: "row", gap: 5, paddingVertical: 2.5 },
  estabK: { fontSize: 8.5, color: FAINT, fontFamily: "Helvetica-Bold" },
  estabV: { fontSize: 8.5, color: INK, fontFamily: "Helvetica-Bold", flex: 1 },
  // meta boxes
  metaRow: { flexDirection: "row", gap: 9, marginTop: 12 },
  metaBox: { flex: 1, border: `1pt solid ${LINE}`, borderRadius: 7, padding: "8px 11px", backgroundColor: "#ffffff" },
  metaK: { fontSize: 7, color: FAINT, fontFamily: "Helvetica-Bold", letterSpacing: 0.6 },
  metaV: { fontSize: 12.5, fontFamily: "Helvetica-Bold", color: GREEN2, marginTop: 3 },
  metaVreg: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: INK, marginTop: 3 },
  // operations
  ops: { flexDirection: "row", flexWrap: "wrap" },
  op: { width: "50%", flexDirection: "row", gap: 6, paddingVertical: 3, paddingRight: 12, alignItems: "flex-start" },
  opText: { flex: 1 },
  opLabel: { fontSize: 8.7, color: INK, lineHeight: 1.25 },
  opState: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.3, marginTop: 1 },
  // two columns
  two: { flexDirection: "row", gap: 14, marginTop: 14 },
  pass: { width: 168, backgroundColor: CREAM, border: `1pt solid ${LINE}`, borderRadius: 7, padding: "9px 12px" },
  chipsRow: { flexDirection: "row", gap: 6, marginTop: 4, marginBottom: 7 },
  chip: { fontSize: 8, fontFamily: "Helvetica-Bold", paddingVertical: 2.5, paddingHorizontal: 8, borderRadius: 8, border: `1pt solid #cfcabb`, color: FAINT, backgroundColor: "#fff" },
  chipOn: { color: "#fff", backgroundColor: GREEN2, border: `1pt solid ${GREEN2}` },
  pDate: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottom: `0.5pt solid #ded8ca` },
  pDateLast: { borderBottom: "none" },
  pK: { fontSize: 8.5, color: FAINT, fontFamily: "Helvetica-Bold" },
  pV: { fontSize: 8.5, color: INK, fontFamily: "Helvetica-Bold" },
  obs: { flex: 1, border: `1pt solid ${LINE}`, borderRadius: 7, padding: "9px 12px", backgroundColor: "#ffffff" },
  obsText: { fontSize: 8.5, color: "#35403a", lineHeight: 1.4 },
  obsEmpty: { fontSize: 8.5, color: "#b4ac9a", fontStyle: "italic" },
  // validation
  valid: { marginTop: 16 },
  valGrid: { flexDirection: "row", gap: 14, alignItems: "flex-end" },
  valBox: { flex: 1 },
  valK: { fontSize: 7, color: FAINT, fontFamily: "Helvetica-Bold", letterSpacing: 0.6 },
  valV: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: INK, marginTop: 3 },
  valSub: { fontSize: 8, color: MUT, marginTop: 1 },
  sig: { flex: 1.15, border: `1pt dashed #c9c3b4`, borderRadius: 7, height: 54, backgroundColor: "#fcfbf7", position: "relative" },
  cachet: { position: "absolute", right: 8, bottom: 8, fontFamily: "GreatVibes", fontSize: 15, color: GREEN2 },
  sigImg: { position: "absolute", left: 8, top: 6, width: 130, height: 42, objectFit: "contain" },
  legal: { fontSize: 7.2, color: FAINT, fontStyle: "italic", marginTop: 11, lineHeight: 1.35 },
  foot: { marginTop: 10, paddingTop: 8, borderTop: `1pt solid ${LINE}`, flexDirection: "row", justifyContent: "space-between" },
  footText: { fontSize: 7, color: MUT },
  footStrong: { fontSize: 7, color: GREEN2, fontFamily: "Helvetica-Bold" },
});

function Emblem({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Circle cx="22" cy="22" r="16.5" stroke={GREEN2} strokeWidth={3.2} fill="none" />
      <Path d="M13 27 C17 15 30 13 33 14 C31 27 20 31 13 27 Z" fill={GREEN2} />
      <Path d="M15 27 C22 21 28 18 32 15" stroke={GOLD} strokeWidth={2.1} fill="none" />
    </Svg>
  );
}

// Marqueur d'état dessiné en SVG (robuste : pas de glyphe unicode dépendant
// d'une police). fait = coché vert · nc = tiret gris · nr = croix rouge.
function Mark({ state }: { state: OpState }) {
  const z = 11;
  if (state === "fait") {
    return (
      <Svg width={z} height={z} viewBox="0 0 11 11">
        <Rect x="0.5" y="0.5" width="10" height="10" rx="2.4" fill={OK} />
        <Path d="M2.6 5.7 L4.6 7.7 L8.4 3.3" stroke="#ffffff" strokeWidth="1.5" fill="none" />
      </Svg>
    );
  }
  if (state === "nc") {
    return (
      <Svg width={z} height={z} viewBox="0 0 11 11">
        <Rect x="0.5" y="0.5" width="10" height="10" rx="2.4" fill="#eeece4" stroke="#c9c3b4" strokeWidth="1" />
        <Line x1="3" y1="5.5" x2="8" y2="5.5" stroke="#8a938c" strokeWidth="1.4" />
      </Svg>
    );
  }
  return (
    <Svg width={z} height={z} viewBox="0 0 11 11">
      <Rect x="0.5" y="0.5" width="10" height="10" rx="2.4" fill="#ffffff" stroke={NR} strokeWidth="1.3" />
      <Path d="M3.2 3.2 L7.8 7.8 M7.8 3.2 L3.2 7.8" stroke={NR} strokeWidth="1.4" />
    </Svg>
  );
}

const stateColor: Record<OpState, string> = { fait: OK, nc: FAINT, nr: NR };

type Props = { cert: CertHotte };

export default function CertificatHottePdf({ cert }: Props) {
  const c = cert;
  const P = PRESTATAIRE_CERT;
  const addressFull = [c.client.adresse, [c.client.cp, c.client.ville].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  const ops: { label: string; state: OpState }[] = CERT_OPERATIONS.map((label, i) => ({
    label: label as string,
    state: (c.operations[i] ?? "fait") as OpState,
  }));
  if (c.autre) ops.push({ label: "Autre : " + c.autre.label, state: c.autre.state });

  return (
    <Document title={`${c.numero} — ${c.client.etablissement}`} author={P.raisonSociale}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View style={S.brandRow}>
            <Emblem size={38} />
            <View>
              <View style={{ flexDirection: "row" }}>
                <Text style={S.wordmark}>OPTIMIVV </Text>
                <Text style={S.wordmarkSub}>NETTOYAGE</Text>
              </View>
              <Text style={S.tagline}>Nettoyage · Dégraissage · Entretien d'extraction professionnelle</Text>
            </View>
          </View>
          <View style={S.refBox}>
            <Text style={S.refLabel}>Référence du certificat</Text>
            <Text style={S.refNum}>{c.numero}</Text>
            <Text style={S.refDate}>Émis le {c.dateEmission}</Text>
          </View>
        </View>
        <View style={S.rule}><View style={S.ruleGreen} /><View style={S.ruleGold} /></View>

        {/* Title */}
        <View style={S.titleWrap}>
          <Text style={S.title}>Certificat de conformité / Attestation d'entretien</Text>
          <Text style={S.subtitle}>Nettoyage de hotte professionnelle</Text>
        </View>

        {/* Établissement */}
        <View style={S.secLbl}><Text style={S.secLblText}>ÉTABLISSEMENT</Text><View style={S.secLblRule} /></View>
        <View style={S.estab}>
          <View style={S.estabRowWide}><Text style={S.estabK}>Établissement</Text><Text style={S.estabV}>{c.client.etablissement || "—"}</Text></View>
          {c.client.raisonSociale ? <View style={S.estabRow}><Text style={S.estabK}>Raison sociale</Text><Text style={S.estabV}>{c.client.raisonSociale}</Text></View> : null}
          {c.client.responsable ? <View style={S.estabRow}><Text style={S.estabK}>Responsable</Text><Text style={S.estabV}>{c.client.responsable}</Text></View> : null}
          {addressFull ? <View style={S.estabRowWide}><Text style={S.estabK}>Adresse</Text><Text style={S.estabV}>{addressFull}</Text></View> : null}
          {c.client.telephone ? <View style={S.estabRow}><Text style={S.estabK}>Téléphone</Text><Text style={S.estabV}>{c.client.telephone}</Text></View> : null}
          {c.client.email ? <View style={S.estabRow}><Text style={S.estabK}>Email</Text><Text style={S.estabV}>{c.client.email}</Text></View> : null}
        </View>

        {/* Meta */}
        <View style={S.metaRow}>
          <View style={S.metaBox}><Text style={S.metaK}>INTERVENTION RÉALISÉE LE</Text><Text style={S.metaV}>{c.dateIntervention}</Text></View>
          <View style={S.metaBox}><Text style={S.metaK}>N° DE DOSSIER</Text><Text style={S.metaVreg}>{c.dossierRef || "—"}</Text></View>
          <View style={S.metaBox}><Text style={S.metaK}>N° DE FACTURE</Text><Text style={S.metaVreg}>{c.factureNum || "—"}</Text></View>
        </View>

        {/* Opérations */}
        <View style={S.secLbl}><Text style={S.secLblText}>OPÉRATIONS EFFECTUÉES</Text><View style={S.secLblRule} /></View>
        <View style={S.ops}>
          {ops.map((o, i) => (
            <View key={i} style={S.op}>
              <View style={{ marginTop: 1 }}><Mark state={o.state} /></View>
              <View style={S.opText}>
                <Text style={S.opLabel}>{o.label}</Text>
                <Text style={{ ...S.opState, color: stateColor[o.state] }}>{OP_LABEL[o.state]}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Passages + Observations */}
        <View style={S.two}>
          <View style={S.pass}>
            <View style={S.secLbl}><Text style={S.secLblText}>PASSAGES</Text></View>
            <View style={S.chipsRow}>
              <Text style={c.passages === 1 ? { ...S.chip, ...S.chipOn } : S.chip}>1 passage</Text>
              <Text style={c.passages === 2 ? { ...S.chip, ...S.chipOn } : S.chip}>2 passages</Text>
            </View>
            <View style={c.passages === 2 ? S.pDate : { ...S.pDate, ...S.pDateLast }}>
              <Text style={S.pK}>Passage n°1</Text><Text style={S.pV}>{c.passage1 || "—"}</Text>
            </View>
            {c.passages === 2 ? (
              <View style={{ ...S.pDate, ...S.pDateLast }}>
                <Text style={S.pK}>Passage n°2</Text><Text style={S.pV}>{c.passage2 || "—"}</Text>
              </View>
            ) : null}
          </View>
          <View style={S.obs}>
            <View style={S.secLbl}><Text style={S.secLblText}>OBSERVATIONS / RÉSERVES</Text></View>
            {c.observations ? (
              <Text style={S.obsText}>{c.observations}</Text>
            ) : (
              <Text style={S.obsEmpty}>Aucune réserve — intervention conforme.</Text>
            )}
          </View>
        </View>

        {/* Validation */}
        <View style={S.valid}>
          <View style={S.secLbl}><Text style={S.secLblText}>VALIDATION</Text><View style={S.secLblRule} /></View>
          <View style={S.valGrid}>
            <View style={S.valBox}>
              <Text style={S.valK}>INTERVENTION RÉALISÉE PAR</Text>
              <Text style={S.valV}>{c.technicien || P.enseigne}</Text>
              <Text style={S.valSub}>{c.societe || P.raisonSociale}</Text>
            </View>
            <View style={S.valBox}>
              <Text style={S.valK}>DATE</Text>
              <Text style={S.valV}>{c.dateIntervention}</Text>
            </View>
            <View style={S.sig}>
              {c.signatureDataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf <Image>, pas une balise HTML <img>
                <Image src={c.signatureDataUrl} style={S.sigImg} />
              ) : (
                <Text style={S.cachet}>Bon pour conformité</Text>
              )}
            </View>
          </View>
          <Text style={S.legal}>
            Le présent certificat atteste de l'entretien réalisé selon les règles de l'art sur les éléments accessibles
            de l'installation. Fait pour valoir ce que de droit — à présenter à votre assurance ou dans le cadre de la
            prévention des risques d'incendie et d'hygiène.
          </Text>
          <View style={S.foot}>
            <Text style={S.footText}>
              <Text style={S.footStrong}>{P.raisonSociale}</Text> · {P.adresse}, {P.ville} · SIRET {P.siret}
            </Text>
            <Text style={S.footText}>{P.telephone} · {P.site}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
