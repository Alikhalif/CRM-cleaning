import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// PDF du contrat de sous-traitance : le contrat, puis ses deux annexes.
//
// Pourquoi un composant dédié et non `ContractPdf` : celui-ci est piloté par
// gabarit (sections + champs + clauses), c'est-à-dire des formulaires à
// remplir. Un contrat de sous-traitance est un texte juridique numéroté de 30
// ou 31 articles, suivi d'un bon de mission et d'un formulaire de rapport.
// Le plier au modèle « sections et champs » aurait découpé les articles du
// client, et leur intégrité est précisément ce qu'il faut préserver.
//
// ⚠️ AUCUN PRIX CLIENT. Les montants rendus ici sont ceux convenus avec le
// sous-traitant, reçus en props. Le composant ne lit aucune autre source.

export type SousTraitancePdfProps = {
  titre: string;
  numero: string | null;
  dateFr: string;
  modeleLabel: string;
  version: string;
  /** En-tête : les deux parties, texte déjà substitué. */
  parties: { intro: string; blocs: { titre: string; corps: string; mention: string }[]; cloture: string };
  articles: { numero: number; titre: string; corps: string; reference?: string }[];
  montants: {
    totalHt: number;
    tauxTva: number | null;
    tva: number | null;
    totalTtc: number | null;
    lignes: { label: string; quantite: number | null; unite: string; prixUnitaireHt: number | null; montantHt: number | null }[];
    frais: { label: string; montantHt: number | null }[];
  };
  bonMission: { titre: string; blocs: { titre: string; lignes: string[] }[]; pied: string[] };
  rapport: { titre: string; entete: { titre: string }[]; rubriques: { numero: number | null; titre: string }[] };
  signatures: { lieu: string; donneurOrdre: string; sousTraitant: string };
};

const C = {
  ink: "#1a1a1a", muted: "#666", line: "#d0d0d0",
  brand: "#4a3cb3", soft: "#f4f4fa",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 42, paddingBottom: 56, paddingHorizontal: 46,
    fontSize: 9, color: C.ink, fontFamily: "Helvetica", lineHeight: 1.45,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  docLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  refTxt: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.brand },
  meta: { fontSize: 7.5, color: C.muted, textAlign: "right" },
  rule: { borderBottomWidth: 1, borderBottomColor: C.line, marginVertical: 9 },

  titre: {
    fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center",
    marginBottom: 12, lineHeight: 1.3,
  },

  intro: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 7 },
  partieTitre: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.brand, marginBottom: 2 },
  partieCorps: { fontSize: 8.8, marginBottom: 3 },
  partieMention: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  cloture: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 10 },

  article: { marginTop: 9 },
  articleTitre: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  articleCorps: { fontSize: 8.6, color: "#262626" },
  articleRef: { fontSize: 7.5, color: C.muted, marginTop: 2, fontStyle: "italic" },

  blocTitre: {
    fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.brand,
    marginTop: 11, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: C.soft, paddingBottom: 2,
  },
  ligneTxt: { fontSize: 8.6, marginBottom: 2 },

  tableHead: {
    flexDirection: "row", backgroundColor: C.soft,
    paddingVertical: 3, paddingHorizontal: 4, marginTop: 6,
  },
  tr: {
    flexDirection: "row", paddingVertical: 3, paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: C.line,
  },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: C.muted },
  td: { fontSize: 8.4 },
  cLabel: { width: "46%" },
  cQte: { width: "14%", textAlign: "right" },
  cPu: { width: "20%", textAlign: "right" },
  cTot: { width: "20%", textAlign: "right" },

  totaux: { marginTop: 8, alignItems: "flex-end" },
  totalLigne: { flexDirection: "row", width: 220, justifyContent: "space-between", marginBottom: 2 },
  totalFort: {
    flexDirection: "row", width: 220, justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: C.line, paddingTop: 3, marginTop: 2,
  },
  gras: { fontFamily: "Helvetica-Bold" },

  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  signBox: { width: "45%" },
  signLabel: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  signQui: { fontSize: 7.5, color: C.muted, marginBottom: 2 },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.line, height: 48 },
  lieuDate: { fontSize: 8.6, marginTop: 14 },

  champ: {
    borderBottomWidth: 0.5, borderBottomColor: C.line,
    height: 14, marginBottom: 5,
  },
  champLabel: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", marginBottom: 1 },

  footer: {
    position: "absolute", bottom: 24, left: 46, right: 46,
    textAlign: "center", fontSize: 7, color: C.muted,
    borderTopWidth: 1, borderTopColor: C.line, paddingTop: 5,
  },
});

const euros = (n: number | null): string =>
  n == null
    ? "—"
    : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

function Pied({ numero, modeleLabel, version }: { numero: string | null; modeleLabel: string; version: string }) {
  return (
    <Text
      style={s.footer}
      fixed
      render={({ pageNumber, totalPages }) =>
        `${numero ?? "projet de contrat"} · ${modeleLabel} · version ${version}`
        + ` — page ${pageNumber} / ${totalPages}`
      }
    />
  );
}

export default function SousTraitancePdf(p: SousTraitancePdfProps) {
  const { montants: m } = p;

  return (
    <Document title={p.numero ?? p.titre}>
      {/* ── Le contrat ──────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.docLabel}>Contrat de sous-traitance</Text>
            <Text style={s.refTxt}>{p.numero ?? "Projet — non numéroté"}</Text>
          </View>
          <View>
            <Text style={s.meta}>{p.modeleLabel}</Text>
            <Text style={s.meta}>Version du modèle : {p.version}</Text>
            <Text style={s.meta}>{p.dateFr}</Text>
          </View>
        </View>
        <View style={s.rule} />

        <Text style={s.titre}>{p.titre}</Text>

        <Text style={s.intro}>{p.parties.intro}</Text>
        {p.parties.blocs.map((b) => (
          <View key={b.titre} wrap={false}>
            <Text style={s.partieTitre}>{b.titre}</Text>
            <Text style={s.partieCorps}>{b.corps}</Text>
            <Text style={s.partieMention}>{b.mention}</Text>
          </View>
        ))}
        <Text style={s.cloture}>{p.parties.cloture}</Text>

        {p.articles.map((a) => (
          <View key={a.numero} style={s.article} wrap={false}>
            <Text style={s.articleTitre}>ARTICLE {a.numero} — {a.titre}</Text>
            <Text style={s.articleCorps}>{a.corps}</Text>
            {a.reference ? <Text style={s.articleRef}>{a.reference}</Text> : null}
          </View>
        ))}

        {/* Rémunération convenue avec le sous-traitant. */}
        <Text style={s.blocTitre}>RÉMUNÉRATION CONVENUE</Text>
        {m.lignes.length > 0 ? (
          <>
            <View style={s.tableHead}>
              <Text style={[s.th, s.cLabel]}>Prestation</Text>
              <Text style={[s.th, s.cQte]}>Qté</Text>
              <Text style={[s.th, s.cPu]}>P.U. HT</Text>
              <Text style={[s.th, s.cTot]}>Montant HT</Text>
            </View>
            {m.lignes.map((l, i) => (
              <View key={i} style={s.tr}>
                <Text style={[s.td, s.cLabel]}>{l.label}</Text>
                <Text style={[s.td, s.cQte]}>
                  {l.quantite == null ? "—" : `${l.quantite} ${l.unite}`}
                </Text>
                <Text style={[s.td, s.cPu]}>{euros(l.prixUnitaireHt)}</Text>
                <Text style={[s.td, s.cTot]}>{euros(l.montantHt)}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={s.ligneTxt}>Prix forfaitaire global.</Text>
        )}

        {m.frais.length > 0 && (
          <>
            <Text style={[s.champLabel, { marginTop: 6 }]}>Frais annexes</Text>
            {m.frais.map((f, i) => (
              <View key={i} style={s.tr}>
                <Text style={[s.td, s.cLabel]}>{f.label}</Text>
                <Text style={[s.td, s.cQte]} />
                <Text style={[s.td, s.cPu]} />
                <Text style={[s.td, s.cTot]}>{euros(f.montantHt)}</Text>
              </View>
            ))}
          </>
        )}

        <View style={s.totaux}>
          <View style={s.totalLigne}>
            <Text style={s.td}>Total HT</Text>
            <Text style={[s.td, s.gras]}>{euros(m.totalHt)}</Text>
          </View>
          <View style={s.totalLigne}>
            <Text style={s.td}>
              TVA{m.tauxTva != null ? ` (${m.tauxTva} %)` : ""}
            </Text>
            <Text style={s.td}>{m.tva == null ? "à déterminer" : euros(m.tva)}</Text>
          </View>
          <View style={s.totalFort}>
            <Text style={[s.td, s.gras]}>Total TTC</Text>
            <Text style={[s.td, s.gras]}>
              {m.totalTtc == null ? "à déterminer" : euros(m.totalTtc)}
            </Text>
          </View>
        </View>

        <Text style={s.lieuDate}>
          Fait à {p.signatures.lieu || "……………………"}, le {p.dateFr}, en deux exemplaires originaux.
        </Text>
        <View style={s.signRow}>
          <View style={s.signBox}>
            <Text style={s.signLabel}>Le Donneur d&apos;ordre</Text>
            <Text style={s.signQui}>{p.signatures.donneurOrdre}</Text>
            <View style={s.signLine} />
          </View>
          <View style={s.signBox}>
            <Text style={s.signLabel}>Le Sous-traitant</Text>
            <Text style={s.signQui}>{p.signatures.sousTraitant}</Text>
            <View style={s.signLine} />
          </View>
        </View>

        <Pied numero={p.numero} modeleLabel={p.modeleLabel} version={p.version} />
      </Page>

      {/* ── Annexe 1 : bon de mission ───────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.titre}>{p.bonMission.titre}</Text>
        {p.bonMission.blocs.map((b) => (
          <View key={b.titre} wrap={false}>
            <Text style={s.blocTitre}>{b.titre}</Text>
            {b.lignes.map((l, i) => <Text key={i} style={s.ligneTxt}>{l}</Text>)}
          </View>
        ))}
        <View style={s.rule} />
        {p.bonMission.pied.map((l, i) => <Text key={i} style={s.articleRef}>{l}</Text>)}
        <Pied numero={p.numero} modeleLabel={p.modeleLabel} version={p.version} />
      </Page>

      {/* ── Annexe 2 : rapport de fin d'intervention ────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.titre}>{p.rapport.titre}</Text>
        <Text style={s.articleRef}>
          À remplir et à remettre APRÈS l&apos;intervention. Une prestation prévue au
          contrat n&apos;est jamais réputée réalisée : seule la déclaration du
          sous-traitant, contresignée, en fait foi.
        </Text>

        <Text style={s.blocTitre}>IDENTIFICATION</Text>
        {p.rapport.entete.map((e) => (
          <View key={e.titre}>
            <Text style={s.champLabel}>{e.titre}</Text>
            <View style={s.champ} />
          </View>
        ))}

        {p.rapport.rubriques.map((r, i) => (
          <View key={`${r.numero}-${i}`} wrap={false}>
            <Text style={s.champLabel}>
              {r.numero != null ? `${r.numero}. ` : ""}{r.titre}
            </Text>
            <View style={s.champ} />
          </View>
        ))}

        <View style={s.signRow}>
          <View style={s.signBox}>
            <Text style={s.signLabel}>Le Sous-traitant</Text>
            <Text style={s.signQui}>Nom, date et signature</Text>
            <View style={s.signLine} />
          </View>
          <View style={s.signBox}>
            <Text style={s.signLabel}>Visa du Donneur d&apos;ordre</Text>
            <Text style={s.signQui}>Réception du rapport</Text>
            <View style={s.signLine} />
          </View>
        </View>

        <Pied numero={p.numero} modeleLabel={p.modeleLabel} version={p.version} />
      </Page>
    </Document>
  );
}
