import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ContractClause, ContractTemplate, FieldValue } from "@/lib/documents/contracts-types";

// Renderer PDF GÉNÉRIQUE : rend n'importe quel contrat à partir de son template
// (sections + champs) + les valeurs saisies + les clauses. Ajouter un nouveau
// modèle ne nécessite donc AUCUN nouveau composant (§16).

export type ContractPdfEmitter = {
  enseigne: string; raisonSociale: string; adresse: string; ville: string;
  siret: string; telephone: string; email: string; site: string;
};

export type ContractPdfProps = {
  emitter: ContractPdfEmitter;
  ref: string;
  title: string;
  dateFr: string;
  sections: ContractTemplate["sections"];
  values: Record<string, FieldValue>;
  clauses: ContractClause[];
  // Nature du document (contrat | attestation | rapport). Une « attestation »
  // porte un en-tête « ATTESTATION » et une signature à une seule partie
  // (l'émetteur atteste) — pas de case « Le client ».
  kind?: string;
};

const C = { ink: "#1a1a1a", muted: "#666", line: "#d0d0d0", brand: "#0b6e58", soft: "#f4f6f5" };

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontSize: 9.5, color: C.ink, fontFamily: "Helvetica", lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  enseigne: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.brand },
  small: { fontSize: 8, color: C.muted },
  docBox: { alignItems: "flex-end" },
  docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  ref: { fontSize: 9, color: C.muted, marginTop: 2 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.line, marginVertical: 10 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 12, textTransform: "uppercase" },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.brand, marginTop: 10, marginBottom: 5, borderBottomWidth: 1, borderBottomColor: C.soft, paddingBottom: 2 },
  row: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", marginBottom: 5, paddingRight: 10 },
  fieldFull: { width: "100%", marginBottom: 5 },
  label: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", marginBottom: 1 },
  value: { fontSize: 9.5 },
  clause: { marginTop: 8 },
  clauseTitle: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  clauseBody: { fontSize: 8.5, color: "#333", marginTop: 2 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 26 },
  signBox: { width: "45%" },
  signLabel: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.line, height: 46 },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, textAlign: "center", fontSize: 7.5, color: C.muted, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 },
});

function fmt(v: FieldValue): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

export function ContractPdf({ emitter, ref, title, dateFr, sections, values, clauses, kind }: ContractPdfProps) {
  const isAttestation = kind === "attestation";
  const docLabel = isAttestation ? "ATTESTATION" : kind === "rapport" ? "RAPPORT" : "CONTRAT";
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.enseigne}>{emitter.enseigne}</Text>
            <Text style={s.small}>{emitter.raisonSociale} · SIRET {emitter.siret}</Text>
            <Text style={s.small}>{emitter.adresse}, {emitter.ville}</Text>
            <Text style={s.small}>{emitter.telephone} · {emitter.email}</Text>
          </View>
          <View style={s.docBox}>
            <Text style={s.docTitle}>{docLabel}</Text>
            <Text style={s.ref}>{ref}</Text>
            <Text style={s.ref}>Le {dateFr}</Text>
          </View>
        </View>

        <View style={s.rule} />
        <Text style={s.title}>{title}</Text>

        {sections.map((sec) => (
          <View key={sec.title} wrap={false}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <View style={s.row}>
              {sec.fields.map((f) => (
                <View key={f.name} style={f.full || f.type === "textarea" || f.type === "checkgroup" ? s.fieldFull : s.field}>
                  <Text style={s.label}>{f.label}</Text>
                  <Text style={s.value}>{fmt(values[f.name])}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {clauses.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Conditions générales</Text>
            {clauses.map((c) => (
              <View key={c.title} style={s.clause} wrap={false}>
                <Text style={s.clauseTitle}>{c.title}</Text>
                <Text style={s.clauseBody}>{c.body}</Text>
              </View>
            ))}
          </View>
        )}

        {isAttestation ? (
          // Attestation = une seule partie : l'émetteur atteste (pas de case client).
          <View style={[s.signRow, { justifyContent: "flex-end" }]}>
            <View style={s.signBox}>
              <Text style={s.signLabel}>Fait pour servir et valoir ce que de droit — {emitter.enseigne}</Text>
              <View style={s.signLine} />
            </View>
          </View>
        ) : (
          <View style={s.signRow}>
            <View style={s.signBox}>
              <Text style={s.signLabel}>Le client (lu et approuvé)</Text>
              <View style={s.signLine} />
            </View>
            <View style={s.signBox}>
              <Text style={s.signLabel}>{emitter.enseigne}</Text>
              <View style={s.signLine} />
            </View>
          </View>
        )}

        <Text style={s.footer} fixed>
          {emitter.raisonSociale} — {emitter.adresse}, {emitter.ville} — {emitter.site}
        </Text>
      </Page>
    </Document>
  );
}
