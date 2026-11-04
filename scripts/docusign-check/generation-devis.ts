// Génération du devis depuis la découverte.
//
// Ces contrôles figent le PONT posé le 2026-11-04 entre la découverte et le
// moteur de rédaction (`lib/generation/devis-contenu.ts`), qui existait depuis
// le 31 octobre sans aucun appelant.
//
// PORTÉE : logique PURE. Ils vérifient que le texte est bien produit à partir
// des champs réellement saisis, qu'il respecte les interdits de rédaction, et
// que rien dans la chaîne ne déclenche un envoi. Ils ne vérifient PAS
// l'écriture en base (création du brouillon, idempotence) : cela demande une
// session Supabase et se contrôle dans l'application.

import {
  activiteCouverte,
  genererContenuDevis,
  verifierRedaction,
  ACTIVITES_COUVERTES,
} from "@/lib/generation/devis-contenu";
import {
  MOTIF_LABEL,
  decouverteDepuisLead,
  genererDepuisLead,
  notesDevis,
} from "@/lib/generation/devis-depuis-decouverte";
import { attendUnDevisDe, statutDevis, type EtatDevis } from "@/lib/devis-a-realiser/shared";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
function eq<T>(nom: string, a: T, b: T) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  console.log(ja === jb ? `  ok    ${nom} = ${ja}` : `  ECHEC ${nom}\n    obtenu  ${ja}\n    attendu ${jb}`);
  if (ja !== jb) ko++;
}

const LE = "2026-11-04T09:00:00Z";

console.log("== Périmètre : six activités, pas une de plus ==");
eq("activités couvertes", [...ACTIVITES_COUVERTES],
  ["nettoyage", "nettoyage_difficile", "diogene", "debarras", "demenagement", "transport"]);
for (const s of ACTIVITES_COUVERTES) vrai(`« ${s} » est couverte`, activiteCouverte(s));
// Dépannage et travaux du bâtiment sont exclus : le bouton ne doit pas
// s'afficher sur ces dossiers, et l'action doit refuser si on l'appelle.
for (const s of ["urgence", "enr", "renovation"]) {
  vrai(`« ${s} » reste hors périmètre`, !activiteCouverte(s));
  const r = genererDepuisLead({ sector: s, discoveryDoneAt: LE });
  vrai(`« ${s} » : génération refusée`, !r.ok);
  if (!r.ok) eq(`« ${s} » : motif`, r.motif, "activite_hors_perimetre");
}

console.log("\n== Sans découverte enregistrée, rien n'est produit ==");
// La découverte est la SOURCE du texte : sans elle il n'y a rien à écrire, et
// il ne faut surtout pas inventer un contenu générique.
const sansDecouverte = genererDepuisLead({ sector: "nettoyage", discoveryDoneAt: null });
vrai("refus", !sansDecouverte.ok);
if (!sansDecouverte.ok) {
  eq("motif", sansDecouverte.motif, "decouverte_absente");
  vrai("le message explique quoi faire",
    MOTIF_LABEL[sansDecouverte.motif].includes("Enregistrez d'abord la découverte"));
}

console.log("\n== Nettoyage : le texte vient des champs saisis ==");
const nettoyage = {
  sector: "nettoyage",
  surfaceM2: 75,
  etatSalete: null,
  discoveryDoneAt: LE,
  discoveryDetails: {
    typeNettoyage: "remise_etat",
    typeBienNet: "appartement",
    nbPieces: 3,
    sols: ["parquet", "carrelage"],
    complements: ["desinfection"],
    vitrerie: "oui",
    vitrerieFenetres: 8,
  },
};
const rNet = genererDepuisLead(nettoyage);
vrai("génération produite", rNet.ok);
if (rNet.ok) {
  const c = rNet.contenu;
  // La surface et le type de bien SAISIS doivent se retrouver dans la
  // désignation : c'est la preuve qu'aucune ressaisie n'est nécessaire.
  vrai("la désignation reprend la surface saisie", c.designation.includes("75 M"));
  vrai("la désignation reprend le type de bien", /APPARTEMENT/.test(c.designation));
  vrai("le nombre de pièces saisi figure au détail", c.detail.includes("3 pièces"));
  vrai("les sols saisis figurent au détail", /parquet/i.test(c.detail));
  vrai("des réserves sont posées", c.reserves.length > 100);
  vrai("les champs utilisés sont tracés", c.sources.includes("typeNettoyage"));

  // §3.4 — « remise en état » est PROSCRIT, et c'est précisément le libellé
  // que la découverte propose. Le moteur doit le réécrire.
  vrai("« remise en état » n'apparaît jamais",
    !/remise\s+en\s+(é|e)tat/i.test(`${c.designation} ${c.detail} ${c.reserves}`));
  vrai("aucun prix dans le texte",
    !/\d[\d\s.,]*\s*(€|EUR\b|euros?)/i.test(`${c.designation} ${c.detail} ${c.reserves}`));
  eq("aucune alerte de rédaction", rNet.alertes, []);
}

console.log("\n== Déménagement : les VILLES, jamais l'adresse complète ==");
// Confidentialité : sur un déménagement, seules les villes et codes postaux
// circulent. Le pont doit transmettre les villes au moteur.
const demenagement = {
  sector: "demenagement",
  surfaceM2: null,
  discoveryDoneAt: LE,
  discoveryDetails: {
    typeDemenagement: "complet",
    logementDepart: "t3",
    volume: "20",
    villeDepart: "Lagny-sur-Marne",
    villeArrivee: "Meaux",
    adresseDepart: "12 rue des Lilas",
    adresseArrivee: "4 avenue Victor Hugo",
    etagesDepart: "3",
    ascenseurDepart: "non",
  },
};
const dec = decouverteDepuisLead(demenagement);
eq("ville de départ transmise", dec.villeDepart, "Lagny-sur-Marne");
eq("ville d'arrivée transmise", dec.villeArrivee, "Meaux");
const rDem = genererDepuisLead(demenagement);
vrai("génération produite", rDem.ok);
if (rDem.ok) {
  const tout = `${rDem.contenu.designation} ${rDem.contenu.detail} ${rDem.contenu.reserves}`;
  vrai("la rue de départ n'apparaît pas", !tout.includes("rue des Lilas"));
  vrai("la rue d'arrivée n'apparaît pas", !tout.includes("avenue Victor Hugo"));
  vrai("l'étage saisi est repris", /3/.test(rDem.contenu.detail));
}

console.log("\n== Débarras et transport répondent aussi ==");
for (const [secteur, details] of [
  ["debarras", { typeDebarras: "appartement", debarrasVolume: "20", etage: "2", ascenseur: "non" }],
  ["transport", { typeObjet: "mobilier", quantiteObjets: 4, villeEnlevement: "Paris", villeLivraison: "Lyon" }],
] as const) {
  const r = genererDepuisLead({ sector: secteur, discoveryDoneAt: LE, discoveryDetails: details });
  vrai(`« ${secteur} » produit un contenu`, r.ok);
  if (r.ok) {
    vrai(`« ${secteur} » : désignation non vide`, r.contenu.designation.trim().length > 0);
    vrai(`« ${secteur} » : réserves posées`, r.contenu.reserves.trim().length > 0);
    eq(`« ${secteur} » : aucune alerte`, r.contenu ? verifierRedaction(r.contenu).alertes : ["?"], []);
  }
}

console.log("\n== Les informations ABSENTES sont signalées, pas inventées ==");
// Une découverte quasi vide : le texte sort quand même, mais le commercial
// est averti de ce qui manque au lieu de recevoir du remplissage.
const presqueVide = genererDepuisLead({
  sector: "nettoyage", surfaceM2: null, discoveryDoneAt: LE, discoveryDetails: {},
});
vrai("un contenu est tout de même produit", presqueVide.ok);
if (presqueVide.ok) {
  vrai("les manques sont listés", presqueVide.contenu.manquant.length >= 3);
  vrai("la surface manquante est signalée",
    presqueVide.contenu.manquant.some((m) => m.includes("surface")));
  vrai("aucune surface inventée", !/\d+\s*m²/i.test(presqueVide.contenu.designation));
}

console.log("\n== Les notes du document portent DÉTAIL puis RÉSERVES ==");
// Le modèle générique n'a qu'un champ libre, rendu tel quel dans le PDF : les
// intitulés doivent être portés par le texte, sinon les trois blocs du cahier
// se perdent en un seul paragraphe.
const contenu = genererContenuDevis(decouverteDepuisLead(nettoyage));
vrai("contenu disponible", contenu !== null);
if (contenu) {
  const n = notesDevis(contenu);
  vrai("l'intitulé DÉTAIL est présent", n.includes("DÉTAIL DE LA PRESTATION"));
  vrai("l'intitulé RÉSERVES est présent", n.includes("RÉSERVES"));
  vrai("le détail précède les réserves",
    n.indexOf("DÉTAIL DE LA PRESTATION") < n.indexOf("RÉSERVES"));
  vrai("le détail généré est bien dedans", n.includes(contenu.detail.trim()));
  vrai("les réserves générées sont bien dedans", n.includes(contenu.reserves.trim()));
  // La désignation ne va PAS dans les notes : elle devient le libellé de la
  // ligne de prestation.
  vrai("la désignation n'est pas dupliquée dans les notes",
    !n.includes(contenu.designation));
}

console.log("\n== Préparer un devis ne l'envoie PAS ==");
// Le brouillon créé porte 0 € quand aucun barème ne s'applique : le dossier
// s'affiche « En préparation », pas « Prêt à envoyer », et reste dans la
// liste jusqu'à un envoi réel.
const brouillonSansPrix: EtatDevis = {
  brouillon: true, brouillonChiffre: false,
  optimivvNonEnvoye: false, photosEnAttente: false,
};
const brouillonChiffre: EtatDevis = {
  brouillon: true, brouillonChiffre: true,
  optimivvNonEnvoye: false, photosEnAttente: false,
};
eq("brouillon à 0 € → en préparation", statutDevis(brouillonSansPrix), "en_preparation");
eq("brouillon chiffré → prêt à envoyer", statutDevis(brouillonChiffre), "pret_a_envoyer");
vrai("le dossier RESTE dans « Devis à réaliser » après génération",
  attendUnDevisDe(LE, "lead"));
vrai("il n'en sort qu'après un envoi réel", !attendUnDevisDe(LE, "envoye"));

console.log("\n== Le moteur est déterministe ==");
// Deux appels sur la même découverte donnent le même texte. C'est ce qui rend
// la régénération sans surprise — et c'est aussi pourquoi ce n'est pas un
// appel à un modèle de langage.
const a = genererContenuDevis(decouverteDepuisLead(nettoyage));
const b = genererContenuDevis(decouverteDepuisLead(nettoyage));
eq("deux générations identiques", a, b);

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
