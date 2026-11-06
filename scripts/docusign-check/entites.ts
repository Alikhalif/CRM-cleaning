// Sociétés émettrices : le représentant légal circule-t-il de bout en bout ?
//
// Le défaut corrigé : les colonnes `representative_name` et
// `representative_title` existaient en base depuis le 2026-10-31, mais aucun
// écran ne les renseignait. Les sept sociétés du CRM étaient donc toutes sans
// représentant, et AUCUN contrat de sous-traitance ne pouvait être émis.
//
// Ces tests vérifient la chaîne complète : contrôle d'entité → instantané
// juridique → en-tête du contrat.

import { controlerEntite } from "@/lib/sous-traitance/contrats-shared";
import { donneurOrdreDepuisEntite } from "@/lib/sous-traitance/variables";
import { entiteComplete, instantanerEntite } from "@/lib/docusign/archivage";
import { PARTIES } from "@/lib/sous-traitance/modele-nettoyage";
import { substituer } from "@/lib/sous-traitance/variables";
import type { EntiteEmettrice } from "@/lib/sous-traitance/variables";

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

/** Les sept sociétés du CRM telles qu'elles sont AUJOURD'HUI : sans représentant. */
const avantCorrectif: EntiteEmettrice = {
  id: "e-1",
  legal_name: "OPTIMIVV NETTOYAGE",
  legal_form: "SASU",
  siret: "92808342700015",
  siren: null,
  vat_number: null,
  address: "2 rue Alfred Bruneau, 75016 Paris",
  country: "FR",
  representative_name: null,
  representative_title: null,
};

const apresSaisie: EntiteEmettrice = {
  ...avantCorrectif,
  representative_name: "M. Rosalie DAVID",
  representative_title: "Président",
};

console.log("== L'état actuel des 7 sociétés bloque l'émission ==");
const av = controlerEntite(avantCorrectif);
vrai("entité sans représentant : refusée", !av.utilisable);
eq("et le motif est précis", av.manquants,
  ["représentant légal", "qualité du représentant"]);
// Même constat par l'autre chemin de contrôle, celui de l'archivage.
eq("entiteComplete refuse aussi",
  entiteComplete({
    id: "e-1", legalName: "OPTIMIVV NETTOYAGE", legalForm: "SASU",
    siret: "92808342700015", address: "2 rue Alfred Bruneau, 75016 Paris",
    representativeName: null, representativeTitle: null,
  }).manquant,
  ["représentant légal", "fonction du représentant"]);

console.log("\n== Une fois le représentant saisi, l'émission devient possible ==");
const ap = controlerEntite(apresSaisie);
vrai("entité complète : acceptée", ap.utilisable);
eq("plus aucun manque", ap.manquants, []);

console.log("\n== Le représentant atteint le contrat ==");
const v = donneurOrdreDepuisEntite(apresSaisie);
eq("nom transmis", v.principal_company_representative, "M. Rosalie DAVID");
eq("qualité transmise", v.principal_company_representative_title, "Président");

const entete = substituer(PARTIES.donneurOrdre.corps, v);
vrai("l'en-tête nomme le représentant", entete.includes("M. Rosalie DAVID"));
vrai("… et sa qualité", entete.includes("Président"));
vrai("aucun « [à compléter] » ne subsiste", !entete.includes("[à compléter]"));

console.log("\n== Sans représentant, le trou se VOIT dans le document ==");
const vSansRepr = donneurOrdreDepuisEntite(avantCorrectif);
const enteteVide = substituer(PARTIES.donneurOrdre.corps, vSansRepr);
vrai("le document porterait « [à compléter] »", enteteVide.includes("[à compléter]"));
// C'est précisément ce que le contrôle empêche : le trou est visible, mais il
// ne doit jamais arriver jusqu'au client.
vrai("… mais le contrôle l'aura refusé avant", !controlerEntite(avantCorrectif).utilisable);

console.log("\n== Instantané juridique : le représentant y est figé ==");
const snap = instantanerEntite({
  id: "e-1", legalName: "OPTIMIVV NETTOYAGE", legalForm: "SASU",
  siret: "92808342700015", address: "2 rue Alfred Bruneau, 75016 Paris",
  representativeName: "M. Rosalie DAVID", representativeTitle: "Président",
}, new Date("2026-11-04T10:00:00Z"));
eq("nom figé", snap.representative_name, "M. Rosalie DAVID");
eq("qualité figée", snap.representative_title, "Président");
// Changer le représentant plus tard ne doit pas réécrire un contrat signé.
const snap2 = instantanerEntite({
  id: "e-1", legalName: "OPTIMIVV NETTOYAGE", legalForm: "SASU",
  siret: "92808342700015", address: "2 rue Alfred Bruneau, 75016 Paris",
  representativeName: "Mme Claire MARTIN", representativeTitle: "Directrice générale",
}, new Date("2027-01-01T10:00:00Z"));
vrai("un instantané ultérieur est distinct",
  snap2.representative_name !== snap.representative_name);
eq("l'ancien n'a pas bougé", snap.representative_name, "M. Rosalie DAVID");

console.log("\n== Les autres champs du contrôle restent exigés ==");
eq("sans SIRET ni SIREN ni TVA → identifiant légal manquant",
  controlerEntite({ ...apresSaisie, siret: null, siren: null, vat_number: null }).manquants,
  ["identifiant légal (SIREN ou SIRET)"]);
eq("sans adresse", controlerEntite({ ...apresSaisie, address: null }).manquants,
  ["adresse du siège"]);
eq("sans forme juridique", controlerEntite({ ...apresSaisie, legal_form: null }).manquants,
  ["forme juridique"]);
// Un champ rempli d'espaces ne vaut pas un champ rempli.
eq("un espace ne suffit pas",
  controlerEntite({ ...apresSaisie, representative_name: "   " }).manquants,
  ["représentant légal"]);

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
