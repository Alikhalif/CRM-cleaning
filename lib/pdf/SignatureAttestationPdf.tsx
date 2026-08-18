import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// Page « BON POUR ACCORD » ajoutée au devis signé (§8). Rendue en @react-pdf
// puis fusionnée après le devis original via pdf-lib.

export type AttestationData = {
  ref: string;
  docNum: string;
  entityName: string;
  signerName: string;
  signerEmail: string;
  dateLabel: string;
  timeLabel: string;
  signatureType: "drawn" | "typed";
  typedName?: string;
  signatureImage?: string | null; // data URL PNG (tracé)
  originalSha256: string;
  requestId: string;
};

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, color: "#1a1a2e", fontFamily: "Helvetica" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  sub: { fontSize: 10, color: "#6b7280", marginBottom: 24 },
  box: { border: "1pt solid #d1d5db", borderRadius: 6, padding: 18, marginBottom: 16 },
  accord: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0f766e", marginBottom: 14 },
  row: { flexDirection: "row", marginBottom: 6 },
  label: { width: 130, color: "#6b7280" },
  value: { flex: 1, fontFamily: "Helvetica-Bold" },
  sigZone: { marginTop: 8, border: "1pt solid #d1d5db", borderRadius: 6, height: 120, alignItems: "center", justifyContent: "center", padding: 8 },
  sigImg: { maxHeight: 100, objectFit: "contain" },
  typed: { fontSize: 30, fontFamily: "Helvetica-Oblique", color: "#111827" },
  meta: { marginTop: 20, fontSize: 8, color: "#9ca3af" },
  mono: { fontFamily: "Courier", fontSize: 8 },
});

export default function SignatureAttestationPdf({ data }: { data: AttestationData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Attestation de signature électronique</Text>
        <Text style={s.sub}>
          {data.entityName} · Devis {data.docNum} · Référence {data.ref}
        </Text>

        <View style={s.box}>
          <Text style={s.accord}>BON POUR ACCORD</Text>
          <View style={s.row}><Text style={s.label}>Nom / Prénom</Text><Text style={s.value}>{data.signerName || "—"}</Text></View>
          <View style={s.row}><Text style={s.label}>E-mail</Text><Text style={s.value}>{data.signerEmail}</Text></View>
          <View style={s.row}><Text style={s.label}>Date</Text><Text style={s.value}>{data.dateLabel}</Text></View>
          <View style={s.row}><Text style={s.label}>Heure</Text><Text style={s.value}>{data.timeLabel}</Text></View>
          <View style={s.row}><Text style={s.label}>Signature</Text><Text style={s.value}>{data.signatureType === "drawn" ? "Tracée" : "Typographique"}</Text></View>

          <View style={s.sigZone}>
            {data.signatureType === "drawn" && data.signatureImage ? (
              <Image src={data.signatureImage} style={s.sigImg} />
            ) : (
              <Text style={s.typed}>{data.typedName || data.signerName}</Text>
            )}
          </View>
        </View>

        <View style={s.meta}>
          <Text>Référence de signature : {data.ref}</Text>
          <Text>Identifiant de la demande : {data.requestId}</Text>
          <Text style={s.mono}>Empreinte du document (SHA-256) : {data.originalSha256}</Text>
          <Text style={{ marginTop: 8 }}>
            Ce document a été signé électroniquement. La piste d&apos;audit complète (horodatage,
            adresse IP, chronologie des événements) figure dans le certificat de preuve associé,
            conservé séparément.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
