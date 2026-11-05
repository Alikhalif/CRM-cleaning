// Résumé horizontal du pipeline commercial.
//
// Ces contrôles figent le CALCUL des quatre chiffres et l'intitulé exact des
// quatre étapes. Ils vérifient aussi ce que le résumé ne doit PAS faire :
// inventer une conversion sur la première étape, perdre un dossier perdu qui
// avait reçu un devis, ou toucher au Suivi commercial.

import {
  ETAPES_RESUME,
  aDecouverteEffectuee,
  aDevisEnvoye,
  aDevisSigne,
  resumePipeline,
  type LeadPourResume,
} from "@/lib/pipeline-summary";
import { PIPELINE_COLUMNS } from "@/lib/leads";
import { CATEGORIES, CATEGORIE_LABEL } from "@/lib/suivi-shared";

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

const L = (p: Partial<LeadPourResume>): LeadPourResume =>
  ({ status: "lead", ...p });

console.log("== Quatre étapes, dans l'ordre, avec l'intitulé exact ==");
eq("nombre d'étapes", ETAPES_RESUME.length, 4);
eq("clés dans l'ordre", ETAPES_RESUME.map((e) => e.cle),
  ["recus", "decouverte", "devis_envoyes", "devis_signes"]);
eq("intitulés", ETAPES_RESUME.map((e) => e.libelle),
  ["LEADS REÇUS", "DÉCOUVERTE EFFECTUÉE", "DEVIS ENVOYÉS", "DEVIS SIGNÉS"]);
// L'intitulé exact est exigé partout dans le pipeline (§5). Il est déclaré
// ICI et nulle part ailleurs : c'est ce qui garantit l'uniformité.
vrai("« DÉCOUVERTE EFFECTUÉE » est l'intitulé de l'étape 2",
  ETAPES_RESUME[1].libelle === "DÉCOUVERTE EFFECTUÉE");
vrai("aucun autre libellé de découverte n'est employé",
  !ETAPES_RESUME.some((e) => /découverte/i.test(e.libelle) && e.libelle !== "DÉCOUVERTE EFFECTUÉE"));

console.log("\n== Une couleur distincte par étape ==");
const tokens = ETAPES_RESUME.map((e) => e.token);
eq("quatre jetons", tokens,
  ["--pipeline-recus", "--pipeline-decouverte", "--pipeline-devis", "--pipeline-signes"]);
eq("tous distincts", new Set(tokens).size, 4);
// Une étape n'est pas une activité : aucun jeton de secteur ne doit servir
// ici, sinon on lit un secteur là où il y a une étape.
vrai("aucun jeton de secteur emprunté", !tokens.some((t) => t.startsWith("--sector-")));

console.log("\n== Découverte effectuée ==");
vrai("date présente → oui", aDecouverteEffectuee(L({ discoveryDoneAt: "2026-11-04T09:00:00Z" })));
vrai("null → non", !aDecouverteEffectuee(L({ discoveryDoneAt: null })));
vrai("absent → non", !aDecouverteEffectuee(L({})));
vrai("chaîne vide → non", !aDecouverteEffectuee(L({ discoveryDoneAt: "   " })));

console.log("\n== Devis envoyé : le statut OU le document ==");
for (const s of ["envoye", "ouvert", "signe", "encaisse"]) {
  vrai(`statut « ${s} » → devis parti`, aDevisEnvoye(L({ status: s })));
}
vrai("statut « lead » seul → non", !aDevisEnvoye(L({ status: "lead" })));
// LE CAS QUI JUSTIFIE DE LIRE LES DOCUMENTS : un dossier perdu qui avait reçu
// un devis. Si on ne lisait que le statut, il disparaîtrait de l'étape 3 et
// le travail commercial accompli serait effacé du résumé.
vrai("perdu AVEC un devis envoyé → compté",
  aDevisEnvoye(L({ status: "perdu", documents: [{ type: "devis", status: "envoye" }] })));
vrai("perdu SANS devis → non compté",
  !aDevisEnvoye(L({ status: "perdu", documents: [] })));
// « refuse » et « expire » : le client a bien reçu le devis, c'est sa réponse
// qui a clos l'affaire.
vrai("devis refusé → il est bien parti",
  aDevisEnvoye(L({ status: "perdu", documents: [{ type: "devis", status: "refuse" }] })));
vrai("devis expiré → il est bien parti",
  aDevisEnvoye(L({ status: "perdu", documents: [{ type: "devis", status: "expire" }] })));
// Un BROUILLON n'est pas un envoi. C'est la règle du 2026-11-04.
vrai("devis brouillon → PAS un envoi",
  !aDevisEnvoye(L({ status: "lead", documents: [{ type: "devis", status: "brouillon" }] })));

console.log("\n== Devis signé ==");
for (const s of ["signe", "encaisse"]) {
  vrai(`statut « ${s} » → signé`, aDevisSigne(L({ status: s })));
}
vrai("devis au statut signé → signé",
  aDevisSigne(L({ status: "perdu", documents: [{ type: "devis", status: "signe" }] })));
// Une facture d'acompte payée ne peut pas exister sans signature.
vrai("acompte payé → signé",
  aDevisSigne(L({ status: "lead", documents: [{ type: "acompte", status: "paye" }] })));
vrai("facture finale payée → signé",
  aDevisSigne(L({ status: "lead", documents: [{ type: "finale", status: "paye" }] })));
vrai("acompte NON payé → pas une preuve de signature",
  !aDevisSigne(L({ status: "lead", documents: [{ type: "acompte", status: "envoye" }] })));
vrai("devis envoyé seul → pas signé",
  !aDevisSigne(L({ status: "envoye" })));

console.log("\n== Le même lot de dossiers aux quatre étapes ==");
// Un dossier signé compte dans les QUATRE étapes : le résumé répond « combien
// ont atteint ce point », pas « combien sont ici en ce moment ».
const signe = L({
  status: "signe",
  discoveryDoneAt: "2026-11-01T10:00:00Z",
  documents: [{ type: "devis", status: "signe" }],
});
const r1 = resumePipeline([signe]);
eq("un seul dossier signé → 1 partout", r1.etapes.map((e) => e.nombre), [1, 1, 1, 1]);
eq("conversion globale 100 %", r1.conversionGlobale, 100);

console.log("\n== Les chiffres réels de la production (2026-11-04) ==");
// Jeu reconstitué à partir des comptages faits en lecture seule :
// 687 leads, 28 découvertes, 22 devis partis, 12 signés.
const prod: LeadPourResume[] = [
  // 12 signés — ils ont tous découverte et devis
  ...Array.from({ length: 12 }, () => L({
    status: "signe", discoveryDoneAt: "2026-10-01T09:00:00Z",
    documents: [{ type: "devis" as const, status: "signe" }],
  })),
  // 10 devis partis non signés, dont 4 avec découverte
  ...Array.from({ length: 4 }, () => L({
    status: "envoye", discoveryDoneAt: "2026-10-01T09:00:00Z",
  })),
  ...Array.from({ length: 6 }, () => L({ status: "envoye" })),
  // 12 découvertes sans devis
  ...Array.from({ length: 12 }, () => L({
    status: "lead", discoveryDoneAt: "2026-10-01T09:00:00Z",
  })),
  // le reste : jamais travaillé
  ...Array.from({ length: 653 }, () => L({ status: "lead" })),
];
const rp = resumePipeline(prod);
eq("les quatre chiffres", rp.etapes.map((e) => e.nombre), [687, 28, 22, 12]);
eq("conversions", rp.etapes.map((e) => e.conversion), [null, 4, 79, 55]);
eq("conversion globale", rp.conversionGlobale, 2);
vrai("aucun dépassement sur ce jeu", !rp.etapes.some((e) => e.depassePrecedente));

console.log("\n== La première étape n'invente pas de conversion ==");
eq("conversion de l'étape 1", rp.etapes[0].conversion, null);
vrai("ni dépassement sur l'étape 1", !rp.etapes[0].depassePrecedente);

console.log("\n== Dépassement signalé, pas masqué ==");
// Cas réel : 18 dossiers de production portent un devis parti SANS découverte
// enregistrée. Sur un sous-ensemble filtré, l'étape 3 peut donc dépasser la 2.
const depasse = resumePipeline([
  L({ status: "envoye" }),
  L({ status: "envoye" }),
  L({ status: "lead", discoveryDoneAt: "2026-10-01T09:00:00Z" }),
]);
eq("chiffres", depasse.etapes.map((e) => e.nombre), [3, 1, 2, 0]);
vrai("l'étape 3 est marquée comme dépassant la 2", depasse.etapes[2].depassePrecedente);
vrai("l'étape 2 ne l'est pas", !depasse.etapes[1].depassePrecedente);
eq("le pourcentage reste calculé, pas tronqué", depasse.etapes[2].conversion, 200);

console.log("\n== Liste vide : aucune division par zéro ==");
const vide = resumePipeline([]);
eq("tout à zéro", vide.etapes.map((e) => e.nombre), [0, 0, 0, 0]);
eq("conversions nulles", vide.etapes.map((e) => e.conversion), [null, null, null, null]);
eq("conversion globale nulle", vide.conversionGlobale, null);

console.log("\n== Le Kanban et le Suivi commercial ne sont PAS touchés ==");
// Le résumé est une lecture transverse : il n'ajoute aucune étape au pipeline
// et ne modifie pas le vocabulaire du Suivi.
eq("colonnes du Kanban inchangées : 7", PIPELINE_COLUMNS.length, 7);
eq("statuts du Kanban", PIPELINE_COLUMNS.map((c) => c.status),
  ["lead", "envoye", "ouvert", "signe", "acompte_paye", "encaisse", "perdu"]);
eq("catégories du Suivi commercial inchangées", [...CATEGORIES],
  ["nouveaux", "en_cours", "termines"]);
eq("libellés du Suivi inchangés",
  CATEGORIES.map((c) => CATEGORIE_LABEL[c]),
  ["Nouveaux prospects", "En cours", "Terminés"]);
vrai("le résumé n'ajoute aucune étape au pipeline",
  ETAPES_RESUME.length === 4 && PIPELINE_COLUMNS.length === 7);

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
