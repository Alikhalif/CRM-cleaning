import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// Certificat de signature électronique (§9) — dossier de preuve conservé
// séparément du devis signé, exploitable en cas de contestation.

export type CertificateData = {
  ref: string;
  docNum: string;
  fileName: string;
  documentId: string;
  originalSha256: string;
  signedSha256: string;
  signerName: string;
  signerEmail: string;
  signerPhone?: string | null;
  dateLabel: string;
  timeLabel: string;
  timezone: string;
  signatureType: string;
  authMethod: string;
  ip: string;
  userAgent: string;
  browser: string;
  device: string;
  sessionId: string;
  events: { at: string; label: string }[];
};

const s = StyleSheet.create({
  page: { padding: 44, fontSize: 9.5, color: "#1a1a2e", fontFamily: "Helvetica" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sub: { fontSize: 9, color: "#6b7280", marginBottom: 18 },
  section: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0f766e", marginTop: 14, marginBottom: 6, borderBottom: "1pt solid #e5e7eb", paddingBottom: 3 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 150, color: "#6b7280" },
  value: { flex: 1 },
  mono: { fontFamily: "Courier", fontSize: 8 },
  ev: { flexDirection: "row", marginBottom: 3 },
  evTime: { width: 130, fontFamily: "Courier", fontSize: 8.5, color: "#374151" },
  evLabel: { flex: 1 },
  foot: { marginTop: 20, fontSize: 7.5, color: "#9ca3af", borderTop: "1pt solid #e5e7eb", paddingTop: 8 },
});

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, ...(mono ? [s.mono] : [])]}>{value || "—"}</Text>
    </View>
  );
}

export default function SignatureCertificatePdf({ data }: { data: CertificateData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Certificat de signature électronique</Text>
        <Text style={s.sub}>Référence {data.ref} · émis le {data.dateLabel} à {data.timeLabel} ({data.timezone})</Text>

        <Text style={s.section}>Document</Text>
        <Field label="Numéro de devis" value={data.docNum} />
        <Field label="Nom du fichier" value={data.fileName} />
        <Field label="Identifiant document" value={data.documentId} mono />
        <Field label="Empreinte avant signature" value={data.originalSha256} mono />
        <Field label="Empreinte document signé" value={data.signedSha256} mono />

        <Text style={s.section}>Signataire</Text>
        <Field label="Nom / Prénom" value={data.signerName} />
        <Field label="E-mail" value={data.signerEmail} />
        <Field label="Téléphone" value={data.signerPhone ?? "—"} />

        <Text style={s.section}>Signature</Text>
        <Field label="Référence unique" value={data.ref} />
        <Field label="Date / Heure" value={`${data.dateLabel} ${data.timeLabel}`} />
        <Field label="Fuseau horaire" value={data.timezone} />
        <Field label="Mode de signature" value={data.signatureType} />
        <Field label="Authentification" value={data.authMethod} />

        <Text style={s.section}>Informations techniques</Text>
        <Field label="Adresse IP" value={data.ip} />
        <Field label="Navigateur" value={data.browser} />
        <Field label="Appareil" value={data.device} />
        <Field label="Identifiant de session" value={data.sessionId} mono />
        <Field label="User-Agent" value={data.userAgent} />

        <Text style={s.section}>Chronologie</Text>
        {data.events.map((e, i) => (
          <View style={s.ev} key={i}>
            <Text style={s.evTime}>{e.at}</Text>
            <Text style={s.evLabel}>{e.label}</Text>
          </View>
        ))}

        <Text style={s.foot}>
          Ce certificat atteste de l&apos;intégrité documentaire (empreintes SHA-256), de
          l&apos;identification du signataire, de son consentement explicite et de la chronologie
          horodatée des événements, enregistrés côté serveur. Signature électronique simple —
          conforme dans son architecture aux principes du règlement eIDAS relatifs à la preuve
          électronique, sans revendication de signature qualifiée.
        </Text>
      </Page>
    </Document>
  );
}
