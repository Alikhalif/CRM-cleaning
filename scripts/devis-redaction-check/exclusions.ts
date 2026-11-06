// EXCLUSIONS, OBSERVATIONS ET CONTRÔLE INDÉPENDANT.
//
// ── CE QUE CES CONTRÔLES FIGENT (anomalies B3, B4, B5 du 2026-11-06) ──
//
// L'audit du moteur a produit un devis Diogène qui PROMETTAIT un traitement
// des nuisibles et un traitement des odeurs que la découverte n'avait jamais
// validés. Deux causes, et une troisième qui les a laissées passer :
//
//   B3 — `nuisibles` n'exigeait aucune validation : la case « présence de
//        nuisibles » de la découverte, une OBSERVATION, ouvrait la section ;
//   B4 — `desodorisation: avecDesodorisation || !!odeurs` faisait d'une odeur
//        constatée une prestation commandée ;
//   B5 — le garde-fou comparait les sections produites à l'analyse du moteur,
//        c'est-à-dire à sa propre décision. Circulaire, il ne pouvait pas
//        détecter un thème admis à tort — et les 369 assertions passaient.
//
// La règle de fond : UNE OBSERVATION N'EST JAMAIS UNE AUTORISATION. Constater
// renseigne le contexte ; commander engage l'entreprise. Un devis est un
// engagement contractuel, pas un compte rendu de visite.
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret.

import {
  controlerDevis,
  genererContenuDevis,
  verifierRedaction,
  type ContenuDevis,
  type Decouverte,
} from "@/lib/generation/devis-contenu";
import {
  EXCLUSION_PAR_CLE,
  THEMES_A_VALIDER,
  controlerConformite,
  controlerTexteConforme,
  exigeValidation,
} from "@/lib/generation/prestations-validation";
import { EXCLUSIONS, COMPLEMENTS } from "@/lib/discovery-nettoyage";
import {
  FAMILLES, FAMILLE_PAR_TYPE, titreDe,
} from "@/lib/generation/bibliotheque-redaction";

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

const SECTIONS = (c: ContenuDevis | null) => (c?.sections ?? []).map((s) => s.titre);
const TEXTE = (c: ContenuDevis | null) =>
  `${c?.designation ?? ""}\n${c?.detail ?? ""}`.toLowerCase();

/** Découverte Diogène de base : celle du scénario 2 de la recette. */
const diogene = (details: Record<string, unknown>): Decouverte => ({
  sector: "diogene",
  surfaceM2: 60,
  etatSalete: "extreme",
  details: {
    typeNettoyage: "insalubre",
    typeBienNet: "appartement",
    dioEncombrement: "dio_enc_important",
    dioDechets: ["dio_dechets_menagers", "dio_biologiques"],
    nbSdb: 1,
    ...details,
  },
  contexteIntervention: null,
});

// ══════════════════════════════════════════════════════════════════════
console.log("\n1. B3 — une observation n'autorise aucune prestation");
// ══════════════════════════════════════════════════════════════════════

// Nuisibles CONSTATÉS, aucun traitement commandé.
const vus = genererContenuDevis(diogene({
  dioNuisibles: "oui", dioNuisiblesTypes: ["dio_rongeurs"], complements: [],
}));
vrai("devis produit", vus !== null);
vrai("AUCUNE section « Traitement des nuisibles »",
  !SECTIONS(vus).includes("Traitement des nuisibles"), SECTIONS(vus).join(" · "));
vrai("l'observation est néanmoins rapportée au client",
  TEXTE(vus).includes("éléments relevés lors de la découverte")
  && TEXTE(vus).includes("nuisibles"));
vrai("et une réserve dit que le traitement n'est pas compris",
  (vus?.reserves ?? "").includes("traitement des nuisibles ne fait pas partie"));
eq("état de la prestation : à confirmer", vus?.etats.nuisibles, "a_confirmer");

// Nuisibles CONSTATÉS *et* traitement commandé : la section revient.
const commandes = genererContenuDevis(diogene({
  dioNuisibles: "oui", dioNuisiblesTypes: ["dio_rongeurs"], complements: ["nuisibles"],
}));
vrai("validée → la section est présente",
  SECTIONS(commandes).includes("Traitement des nuisibles"));
vrai("et les rongeurs identifiés y sont nommés", TEXTE(commandes).includes("rongeurs"));
eq("état : inclus", commandes?.etats.nuisibles, "inclus");

// Aucune observation, aucune commande : rien, et pas de réserve inutile.
const rien = genererContenuDevis(diogene({ complements: [] }));
vrai("ni observation ni commande → aucune section",
  !SECTIONS(rien).includes("Traitement des nuisibles"));
vrai("ni réserve sur les nuisibles",
  !(rien?.reserves ?? "").includes("traitement des nuisibles ne fait pas partie"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n2. B4 — une odeur constatée n'est pas une désodorisation commandée");
// ══════════════════════════════════════════════════════════════════════

const odeurs = genererContenuDevis(diogene({
  dioOdeurs: "dio_odeurs_fortes", complements: [],
}));
vrai("AUCUNE section « Traitement des odeurs »",
  !SECTIONS(odeurs).includes("Traitement des odeurs"), SECTIONS(odeurs).join(" · "));
vrai("l'odeur est rapportée au contexte", TEXTE(odeurs).includes("odeurs fortes relevées"));
vrai("et une réserve borne l'attente du client",
  (odeurs?.reserves ?? "").includes("sans garantir leur disparition"));
eq("état : à confirmer", odeurs?.etats.desodorisation, "a_confirmer");

const odeursCommandees = genererContenuDevis(diogene({
  dioOdeurs: "dio_odeurs_fortes", complements: ["desodorisation"],
}));
vrai("validée → la section est présente",
  SECTIONS(odeursCommandees).includes("Traitement des odeurs"));
vrai("et l'odeur constatée précise la prestation",
  TEXTE(odeursCommandees).includes("odeurs constatées"));

// « aucune » n'est pas une odeur : ni observation, ni réserve.
const sansOdeur = genererContenuDevis(diogene({ dioOdeurs: "aucune", complements: [] }));
vrai("« aucune » ne produit aucune observation",
  !TEXTE(sansOdeur).includes("odeurs"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n3. Exclusions explicites — elles priment sur tout (§7.4)");
// ══════════════════════════════════════════════════════════════════════

vrai("la liste de la découverte couvre les dix exclusions",
  EXCLUSIONS.length === 10, `${EXCLUSIONS.length} options`);
for (const o of EXCLUSIONS) {
  vrai(`« ${o.label} » est traitée par le moteur`,
    EXCLUSION_PAR_CLE[o.value] !== undefined);
}
vrai("« nuisibles » est devenu validable en découverte",
  COMPLEMENTS.some((o) => o.value === "nuisibles"));

// Le cas décisif : prestation VALIDÉE *et* EXCLUE. L'exclusion gagne.
const contradiction = genererContenuDevis(diogene({
  complements: ["desinfection", "desodorisation", "nuisibles"],
  dioNuisibles: "oui",
  exclusions: ["excl_desinfection", "excl_nuisibles"],
}));
vrai("validée PUIS exclue → la désinfection ne sort pas",
  !SECTIONS(contradiction).includes("Désinfection"), SECTIONS(contradiction).join(" · "));
vrai("validée PUIS exclue → les nuisibles ne sortent pas",
  !SECTIONS(contradiction).includes("Traitement des nuisibles"));
eq("état : exclu", contradiction?.etats.desinfection, "exclu");
vrai("la désodorisation, validée et non exclue, sort bien",
  SECTIONS(contradiction).includes("Traitement des odeurs"));
vrai("les exclusions sont rappelées dans les réserves",
  (contradiction?.reserves ?? "").includes("À la demande du client"));

// Le débarras préalable s'exclut aussi, sur un chantier insalubre.
const sansDebarras = genererContenuDevis(diogene({
  complements: [], exclusions: ["excl_debarras_prealable"],
}));
vrai("« sans débarras préalable » retire la première phase",
  !SECTIONS(sansDebarras).includes("Débarras préalable du logement"));
vrai("et le titre ne l'annonce plus",
  !(sansDebarras?.designation ?? "").toLowerCase().includes("débarras"));

// Texte libre.
const autres = genererContenuDevis(diogene({
  complements: [], exclusionsAutres: "sans intervention sur la toiture",
}));
vrai("l'exclusion en texte libre est reprise en réserve",
  (autres?.reserves ?? "").includes("sans intervention sur la toiture"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n4. B5 — le contrôle est INDÉPENDANT du moteur");
// ══════════════════════════════════════════════════════════════════════

// Il doit pouvoir contredire une sortie qu'on lui soumet, même fabriquée.
const faux = controlerConformite(
  { desinfection: "exclu", vitrerie: "inclus" },
  ["Désinfection", "Nettoyage approfondi des espaces intérieurs"],
);
vrai("une prestation exclue PRÉSENTE est signalée", !faux.ok);
vrai("le motif nomme l'exclusion",
  faux.violations.some((v) => v.genre === "prestation_exclue" && v.theme === "desinfection"));
vrai("une prestation validée ABSENTE est signalée aussi",
  faux.violations.some((v) => v.genre === "perte_validee" && v.theme === "vitrerie"));

const promesse = controlerConformite(
  { nuisibles: "a_confirmer" }, ["Traitement des nuisibles"],
);
vrai("« à confirmer » ne vaut pas accord", !promesse.ok);
vrai("et le motif le dit en clair",
  promesse.violations[0]?.message.includes("observation faite en découverte") === true);

// Les thèmes qui exigent validation, et ceux qui n'en exigent pas.
vrai("les huit thèmes à valider sont déclarés", THEMES_A_VALIDER.length === 8);
for (const t of ["vitrerie", "murs", "plafonds", "desinfection", "decontamination",
  "desodorisation", "debarras_inclus", "nuisibles"] as const) {
  vrai(`${t} exige une validation`, exigeValidation(t));
}
vrai("le nettoyage intérieur n'en exige pas", !exigeValidation("interieur"));
vrai("ni les sanitaires", !exigeValidation("sanitaires"));

// Contrôle textuel : il survit à une réécriture manuelle.
const etatsExclus = { murs: "exclu" as const, nuisibles: "exclu" as const };
vrai("un texte réécrit qui réintroduit une exclusion est refusé",
  !controlerTexteConforme(etatsExclus,
    "1. Nettoyage\n- Lessivage des murs du séjour.").ok);
vrai("un texte réécrit sans l'exclusion passe",
  controlerTexteConforme(etatsExclus,
    "1. Nettoyage\n- Dépoussiérage des surfaces accessibles.").ok);
// Les RÉSERVES et les OBSERVATIONS nomment légitimement l'exclusion.
vrai("une exclusion énoncée en réserve n'est pas sa propre violation",
  controlerTexteConforme(etatsExclus,
    "1. Nettoyage\n- Dépoussiérage.\n\nRÉSERVES\n\nLe lessivage des murs n'est pas compris.").ok);
vrai("une observation rapportée n'est pas une promesse",
  controlerTexteConforme(etatsExclus,
    "1. Nettoyage\n- Dépoussiérage.\n\nÉléments relevés lors de la découverte : présence de nuisibles relevée.").ok);

// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Les alertes remontent jusqu'à l'interface");
// ══════════════════════════════════════════════════════════════════════

// `verifierRedaction` est ce que l'écran affiche : le contrôle indépendant
// doit s'y déverser, sans quoi il resterait invisible.
const propre = genererContenuDevis(diogene({
  complements: ["desinfection"], exclusions: ["excl_nuisibles"],
}));
eq("un devis conforme n'alerte sur rien", verifierRedaction(propre!).alertes, []);
vrai("et le contrôle indépendant le confirme", controlerDevis(propre!).ok);

// Devis trafiqué : on force une section exclue dans le contenu.
const trafique: ContenuDevis = {
  ...propre!,
  sections: [...propre!.sections, { titre: titreDe("nuisibles"), operations: ["x"] }],
};
vrai("une section exclue ajoutée après coup est détectée",
  !controlerDevis(trafique).ok);
vrai("et `verifierRedaction` la fait remonter",
  verifierRedaction(trafique).alertes.some((a) => a.includes("EXCLUE")));

// ══════════════════════════════════════════════════════════════════════
console.log("\n6. B1 et B2 — plus d'erreur de langue dans un document client");
// ══════════════════════════════════════════════════════════════════════

const volumeInconnu = genererContenuDevis(diogene({
  complements: [], dioVolume: "a_evaluer",
}));
vrai("plus de « estimé à à évaluer »",
  !TEXTE(volumeInconnu).includes("estimé à à évaluer"));
vrai("une phrase professionnelle le remplace",
  TEXTE(volumeInconnu).includes("volume définitif des éléments à évacuer sera confirmé"));
vrai("et la réserve de volume accompagne l'incertitude",
  (volumeInconnu?.reserves ?? "").includes("volume annoncé lors de la découverte"));

const volumeConnu = genererContenuDevis(diogene({ complements: [], dioVolume: "10-20" }));
vrai("un volume connu est chiffré", TEXTE(volumeConnu).includes("10–20 m³"));

vrai("plus de « Intervention de intervention »",
  !TEXTE(volumeInconnu).includes("intervention de intervention"));
vrai("plus de « Conditions d'accès relevées : vide »",
  !TEXTE(genererContenuDevis({
    sector: "nettoyage", surfaceM2: 70, etatSalete: "moyen",
    details: { typeNettoyage: "approfondi", occupation: "vide" },
    contexteIntervention: null,
  })).includes("conditions d'accès relevées : vide"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n7. B1 généralisé — les TREIZE familles, pas seulement les deux fautives");
// ══════════════════════════════════════════════════════════════════════
//
// L'audit a trouvé « Intervention de intervention en logement… » sur `diogene`
// et « Intervention de intervention de nettoyage… » sur `apres_deces`. Corriger
// ces deux chaînes ne prouve rien pour les onze autres, ni pour celles qu'on
// ajoutera : la phrase est `Intervention de {nature}`, donc TOUTE nature
// commençant par « intervention » produit la faute.
//
// Ce contrôle part de `FAMILLES` : une famille ajoutée demain est testée sans
// qu'on y pense.

const SUSPECTS: RegExp[] = [
  /\bintervention de intervention\b/i,
  /\bintervention de de\b/i,
  /\bde de\b/i,
  /\bd'un [a-zéèêà]+ d'un\b/i,
  /\bnettoyage de nettoyage\b/i,
];

for (const [cle, def] of Object.entries(FAMILLES)) {
  const phrase = `Intervention de ${def.nature} d'un appartement d'environ 60 m².`;
  vrai(`${cle.padEnd(20)} introduction correcte`,
    !SUSPECTS.some((re) => re.test(phrase)), phrase);
  vrai(`${cle.padEnd(20)} la nature ne commence pas par « intervention »`,
    !/^intervention\b/i.test(def.nature), def.nature);
  vrai(`${cle.padEnd(20)} « equipements » figure dans l'ordre de rédaction`,
    (def.themes as readonly string[]).includes("equipements"), def.themes.join(", "));
}

// Et sur un vrai devis de chaque type de découverte, produit par le moteur.
for (const [type, attendu] of Object.entries(FAMILLE_PAR_TYPE)) {
  const c = genererContenuDevis({
    sector: "nettoyage", surfaceM2: 70, etatSalete: "moyen",
    details: { typeNettoyage: type, typeBienNet: "appartement", nbSdb: 1 },
    contexteIntervention: null,
  });
  vrai(`« ${type} » → ${attendu} : devis produit`, c !== null);
  if (!c) continue;
  vrai(`« ${type} » : introduction sans répétition`,
    !SUSPECTS.some((re) => re.test(c.introduction)), c.introduction.slice(0, 130));
  const conf = controlerDevis(c);
  vrai(`« ${type} » : aucune prestation non validée`, conf.ok,
    conf.violations.map((v) => v.message).join(" | "));
  vrai(`« ${type} » : titre non vide, en majuscules`,
    c.designation.length > 10 && c.designation === c.designation.toUpperCase());
}

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
