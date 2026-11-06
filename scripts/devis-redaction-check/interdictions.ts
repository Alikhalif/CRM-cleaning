// Les 28 interdictions absolues du §19, une par une.
//
// Chaque interdiction est soit vérifiée par une assertion, soit explicitement
// signalée comme NON VÉRIFIABLE ici — jamais présentée comme tenue sans
// preuve. Le §21 l'exige : « ne jamais déclarer un développement terminé sans
// tests ».

import { readFileSync } from "node:fs";

import {
  genererContenuDevis, verifierRedaction,
  type ContenuDevis, type Decouverte,
} from "@/lib/generation/devis-contenu";
import {
  HISTORIQUE_REFERENTIEL, OPERATIONS, VERSION_REFERENTIEL,
} from "@/lib/generation/bibliotheque-redaction";
import { bilan, contient, eq, faux, texteComplet, titre, vrai } from "./commun";

// ── Jeux de découverte ────────────────────────────────────────────────

/** Le minimum absolu : rien n'est validé en dehors du type de nettoyage. */
const NU: Decouverte = {
  sector: "nettoyage", surfaceM2: null, etatSalete: null,
  details: { typeNettoyage: "approfondi" },
};

/** Tout est validé. */
const PLEIN: Decouverte = {
  sector: "diogene", surfaceM2: 100, etatSalete: "extreme",
  details: {
    typeNettoyage: "insalubre", typeBienNet: "maison",
    nbPieces: 5, nbSdb: 2, nbWc: 2, sols: ["sol_carrelage"],
    cuisineEquipee: "oui", equipements: ["opt_four"],
    vitrerie: "oui", vitrerieFenetres: 10,
    murs: "murs_lessivage", plafonds: "oui",
    // « nuisibles » ajouté le 2026-11-06 : le fixture est censé porter TOUTES
    // les prestations validées, et le traitement des nuisibles en est devenu
    // une (anomalie B3 — il sortait auparavant sur la seule observation).
    complements: ["desinfection", "decontamination", "desodorisation", "debarras",
      "nuisibles"],
    debarrasVolume: ">20",
    dioEncombrement: "dio_enc_extreme", dioDechets: ["dio_biologiques"],
    dioVolume: ">40", dioNuisibles: "oui", dioNuisiblesTypes: ["dio_punaises"],
    etage: "3", ascenseur: "non", stationnement: "stationnement_difficile",
  },
};

const nu = genererContenuDevis(NU)!;
const plein = genererContenuDevis(PLEIN)!;
const SECTIONS = (c: ContenuDevis) => c.sections.map((s) => s.titre);

/**
 * Code seul, commentaires retirés.
 *
 * Les interdictions 24, 25 et 28 portent sur le COMPORTEMENT du moteur. Les
 * chercher dans le fichier brut faisait échouer le contrôle sur les
 * commentaires qui EXPLIQUENT justement l'interdiction — un garde-fou qui
 * sanctionne sa propre documentation ne prouve rien.
 */
function codeSeul(chemin: string): string {
  const brut = readFileSync(chemin, "utf8");
  const sansBlocs = brut.replace(/\/\*[\s\S]*?\*\//g, " ");
  return sansBlocs.replace(/^[ \t]*\/\/.*$/gm, "");
}

const source = codeSeul("lib/generation/devis-contenu.ts");
const sourceBiblio = codeSeul("lib/generation/bibliotheque-redaction.ts");

// ══════════════════════════════════════════════════════════════════════
titre("1 à 5 — ne pas recopier, ne pas résumer, ne rien oublier");

// 1. Recopier la découverte ligne par ligne.
vrai("01 — les opérations sont plus nombreuses que les champs saisis",
  plein.sections.reduce((n, s) => n + s.operations.length, 0)
    > Object.keys(PLEIN.details).length,
  `${plein.sections.reduce((n, s) => n + s.operations.length, 0)} opérations pour ${Object.keys(PLEIN.details).length} champs`);
vrai("01 — des opérations du référentiel apparaissent, pas seulement les champs",
  contient(plein.detail, "Dépoussiérage minutieux de l'ensemble des surfaces accessibles"));

// 2. Générer un devis sous forme de questionnaire.
faux("02 — aucune question dans le devis", /\?/.test(texteComplet(plein)));
faux("02 — aucun libellé de formulaire brut (« Type de nettoyage : »)",
  /(type de nettoyage|nombre de pi(è|e)ces|pr(é|e)sence de nuisibles)\s*:/i.test(texteComplet(plein)));
faux("02 — aucune clé technique dans le texte",
  /\b(opt_|dio_|sol_|ext_|murs_|plafonds_|vitrerie[A-Z])/.test(texteComplet(plein)),
  texteComplet(plein).match(/\b(opt_|dio_|sol_|ext_)\w+/g)?.join(", "));

// 3. Produire un simple résumé.
vrai("03 — chaque section porte au moins deux opérations",
  plein.sections.every((s) => s.operations.length >= 2));
vrai("03 — le devis complet dépasse 1 500 caractères",
  texteComplet(plein).length > 1500, `${texteComplet(plein).length} caractères`);

// 4. Générer un titre vague.
vrai("04 — le titre nomme la prestation ET le bien",
  contient(plein.designation, "nettoyage") && contient(plein.designation, "maison"),
  plein.designation);
faux("04 — le titre n'est pas un mot générique seul",
  /^(NETTOYAGE|DEVIS|PRESTATION|INTERVENTION)\.?$/.test(plein.designation.trim()));

// 5. Oublier une prestation validée.
for (const attendue of [
  "Nettoyage de la vitrerie", "Lessivage des murs", "Nettoyage des plafonds",
  "Désinfection", "Décontamination", "Traitement des odeurs",
  "Débarras préalable du logement", "Traitement des nuisibles",
]) {
  vrai(`05 — « ${attendue} » validée → présente`, SECTIONS(plein).includes(attendue),
    SECTIONS(plein).join(" · "));
}

// ══════════════════════════════════════════════════════════════════════
titre("6 à 10 — ne rien inventer");

// 6. Ajouter une prestation exclue.
const exclu = genererContenuDevis({
  sector: "nettoyage", surfaceM2: 60, etatSalete: null,
  details: { typeNettoyage: "approfondi", vitrerie: "non", murs: "non", plafonds: "non" },
})!;
faux("06 — vitrerie exclue → absente", SECTIONS(exclu).includes("Nettoyage de la vitrerie"));
faux("06 — lessivage exclu → absent", SECTIONS(exclu).includes("Lessivage des murs"));

// 7. Inventer des équipements.
faux("07 — aucun équipement nommé quand aucun n'est saisi",
  /\b(four|r(é|e)frig(é|e)rateur|cong(é|e)lateur|lave-linge|lave-vaisselle|hotte)\b/i
    .test(texteComplet(nu)),
  texteComplet(nu).match(/\b(four|hotte|lave-\w+)\b/i)?.join(", "));
vrai("07 — les équipements saisis, eux, apparaissent", contient(plein.detail, "four"));

// 8. Inventer des surfaces.
faux("08 — aucune surface quand elle n'est pas saisie", /\d+\s*m²/.test(texteComplet(nu)),
  texteComplet(nu).match(/\d+\s*m²/g)?.join(", "));
vrai("08 — la surface saisie, elle, apparaît", contient(plein.designation, "100 m²"));

// 9. Inventer des volumes.
faux("09 — aucun volume quand il n'est pas saisi", /\d+\s*m³/.test(texteComplet(nu)));
vrai("09 — le volume saisi, lui, apparaît", contient(plein.detail, "> 40 m³"));

// 10. Inventer des contraintes.
faux("10 — aucune condition d'accès quand rien n'est saisi",
  contient(texteComplet(nu), "conditions d'accès relevées"));
vrai("10 — les contraintes saisies, elles, apparaissent",
  contient(plein.detail, "étage 3 sans ascenseur")
  && contient(plein.detail, "stationnement difficile"));
faux("10 — un logement très sale n'est jamais qualifié « type Diogène »",
  contient(
    genererContenuDevis({
      sector: "nettoyage", surfaceM2: 50, etatSalete: "tres_important",
      details: { typeNettoyage: "tres_sale" },
    })!.designation,
    "diogene",
  ));

// ══════════════════════════════════════════════════════════════════════
titre("11 à 15 — aucun ajout automatique de prestation complémentaire");

const COMPLEMENTAIRES: [string, string][] = [
  ["11", "Nettoyage de la vitrerie"],
  ["12", "Lessivage des murs"],
  ["12", "Nettoyage des plafonds"],
  ["13", "Désinfection"],
  ["14", "Décontamination"],
  ["15", "Débarras et évacuation des encombrants"],
  ["15", "Débarras préalable du logement"],
];
for (const [n, section] of COMPLEMENTAIRES) {
  faux(`${n} — « ${section} » jamais ajoutée sans validation`,
    SECTIONS(nu).includes(section), SECTIONS(nu).join(" · "));
}
// Et sur une découverte riche MAIS sans aucun complément validé.
const richeSansComplements = genererContenuDevis({
  sector: "nettoyage", surfaceM2: 120, etatSalete: "important",
  details: {
    typeNettoyage: "approfondi", typeBienNet: "maison",
    nbPieces: 6, nbSdb: 3, nbWc: 2, sols: ["sol_parquet"],
    cuisineEquipee: "oui", complements: [],
  },
})!;
for (const [, section] of COMPLEMENTAIRES) {
  faux(`11-15 — « ${section} » absente d'une découverte riche sans complément`,
    SECTIONS(richeSansComplements).includes(section));
}

// ══════════════════════════════════════════════════════════════════════
titre("16 et 17 — aucun tarif, aucun montant");

for (const [nom, c] of [["minimal", nu], ["complet", plein]] as const) {
  faux(`16 — aucun prix dans le contenu (${nom})`,
    /\d[\d\s.,]*\s*(€|EUR\b|euros?|CHF\b|\$|CAD\b)/i.test(texteComplet(c)),
    texteComplet(c).match(/\d[\d\s.,]*\s*(€|EUR|euros?|CHF|\$)/gi)?.join(", "));
}
faux("16 — le mot « tarif » n'apparaît pas", /\btarif/i.test(texteComplet(plein)));
// 17. Modifier les montants validés : structurellement impossible — le
// contenu produit ne porte AUCUN champ de montant.
eq("17 — le contenu produit ne comporte aucun champ de montant",
  Object.keys(plein).filter((k) => /montant|prix|total|ht|ttc|tva|amount/i.test(k)),
  []);
faux("17 — le moteur ne lit ni n'écrit aucun montant",
  /montant|unitPriceHt|total_ttc|total_ht/.test(source),
  source.match(/montant\w*|unitPriceHt|total_\w+/g)?.join(", "));

// ══════════════════════════════════════════════════════════════════════
titre("18 et 19 — ni répétition, ni superficialité");

// 18. Répéter les mêmes opérations.
const toutes = plein.sections.flatMap((s) => s.operations);
eq("18 — aucune opération répétée (devis complet)", toutes.length, new Set(toutes).size);
const titresSections = SECTIONS(plein);
eq("18 — aucune section en double", titresSections.length, new Set(titresSections).size);

// 19. Produire des descriptions superficielles.
eq("19 — un chantier Diogène est de niveau 3", plein.niveau, 3);
vrai("19 — un chantier complexe porte au moins 30 opérations",
  toutes.length >= 30, `${toutes.length} opérations`);

// ══════════════════════════════════════════════════════════════════════
titre("20 à 23 — expressions et rubriques proscrites");

// 20. « Remise en état » — y compris quand la découverte l'emploie.
const remiseEtat = genererContenuDevis({
  sector: "nettoyage", surfaceM2: 70, etatSalete: null,
  details: { typeNettoyage: "remise_etat", typeBienNet: "appartement" },
})!;
faux("20 — « remise en état » absente alors que la découverte l'a cochée",
  contient(texteComplet(remiseEtat), "remise en etat"), remiseEtat.designation);
vrai("20 — elle est réécrite en « nettoyage approfondi »",
  contient(remiseEtat.designation, "nettoyage approfondi"));
faux("20 — absente aussi du devis complet", contient(texteComplet(plein), "remise en etat"));

// 21, 22, 23.
faux("21 — pas de rubrique « Engagements de l'entreprise »",
  /engagements?\s+de\s+l'entreprise/i.test(texteComplet(plein)));
faux("22 — pas de rubrique « Objectif final »", /objectif\s+final/i.test(texteComplet(plein)));
faux("23 — pas de rubrique « Conditions de règlement »",
  /conditions\s+de\s+r(è|e)glement/i.test(texteComplet(plein)));

// ══════════════════════════════════════════════════════════════════════
titre("24 et 25 — ni envoi automatique, ni modification du processus");

// 24. Envoyer automatiquement le devis : le moteur est PUR.
faux("24 — le moteur n'importe aucun client Supabase",
  /supabase|@\/lib\/supabase/.test(source));
faux("24 — le moteur n'appelle ni fetch, ni nodemailer, ni aucun envoi",
  /\bfetch\(|nodemailer|sendMail|envoyer|brevo/i.test(source),
  source.match(/\bfetch\(|nodemailer|sendMail|envoyer|brevo/gi)?.join(", "));
faux("24 — le moteur ne lit ni n'écrit de fichier",
  /node:fs|readFileSync|writeFileSync/.test(source));

// 25. Modifier inutilement le processus commercial : le moteur ignore les
// statuts, le pipeline et les documents.
faux("25 — le moteur ignore les statuts et le pipeline",
  /\bstatus\b|pipeline|brouillon|'envoye'|"envoye"/.test(source),
  source.match(/\bstatus\b|pipeline|brouillon/g)?.join(", "));
eq("25 — le contenu produit ne porte aucun identifiant de document",
  Object.keys(plein).filter((k) => /id$|documentId|leadId|devisId/i.test(k)), []);

// ══════════════════════════════════════════════════════════════════════
titre("26 et 27 — aucune promesse, aucune antériorité");

// 26. Promettre des résultats sanitaires non garantis.
const deces = genererContenuDevis({
  sector: "nettoyage", surfaceM2: 40, etatSalete: "tres_important",
  details: {
    typeNettoyage: "approfondi", complements: ["desinfection", "decontamination"],
    decontaminationOrigine: "deces", nbSdb: 1,
  },
})!;
faux("26 — aucune promesse de désinfection ou décontamination totale",
  /(d(é|e)sinfection|d(é|e)contamination|st(é|e)rilisation)\s+(totale|compl(è|e)te|int(é|e)grale)/i
    .test(texteComplet(deces)));
faux("26 — aucun « 100 % sain » ni « nous garantissons »",
  /100\s*%\s*(sain|st(é|e)rile)|nous\s+garantissons/i.test(texteComplet(deces)));
vrai("26 — la réserve du §7.9 est présente et ne déclenche PAS le garde-fou",
  contient(deces.reserves, "ni une garantie d'absence totale")
  && verifierRedaction(deces).ok,
  verifierRedaction(deces).alertes.join(" · "));

// 27. Présenter une intervention prévue comme déjà réalisée.
for (const [nom, c] of [["minimal", nu], ["complet", plein], ["décès", deces]] as const) {
  faux(`27 — aucun passé composé d'exécution (${nom})`,
    /a\s+(é|e)t(é|e)\s+(r(é|e)alis|nettoy|d(é|e)sinfect|d(é|e)contamin|trait)/i
      .test(texteComplet(c)),
    texteComplet(c).match(/a\s+(é|e)t(é|e)\s+\w+/gi)?.join(", "));
  vrai(`27 — le garde-fou de rédaction passe (${nom})`, verifierRedaction(c).ok,
    verifierRedaction(c).alertes.join(" · "));
}
// Le garde-fou attrape bien une saisie humaine fautive.
vrai("27 — une saisie humaine « a été réalisé » EST détectée",
  !verifierRedaction({
    ...plein,
    reserves: plein.reserves + "\n\nLe nettoyage a été réalisé le 3 novembre.",
  }).ok);
vrai("20 — une saisie humaine « remise en état » EST détectée",
  !verifierRedaction({ ...plein, detail: "Remise en état du logement." }).ok);
vrai("16 — une saisie humaine chiffrée EST détectée",
  !verifierRedaction({ ...plein, detail: "Forfait de 1 200 € HT." }).ok);

// ══════════════════════════════════════════════════════════════════════
titre("28 — aucune modification automatique du référentiel");

const avant = JSON.stringify(OPERATIONS);
for (let i = 0; i < 5; i++) {
  genererContenuDevis(PLEIN);
  genererContenuDevis(NU);
}
eq("28 — générer un devis ne modifie JAMAIS le référentiel", JSON.stringify(OPERATIONS), avant);
// `OPERATIONS[theme]` est une LECTURE : seule une affectation ou une
// mutation constitue un apprentissage automatique.
faux("28 — le référentiel ne contient aucune écriture ni apprentissage",
  /OPERATIONS\s*(\[[^\]]*\])?\s*(=[^=]|\.push|\.splice|\.pop)|Object\.assign\s*\(\s*OPERATIONS/
    .test(sourceBiblio),
  sourceBiblio.match(/OPERATIONS\s*(\[[^\]]*\])?\s*(=[^=]|\.push)/g)?.join(", "));
vrai("28 — le référentiel est versionné", /^\d{4}-\d{2}-\d{2}\.\d+$/.test(VERSION_REFERENTIEL),
  VERSION_REFERENTIEL);
vrai("28 — l'historique des évolutions est renseigné",
  HISTORIQUE_REFERENTIEL.length >= 1
  && HISTORIQUE_REFERENTIEL[0].version === VERSION_REFERENTIEL);

bilan("28 interdictions du §19");
