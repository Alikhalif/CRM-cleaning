// Processus d'envoi des devis — AUCUN envoi automatique.
//
// Correction du 2026-11-04 : l'envoi automatique des devis (séquence n8n WF2,
// quatre e-mails Brevo) et le choix de canal « Manuel / Automatique » ont été
// retirés. Un devis part UNIQUEMENT après préparation et validation par le
// commercial.
//
// Ces tests figent la règle. Si quelqu'un réintroduit un jour un chemin
// d'envoi automatique, ou fait sortir un dossier de « Devis à réaliser » sans
// envoi réel, ils échouent.

import {
  STATUTS_SORTIE,
  attendUnDevis,
  attendUnDevisDe,
  statutDevis,
  type EtatDevis,
} from "@/lib/devis-a-realiser/shared";
import * as leads from "@/lib/leads";
import type { Lead } from "@/lib/leads";

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

console.log("== Plus aucun sélecteur de canal d'envoi ==");
// `needsEnvoi` imposait de choisir Mano ou Auto et affichait « Canal
// manquant » ; `canLaunchSequence` ouvrait le bouton de séquence n8n.
const api = leads as unknown as Record<string, unknown>;
vrai("needsEnvoi() n'existe plus", api.needsEnvoi === undefined);
vrai("canLaunchSequence() n'existe plus", api.canLaunchSequence === undefined);
// Le sous-statut de SIGNATURE, lui, reste exigé : ce n'est pas le même sujet.
vrai("needsSignature() est conservé", typeof api.needsSignature === "function");

console.log("\n== Le parcours commercial, dans l'ordre ==");
// 1 nouveau lead → 2 découverte à faire → 3 découverte enregistrée →
// 4 « Devis à réaliser » → 5 préparation → 6 validation et envoi → 7 envoyé.
const nouveau = { discoveryDoneAt: null, status: "lead" };
const decouverteFaite = { discoveryDoneAt: "2026-11-04T09:00:00Z", status: "lead" };
const devisEnvoye = { discoveryDoneAt: "2026-11-04T09:00:00Z", status: "envoye" };

vrai("1-2. un lead sans découverte n'attend PAS de devis",
  !attendUnDevisDe(nouveau.discoveryDoneAt, nouveau.status));
vrai("3-4. découverte enregistrée → le dossier entre dans « Devis à réaliser »",
  attendUnDevisDe(decouverteFaite.discoveryDoneAt, decouverteFaite.status));
vrai("7. une fois le devis envoyé, le dossier en sort",
  !attendUnDevisDe(devisEnvoye.discoveryDoneAt, devisEnvoye.status));

console.log("\n== Entrer dans « Devis à réaliser » ne déclenche RIEN ==");
// La règle d'appartenance ne lit que deux champs, et n'écrit nulle part :
// c'est une vue dérivée. Aucun effet de bord n'est possible.
const avant = { ...decouverteFaite };
const dedans = attendUnDevisDe(decouverteFaite.discoveryDoneAt, decouverteFaite.status);
vrai("le dossier y figure", dedans);
eq("et son état n'a pas bougé", decouverteFaite, avant);
vrai("le statut reste « lead » — aucun passage à « envoyé »",
  decouverteFaite.status === "lead");

console.log("\n== Seul un envoi RÉEL fait sortir le dossier ==");
// Les statuts de sortie sont ceux posés par un envoi effectif ou une clôture.
eq("statuts de sortie", [...STATUTS_SORTIE].sort(),
  ["encaisse", "envoye", "ouvert", "perdu", "signe"]);
for (const s of ["lead"]) {
  vrai(`« ${s} » ne fait pas sortir`, !STATUTS_SORTIE.has(s));
}
for (const s of ["envoye", "ouvert", "signe", "encaisse", "perdu"]) {
  vrai(`« ${s} » fait sortir`, STATUTS_SORTIE.has(s));
}

console.log("\n== Un brouillon ne vaut pas un envoi ==");
// Règle absolue : commencer ou finir la rédaction ne sort pas le dossier.
const enCoursDeRedaction: EtatDevis = {
  brouillon: true, brouillonChiffre: false,
  optimivvNonEnvoye: false, photosEnAttente: false,
};
const pretAEnvoyer: EtatDevis = {
  brouillon: true, brouillonChiffre: true,
  optimivvNonEnvoye: false, photosEnAttente: false,
};
eq("brouillon ouvert → en préparation", statutDevis(enCoursDeRedaction), "en_preparation");
eq("brouillon chiffré → prêt à envoyer", statutDevis(pretAEnvoyer), "pret_a_envoyer");
// « Prêt à envoyer » décrit un travail achevé, PAS un envoi : le dossier reste
// dans la liste tant que le commercial n'a pas cliqué sur Envoyer.
vrai("même prêt, le dossier attend toujours son envoi",
  attendUnDevisDe("2026-11-04T09:00:00Z", "lead"));

console.log("\n== Le champ de canal historique n'est plus exigé ==");
// 23 dossiers portent encore « mano » ou « auto » : on les lit sans erreur,
// mais plus aucune règle n'en dépend.
const historique = { discoveryDoneAt: "2026-07-21T09:00:00Z", status: "envoye" };
vrai("un dossier historique sort normalement",
  !attendUnDevisDe(historique.discoveryDoneAt, historique.status));

console.log("\n== attendUnDevis() et attendUnDevisDe() ne peuvent pas diverger ==");
// Le compteur et la liste doivent dire la même chose, sans quoi l'utilisateur
// voit « 4 » et n'en trouve que 3.
for (const [d, st] of [[null, "lead"], ["2026-11-04T09:00:00Z", "lead"],
                       ["2026-11-04T09:00:00Z", "envoye"], [null, "signe"]] as const) {
  const lead = { discoveryDoneAt: d, status: st } as unknown as Lead;
  eq(`cohérence (${d ? "découverte" : "sans découverte"}, ${st})`,
    attendUnDevis(lead), attendUnDevisDe(d, st));
}

console.log(ko === 0 ? "\nTOUT PASSE\n" : `\n${ko} ECHEC(S)\n`);
process.exit(ko === 0 ? 0 : 1);
