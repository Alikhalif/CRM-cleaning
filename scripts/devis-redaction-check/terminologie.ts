// MULTI-PAYS, MULTI-SOCIÉTÉ — correction C2 du 2026-11-06.
//
// ── LA CONTRAINTE DU CLIENT ──────────────────────────────────────────
//
//   « Ne pas créer cinq moteurs différents. »
//
// Il n'en existe qu'un. Le référentiel reste écrit en français de France, et
// la dernière étape du rendu PROJETTE le texte vers l'usage du pays de la
// société émettrice. D'où les deux propriétés que ces contrôles figent :
//
// 1. POUR LE FRANÇAIS DE FRANCE, LA PROJECTION EST L'IDENTITÉ. Octet pour
//    octet, sur les quatre familles de nettoyage. C'est ce qui rend C2
//    déployable sans rien casser : les sept sociétés du CRM sont françaises,
//    donc C2 n'a aujourd'hui aucun effet observable en production.
// 2. POUR LE QUÉBEC, le document s'appelle une SOUMISSION — et « soumission »
//    est féminin, donc les articles et les participes suivent. Un accord faux
//    dans un document contractuel se remarque et décrédibilise le reste.
//
// ── ET CE QUI N'EST PAS TRANCHÉ ──────────────────────────────────────
//
// Les régimes de TVA, les devises, les mentions légales par pays et les
// langues autres que le français. Ils sont déclarés dans
// `ARBITRAGES_EN_ATTENTE`, et ces contrôles vérifient que la déclaration
// existe — parce qu'un point d'arbitrage oublié devient un document
// inopposable, pas une ligne de dette technique.
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret.

import {
  ARBITRAGES_EN_ATTENTE,
  COUNTRIES,
  LANGUES_PLAUSIBLES,
  LANGUES_SERVIES,
  TERMINOLOGIE_REFERENCE,
  controlerTerminologie,
  langueServie,
  paysReconnuPourTerminologie,
  projeter,
  terminologieDe,
  terminologieDifferente,
  type Country,
} from "@/lib/generation/terminologie";
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
  // Choisie pour une raison précise : ce sont les SEULES opérations du
  // référentiel qui nomment le document — trois, dans les thèmes
  // équipements, vitrerie et extérieurs. Sans elles, un contrôle de la
  // projection des opérations ne prouverait rien : une première rédaction de
  // cette suite n'avait que des familles où aucune opération ne contient le
  // mot, et la mutation « les opérations ne sont plus projetées » passait
  // inaperçue.
  "équipements, vitrerie et extérieurs": {
    typeNettoyage: "approfondi", typeBienNet: "maison", nbSdb: 2,
    vitrerie: "oui", equipements: ["four", "frigo"], exterieurTypes: ["terrasse"],
  },
};

/** Opérations d'un devis qui nomment le document, quel que soit le pays. */
const opsNommantLeDocument = (c: { sections: { operations: string[] }[] } | null) =>
  (c?.sections ?? []).flatMap((x) => x.operations)
    .filter((o) => /\bdevis\b|\bsoumission\b/i.test(o));

const devisDe = (details: Record<string, unknown>, pays: Country) => genererContenuDevis({
  sector: "nettoyage", surfaceM2: 110, etatSalete: "important",
  details, contexteIntervention: "Logement libre de tout occupant.",
  mentionProduits: null,
  terminologie: terminologieDe(pays),
});

// ══════════════════════════════════════════════════════════════════════
console.log("\n1. UN SEUL MOTEUR : la projection française est l'IDENTITÉ");
// ══════════════════════════════════════════════════════════════════════
//
// C'est LA propriété qui rend C2 déployable. Si elle tombe, un devis français
// change de texte sans que personne l'ait demandé.

for (const [nom, details] of Object.entries(FAMILLES)) {
  const fr = devisDe(details, "FR");
  vrai(`« ${nom} » : devis produit`, fr !== null);
  if (!fr) continue;

  // Les trois autres pays européens emploient le même mot : même texte.
  for (const pays of ["CH", "BE", "LU"] as Country[]) {
    const autre = devisDe(details, pays);
    eq(`« ${nom} » · ${pays} : texte identique au français, octet pour octet`,
      notesDevis(autre!), notesDevis(fr));
    eq(`« ${nom} » · ${pays} : titre identique`, autre!.designation, fr.designation);
    eq(`« ${nom} » · ${pays} : réserves identiques`, autre!.reserves, fr.reserves);
  }
}

// Et la projection elle-même, hors moteur : rien ne bouge en français.
for (const pays of ["FR", "CH", "BE", "LU"] as Country[]) {
  const t = terminologieDe(pays);
  vrai(`${pays} : la terminologie ne diffère pas de la référence`, !terminologieDifferente(t));
  const texte = "Le présent devis est établi. Les éléments exclus du devis sont listés.";
  eq(`${pays} : projeter est l'identité`, projeter(texte, t), texte);
}

// ══════════════════════════════════════════════════════════════════════
console.log("\n2. Québec : une SOUMISSION, et les accords qui suivent");
// ══════════════════════════════════════════════════════════════════════

const CA = terminologieDe("CA");
eq("le document s'appelle « soumission »", CA.document, "soumission");
eq("au pluriel, « soumissions »", CA.documentPluriel, "soumissions");
eq("et il est féminin", CA.genre, "f");
vrai("la terminologie canadienne diffère de la référence", terminologieDifferente(CA));

const ACCORDS: [string, string][] = [
  ["Le présent devis est établi sur la base des informations.",
    "La présente soumission est établie sur la base des informations."],
  ["Le devis est établi sur le volume annoncé.",
    "La soumission est établie sur le volume annoncé."],
  ["Les éléments exclus du présent devis sont listés.",
    "Les éléments exclus de la présente soumission sont listés."],
  ["Le traitement ne fait pas partie du présent devis.",
    "Le traitement ne fait pas partie de la présente soumission."],
  ["Les vitrages sont exclus du devis.", "Les vitrages sont exclus de la soumission."],
  ["Nettoyage des équipements compris au devis.",
    "Nettoyage des équipements compris à la soumission."],
  ["Les surfaces prévues au devis sont traitées.",
    "Les surfaces prévues à la soumission sont traitées."],
  ["Ce devis ne couvre pas les déchets dangereux.",
    "Cette soumission ne couvre pas les déchets dangereux."],
  ["le devis", "la soumission"],
  ["les devis sont établis", "les soumissions sont établies"],
  ["Devis complémentaire", "Soumission complémentaire"],
];
for (const [avant, attendu] of ACCORDS) {
  eq(`« ${avant.slice(0, 48)}… »`, projeter(avant, CA), attendu);
}

// LE POINT QUI COMPTE : plus aucune occurrence du mot français.
for (const [nom, details] of Object.entries(FAMILLES)) {
  const ca = devisDe(details, "CA");
  if (!ca) continue;
  const texte = notesDevis(ca);
  vrai(`« ${nom} » · CA : aucune occurrence de « devis »`,
    !/\bdevis\b/i.test(texte),
    (texte.match(/.{0,40}\bdevis\b.{0,40}/i) ?? [])[0]);
  vrai(`« ${nom} » · CA : « soumission » y figure`, /\bsoumission\b/i.test(texte));
  // Et aucun accord resté au masculin.
  const c = controlerTerminologie(texte, CA);
  eq(`« ${nom} » · CA : aucun accord manquant`, c.accordsManquants, []);
  vrai(`« ${nom} » · CA : le contrôle est conforme`, c.ok, JSON.stringify(c));
}

// La projection est idempotente : deux passages donnent le même texte.
const unFr = devisDe(FAMILLES["Diogène"], "FR");
const projete = projeter(notesDevis(unFr!), CA);
eq("la projection est idempotente", projeter(projete, CA), projete);

// ══════════════════════════════════════════════════════════════════════
console.log("\n3. Les titres de sections sont projetés aussi (C4 en dépend)");
// ══════════════════════════════════════════════════════════════════════
//
// La reprise ciblée appareille une section par son titre. Un titre non
// projeté ne se retrouverait plus dans un devis québécois, et le commercial
// verrait « la découverte ne valide aucune section » sur une section qui
// existe pourtant.

for (const [nom, details] of Object.entries(FAMILLES)) {
  const ca = devisDe(details, "CA");
  if (!ca) continue;
  eq(`« ${nom} » · CA : les titres du texte sont ceux de l'objet`,
    titresDeSections(notesDevis(ca)), ca.sections.map((s) => s.titre));
}

// Et les OPÉRATIONS de l'objet, pas seulement le texte rendu. C'est la
// famille « équipements, vitrerie et extérieurs » qui le prouve : elle est la
// seule à porter des opérations nommant le document.
const avecOps = devisDe(FAMILLES["équipements, vitrerie et extérieurs"], "FR");
const opsFr = opsNommantLeDocument(avecOps);
vrai("en français, des opérations nomment bien le document",
  opsFr.length >= 3, JSON.stringify(opsFr));
vrai("et elles disent « devis »", opsFr.every((o) => /\bdevis\b/i.test(o)));

const avecOpsCa = devisDe(FAMILLES["équipements, vitrerie et extérieurs"], "CA");
const opsCa = opsNommantLeDocument(avecOpsCa);
eq("au Québec, le même nombre d'opérations nomme le document",
  opsCa.length, opsFr.length);
vrai("mais AUCUNE ne dit « devis »", !opsCa.some((o) => /\bdevis\b/i.test(o)),
  JSON.stringify(opsCa.filter((o) => /\bdevis\b/i.test(o))));
vrai("toutes disent « soumission »", opsCa.every((o) => /\bsoumission\b/i.test(o)),
  JSON.stringify(opsCa));
vrai("et l'accord de l'article suit : « à la soumission »",
  opsCa.some((o) => /à la soumission/.test(o)), JSON.stringify(opsCa));

// L'INTRODUCTION nomme aussi le document, et elle est projetée : une
// première mesure de ma part n'avait regardé que le catalogue des
// opérations et l'avait manquée.
vrai("en français, l'introduction nomme le document",
  /\bdevis\b/i.test(avecOps?.introduction ?? ""), avecOps?.introduction);
vrai("au Québec, elle dit « soumission » et pas « devis »",
  /\bsoumission\b/i.test(avecOpsCa?.introduction ?? "")
  && !/\bdevis\b/i.test(avecOpsCa?.introduction ?? ""), avecOpsCa?.introduction);

// ── CE QUE CES CONTRÔLES NE PEUVENT PAS PROUVER, ET POURQUOI ────
//
// La projection s'applique à cinq endroits : la désignation, l'introduction,
// les titres de sections, leurs opérations et le descriptif rendu. Quatre
// sont observables ici. DEUX ne le sont pas — neutraliser la projection de
// la désignation, ou celle des titres de sections, ne fait tomber aucun
// contrôle, et la campagne de mutations le confirme.
//
// Ce n'est pas un oubli, c'est une MESURE : ni la désignation, ni aucun titre
// de section ne contient le mot, dans aucune des cinq familles. Un contrôle
// ne peut donc rien y observer, et prétendre le contraire serait afficher une
// couverture qui n'existe pas.
//
// L'assertion ci-dessous fige ce fait. Le jour où quelqu'un écrira
// « Devis de nettoyage approfondi » dans un titre, elle tombera — et
// c'est exactement ce qu'on veut : elle dira d'aller vérifier la projection
// du titre, au lieu de laisser un « devis » partir dans une soumission
// québécoise.
const positionsNonCouvertes = Object.entries(FAMILLES).flatMap(([nom, d]) => {
  const c = devisDe(d, "FR");
  const vu: string[] = [];
  const nomme = (x: string) => /\bdevis\b|\bsoumission\b/i.test(x);
  if (nomme(c?.designation ?? "")) vu.push(`${nom} : désignation`);
  for (const sec of c?.sections ?? []) {
    if (nomme(sec.titre)) vu.push(`${nom} : titre « ${sec.titre} »`);
  }
  return vu;
});
eq("ni désignation ni titre de section ne nomme le document (fait mesuré)",
  positionsNonCouvertes, []);

// ══════════════════════════════════════════════════════════════════════
console.log("\n4. AUCUN MÉLANGE DE PAYS");
// ══════════════════════════════════════════════════════════════════════
//
// « Ne jamais mélanger les pays. » Un texte qui dit « la présente soumission »
// puis « le présent devis » laisse penser que deux documents se superposent,
// et donne une prise à qui veut en contester un.

const TEXTE_FR = "Le présent devis est établi sur la base de la découverte.";
eq("un texte français, contrôlé en français : conforme",
  controlerTerminologie(TEXTE_FR, terminologieDe("FR")).ok, true);
const melange = controlerTerminologie(TEXTE_FR, CA);
eq("un texte français, contrôlé en canadien : REFUSÉ", melange.ok, false);
eq("et l'intrus est nommé, avec les pays qui l'emploient",
  melange.intrus.map((i) => i.terme), ["devis"]);
vrai("les quatre pays européens y figurent",
  ["FR", "CH", "BE", "LU"].every((p) => melange.intrus[0].appartientA.includes(p as Country)),
  JSON.stringify(melange.intrus));

// Et dans l'autre sens, ce qui est aussi important : un texte québécois sur
// un devis français est pareillement refusé. Le contrôle ne protège pas un
// pays en particulier, il refuse le mélange — c'est la demande du client, et
// une première rédaction de ce contrôle attendait ici `true`, ce qui aurait
// laissé passer une soumission dans un dossier français.
const inverse = controlerTerminologie(projeter(TEXTE_FR, CA), terminologieDe("FR"));
eq("un texte canadien, contrôlé en français : REFUSÉ aussi", inverse.ok, false);
eq("et c'est « soumission » qui est nommé",
  inverse.intrus.map((i) => i.terme), ["soumission"]);
eq("avec le seul pays qui l'emploie", inverse.intrus[0].appartientA, ["CA"]);

const moitie = `${projeter(TEXTE_FR, CA)} Le reste du devis est inchangé.`;
eq("un texte À MOITIÉ projeté est refusé", controlerTerminologie(moitie, CA).ok, false);

// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Le détecteur d'accord manquant — ce que la table ne couvre pas");
// ══════════════════════════════════════════════════════════════════════
//
// `ACCORDS_FEMININ` est une table FERMÉE. Elle couvre ce que le référentiel
// contient (un seul participe, « établi », en quatre endroits) plus ce qu'un
// rédacteur écrira plausiblement. Le jour où quelqu'un écrit autre chose, le
// détecteur doit parler — sinon la table devient un piège.

const INACCORDES = [
  "La présente soumission est réputé accepté.",
  "La soumission est conforme aux usages.",
  "Cette soumission sera transmis au client.",
];
for (const t of INACCORDES) {
  const c = controlerTerminologie(t, CA);
  vrai(`« ${t.slice(0, 44)}… » : accord manquant signalé`,
    c.accordsManquants.length > 0, JSON.stringify(c));
  vrai(`« ${t.slice(0, 44)}… » : le contrôle n'est pas conforme`, !c.ok);
}
// Et ce qui est correctement accordé ne remonte PAS : un détecteur bruyant
// finit par être ignoré.
for (const t of [
  "La présente soumission est établie sur la base de la découverte.",
  "La soumission est signée par le client.",
  "Cette soumission est datée du 6 novembre.",
  "Les soumissions sont établies par le commercial.",
]) {
  eq(`« ${t.slice(0, 44)}… » : rien à signaler`,
    controlerTerminologie(t, CA).accordsManquants, []);
}
// En français, le détecteur ne s'applique pas : le nom est masculin.
eq("en français, aucun accord n'est contrôlé",
  controlerTerminologie("Le devis est établi.", terminologieDe("FR")).accordsManquants, []);

// ══════════════════════════════════════════════════════════════════════
console.log("\n6. La langue est CONFIGURÉE, et le refus est explicite");
// ══════════════════════════════════════════════════════════════════════
//
// Le référentiel n'existe qu'en français. Un repli silencieux sur le français
// quand on demande de l'allemand produirait un devis que la société ne
// pourrait pas opposer, et l'erreur ne se verrait qu'au litige.

eq("une seule langue est servie", [...LANGUES_SERVIES], ["fr"]);
eq("« fr » est servi", langueServie("fr"), "fr");
eq("« FR » aussi, la casse ne décide pas", langueServie("FR"), "fr");
eq("« fr-CA » est ramené à « fr »", langueServie("fr-CA"), "fr");
for (const l of ["de", "nl", "en", "it", "lb", "", "  ", "xx"]) {
  eq(`« ${l} » : REFUSÉ, aucun repli silencieux`, langueServie(l), null);
}
eq("null refusé", langueServie(null), null);
eq("undefined refusé", langueServie(undefined), null);

// Les langues plausibles sont déclarées pour les cinq pays — descriptif, pas
// prescriptif : dire qu'une société luxembourgeoise pourrait vouloir de
// l'allemand n'est pas dire que le CRM sait le produire.
for (const pays of COUNTRIES) {
  vrai(`${pays} : des langues plausibles sont déclarées`,
    (LANGUES_PLAUSIBLES[pays] ?? []).length > 0);
  vrai(`${pays} : le français y figure`,
    (LANGUES_PLAUSIBLES[pays] ?? []).includes("fr"));
}
vrai("et une langue plausible n'est pas pour autant servie",
  LANGUES_PLAUSIBLES.CH.includes("de") && langueServie("de") === null);

// ══════════════════════════════════════════════════════════════════════
console.log("\n7. Le pays vient de la société, et un pays inconnu ne devine pas");
// ══════════════════════════════════════════════════════════════════════

eq("FR reconnu", paysReconnuPourTerminologie("FR"), "FR");
eq("minuscules", paysReconnuPourTerminologie("ca"), "CA");
eq("espaces", paysReconnuPourTerminologie(" BE "), "BE");
eq("hors référentiel", paysReconnuPourTerminologie("DE"), null);
eq("libellé au lieu du code", paysReconnuPourTerminologie("Canada"), null);
eq("vide", paysReconnuPourTerminologie(""), null);
eq("nul", paysReconnuPourTerminologie(null), null);

// Les cinq pays ont une terminologie, et une seule.
for (const pays of COUNTRIES) {
  const t = terminologieDe(pays);
  eq(`${pays} : la terminologie porte son propre pays`, t.pays, pays);
  vrai(`${pays} : le nom du document n'est pas vide`, t.document.length > 3);
  vrai(`${pays} : le genre est déclaré`, t.genre === "m" || t.genre === "f");
}
eq("la référence est le français de France", TERMINOLOGIE_REFERENCE.pays, "FR");
eq("et son document est « devis »", TERMINOLOGIE_REFERENCE.document, "devis");

// ══════════════════════════════════════════════════════════════════════
console.log("\n8. Ce qui n'est PAS tranché est DÉCLARÉ");
// ══════════════════════════════════════════════════════════════════════
//
// Un point d'arbitrage oublié ne devient pas une ligne de dette technique :
// il devient un document inopposable. Ces points vivent donc dans le code,
// pas dans une note.

vrai("des arbitrages sont déclarés", ARBITRAGES_EN_ATTENTE.length >= 5,
  String(ARBITRAGES_EN_ATTENTE.length));
for (const a of ARBITRAGES_EN_ATTENTE) {
  vrai(`« ${a.sujet.slice(0, 40)} » : des pays sont nommés`, a.pays.length > 0);
  vrai(`« ${a.sujet.slice(0, 40)} » : le motif est expliqué`, a.pourquoi.length > 60,
    a.pourquoi);
  vrai(`« ${a.sujet.slice(0, 40)} » : les pays sont du référentiel`,
    a.pays.every((p) => (COUNTRIES as readonly string[]).includes(p)));
}
// Les sujets qui coûteraient le plus cher sont couverts, nommément.
for (const motif of [/TPS|TVQ/i, /TVA suisse|taux suisses/i, /devise/i,
  /mentions l[ée]gales/i, /langues/i]) {
  vrai(`un arbitrage couvre ${motif}`,
    ARBITRAGES_EN_ATTENTE.some((a) => motif.test(a.sujet) || motif.test(a.pourquoi)));
}

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
