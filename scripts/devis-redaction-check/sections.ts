// REPRISE CIBLÉE D'UNE SECTION — correction C4 du 2026-11-06.
//
// ── LE MANQUE CORRIGÉ ────────────────────────────────────────────────
//
// La rédaction assistée ne savait remplacer que des blocs entiers : tout le
// devis, le titre, ou les réserves. Un commercial qui trouvait une seule
// section trop maigre n'avait que « Régénérer le devis » — qui emporte aussi
// les phrases qu'il avait écrites à la main ailleurs. En pratique il
// renonçait, ou il perdait son travail.
//
// ── L'INVARIANT QUE CES CONTRÔLES FIGENT ─────────────────────────────
//
// Hors des puces de la section visée, le texte ressort IDENTIQUE, caractère
// pour caractère. C'est mesuré, pas affirmé : chaque remplacement est vérifié
// en comparant les deux textes amputés de la plage remplacée. Ce qui doit
// survivre : les autres sections, la numérotation telle qu'elle est écrite,
// les paragraphes de queue (mention des produits, conditions d'accès,
// éléments relevés), le bloc RÉSERVES, et les lignes vides.
//
// ── ET CE QUE LE MOTEUR REFUSE ───────────────────────────────────────
//
// Une section nommée à la main n'autorise aucune prestation. Le découpage la
// voit — c'est du texte — mais l'action serveur refuse de la remplir, parce
// que la découverte ne la valide pas. C'est la règle du 2026-11-06, appliquée
// ici : constater n'est pas commander.
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret.

import {
  MOTIF_REMPLACEMENT_LABEL,
  decouperSections,
  normaliserTitre,
  pucesAilleurs,
  remplacerPucesSection,
  titresDeSections,
} from "@/lib/generation/devis-sections";
import { genererContenuDevis } from "@/lib/generation/devis-contenu";
import { notesDevis } from "@/lib/generation/devis-depuis-decouverte";

let ko = 0;
function vrai(nom: string, cond: boolean, detail?: string) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}${detail ? `\n    ${detail}` : ""}`);
  if (!cond) ko++;
}
function eq<T>(nom: string, a: T, b: T) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  console.log(ja === jb ? `  ok    ${nom}` : `  ECHEC ${nom}\n    obtenu  ${ja}\n    attendu ${jb}`);
  if (ja !== jb) ko++;
}

/**
 * LA MESURE DE L'INVARIANT.
 *
 * On retire de chaque texte les lignes de puces de la section visée, puis on
 * compare le reste caractère pour caractère. Une différence ailleurs — un
 * numéro recalculé, une ligne vide perdue, un paragraphe de queue déplacé —
 * ressort immédiatement.
 */
function resteIntact(avant: string, apres: string, titre: string): { ok: boolean; ecart: string } {
  const amputer = (t: string) => {
    const s = decouperSections(t).find((x) => normaliserTitre(x.titre) === normaliserTitre(titre));
    const lignes = t.split("\n");
    if (!s?.plage) return lignes.join("\n");
    lignes.splice(s.plage.debut, s.plage.fin - s.plage.debut + 1);
    return lignes.join("\n");
  };
  const a = amputer(avant), b = amputer(apres);
  if (a === b) return { ok: true, ecart: "" };
  const la = a.split("\n"), lb = b.split("\n");
  const i = la.findIndex((l, n) => l !== lb[n]);
  return {
    ok: false,
    ecart: `ligne ${i + 1} — avant ${JSON.stringify(la[i])} / après ${JSON.stringify(lb[i])}`,
  };
}

// Un descriptif qui porte TOUT ce qui doit survivre : trois sections, la
// mention des produits, les conditions d'accès, les éléments relevés, les
// informations complémentaires, et le bloc RÉSERVES.
const TEXTE = [
  "PRESTATION",
  "",
  "Nettoyage approfondi d'un appartement de 85 m².",
  "",
  "DÉTAIL DE LA PRESTATION",
  "",
  "1. Nettoyage intérieur",
  "",
  "- Dépoussiérage de l'ensemble des surfaces",
  "- Nettoyage des sols",
  "",
  "2. Sanitaires",
  "",
  "- Détartrage de la douche",
  "- Nettoyage des WC",
  "- Ligne ajoutée à la main par le commercial",
  "",
  "3. Cuisine",
  "",
  "- Dégraissage des plans de travail",
  "",
  "Utilisation de produits 100 % français et 100 % écologiques.",
  "",
  "Conditions d'accès relevées : absence d'ascenseur.",
  "",
  "Éléments relevés lors de la découverte : traces de nicotine sur les murs.",
  "",
  "Informations complémentaires communiquées : le client sera absent.",
  "",
  "RÉSERVES",
  "",
  "Le devis pourra être réévalué si l'état constaté diffère.",
].join("\n");

// ══════════════════════════════════════════════════════════════════════
console.log("\n1. Découpage : où commence une section, où elle s'arrête");
// ══════════════════════════════════════════════════════════════════════

const sections = decouperSections(TEXTE);
eq("trois sections", sections.length, 3);
eq("titres dans l'ordre", titresDeSections(TEXTE),
  ["Nettoyage intérieur", "Sanitaires", "Cuisine"]);
eq("numéros lus dans le texte", sections.map((s) => s.numero), [1, 2, 3]);
eq("puces de la première", sections[0].puces,
  ["Dépoussiérage de l'ensemble des surfaces", "Nettoyage des sols"]);
eq("la ligne écrite à la main compte comme une puce", sections[1].puces.length, 3);

// Le point qui compte : la dernière section s'arrête AVANT la mention des
// produits. Sans cela, une reprise de « Cuisine » effacerait l'allégation
// réglementaire et les trois paragraphes de queue.
eq("la dernière section ne contient qu'une puce", sections[2].puces, ["Dégraissage des plans de travail"]);
vrai("la mention des produits n'est pas avalée par la section",
  !sections[2].puces.some((p) => /produits d'entretien/.test(p)));
vrai("ni les conditions d'accès",
  !sections[2].puces.some((p) => /Conditions d'acc/.test(p)));
vrai("ni le bloc RÉSERVES",
  !sections[2].puces.some((p) => /RÉSERVES|réévalué/.test(p)));

eq("aucune section dans un texte sans en-tête numéroté",
  decouperSections("PRESTATION\n\nUn texte libre.\n\n- une puce orpheline"), []);
eq("texte vide", decouperSections(""), []);

// ══════════════════════════════════════════════════════════════════════
console.log("\n2. L'INVARIANT : hors de la section visée, rien ne bouge");
// ══════════════════════════════════════════════════════════════════════

for (const titre of ["Nettoyage intérieur", "Sanitaires", "Cuisine"]) {
  const r = remplacerPucesSection(TEXTE, titre, ["Première ligne neuve", "Deuxième ligne neuve"]);
  vrai(`« ${titre} » : remplacement accepté`, r.ok);
  if (!r.ok) continue;
  const inv = resteIntact(TEXTE, r.texte, titre);
  vrai(`« ${titre} » : tout le reste est identique`, inv.ok, inv.ecart);
  eq(`« ${titre} » : les nouvelles lignes y sont`,
    decouperSections(r.texte).find((s) => s.titre === titre)?.puces,
    ["Première ligne neuve", "Deuxième ligne neuve"]);
}

// Les trois paragraphes de queue et le bloc RÉSERVES, nommément.
const apresCuisine = remplacerPucesSection(TEXTE, "Cuisine", ["Une seule ligne"]);
vrai("la mention des produits survit à une reprise de la dernière section",
  apresCuisine.ok && apresCuisine.texte.includes(
    "Utilisation de produits 100 % français et 100 % écologiques."));
vrai("les conditions d'accès survivent",
  apresCuisine.ok && apresCuisine.texte.includes("Conditions d'accès relevées : absence d'ascenseur."));
vrai("les éléments relevés survivent",
  apresCuisine.ok && apresCuisine.texte.includes("Éléments relevés lors de la découverte"));
vrai("les informations complémentaires survivent",
  apresCuisine.ok && apresCuisine.texte.includes("Informations complémentaires communiquées"));
vrai("le bloc RÉSERVES survit",
  apresCuisine.ok && apresCuisine.texte.includes("RÉSERVES\n\nLe devis pourra être réévalué"));

// Et la ligne écrite à la main dans une AUTRE section survit : c'est tout
// l'intérêt de la reprise ciblée face à « Régénérer le devis ».
vrai("la ligne écrite à la main dans une autre section survit",
  apresCuisine.ok && apresCuisine.texte.includes("Ligne ajoutée à la main par le commercial"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n3. La numérotation vient du texte, elle n'est JAMAIS recalculée");
// ══════════════════════════════════════════════════════════════════════
//
// Un descriptif réordonné à la main doit le rester. Renuméroter « pour bien
// faire » modifierait un texte que personne n'a demandé de modifier.

const DESORDRE = [
  "3. Cuisine",
  "",
  "- Dégraissage",
  "",
  "1. Sanitaires",
  "",
  "- Détartrage",
].join("\n");
const rd = remplacerPucesSection(DESORDRE, "Sanitaires", ["Détartrage complet"]);
vrai("remplacement accepté sur un texte réordonné", rd.ok);
eq("les numéros restent 3 puis 1",
  rd.ok ? decouperSections(rd.texte).map((s) => s.numero) : null, [3, 1]);
vrai("et l'ordre des sections est conservé",
  rd.ok && rd.texte.indexOf("Cuisine") < rd.texte.indexOf("Sanitaires"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n4. Ce que le remplacement refuse, et comment il le dit");
// ══════════════════════════════════════════════════════════════════════

const introuvable = remplacerPucesSection(TEXTE, "Désinsectisation", ["x"]);
eq("un titre absent est refusé", introuvable.ok ? null : introuvable.motif, "section_introuvable");
vrai("et le motif est une phrase lisible",
  MOTIF_REMPLACEMENT_LABEL.section_introuvable.length > 40);

const AMBIGU = "1. Sanitaires\n\n- A\n\n2. Sanitaires\n\n- B";
const amb = remplacerPucesSection(AMBIGU, "Sanitaires", ["C"]);
eq("deux sections homonymes : on ne devine pas", amb.ok ? null : amb.motif, "section_ambigue");

for (const puces of [[], [""], ["   ", ""]]) {
  const r = remplacerPucesSection(TEXTE, "Cuisine", puces);
  eq(`${JSON.stringify(puces)} : refusé, une section vide serait une suppression`,
    r.ok ? null : r.motif, "puces_vides");
}
// Un refus ne modifie RIEN : pas de texte à moitié remplacé.
vrai("un refus ne renvoie aucun texte",
  !("texte" in introuvable) && !("texte" in amb));

// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Appariement du titre : la casse et les accents ne décident pas");
// ══════════════════════════════════════════════════════════════════════

for (const variante of ["nettoyage interieur", "NETTOYAGE INTÉRIEUR", "Nettoyage  intérieur",
  "nettoyage intérieur."]) {
  const r = remplacerPucesSection(TEXTE, variante, ["Ligne neuve"]);
  vrai(`« ${variante} » retrouve la section`, r.ok && r.titre === "Nettoyage intérieur",
    r.ok ? r.titre : JSON.stringify(r));
}
vrai("mais un autre titre ne la retrouve pas",
  !remplacerPucesSection(TEXTE, "Nettoyage extérieur", ["x"]).ok);

eq("normalisation", normaliserTitre("  Désinfection / Décontamination  "),
  "desinfection decontamination");

// ══════════════════════════════════════════════════════════════════════
console.log("\n6. Une section sans puce reçoit les lignes après son titre");
// ══════════════════════════════════════════════════════════════════════

const VIDEE = "1. Sanitaires\n\n2. Cuisine\n\n- Dégraissage";
const rv = remplacerPucesSection(VIDEE, "Sanitaires", ["Détartrage"]);
vrai("remplacement accepté sur une section vidée à la main", rv.ok);
eq("la ligne est posée dans la bonne section",
  rv.ok ? decouperSections(rv.texte).find((s) => s.titre === "Sanitaires")?.puces : null,
  ["Détartrage"]);
eq("la section suivante n'a pas changé",
  rv.ok ? decouperSections(rv.texte).find((s) => s.titre === "Cuisine")?.puces : null,
  ["Dégraissage"]);
// Sans ligne vide entre titre et puces, on ne la crée pas deux fois.
const SERRE = "1. Sanitaires\n2. Cuisine\n\n- Dégraissage";
const rs = remplacerPucesSection(SERRE, "Sanitaires", ["Détartrage"]);
vrai("forme serrée : une seule ligne vide est insérée",
  rs.ok && !rs.texte.includes("\n\n\n"), rs.ok ? JSON.stringify(rs.texte) : "");

// ══════════════════════════════════════════════════════════════════════
console.log("\n7. pucesAilleurs : ne pas réintroduire ce qui est déjà écrit");
// ══════════════════════════════════════════════════════════════════════

const ailleurs = pucesAilleurs(TEXTE, "Sanitaires");
vrai("les puces des autres sections y sont",
  ailleurs.has(normaliserTitre("Nettoyage des sols"))
  && ailleurs.has(normaliserTitre("Dégraissage des plans de travail")));
vrai("celles de la section visée n'y sont PAS",
  !ailleurs.has(normaliserTitre("Détartrage de la douche")));
vrai("la comparaison est insensible à la casse et aux accents",
  pucesAilleurs(TEXTE, "Cuisine").has(normaliserTitre("NETTOYAGE DES SOLS")));
eq("un texte sans autre section ne donne rien",
  pucesAilleurs("1. Cuisine\n\n- Dégraissage", "Cuisine").size, 0);

// ══════════════════════════════════════════════════════════════════════
console.log("\n8. Sur un VRAI devis produit par le moteur");
// ══════════════════════════════════════════════════════════════════════
//
// Le texte fabriqué plus haut est lisible mais c'est un décor. Ici le
// descriptif sort du moteur : si le découpage avait une hypothèse fausse sur
// la mise en page réelle, elle se verrait là.

const contenu = genererContenuDevis({
  sector: "nettoyage",
  surfaceM2: 120,
  etatSalete: "important",
  details: {
    typeNettoyage: "approfondi", typeBienNet: "maison", nbSdb: 2,
    opt_degraissage_cuisine: "oui", opt_vitres: "oui",
  },
  contexteIntervention: "Logement libre de tout occupant.",
  mentionProduits: "Utilisation de produits 100 % français et 100 % écologiques.",
});
vrai("devis produit", contenu !== null);
const reelles = contenu ? titresDeSections(notesDevis(contenu)) : [];
eq("les sections du texte sont celles du moteur",
  reelles, (contenu?.sections ?? []).map((s) => s.titre));
vrai("au moins deux sections, sinon le contrôle ne prouve rien", reelles.length >= 2,
  JSON.stringify(reelles));

const texteReel = contenu ? notesDevis(contenu) : "";
for (const titre of reelles) {
  const r = remplacerPucesSection(texteReel, titre, ["Ligne de contrôle"]);
  vrai(`« ${titre} » : remplacée`, r.ok);
  if (!r.ok) continue;
  const inv = resteIntact(texteReel, r.texte, titre);
  vrai(`« ${titre} » : le reste du devis est intact`, inv.ok, inv.ecart);
  // Et les réserves du moteur, qui protègent l'entreprise, sont toujours là.
  vrai(`« ${titre} » : le bloc RÉSERVES est intact`,
    r.texte.includes((contenu?.reserves ?? "").trim()));
}

// Le dernier point, et c'est celui qui justifie la fonction : reprendre une
// section ne remet PAS les autres sections dans leur état d'origine.
if (reelles.length >= 2) {
  const mainTenue = texteReel.replace(
    `- ${contenu!.sections[1].operations[0]}`,
    "- Phrase réécrite à la main par le commercial");
  const r = remplacerPucesSection(mainTenue, reelles[0], ["Ligne neuve"]);
  vrai("une phrase réécrite à la main dans une autre section survit",
    r.ok && r.texte.includes("Phrase réécrite à la main par le commercial"));
}

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
