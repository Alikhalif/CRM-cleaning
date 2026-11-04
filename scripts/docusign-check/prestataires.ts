// Recherche des prestataires référencés et représentation des sociétés.
//
// Contrôles de la Partie 2 du master prompt du 2026-11-04 : l'appariement
// prestataire ↔ mission, et la formule de représentation quand une société est
// représentée par une personne morale.
//
// PORTÉE : logique PURE. Aucun appel réseau, aucune base.

import {
  classerPrestataires,
  correspondanceMission,
  departementDe,
  controlerEntite,
  type PrestataireChoisissable,
} from "@/lib/sous-traitance/contrats-shared";
import { donneurOrdreDepuisEntite } from "@/lib/sous-traitance/variables";
import { COUNTRIES, IDENTIFIANT_LEGAL } from "@/lib/leads";

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

function presta(p: Partial<PrestataireChoisissable> & { nom: string }): PrestataireChoisissable {
  return {
    technicianId: p.nom, initiales: "XX", email: "a@b.fr", telephone: null,
    raisonSociale: p.nom, nomCommercial: null, formeJuridique: null,
    siren: "812345678", siret: "81234567800012", adresse: "1 rue X", cpVille: null,
    dirigeant: "M. Y", secteurs: [], departements: [], competences: [],
    codePostalBase: null, nbInterventions: 0, manquants: [], utilisable: true,
    ...p,
  };
}

console.log("== Département déduit du code postal ==");
eq("75011 → 75", departementDe("75011"), "75");
eq("77400 → 77", departementDe("77400"), "77");
eq("01000 → 01", departementDe("01000"), "01");
// Outre-mer sur trois chiffres : 97400 est La Réunion, pas le « 97 ».
eq("97400 → 974", departementDe("97400"), "974");
eq("98000 → 980", departementDe("98000"), "980");
// Rien ne doit être deviné d'un code postal absent ou étranger.
eq("vide → null", departementDe(""), null);
eq("null → null", departementDe(null), null);
eq("code suisse 1201 → null", departementDe("1201"), null);
eq("texte → null", departementDe("Paris"), null);

console.log("\n== Correspondance prestataire ↔ mission ==");
const couvre = presta({
  nom: "NET 77", secteurs: ["nettoyage", "debarras"], departements: ["77", "93"],
});
const c1 = correspondanceMission(couvre, { secteur: "nettoyage", codePostal: "77400" });
vrai("activité couverte", c1.secteurCouvert);
vrai("département couvert", c1.departementCouvert);
vrai("correspondance complète", c1.correspond);
vrai("le motif le dit", c1.motifs.includes("activité couverte") && c1.motifs.includes("département 77"));

const horsZone = correspondanceMission(couvre, { secteur: "nettoyage", codePostal: "13001" });
vrai("hors zone : activité oui, département non",
  horsZone.secteurCouvert && !horsZone.departementCouvert && !horsZone.correspond);
vrai("le motif dit pourquoi", horsZone.motifs.some((m) => m.includes("hors zone")));

const mauvaiseActivite = correspondanceMission(couvre, { secteur: "demenagement", codePostal: "77400" });
vrai("activité non déclarée → pas de correspondance", !mauvaiseActivite.correspond);

console.log("\n== Un rattachement par code postal vaut couverture du département ==");
// Un prestataire sans départements déclarés mais basé dans le 77 couvre le 77.
const basePostale = presta({ nom: "SOLO 77", secteurs: ["nettoyage"], codePostalBase: "77100" });
const c2 = correspondanceMission(basePostale, { secteur: "nettoyage", codePostal: "77400" });
vrai("département déduit du rattachement", c2.departementCouvert && c2.correspond);

console.log("\n== Une donnée manquante n'est jamais un échec ==");
// Règle : on ne masque pas un prestataire parce qu'une information manque, on
// dit seulement qu'on n'a pas pu vérifier.
const sansRien = presta({ nom: "INCONNU" });
const c3 = correspondanceMission(sansRien, { secteur: "nettoyage", codePostal: "77400" });
vrai("aucune activité déclarée → non couvert, mais aucun motif accusateur",
  !c3.secteurCouvert && !c3.motifs.some((m) => m.includes("non déclarée")));
const c4 = correspondanceMission(couvre, { secteur: null, codePostal: null });
vrai("mission sans critère → rien n'est affirmé", !c4.correspond);

console.log("\n== Le classement remonte les bons, sans en cacher aucun ==");
const liste = [
  presta({ nom: "ZZZ hors zone", secteurs: ["nettoyage"], departements: ["13"] }),
  presta({ nom: "AAA complet", secteurs: ["nettoyage"], departements: ["77"], nbInterventions: 2 }),
  presta({ nom: "BBB complet neuf", secteurs: ["nettoyage"], departements: ["77"], nbInterventions: 0 }),
  presta({ nom: "CCC fiche incomplete", secteurs: ["nettoyage"], departements: ["77"], manquants: ["SIRET"], utilisable: false }),
  presta({ nom: "DDD rien" }),
];
const classe = classerPrestataires(liste, { secteur: "nettoyage", codePostal: "77400" });
eq("AUCUN prestataire n'est retiré", classe.length, liste.length);
eq("premier = correspond + complet + historique", classe[0].prestataire.nom, "AAA complet");
eq("deuxième = correspond + complet sans historique", classe[1].prestataire.nom, "BBB complet neuf");
eq("troisième = correspond mais fiche incomplète", classe[2].prestataire.nom, "CCC fiche incomplete");
vrai("le dernier ne correspond pas", !classe[classe.length - 1].corr.correspond);
// Un prestataire hors zone reste accessible : il suffit parfois de compléter
// sa fiche ou d'accepter un déplacement.
vrai("le hors-zone est toujours dans la liste",
  classe.some((x) => x.prestataire.nom === "ZZZ hors zone"));

console.log("\n== AUCUNE disponibilité n'est produite ==");
// Consigne explicite : « Ne pas inventer de disponibilités ». Le type de
// correspondance ne doit porter aucun champ de ce genre.
const champs = Object.keys(c1);
eq("champs de la correspondance", champs.sort(),
  ["correspond", "departementCouvert", "motifs", "secteurCouvert"]);
vrai("aucun champ de disponibilité",
  !champs.some((k) => /dispo|libre|calendrier|planning/i.test(k)));

console.log("\n== Représentation d'une société par une autre société ==");
const base = {
  id: "e1", legal_name: "CGK SERVICES", trade_name: null, legal_form: "SAS",
  siren: "812345678", siret: "81234567800012", vat_number: "FR81234567800",
  address: "1 rue de Paris, 75001 Paris", country: "FR",
};
const physique = donneurOrdreDepuisEntite({
  ...base, representative_name: "M. Jean DUPONT", representative_title: "Président",
});
eq("personne physique seule", physique.principal_company_representative, "M. Jean DUPONT");

const morale = donneurOrdreDepuisEntite({
  ...base,
  representative_company_name: "HOLDING CGK SAS",
  representative_name: "M. Jean DUPONT",
  representative_title: "Président",
});
eq("personne morale + son représentant",
  morale.principal_company_representative,
  "la société HOLDING CGK SAS, elle-même représentée par M. Jean DUPONT");
// La phrase du contrat est « Représentée par {{…}}, en sa qualité de {{…}} » :
// elle doit se lire juste avec la chaîne composée.
const phrase = `Représentée par ${morale.principal_company_representative}, `
  + `en sa qualité de ${morale.principal_company_representative_title}.`;
eq("la phrase du contrat se lit juste", phrase,
  "Représentée par la société HOLDING CGK SAS, elle-même représentée par M. Jean DUPONT, en sa qualité de Président.");

const moraleSeule = donneurOrdreDepuisEntite({
  ...base, representative_company_name: "HOLDING CGK SAS",
  representative_name: "", representative_title: "Gérant",
});
eq("société représentante sans personne physique",
  moraleSeule.principal_company_representative, "la société HOLDING CGK SAS");

console.log("\n== Identifiant légal : SIREN, à défaut SIRET, à défaut TVA ==");
eq("SIREN prioritaire", donneurOrdreDepuisEntite(base).principal_company_siren, "812345678");
eq("repli SIRET",
  donneurOrdreDepuisEntite({ ...base, siren: null }).principal_company_siren, "81234567800012");
eq("repli TVA",
  donneurOrdreDepuisEntite({ ...base, siren: null, siret: null }).principal_company_siren,
  "FR81234567800");
eq("rien à afficher plutôt qu'une invention",
  donneurOrdreDepuisEntite({ ...base, siren: null, siret: null, vat_number: null })
    .principal_company_siren, "");

console.log("\n== Les cinq pays ont un libellé d'identifiant légal ==");
eq("cinq pays", COUNTRIES.length, 5);
for (const p of COUNTRIES) {
  const i = IDENTIFIANT_LEGAL[p];
  vrai(`${p} : libellé, aide et exemple`,
    Boolean(i && i.label.trim() && i.aide.trim() && i.exemple.trim()));
}
vrai("« SIRET » n'est pas imposé hors de France",
  COUNTRIES.filter((p) => p !== "FR").every((p) => !/SIRET/i.test(IDENTIFIANT_LEGAL[p].label)));

console.log("\n== Une entité sans représentant ne peut pas émettre ==");
const sansRepresentant = controlerEntite({ ...base, representative_name: null, representative_title: null });
vrai("refusée", !sansRepresentant.utilisable);
vrai("le manque est nommé",
  sansRepresentant.manquants.some((m) => m.includes("représentant")));
const complete = controlerEntite({
  ...base, representative_name: "M. Jean DUPONT", representative_title: "Président",
});
vrai("acceptée quand tout est là", complete.utilisable);
eq("rien ne manque", complete.manquants, []);
// La société représentante est FACULTATIVE : son absence ne bloque pas.
const avecMorale = controlerEntite({
  ...base, representative_name: "M. Jean DUPONT", representative_title: "Président",
  representative_company_name: null,
});
vrai("la société représentante n'est pas exigée", avecMorale.utilisable);

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
