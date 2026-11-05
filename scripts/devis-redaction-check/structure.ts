// Structure obligatoire du devis — §2, §3, §4, §5, §10, §14.

import {
  analyser, construireIntroduction, construireSections, construireTitre,
  corrigerRepetitions,
  genererAuNiveau, genererContenuDevis,
} from "@/lib/generation/devis-contenu";
import { notesDevis } from "@/lib/generation/devis-depuis-decouverte";
import { MENTION_PRODUITS, RESERVE_REEVALUATION } from "@/lib/generation/bibliotheque-redaction";
import { bilan, contient, decouverteNettoyage, eq, faux, titre, vrai } from "./commun";

// Le dossier de référence du §4 : appartement de 90 m², encrassement
// important, vitrerie comprise.
const REFERENCE = decouverteNettoyage(
  {
    typeNettoyage: "approfondi",
    typeBienNet: "appartement",
    nbPieces: 3,
    nbSdb: 1,
    nbWc: 1,
    sols: ["sol_carrelage"],
    cuisineEquipee: "oui",
    vitrerie: "oui",
    vitrerieFenetres: 6,
    vitrerieFaces: "les_deux",
  },
  { surfaceM2: 90, etatSalete: "important" },
);

// ══════════════════════════════════════════════════════════════════════
titre("§14 — les trois niveaux sont séparés");

const analyse = analyser(REFERENCE);
vrai("analyser() renvoie une analyse", analyse !== null);
if (!analyse) bilan("structure");

vrai("l'analyse porte la famille retenue", analyse.famille === "approfondi");
vrai("l'analyse porte les thèmes validés", analyse.themes.length > 0);
vrai(
  "l'analyse ne contient aucun texte rédigé (pas de titre, pas d'introduction)",
  !("designation" in analyse) && !("introduction" in analyse),
);
vrai(
  "construireTitre / construireIntroduction / construireSections sont appelables séparément",
  typeof construireTitre(analyse) === "string"
  && typeof construireIntroduction(analyse) === "string"
  && Array.isArray(construireSections(analyse)),
);

// ══════════════════════════════════════════════════════════════════════
titre("§3 — génération du titre");

const c = genererContenuDevis(REFERENCE);
vrai("un contenu est produit", c !== null);
if (!c) bilan("structure");

eq("titre exact", c.designation, "NETTOYAGE APPROFONDI D'UN APPARTEMENT DE 90 M² AVEC VITRERIE");
vrai("le titre est en majuscules", c.designation === c.designation.toUpperCase());
faux("le titre ne contient pas « remise en état »", contient(c.designation, "remise en etat"));
faux("le titre n'est pas vague", c.designation.trim().length < 12);

// §3.3 — la vitrerie n'apparaît au titre que si elle est validée.
const sansVitrerie = genererContenuDevis(
  decouverteNettoyage(
    { typeNettoyage: "approfondi", typeBienNet: "appartement", vitrerie: "non" },
    { surfaceM2: 90 },
  ),
);
faux(
  "vitrerie refusée → absente du titre",
  contient(sansVitrerie?.designation ?? "", "vitrerie"),
);

// §3.3 — lessivage des murs ET plafonds.
const lessivage = genererContenuDevis(
  decouverteNettoyage({
    typeNettoyage: "approfondi",
    murs: "murs_lessivage",
    mursSurface: "totale",
    plafonds: "oui",
    plafondsType: "plafonds_lessivage",
  }),
);
vrai(
  "murs + plafonds → « AVEC LESSIVAGE DES MURS ET PLAFONDS »",
  contient(lessivage?.designation ?? "", "avec lessivage des murs et plafonds"),
  lessivage?.designation,
);

// §3.3 — jamais « type Diogène » sur un simple encrassement.
const tresSale = genererContenuDevis(
  decouverteNettoyage({ typeNettoyage: "tres_sale", typeBienNet: "maison" }, {}),
);
faux(
  "un logement très sale n'est JAMAIS qualifié de « type Diogène »",
  contient(tresSale?.designation ?? "", "diogene"),
  tresSale?.designation,
);
const dio = genererContenuDevis({
  sector: "diogene", surfaceM2: 60, etatSalete: "extreme",
  details: { typeNettoyage: "insalubre", dioEncombrement: "dio_enc_extreme" },
});
vrai(
  "le secteur Diogène, lui, le porte au titre",
  contient(dio?.designation ?? "", "type diogene"),
  dio?.designation,
);

// §3.1 — pas de longueur excessive, pas de répétition.
const charge = genererContenuDevis(
  decouverteNettoyage({
    typeNettoyage: "approfondi",
    typeBienNet: "maison",
    vitrerie: "oui",
    vitrerieFenetres: 4,
    murs: "murs_lessivage",
    plafonds: "oui",
    complements: ["desinfection", "decontamination", "debarras"],
    debarrasVolume: "5-10",
  }),
);
vrai(
  "au plus trois compléments au titre (§3.1 : sans longueur excessive)",
  (charge?.designation.match(/ ET |, /g) ?? []).length <= 3,
  charge?.designation,
);
vrai(
  "aucun mot répété deux fois dans le titre",
  (() => {
    const mots = (charge?.designation ?? "").split(/\s+/).filter((m) => m.length > 4);
    return new Set(mots).size === mots.length;
  })(),
  charge?.designation,
);

// ══════════════════════════════════════════════════════════════════════
titre("§4 — introduction professionnelle");

vrai("l'introduction existe", c.introduction.trim().length > 0);
vrai(
  "elle situe la nature de l'intervention",
  contient(c.introduction, "intervention de nettoyage approfondi"),
  c.introduction,
);
vrai("elle cite le type de bien", contient(c.introduction, "appartement"));
vrai("elle cite la superficie connue", contient(c.introduction, "90 m²"));
vrai(
  "elle cite le niveau d'encrassement",
  contient(c.introduction, "encrassement important"),
  c.introduction,
);
faux(
  "elle n'emploie jamais « remise en état »",
  contient(c.introduction, "remise en etat"),
);
vrai(
  "elle annonce les principales opérations",
  contient(c.introduction, "la prestation comprend"),
);
vrai(
  "elle reste concise : quatre opérations citées au plus",
  (c.introduction.match(/,/g) ?? []).length <= 4,
  c.introduction,
);
vrai("deux phrases, pas davantage", c.introduction.split("\n\n").length === 2);

// Sans surface saisie, l'introduction ne l'invente pas (interdiction 8).
const sansSurface = genererContenuDevis(
  decouverteNettoyage({ typeNettoyage: "approfondi", typeBienNet: "studio" }),
);
faux(
  "aucune surface inventée quand elle n'est pas saisie",
  /\d+\s*m²/.test(sansSurface?.introduction ?? ""),
  sansSurface?.introduction,
);

// ══════════════════════════════════════════════════════════════════════
titre("§5 — sections techniques développées, pas une recopie du formulaire");

vrai("plusieurs sections sont produites", c.sections.length >= 4, `${c.sections.length} sections`);
vrai(
  "chaque section porte un titre professionnel",
  c.sections.every((s) => s.titre.length > 10),
);
vrai(
  "chaque section porte plusieurs opérations",
  c.sections.every((s) => s.operations.length >= 2),
  JSON.stringify(c.sections.map((s) => [s.titre, s.operations.length])),
);
vrai(
  "les sections sont numérotées dans le rendu",
  /^1\. /m.test(c.detail) && /^2\. /m.test(c.detail),
);

// Le résultat attendu du §5, repris verbatim.
const attenduVerbatim = [
  "Dépoussiérage minutieux de l'ensemble des surfaces accessibles.",
  "Nettoyage des plinthes, angles, recoins et zones difficiles d'accès.",
  "Nettoyage des portes, poignées, encadrements et huisseries.",
  "Nettoyage des interrupteurs et éléments fixes accessibles.",
  "Dégraissage des plans de travail et surfaces accessibles.",
  "Nettoyage approfondi des façades des meubles présents.",
  "Nettoyage de l'évier et de la robinetterie.",
  "Nettoyage des crédences et surfaces carrelées accessibles.",
  "Nettoyage approfondi des équipements sanitaires.",
  "Détartrage des robinetteries, vasques et équipements concernés.",
  "Élimination des dépôts de savon et de calcaire.",
  "Nettoyage des surfaces vitrées prévues au devis.",
  "Élimination des traces et salissures.",
];
for (const ligne of attenduVerbatim) {
  vrai(`§5 verbatim — « ${ligne.slice(0, 44)}… »`, contient(c.detail, ligne));
}

// Le MAUVAIS RÉSULTAT du §5 : une puce par champ, sans développement.
faux(
  "pas de puce « Nettoyage cuisine. » (recopie du formulaire)",
  /- Nettoyage cuisine\.$/m.test(c.detail),
);
faux(
  "pas de puce « Nettoyage vitres. »",
  /- Nettoyage vitres\.$/m.test(c.detail),
);
vrai(
  "le détail est plus développé que la découverte ne compte de champs",
  c.sections.reduce((n, s) => n + s.operations.length, 0) > Object.keys(REFERENCE.details).length,
);

// §19.18 — aucune opération répétée d'une section à l'autre.
const toutes = c.sections.flatMap((s) => s.operations);
eq("aucune opération répétée", toutes.length, new Set(toutes).size);

// ══════════════════════════════════════════════════════════════════════
titre("§10 — niveau de développement");

const n1 = genererContenuDevis(
  decouverteNettoyage({ typeNettoyage: "classique", typeBienNet: "studio" }),
);
eq("un nettoyage courant est de niveau 1", n1?.niveau, 1);

eq("un nettoyage approfondi est de niveau 2", c.niveau, 2);

const n3 = genererContenuDevis({
  sector: "nettoyage", surfaceM2: 70, etatSalete: "extreme",
  details: { typeNettoyage: "insalubre", dioDechets: ["dio_biologiques"], dioVolume: "20-40" },
});
eq("un logement insalubre est de niveau 3", n3?.niveau, 3);

const nb1 = n1?.sections.reduce((n, s) => n + s.operations.length, 0) ?? 0;
const nb3 = n3?.sections.reduce((n, s) => n + s.operations.length, 0) ?? 0;
vrai(
  "le niveau 3 développe davantage que le niveau 1",
  nb3 > nb1,
  `niveau 1 : ${nb1} opérations · niveau 3 : ${nb3}`,
);
vrai(
  "un devis simple n'est pas allongé artificiellement",
  nb1 <= 12,
  `${nb1} opérations`,
);

// §17, boutons « Améliorer » et « Développer » : le niveau se relève, jamais
// ne s'abaisse.
const releve = genererAuNiveau(
  decouverteNettoyage({ typeNettoyage: "classique", typeBienNet: "studio" }), 3,
);
eq("genererAuNiveau(3) relève un niveau 1", releve?.niveau, 3);
const abaisse = genererAuNiveau(
  { sector: "nettoyage", surfaceM2: 70, etatSalete: "extreme",
    details: { typeNettoyage: "insalubre" } },
  1,
);
eq("genererAuNiveau(1) n'abaisse PAS un niveau 3", abaisse?.niveau, 3);

// ══════════════════════════════════════════════════════════════════════
titre("§2 et §22 — les trois blocs dans le document");

const notes = notesDevis(c);
vrai("bloc PRESTATION présent", /^PRESTATION$/m.test(notes));
vrai("bloc DÉTAIL DE LA PRESTATION présent", /^DÉTAIL DE LA PRESTATION$/m.test(notes));
vrai("bloc RÉSERVES présent", /^RÉSERVES$/m.test(notes));
eq(
  "les trois blocs, dans l'ordre",
  [
    notes.indexOf("PRESTATION\n") < notes.indexOf("DÉTAIL DE LA PRESTATION"),
    notes.indexOf("DÉTAIL DE LA PRESTATION") < notes.indexOf("RÉSERVES"),
  ],
  [true, true],
);
faux(
  "plus de double intitulé « DÉTAIL DES PRESTATIONS »",
  notes.includes("DÉTAIL DES PRESTATIONS"),
);
eq(
  "un seul intitulé DÉTAIL",
  (notes.match(/DÉTAIL DE LA PRESTATION/g) ?? []).length,
  1,
);
vrai("le bloc PRESTATION porte le titre", notes.includes(c.designation));
vrai("le bloc PRESTATION porte l'introduction", notes.includes(c.introduction.split("\n")[0]));

// ══════════════════════════════════════════════════════════════════════
titre("§11 et §12 — mentions et réserves");

vrai("la mention « produits » du §11 est reprise mot pour mot", c.detail.includes(MENTION_PRODUITS));
vrai(
  "la clause de réévaluation du §12.2 est reprise mot pour mot",
  c.reserves.includes(RESERVE_REEVALUATION),
);

const demenagement = genererContenuDevis({
  sector: "demenagement", surfaceM2: null, etatSalete: null,
  details: { logementDepart: "appartement_t3", volume: "20-30", typeDemenagement: "complet" },
  villeDepart: "Paris", villeArrivee: "Lyon",
});
faux(
  "pas de mention « produits de nettoyage » sur un déménagement",
  (demenagement?.detail ?? "").includes(MENTION_PRODUITS),
);
vrai(
  "la clause de réévaluation figure aussi sur un déménagement",
  (demenagement?.reserves ?? "").includes(RESERVE_REEVALUATION),
);

// ══════════════════════════════════════════════════════════════════════
titre("§17.4 — corriger les répétitions");

const avecDoublons = [
  "1. Nettoyage approfondi des espaces intérieurs",
  "",
  "- Dépoussiérage minutieux de l'ensemble des surfaces accessibles.",
  "- Nettoyage des portes, poignées, encadrements et huisseries.",
  "- Dépoussiérage minutieux de l'ensemble des surfaces accessibles.",
  "",
  "2. Nettoyage de la vitrerie",
  "",
  "- Nettoyage des surfaces vitrées prévues au devis.",
  "",
  "3. Section entièrement redondante",
  "",
  "- Nettoyage des portes, poignées, encadrements et huisseries.",
].join("\n");

const corrige = corrigerRepetitions(avecDoublons);
eq("deux puces en double retirées", corrige.retirees, 2);
eq("une seule occurrence de la puce dédoublonnée",
  (corrige.texte.match(/Dépoussiérage minutieux/g) ?? []).length, 1);
vrai("la puce conservée garde sa place (la première)",
  corrige.texte.indexOf("Dépoussiérage minutieux") < corrige.texte.indexOf("Nettoyage des portes"));
faux("la section vidée de ses puces disparaît",
  corrige.texte.includes("Section entièrement redondante"), corrige.texte);
eq("les sections restantes sont renumérotées 1 et 2",
  (corrige.texte.match(/^\d+\. /gm) ?? []), ["1. ", "2. "]);
vrai("les intitulés de section sont préservés",
  corrige.texte.includes("1. Nettoyage approfondi des espaces intérieurs")
  && corrige.texte.includes("2. Nettoyage de la vitrerie"));

// Idempotence : un second passage ne retire plus rien.
eq("un second passage ne retire plus rien", corrigerRepetitions(corrige.texte).retirees, 0);

// Elle ne reformule pas, et ne touche pas au texte hors puces.
const sansDoublon = notesDevis(c);
eq("un devis généré ne contient AUCUNE répétition à corriger",
  corrigerRepetitions(sansDoublon).retirees, 0);
eq("un devis propre est rendu inchangé",
  corrigerRepetitions(sansDoublon).texte, sansDoublon);

// Deux formulations différentes du même sens sont CONSERVÉES toutes les deux :
// les départager demanderait de juger du sens, et le §19.19 interdit
// d'appauvrir un descriptif.
const proches = ["- Nettoyage des sols.", "- Nettoyage de tous les sols."].join("\n");
eq("deux formulations proches mais distinctes sont conservées",
  corrigerRepetitions(proches).retirees, 0);

// ══════════════════════════════════════════════════════════════════════
titre("Hors périmètre");

for (const s of ["urgence", "enr", "renovation"]) {
  eq(
    `secteur ${s} → aucun contenu produit`,
    genererContenuDevis({ sector: s, surfaceM2: 50, etatSalete: null, details: {} }),
    null,
  );
}

// ── Exemple complet, pour relecture humaine ───────────────────────────
console.log(`\n${"─".repeat(74)}`);
console.log("  EXEMPLE DE SORTIE — dossier de référence du §4");
console.log("─".repeat(74));
console.log(notes);
console.log("─".repeat(74));

bilan("structure");
