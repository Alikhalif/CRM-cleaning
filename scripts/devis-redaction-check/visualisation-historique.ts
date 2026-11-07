// LOT E — visualisation, historique des versions, préremplissage.
//
// ── CE QUE CES CONTRÔLES FIGENT ──────────────────────────────────────
//
// 1. UNE SEULE fenêtre de visualisation, employée par les trois écrans. La
//    recopier produirait trois comportements qui divergent au premier
//    correctif — ce que le Lot B a supprimé côté rendu.
// 2. Le TEXTE CONTRACTUEL atteint le PDF. C'est l'anomalie critique trouvée
//    en branchant l'historique : `notes` était sélectionné en base et jamais
//    rendu, donc le devis partait au client SANS AUCUNE RÉSERVE.
// 3. L'historique ne casse rien tant que sa migration n'est pas appliquée.
// 4. Les TROIS parcours de création rédigent avec le même moteur.
//
// PORTÉE : logique pure + lecture des fichiers du dépôt. Aucun réseau,
// aucune base, aucun secret.

import { existsSync, readFileSync } from "node:fs";
import { euroPdf, texteLisiblePdf } from "@/lib/pdf/montant";
import { formatEUR } from "@/lib/leads";
import {
  LIBELLE_ORIGINE, versionDEmission,
  type Historique, type OrigineVersion, type VersionDocument,
} from "@/lib/devis/versions-shared";

let ko = 0;
function vrai(nom: string, cond: boolean, detail?: string) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}${detail ? `\n    ${detail}` : ""}`);
  if (!cond) ko++;
}
function eq<T>(nom: string, a: T, b: T) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  vrai(nom, ok, ok ? undefined : `attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);
}
const lu = (p: string): string => (existsSync(p) ? readFileSync(p, "utf8") : "");

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 1. Une seule fenêtre de visualisation, trois écrans ==");
// ═══════════════════════════════════════════════════════════════════════
const FENETRE = "components/ApercuDocument/ApercuDocument.tsx";
vrai("la fenêtre partagée existe", existsSync(FENETRE));
{
  const f = lu(FENETRE);
  vrai("elle affiche le document FINAL, pas un rendu réimplémenté",
    f.includes("/preview-pdf"));
  vrai("… et un seul moteur de rendu est en jeu",
    !f.includes("renderToBuffer") && !f.includes("genererDevisBuffer"));
  vrai("elle se ferme au clavier", f.includes('e.key === "Escape"'));
  vrai("elle prend le focus à l'ouverture", f.includes("panneau.current?.focus()"));
  vrai("elle ne peut rien envoyer",
    !f.includes("sendDocument") && !f.includes("markDocumentSent"));
  vrai("le bouton « Actualiser » n'apparaît que si l'appelant sait rafraîchir",
    f.includes("{onActualiser && ("));
}
for (const [ecran, fichier] of [
  ["l'éditeur de devis", "app/(app)/devis/new/QuoteEditor.tsx"],
  ["la fiche du document", "app/(app)/_shared/DocumentActions.tsx"],
  ["la comptabilité", "app/(app)/comptabilite/Comptabilite.tsx"],
] as [string, string][]) {
  vrai(`${ecran} emploie la fenêtre partagée`,
    lu(fichier).includes("<ApercuDocument"));
}
{
  // Avant le Lot E, ces deux écrans ouvraient un ONGLET et on perdait sa place.
  const fiche = lu("app/(app)/_shared/DocumentActions.tsx");
  vrai("la fiche n'ouvre plus le PDF dans un onglet depuis sa barre d'actions",
    !/<a\s+href=\{`\/api\/documents\/\$\{doc\.id\}\/preview-pdf`\}/.test(fiche));
  vrai("… son bouton porte l'icône œil", fiche.includes('name="eye"'));
  const compta = lu("app/(app)/comptabilite/Comptabilite.tsx");
  vrai("la comptabilité propose la visualisation depuis la liste",
    compta.includes("Visualiser le document"));
  vrai("… et la fenêtre est montée UNE fois, pas une par ligne",
    (compta.match(/<ApercuDocument/g) ?? []).length === 1);
}

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 2. Le texte contractuel atteint le PDF ==");
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ ANOMALIE CRITIQUE corrigée le 2026-11-07. `notes` était SÉLECTIONNÉ en
// base et jamais rendu : `DocumentDetail["doc"].notes` valait toujours
// `undefined`. Le moteur rédigeait PRESTATION / DÉTAIL / RÉSERVES,
// l'éditeur l'affichait, le commercial le relisait — et le client recevait
// un document sans une seule réserve.
{
  const serveur = lu("lib/documents-server.ts");
  vrai("le type de frontière DÉCLARE enfin la colonne",
    /notes: string \| null;/.test(serveur));
  vrai("… et le lecteur la rend", serveur.includes("notes: row.notes ?? undefined"));

  const net = lu("lib/pdf/DevisNettoyagePdf.tsx");
  vrai("le rendu propreté lit le descriptif", net.includes("doc.notes"));
  vrai("… il ne se contente plus d'un paragraphe générique",
    net.includes("blocs.length > 0"));
  vrai("… et il distingue les intertitres du moteur",
    net.includes("estIntertitre("));
  vrai("le repli générique est conservé pour un document sans descriptif",
    net.includes("Réalisation d&apos;une prestation de nettoyage"));

  const doc = lu("lib/pdf/DocumentPdf.tsx");
  vrai("le rendu générique lit aussi le descriptif", doc.includes("doc.notes"));
}

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 3. L'historique des versions ==");
// ═══════════════════════════════════════════════════════════════════════
{
  const ORIGINES: OrigineVersion[] = ["moteur", "assiste", "manuel", "emission"];
  for (const o of ORIGINES) {
    vrai(`« ${o} » porte un libellé lisible`, (LIBELLE_ORIGINE[o] ?? "").length > 5);
  }
  eq("quatre origines, pas une de plus", Object.keys(LIBELLE_ORIGINE).length, 4);

  const v = (version: number, origine: OrigineVersion): VersionDocument => ({
    id: `v${version}`, version, designation: "T", notes: "N",
    origine, regles: [], note: "", creeLe: "2026-11-07T10:00:00.000Z",
    creePar: null, auteur: null,
  });

  const h: Historique = {
    disponible: true,
    versions: [v(3, "emission"), v(2, "manuel"), v(1, "moteur")],
  };
  eq("la version d'émission est retrouvée", versionDEmission(h)?.version, 3);
  eq("… et c'est bien celle qui engage", versionDEmission(h)?.origine, "emission");

  const sansEmission: Historique = { disponible: true, versions: [v(1, "moteur")] };
  eq("un devis jamais envoyé n'en a pas", versionDEmission(sansEmission), null);

  const absent: Historique = { disponible: false, motif: "migration non appliquée" };
  eq("un historique indisponible n'en invente pas", versionDEmission(absent), null);
}

console.log("\n-- La migration n'est pas appliquée : rien ne doit casser --");
{
  const serveur = lu("lib/devis/versions-server.ts");
  vrai("l'écriture est en MEILLEUR EFFORT, comme le journal d'audit",
    serveur.includes("Promise<boolean>") && serveur.includes("catch {"));
  vrai("une table absente est reconnue, pas confondue avec une panne",
    serveur.includes("42P01") && serveur.includes("PGRST205"));
  vrai("… et la lecture rend « indisponible » avec un motif en clair",
    serveur.includes("disponible: false"));
  vrai("une course sur le numéro de version est rattrapée une fois",
    serveur.includes('error.code !== "23505"'));

  const panneau = lu("app/(app)/_shared/HistoriqueVersions.tsx");
  vrai("le panneau DIT pourquoi l'historique est vide",
    panneau.includes("historique.motif"));
  // ⚠️ On cherche l'absence d'un BOUTON, pas l'absence du mot : l'en-tête du
  // panneau explique précisément pourquoi il ne restaure pas, et ma première
  // version se déclenchait sur sa propre documentation.
  vrai("… et ne propose aucun bouton de restauration",
    !/>\s*Restaurer/i.test(panneau) && !panneau.includes("onRestaurer"));
}

console.log("\n-- Les quatre origines sont réellement branchées --");
for (const [origine, fichier] of [
  ["moteur", "app/(app)/leads/[id]/devis-actions.ts"],
  ["emission", "app/(app)/_shared/document-actions.ts"],
] as [string, string][]) {
  vrai(`« ${origine} » est enregistrée par ${fichier.split("/").pop()}`,
    new RegExp(`origine: "${origine}"`).test(lu(fichier)));
}
// « manuel » n'existe plus en littéral : l'origine est CHOISIE selon ce qui
// a servi depuis le dernier enregistrement. C'est ce choix qu'il faut figer,
// et non la présence d'une chaîne.
vrai("« manuel » est l'origine par défaut de l'éditeur",
  lu("app/(app)/devis/new/actions.ts")
    .includes('reglesAssistees.length > 0 ? "assiste" : "manuel"'));
{
  const act = lu("app/(app)/devis/new/actions.ts");
  vrai("« assiste » se distingue de « manuel » selon ce qui a servi",
    act.includes('reglesAssistees.length > 0 ? "assiste" : "manuel"'));
  const ed = lu("app/(app)/devis/new/QuoteEditor.tsx");
  vrai("l'éditeur retient les fonctions employées", ed.includes("reglesAssistees"));
  vrai("… et les remet à zéro après enregistrement",
    ed.includes("setReglesAssistees([])"));
  const ra = lu("app/(app)/devis/new/RedactionAssistee.tsx");
  eq("chaque application signale la fonction employée",
    (ra.match(/onAssistance\?\.\(/g) ?? []).length, 4);

  // ⚠️ L'ordre se mesure DANS la fonction concernée. Ma première version le
  // mesurait sur tout le fichier, et `indexOf` trouvait la version
  // d'émission de `markDocumentSent`, déclarée plus haut.
  const envoi = lu("app/(app)/_shared/document-actions.ts");
  const debut = envoi.indexOf("export async function sendDocumentByEmail");
  const corps = debut >= 0 ? envoi.slice(debut) : "";
  const garde = corps.indexOf("if (!result.ok) return { ok: false, error: `Brevo");
  const version = corps.indexOf('origine: "emission"');
  vrai("la version d'émission est écrite APRÈS un envoi réussi",
    garde > 0 && version > garde,
    `garde=${garde} version=${version}`);
  vrai("… et « marquer envoyé » en écrit une aussi",
    debut > 0 && envoi.slice(0, debut).includes('origine: "emission"'));
}

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 4. Les trois parcours de création rédigent pareil ==");
// ═══════════════════════════════════════════════════════════════════════
for (const [parcours, fichier] of [
  ["fiche lead → Générer le devis", "app/(app)/leads/[id]/devis-actions.ts"],
  ["/devis/nouveau", "lib/devis/prefill.ts"],
  ["/devis/new?lead=", "app/(app)/devis/new/page.tsx"],
] as [string, string][]) {
  vrai(`${parcours} appelle le module partagé`,
    lu(fichier).includes("redigerPourLead("));
}
{
  const page = lu("app/(app)/devis/new/page.tsx");
  vrai("la rédaction d'ouverture ne s'applique PAS à une reprise",
    page.includes("leadCtx && !sourceId"));
  const ed = lu("app/(app)/devis/new/QuoteEditor.tsx");
  vrai("un document repris garde SON texte",
    ed.includes("prefill?.notes ?? redaction?.notes"));
  vrai("… et ses lignes, jamais remplacées par la désignation du moteur",
    ed.includes("lines: prefill"));
  vrai("la désignation du moteur devient le libellé de la 1re ligne",
    ed.includes("label: redaction.designation"));
  // ⚠️ `unitPriceHt: 0` figure trois fois dans ce fichier : chercher la
  // chaîne ne dit rien de LA ligne préremplie. On éprouve le bloc qui la
  // construit, depuis la désignation du moteur jusqu'à sa remise.
  const bloc = (() => {
    const d = ed.indexOf("label: redaction.designation");
    return d < 0 ? "" : ed.slice(d, d + 260);
  })();
  vrai("… à 0 € : le texte ne porte jamais de montant",
    bloc.includes("unitPriceHt: 0,"));
  vrai("… et aucun montant n'y est inventé",
    bloc !== "" && !/unitPriceHt: [1-9]/.test(bloc));
  vrai("les signalements du moteur sont affichés",
    ed.includes("redaction?.signalements"));
}

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 5. Les montants sont lisibles dans le PDF ==");
// ═══════════════════════════════════════════════════════════════════════
//
// `Intl.NumberFormat("fr-FR")` sépare les milliers par une ESPACE FINE
// INSÉCABLE (U+202F). C'est la typographie française juste, et le navigateur
// l'affiche. Les polices intégrées de react-pdf n'ont pas ce glyphe : leur
// encodage le fait tomber sur la BARRE OBLIQUE, et « 4 850 € » s'imprimait
// « 4/850 € » sur tous les devis et toutes les factures.
//
// Vérifié le 2026-11-07 par extraction de la couche texte, pas par lecture
// d'une image : le PDF contenait bien U+002F.
{
  const m = euroPdf(4850);
  vrai("aucune espace fine insécable ne subsiste", !/[\u202F\u2009\u00A0]/.test(m), m);
  vrai("… ni de barre oblique dans un montant", !m.includes("/"), m);
  vrai("les milliers restent séparés", /4\s850/.test(m), m);
  vrai("la devise est conservée", m.includes("€"), m);
  eq("un petit montant est intact", euroPdf(12).replace(/\s/g, " "),
    formatEUR(12).replace(/[\u202F\u2009\u00A0]/g, " "));
  vrai("la valeur n'est jamais altérée",
    euroPdf(1234567).replace(/[^0-9,]/g, "") === formatEUR(1234567).replace(/[^0-9,]/g, ""));
  vrai("texteLisiblePdf traite un texte déjà composé",
    !/[\u202F\u00A0]/.test(texteLisiblePdf("Acompte\u00A0: 1\u202F500\u00A0€")));
}
for (const f of ["lib/pdf/DocumentPdf.tsx", "lib/pdf/DevisNettoyagePdf.tsx"]) {
  const src = lu(f);
  vrai(`${f.split("/").pop()} compose ses montants pour le PDF`,
    src.includes("euroPdf("));
  vrai("… et n'emploie plus la forme destinée à l'écran",
    !src.includes("formatEUR("));
}

// ═══════════════════════════════════════════════════════════════════════
console.log("\n== 6. Aucune condition morte dans les fichiers du lot ==");
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️ GARDE GÉNÉRALE, née du test par mutation. Trois contrôles de cette
// suite étaient aveugles à la même chose : `if (false)` et `{false && …}`
// neutralisent un comportement sans retirer la ligne que le contrôle
// cherche. Chercher la ligne ne suffit donc pas.
//
// La règle vaut au-delà des tests : une condition constamment fausse est du
// code mort déguisé en code vivant, et elle se lit comme une intention.
for (const f of [
  "components/ApercuDocument/ApercuDocument.tsx",
  "app/(app)/_shared/DocumentActions.tsx",
  "app/(app)/_shared/HistoriqueVersions.tsx",
  "app/(app)/comptabilite/Comptabilite.tsx",
  "app/(app)/devis/new/page.tsx",
  "app/(app)/devis/new/QuoteEditor.tsx",
  "app/(app)/devis/new/actions.ts",
  "lib/devis/versions-server.ts",
  "lib/devis/versions-shared.ts",
  "lib/documents-server.ts",
  "lib/pdf/DevisNettoyagePdf.tsx",
]) {
  const src = lu(f);
  const mortes = [
    /\bif\s*\(\s*false\s*\)/,
    // `false &&` partout, et pas seulement en JSX : une conjonction
    // constamment fausse est du code mort où qu'elle soit. Le test par
    // mutation a montré que `const x = false && …` échappait à la garde.
    /\bfalse\s*&&/,
    /\?\s*\(?\s*false\s*\)?\s*:/,
  ].filter((re) => re.test(src));
  vrai(`${f.split("/").pop()} : aucune condition morte`, mortes.length === 0,
    mortes.length > 0 ? `motif(s) : ${mortes.map(String).join(" ")}` : undefined);
}

console.log(`\n${ko === 0 ? "  ✅ TOUT PASSE" : `  ❌ ${ko} ÉCHEC(S)`}`);
process.exit(ko === 0 ? 0 : 1);
