// REFORMULATION D'UN TEXTE DE DEVIS — correction C5 du 2026-11-06.
//
// ── CE QUI EST VÉRIFIÉ, ET DANS QUEL ORDRE D'IMPORTANCE ─────────────
//
// 1. LA REFORMULATION NE TOUCHE PAS AU TEXTE DU MOTEUR. Si elle réécrivait sa
//    propre sortie, l'un des deux aurait tort — et le commercial verrait son
//    devis changer sans raison. Mesuré sur quatre familles de nettoyage.
// 2. ELLE EST IDEMPOTENTE. Deux passages donnent le même texte : sans cela,
//    cliquer deux fois produirait deux devis différents.
// 3. ELLE NE PROMET JAMAIS DAVANTAGE. Aucune règle n'introduit un terme qui
//    engage l'entreprise sur un résultat.
// 4. ELLE CORRIGE LE MÉCANIQUE. Sept défauts ont été trouvés dans ces
//    règles → quatre en les sondant, trois de plus en les contrôlant.
//    Chacun est figé ici par son propre contrôle, nommé : une règle de
//    correction qui se trompe écrit la faute dans un document contractuel.
// 5. ELLE SIGNALE LE CONTRACTUEL SANS LE RÉÉCRIRE. Une promesse, une garantie,
//    un délai, un prix restent DANS le texte, et remontent comme points à
//    revoir. C'est au commercial de trancher le fond de son devis.
// 6. ELLE NE CASSE PAS LA STRUCTURE que la reprise ciblée (C4) lit : mêmes
//    en-têtes, mêmes numéros, mêmes paragraphes de queue.
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret.

import {
  NOMS_DE_REGLES,
  pointsARevoir,
  reformuler,
  reformulerPrestation,
  retenirSousGardeFou,
} from "@/lib/generation/devis-reformulation";
import { genererContenuDevis } from "@/lib/generation/devis-contenu";
import { notesDevis } from "@/lib/generation/devis-depuis-decouverte";
import { titresDeSections } from "@/lib/generation/devis-sections";

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

const MENTION = "Utilisation de produits d'entretien 100 % français et 100 % écologiques.";

const FAMILLES: Record<string, Record<string, unknown>> = {
  "nettoyage approfondi": {
    typeNettoyage: "approfondi", typeBienNet: "maison", nbSdb: 2,
    opt_degraissage_cuisine: "oui", opt_vitres: "oui",
  },
  "fin de bail": { typeNettoyage: "fin_bail", typeBienNet: "appartement", nbSdb: 1 },
  "après incendie": {
    typeNettoyage: "apres_incendie", typeBienNet: "maison", suieEtendue: "plusieurs_pieces",
  },
  "Diogène": {
    typeNettoyage: "diogene", typeBienNet: "appartement",
    dioVolume: "a_evaluer", dioNuisibles: "oui",
  },
};

const devisDe = (details: Record<string, unknown>) => genererContenuDevis({
  sector: "nettoyage", surfaceM2: 110, etatSalete: "important",
  details, contexteIntervention: "Logement libre de tout occupant.",
  mentionProduits: MENTION,
});

// ══════════════════════════════════════════════════════════════════════
console.log("\n1. LE POINT CAPITAL : aucun effet sur le texte du moteur");
// ══════════════════════════════════════════════════════════════════════
//
// Le correcteur et le rédacteur suivent les MÊMES conventions — apostrophes
// droites, pas d'insécable, point final sur les puces, « produits
// d'entretien ». Si la reformulation modifiait la sortie du moteur, l'un des
// deux aurait tort, et le commercial verrait son devis bouger sans raison.

for (const [nom, details] of Object.entries(FAMILLES)) {
  const c = devisDe(details);
  vrai(`« ${nom} » : devis produit`, c !== null);
  if (!c) continue;
  const t = notesDevis(c);
  const r = reformuler(t);
  vrai(`« ${nom} » : la reformulation ne change RIEN`, r.texte === t,
    r.corrections.map((x) => x.regle).join(", "));
  eq(`« ${nom} » : aucune correction rapportée`, r.corrections.map((x) => x.regle), []);
  eq(`« ${nom} » : aucune règle écartée`, r.bloquees.map((x) => x.regle), []);
}

// ══════════════════════════════════════════════════════════════════════
console.log("\n2. Idempotence : deux passages, un seul résultat");
// ══════════════════════════════════════════════════════════════════════

const SALE = [
  "1. Sanitaires",
  "",
  "-  detartrage de la douche  ",
  "- nettoyage des wc au 2eme etage",
  "- surface de 85m2 traitee a 100%",
  "- nettoyage du du sol avec des produits de nettoyage",
].join("\n");

const p1 = reformuler(SALE);
const p2 = reformuler(p1.texte);
eq("le second passage ne corrige plus rien", p2.corrections.map((x) => x.regle), []);
vrai("et rend exactement le même texte", p2.texte === p1.texte,
  JSON.stringify([p1.texte, p2.texte]));
vrai("le premier passage, lui, a bien corrigé", p1.corrections.length > 0,
  JSON.stringify(p1.corrections.map((x) => x.regle)));

// ══════════════════════════════════════════════════════════════════════
console.log("\n3. LE GARDE-FOU : aucune règle ne promet davantage");
// ══════════════════════════════════════════════════════════════════════
//
// Deux niveaux, et il faut les deux.
//
// LA DÉCISION, testée directement. Aucune règle actuelle n'introduit de
// promesse : le garde-fou est donc DORMANT en exploitation, et une mutation
// qui le neutralise ne casserait rien d'observable. C'est précisément pour
// cela que la décision est isolée dans `retenirSousGardeFou` et contrôlée
// ici : un garde-fou qu'on ne sait pas tester n'est pas un garde-fou.
//
// LA PROPRIÉTÉ, mesurée sur le corpus : le nombre de termes engageants ne
// monte jamais, et aucune règle n'est écartée — ce qui dit qu'aujourd'hui
// aucune règle ne promet, pas que le garde-fou serait inutile demain.

// ── La décision ────────────────────────────────────────────────────
const NEUTRE = "- Nettoyage des sols.";
vrai("une substitution qui n'ajoute aucune promesse est retenue",
  retenirSousGardeFou(NEUTRE, "- Lavage des sols."));
vrai("une substitution qui AJOUTE une promesse est écartée",
  !retenirSousGardeFou(NEUTRE, "- Nettoyage impeccable des sols."));
for (const promesse of ["garanti", "impeccable", "comme neuf", "totalement propre",
  "nettoyé à 100 %", "sans aucune trace", "désinfection"]) {
  vrai(`« ${promesse} » introduit : écarté`,
    !retenirSousGardeFou(NEUTRE, `${NEUTRE} ${promesse}`));
}
vrai("retirer une promesse est en revanche accepté",
  retenirSousGardeFou("- Nettoyage impeccable des sols.", NEUTRE));
vrai("et un texte identique passe",
  retenirSousGardeFou(NEUTRE, NEUTRE));

// ── La propriété sur le corpus ─────────────────────────────────────

const ENGAGEANTS = /\bgarantis?e?s?\b|\bimpeccables?\b|\bparfaitement\b|\bcomme neufs?\b|\bà neuf\b|\btotalement\b|\bintégralement\b|\bentièrement\b|\bnickel\b|\béradication\b|\bdésinfection\b|\bstérilisation\b|\baucune trace\b/gi;
const compter = (t: string) => (t.match(ENGAGEANTS) ?? []).length;

const CORPUS = [
  SALE,
  "- nettoyage a fond des vitres",
  "- les sols sont très sales",
  "- intervention au rdc et au 1er etage, sdb comprise",
  "- travaux realises dans le but de relouer",
  "- Dépoussiérage de l’ensemble des surfaces",
  "- pas mal de traces sur les murs",
  ...Object.values(FAMILLES).map((d) => { const c = devisDe(d); return c ? notesDevis(c) : ""; }),
];
for (const [i, t] of CORPUS.entries()) {
  if (!t) continue;
  const r = reformuler(t);
  vrai(`corpus ${i + 1} : le nombre de promesses ne monte pas`,
    compter(r.texte) <= compter(t),
    `avant ${compter(t)} / après ${compter(r.texte)}`);
  eq(`corpus ${i + 1} : aucune règle écartée`, r.bloquees.length, 0);
}

// ══════════════════════════════════════════════════════════════════════
console.log("\n4. Les corrections mécaniques");
// ══════════════════════════════════════════════════════════════════════

const CAS: [string, string, string][] = [
  // [ce qu'on teste, entrée, sortie attendue]
  ["apostrophe courbe redressée",
    "- Dépoussiérage de l’ensemble des surfaces",
    "- Dépoussiérage de l'ensemble des surfaces."],
  ["espace insécable remplacé",
    "- Surface de 85 m² traitée",
    "- Surface de 85 m² traitée."],
  ["espaces en trop resserrés",
    "-  Nettoyage   des    sols  ",
    "- Nettoyage des sols."],
  ["espace avant les deux-points",
    "- Pièces concernées: cuisine et séjour",
    "- Pièces concernées : cuisine et séjour."],
  ["espace après la virgule",
    "- Cuisine,séjour et couloir",
    "- Cuisine, séjour et couloir."],
  ["espace parasite avant la virgule",
    "- Cuisine , séjour",
    "- Cuisine, séjour."],
  ["pourcentage détaché",
    "- Décapage à 100% des sols",
    "- Décapage à 100 % des sols."],
  ["mètres carrés en exposant",
    "- Surface de 85m2",
    "- Surface de 85 m²."],
  ["mètres cubes en exposant",
    "- Volume estimé à 20m3",
    "- Volume estimé à 20 m³."],
  ["majuscule initiale posée",
    "- nettoyage des sols.",
    "- Nettoyage des sols."],
  ["point final ajouté",
    "- Nettoyage des sols",
    "- Nettoyage des sols."],
  ["deux-points final laissé tel quel",
    "- Pièces concernées :",
    "- Pièces concernées :"],
  ["etc. dédoublé",
    "- Sols, murs, plinthes, etc...",
    "- Sols, murs, plinthes, etc."],
  ["produits de nettoyage → produits d'entretien",
    "- Emploi de produits de nettoyage adaptés",
    "- Emploi de produits d'entretien adaptés."],
  ["nettoyage à fond → nettoyage approfondi",
    "- Nettoyage à fond de la cuisine",
    "- Nettoyage approfondi de la cuisine."],
  ["très sale → fortement encrassé",
    "- Four très sale",
    "- Four fortement encrassé."],
  ["abréviations développées",
    "- Sdb et wc du rdc",
    "- Salle de bains et WC du rez-de-chaussée."],
  ["afin de pouvoir → afin de",
    "- Travaux afin de pouvoir relouer",
    "- Travaux afin de relouer."],
  ["dans le but de → afin de",
    "- Travaux dans le but de relouer",
    "- Travaux afin de relouer."],
  ["pas mal de → plusieurs",
    "- Pas mal de traces relevées",
    "- Plusieurs traces relevées."],
];
for (const [quoi, avant, attendu] of CAS) {
  const r = reformuler(avant);
  eq(quoi, r.texte, attendu);
}

// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Les régressions trouvées dans ces règles, une par une");
// ══════════════════════════════════════════════════════════════════════
//
// Elles sont ici une par une, nommées, parce qu'une règle de correction qui se
// trompe écrit la faute dans un document contractuel.

// (a) « au niveau de la cuisine » devenait « sur cuisine » : l'article
//     disparaissait. La règle a été retirée du correcteur.
const tic = reformuler("- Au niveau de la cuisine, dégraissage complet");
eq("(a) « au niveau de » n'est plus réécrit",
  tic.texte, "- Au niveau de la cuisine, dégraissage complet.");
vrai("(a) mais il est signalé", tic.aRevoir.some((r) => r.regle === "tic de langage"),
  JSON.stringify(tic.aRevoir));
vrai("(a) aucune phrase du type « sur cuisine »", !/\bsur cuisine\b/.test(tic.texte));

// (b) « !! » devenait « ! ! » : la règle des espaces passait avant celle des
//     doublements et cassait son motif. L'ordre a été inversé.
eq("(b) la ponctuation doublée est réduite, pas espacée",
  reformuler("- Travail terminé !!").texte, "- Travail terminé !");
eq("(b) idem pour les points d'interrogation",
  reformuler("- Accès au local ??").texte, "- Accès au local ?");
vrai("(b) et « ponctuation doublée » précède « ponctuation collée »",
  NOMS_DE_REGLES.indexOf("ponctuation doublée") < NOMS_DE_REGLES.indexOf("ponctuation collée"),
  JSON.stringify(NOMS_DE_REGLES));

// (c) « du du sol » n'était pas corrigé : le motif exigeait trois lettres.
eq("(c) un mot de deux lettres doublé est corrigé",
  reformuler("- Nettoyage du du sol").texte, "- Nettoyage du sol.");
eq("(c) idem pour « le le »",
  reformuler("- Lavage de le le mur").texte, "- Lavage de le mur.");
eq("(c) mais « nous nous » est un pronom réfléchi, pas un doublon",
  reformuler("- Nous nous chargeons de l'évacuation").texte,
  "- Nous nous chargeons de l'évacuation.");
eq("(c) et « vous vous » non plus",
  reformuler("- Vous vous chargez du tri").texte, "- Vous vous chargez du tri.");

// (d) « 1er étage » devenait « 1re étage » : le motif lisait « er » comme
//     « ere ». « 1er » est masculin, « 1re » féminin.
eq("(d) « 1er » reste masculin", reformuler("- Intervention au 1er étage").texte,
  "- Intervention au 1er étage.");
eq("(d) « 1ère » devient « 1re »", reformuler("- 1ère ligne de prestation").texte,
  "- 1re ligne de prestation.");
eq("(d) « 2ème » devient « 2e »", reformuler("- Intervention au 2ème étage").texte,
  "- Intervention au 2e étage.");
eq("(d) « 3eme » aussi", reformuler("- Local au 3eme niveau").texte,
  "- Local au 3e niveau.");

// (e) « 100 % » : dans le garde-fou, pas dans les signalements — la mention
//     des produits, validée par l'administrateur, en porte un.
const avecMention = reformuler(`- Nettoyage des sols.\n\n${MENTION}`);
eq("(e) la mention des produits n'est pas signalée", avecMention.aRevoir.length, 0);
vrai("(e) et elle traverse la reformulation intacte",
  avecMention.texte.includes(MENTION), avecMention.texte);

// ══════════════════════════════════════════════════════════════════════
console.log("\n6. Le contractuel est SIGNALÉ, jamais réécrit");
// ══════════════════════════════════════════════════════════════════════

const CONTRACTUEL: [string, string, string][] = [
  ["promesse de résultat", "- Résultat impeccable sur toutes les surfaces", "impeccable"],
  ["promesse de résultat", "- Sols rendus comme neufs", "comme neufs"],
  ["promesse de résultat", "- Vitres nettoyées sans aucune trace", "sans aucune trace"],
  ["garantie", "- Résultat garanti sur les sanitaires", "garanti"],
  ["totalité affirmée", "- Murs totalement dégraissés", "totalement"],
  ["totalité affirmée", "- Sols intégralement décapés", "intégralement"],
  ["délai ou durée", "- Intervention en 48 heures", "en 48 heures"],
  ["délai ou durée", "- Livraison sous 3 jours", "sous 3 jours"],
  ["délai ou durée", "- Remise en état le jour même", "le jour même"],
  ["prix dans le texte", "- Forfait de 250 euros", "250 euros"],
  ["prix dans le texte", "- Supplément de 80 €", "80 €"],
  ["tic de langage", "- Au niveau des plinthes, dépoussiérage", "Au niveau des"],
  ["formulation à la première personne", "- on nettoie les murs", "On nettoie"],
];
for (const [regle, texte, extrait] of CONTRACTUEL) {
  const r = reformuler(texte);
  const vu = r.aRevoir.find((x) => x.regle === regle);
  vrai(`« ${extrait} » → ${regle}`, Boolean(vu),
    JSON.stringify(r.aRevoir.map((x) => x.regle)));
  // LE POINT QUI COMPTE : le terme est toujours dans le texte. La promesse
  // n'a pas été escamotée ; elle attend un arbitrage humain.
  const noyau = extrait.replace(/^(On|Au niveau des)\s*/, "");
  vrai(`« ${extrait} » : laissé dans le texte, pas réécrit`,
    r.texte.toLowerCase().includes(noyau.toLowerCase()), r.texte);
  vrai(`« ${extrait} » : le motif est expliqué`, (vu?.pourquoi ?? "").length > 40);
}

// Un même terme répété ne remonte qu'une fois : une liste de doublons serait
// illisible, et c'est le terme qu'on cherche, pas ses occurrences.
const repete = reformuler("- Résultat impeccable.\n- Finition impeccable.");
eq("un terme répété ne remonte qu'une fois",
  repete.aRevoir.filter((r) => r.extrait.toLowerCase() === "impeccable").length, 1);

eq("un texte sain ne remonte aucun point",
  pointsARevoir("- Dépoussiérage des surfaces accessibles.").length, 0);

// ══════════════════════════════════════════════════════════════════════
console.log("\n7. La structure que la reprise ciblée (C4) lit n'est pas cassée");
// ══════════════════════════════════════════════════════════════════════

const STRUCTURE = [
  "PRESTATION",
  "",
  "nettoyage approfondi d'un appartement de 85m2",
  "",
  "DÉTAIL DE LA PRESTATION",
  "",
  "1. Nettoyage intérieur",
  "",
  "- depoussierage des surfaces",
  "",
  "2. Sanitaires",
  "",
  "- detartrage de la douche",
  "",
  MENTION,
  "",
  "Conditions d'accès relevées : absence d'ascenseur.",
  "",
  "RÉSERVES",
  "",
  "Le devis pourra être réévalué si l'état constaté diffère.",
].join("\n");

const rs = reformuler(STRUCTURE);
eq("les sections sont les mêmes après reformulation",
  titresDeSections(rs.texte), titresDeSections(STRUCTURE));
eq("et leurs numéros aussi", titresDeSections(rs.texte).length, 2);
for (const entete of ["PRESTATION", "DÉTAIL DE LA PRESTATION", "RÉSERVES"]) {
  vrai(`l'en-tête « ${entete} » est intact`, rs.texte.includes(`\n${entete}\n`)
    || rs.texte.startsWith(`${entete}\n`), entete);
}
vrai("la mention des produits est intacte", rs.texte.includes(MENTION));
vrai("les conditions d'accès sont intactes",
  rs.texte.includes("Conditions d'accès relevées : absence d'ascenseur."));
vrai("la réserve est intacte",
  rs.texte.includes("Le devis pourra être réévalué si l'état constaté diffère."));
vrai("et les puces ont bien été corrigées",
  rs.texte.includes("- Dépoussiérage des surfaces.") === false
  && rs.texte.includes("- Depoussierage des surfaces."), rs.texte);
// Les en-têtes ne sont PAS des puces : aucun point final ne leur est ajouté.
vrai("un en-tête de section ne reçoit pas de point final",
  !/^\d+\.\s.*\.$/m.test(rs.texte.split("\n").find((l) => /^1\./.test(l)) ?? "x."));

// ══════════════════════════════════════════════════════════════════════
console.log("\n8. Une prestation isolée, et les cas vides");
// ══════════════════════════════════════════════════════════════════════

eq("une ligne sans tiret est traitée comme une puce",
  reformulerPrestation("nettoyage a fond du sol").texte, "Nettoyage a fond du sol.");
eq("le tiret d'entrée est accepté et retiré",
  reformulerPrestation("- detartrage de la douche").texte, "Detartrage de la douche.");
eq("une ligne déjà propre ressort intacte",
  reformulerPrestation("Détartrage de la douche.").texte, "Détartrage de la douche.");
eq("une prestation vide ne produit rien", reformulerPrestation("   ").texte, "");
eq("et aucune correction n'est inventée", reformulerPrestation("").corrections.length, 0);

eq("un texte vide ressort tel quel", reformuler("").texte, "");
eq("un texte d'espaces ressort tel quel", reformuler("   \n  ").texte, "   \n  ");
eq("et sans correction", reformuler("   \n  ").corrections.length, 0);

// Chaque règle appliquée est NOMMÉE : un rapport qui dit « corrigé » sans
// dire quoi ne permet pas de relire le texte.
const nomme = reformuler(SALE);
vrai("toutes les règles rapportées ont un nom connu",
  nomme.corrections.every((c) => NOMS_DE_REGLES.includes(c.regle)),
  JSON.stringify(nomme.corrections.map((c) => c.regle)));
vrai("et il y a au moins quatre règles déclarées", NOMS_DE_REGLES.length >= 4,
  String(NOMS_DE_REGLES.length));

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
