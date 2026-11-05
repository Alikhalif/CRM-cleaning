// TAXONOMIE DES ACTIVITÉS — deux familles, six branches (validation client
// du 2026-11-05, §2).
//
// POURQUOI CE CONTRÔLE EXISTE. Le client a redéfini l'organisation des
// activités du module Superviseur : deux familles commerciales, chacune
// découpée en branches, et une liste d'activités explicitement exclues. Deux
// pièges à verrouiller :
//
//   1. réutiliser `FAMILLE_NETTOYAGE` de lib/discovery-nettoyage.ts — qui
//      regroupe les secteurs partageant le même FORMULAIRE et inclut
//      `urgence`, donc une activité que le client a exclue ;
//   2. fusionner les découvertes sous prétexte que les activités partagent une
//      famille. Consigne explicite : « Il ne faut surtout pas fusionner les
//      formulaires de découverte. »
//
// Ce contrôle vérifie la taxonomie ET que les découvertes n'ont pas bougé.

import { readFileSync } from "node:fs";
import {
  BRANCHES,
  BRANCHES_ORDONNEES,
  FAMILLES,
  SECTEURS_HORS_PERIMETRE,
  SECTEURS_SUPERVISES,
  brancheDuSecteur,
  familleDuSecteur,
} from "@/lib/supervision-perimetre";
import { FAMILLE_NETTOYAGE } from "@/lib/discovery-nettoyage";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}

console.log("\n1. Deux familles, six branches");

vrai("exactement deux familles", FAMILLES.length === 2);
vrai("la première famille est NETTOYAGE", FAMILLES[0]?.slug === "nettoyage");
vrai(
  "la seconde est DÉMÉNAGEMENT / DÉBARRAS / TRANSPORT",
  FAMILLES[1]?.slug === "demenagement_debarras_transport",
);
vrai("six branches en tout", BRANCHES_ORDONNEES.length === 6);
vrai(
  "famille Nettoyage : nettoyage, désinfection, désinsectisation",
  JSON.stringify(FAMILLES[0]?.branches) ===
    JSON.stringify(["nettoyage", "desinfection", "desinsectisation"]),
);
vrai(
  "famille Déménagement : déménagement, débarras, transport",
  JSON.stringify(FAMILLES[1]?.branches) ===
    JSON.stringify(["demenagement", "debarras", "transport"]),
);
vrai(
  "chaque branche déclare la famille qui la contient",
  FAMILLES.every((f) => f.branches.every((b) => BRANCHES[b].famille === f.slug)),
);

console.log("\n2. Rattachement des secteurs existants");

const attendu: Record<string, string> = {
  nettoyage: "nettoyage",
  nettoyage_difficile: "nettoyage",
  diogene: "nettoyage",
  demenagement: "demenagement",
  debarras: "debarras",
  transport: "transport",
};
for (const [secteur, branche] of Object.entries(attendu)) {
  vrai(`${secteur} → branche ${branche}`, brancheDuSecteur(secteur) === branche);
}
vrai("nettoyage_difficile reste dans la famille Nettoyage", familleDuSecteur("nettoyage_difficile") === "nettoyage");
vrai("diogene reste dans la famille Nettoyage", familleDuSecteur("diogene") === "nettoyage");
vrai(
  "debarras est dans la famille Déménagement / Débarras / Transport",
  familleDuSecteur("debarras") === "demenagement_debarras_transport",
);
vrai(
  "aucun secteur n'est rattaché à deux branches",
  SECTEURS_SUPERVISES.length === new Set(SECTEURS_SUPERVISES).size,
);

console.log("\n3. Activités exclues du module");

for (const s of ["urgence", "enr", "renovation"]) {
  vrai(`${s} n'est rattaché à aucune branche`, brancheDuSecteur(s) === null);
  vrai(`${s} figure dans les exclusions explicites`, SECTEURS_HORS_PERIMETRE.includes(s));
}
vrai(
  "la taxonomie du superviseur n'est PAS celle des découvertes",
  FAMILLE_NETTOYAGE.includes("urgence") && !SECTEURS_SUPERVISES.includes("urgence"),
);

console.log("\n4. Branches sans activité en base — annoncées, pas inventées");

vrai("la branche désinfection n'a aucun secteur", BRANCHES.desinfection.secteurs.length === 0);
vrai("la branche désinsectisation n'a aucun secteur", BRANCHES.desinsectisation.secteurs.length === 0);
vrai(
  "la branche désinfection explique ce qui manque",
  (BRANCHES.desinfection.manque ?? "").length > 40,
);
vrai(
  "la branche désinsectisation explique ce qui manque",
  (BRANCHES.desinsectisation.manque ?? "").length > 40,
);
vrai(
  "toute branche vide porte une explication",
  BRANCHES_ORDONNEES.every((b) => BRANCHES[b].secteurs.length > 0 || Boolean(BRANCHES[b].manque)),
);

console.log("\n5. Les découvertes n'ont pas été fusionnées");

// Le client a demandé que chaque prestation garde son formulaire. On vérifie
// que les fichiers de découverte existent toujours et restent distincts.
const lire = (p: string): string => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
};
const nettoyage = lire("lib/discovery-nettoyage.ts");
const metier = lire("lib/discovery-metier.ts");

vrai("la découverte Nettoyage est toujours présente", nettoyage.length > 500);
vrai("la découverte Débarras / Déménagement / Transport est toujours présente", metier.length > 500);
vrai(
  "la découverte Nettoyage garde ses options désinfection / décontamination",
  nettoyage.includes("desinfection") && nettoyage.includes("decontamination"),
);
// Trois jeux de questions DISTINCTS dans la famille 2 : le volume d'un
// débarras, le volume d'un déménagement et le type d'objet transporté ne se
// posent pas de la même façon. Les fusionner serait la régression redoutée.
for (const symbole of ["VOLUME_DEBARRAS", "VOLUME_DEMENAGEMENT", "TYPE_OBJET", "OPTIONS_TRANSPORT"]) {
  vrai(`${symbole} existe toujours dans la découverte métier`, metier.includes(`export const ${symbole}`));
}
vrai(
  "les questions Diogène restent spécifiques (DIO_*)",
  /export const DIO_[A-Z_]+/.test(nettoyage),
);

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
