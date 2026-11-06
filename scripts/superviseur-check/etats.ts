// MACHINE À ÉTATS COMMERCIALE — LOT 1, test 1 du 2026-11-06.
//
// ── CE QUE CES CONTRÔLES FIGENT ──────────────────────────────────────
//
// `lib/supervision-server.ts` calculait :
//
//   traite = status !== "lead" || discovery_done_at || premiereOuverture
//
// où `premiereOuverture` vient de l'audit `lead.open` — c'est-à-dire du simple
// fait d'AFFICHER le dossier. Mesuré sur les 712 leads de production : 650
// comptés « traités », dont 601 sur ce seul critère. Le cockpit annonçait 62
// leads en attente quand 656 étaient affectés et jamais appelés.
//
// Le client a tranché, mot pour mot : « une action créée ne signifie pas qu'un
// lead est traité » et « un appel sans réponse ne signifie pas que le client a
// été contacté avec succès ».
//
// Ces assertions verrouillent les deux confusions, et la troisième que
// personne n'avait vue : ouvrir une fiche n'est pas appeler un client.
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret.

import {
  ETATS_ORDONNES,
  ETAT_LABEL,
  appelsTries,
  compterAppels,
  dedoublonnerAppels,
  delaiPremierAppelMin,
  delaiPremierContactMin,
  estContacte,
  etatDuLead,
  premierAppel,
  premierContact,
  rangEtat,
  type Appel,
  type EtatLead,
  type FaitsLead,
} from "@/lib/supervision-etats";

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

/** Faits minimaux : un lead qui vient d'arriver, sans rien. */
const nu = (p: Partial<FaitsLead> = {}): FaitsLead => ({
  ownerId: null,
  statut: "lead",
  decouverteLe: null,
  appels: [],
  devisEnvoye: false,
  devisOuvert: false,
  devisSigne: false,
  isNrp: false,
  motifPerte: null,
  ...p,
});

const appel = (le: string, resultat: Appel["resultat"], source: Appel["source"] = "declare"): Appel =>
  ({ le, resultat, source, parQui: "u1" });

// ══════════════════════════════════════════════════════════════════════
console.log("\n1. LA confusion corrigée : une tâche ouverte n'est pas un contact");
// ══════════════════════════════════════════════════════════════════════
//
// `FaitsLead` ne porte AUCUN champ « action commerciale ouverte », et c'est
// la correction elle-même : la donnée qui causait l'erreur n'entre plus dans
// la machine. On le vérifie par le typage ET par le comportement.

const champs = Object.keys(nu());
vrai("aucun champ d'action ou de tâche commerciale dans les faits",
  !champs.some((c) => /action|tache|task|relance|echeance/i.test(c)), champs.join(", "));

// Un lead affecté, avec découverte NON faite et aucun appel : « affecté ».
eq("affecté sans appel → « affecté », pas « contacté »",
  etatDuLead(nu({ ownerId: "c1" })), "affecte" as EtatLead);
vrai("et il n'est PAS compté comme contacté", !estContacte(nu({ ownerId: "c1" })));

// ══════════════════════════════════════════════════════════════════════
console.log("\n2. La deuxième confusion : appel sans réponse ≠ contact établi");
// ══════════════════════════════════════════════════════════════════════

for (const r of ["sans_reponse", "rappel", "injoignable"] as Appel["resultat"][]) {
  const f = nu({ ownerId: "c1", appels: [appel("2026-11-01T10:00:00Z", r)] });
  eq(`« ${r} » → appel sans réponse`, etatDuLead(f), "appel_sans_reponse" as EtatLead);
  vrai(`« ${r} » n'est PAS un contact`, !estContacte(f));
}

const joint = nu({ ownerId: "c1", appels: [appel("2026-11-01T10:00:00Z", "joint")] });
eq("« joint » → contact établi", etatDuLead(joint), "contact_etabli" as EtatLead);
vrai("et il EST compté comme contacté", estContacte(joint));

// Être joint une fois suffit, quelles qu'aient été les tentatives précédentes.
const apresEchecs = nu({
  ownerId: "c1",
  appels: [
    appel("2026-11-01T09:00:00Z", "sans_reponse"),
    appel("2026-11-01T11:00:00Z", "sans_reponse"),
    appel("2026-11-02T09:00:00Z", "joint"),
    appel("2026-11-03T09:00:00Z", "sans_reponse"),
  ],
});
eq("joint une fois puis sans réponse → reste contact établi",
  etatDuLead(apresEchecs), "contact_etabli" as EtatLead);

// ══════════════════════════════════════════════════════════════════════
console.log("\n3. La troisième, que personne n'avait vue : ouvrir ≠ appeler");
// ══════════════════════════════════════════════════════════════════════
//
// L'audit `lead.open` ne figure nulle part dans les faits : un dossier
// consulté cent fois sans un appel reste « affecté ». C'est ce critère qui
// comptait 601 leads comme traités.

vrai("aucun champ d'affichage de fiche dans les faits",
  !champs.some((c) => /open|affich|consult|vue?$/i.test(c)), champs.join(", "));

// ══════════════════════════════════════════════════════════════════════
console.log("\n4. Les onze états, et l'ordre de résolution");
// ══════════════════════════════════════════════════════════════════════

eq("onze états déclarés", ETATS_ORDONNES.length, 11);
for (const e of ETATS_ORDONNES) {
  vrai(`« ${e} » porte un libellé`, Boolean(ETAT_LABEL[e]?.trim()));
}

eq("reçu sans propriétaire", etatDuLead(nu()), "recu" as EtatLead);
eq("découverte faite, aucun devis → devis à réaliser",
  etatDuLead(nu({ ownerId: "c1", decouverteLe: "2026-11-01T10:00:00Z" })),
  "devis_a_realiser" as EtatLead);
eq("devis envoyé", etatDuLead(nu({ ownerId: "c1", devisEnvoye: true })), "devis_envoye" as EtatLead);
eq("devis ouvert", etatDuLead(nu({ statut: "ouvert" })), "devis_ouvert" as EtatLead);
eq("devis signé", etatDuLead(nu({ statut: "signe" })), "devis_signe" as EtatLead);
eq("encaissé compte comme signé", etatDuLead(nu({ statut: "encaisse" })), "devis_signe" as EtatLead);
eq("perdu sort du cycle", etatDuLead(nu({ statut: "perdu" })), "perdu" as EtatLead);

// L'aval l'emporte sur l'amont : un fait postérieur prouve que les étapes
// antérieures ont eu lieu, même mal journalisées. L'inverse produirait un
// « devis signé jamais contacté ».
eq("devis signé sans découverte saisie → signé quand même",
  etatDuLead(nu({ statut: "signe", decouverteLe: null })), "devis_signe" as EtatLead);
vrai("et il compte comme contacté", estContacte(nu({ statut: "signe" })));
eq("devis envoyé sans appel journalisé → envoyé",
  etatDuLead(nu({ ownerId: "c1", devisEnvoye: true, appels: [] })), "devis_envoye" as EtatLead);

// `is_nrp` est antérieur aux appels déclarés : il ne doit pas être perdu.
eq("is_nrp seul → appel sans réponse",
  etatDuLead(nu({ ownerId: "c1", isNrp: true })), "appel_sans_reponse" as EtatLead);
vrai("et ce n'est pas un contact", !estContacte(nu({ ownerId: "c1", isNrp: true })));

// Un lead perdu : contacté ou non selon les FAITS, jamais par défaut.
vrai("perdu après contact → contacté",
  estContacte(nu({ statut: "perdu", appels: [appel("2026-11-01T10:00:00Z", "joint")] })));
vrai("perdu sans jamais de réponse → NON contacté",
  !estContacte(nu({ statut: "perdu", appels: [appel("2026-11-01T10:00:00Z", "sans_reponse")] })));

// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Rangs et progression");
// ══════════════════════════════════════════════════════════════════════

vrai("« recu » est le premier rang", rangEtat("recu") === 0);
vrai("« contact_etabli » est après « appel_sans_reponse »",
  rangEtat("contact_etabli") > rangEtat("appel_sans_reponse"));
vrai("« devis_signe » est après « devis_envoye »",
  rangEtat("devis_signe") > rangEtat("devis_envoye"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n6. Délais — null quand rien n'est journalisé");
// ══════════════════════════════════════════════════════════════════════
//
// `null` est la réponse honnête et aujourd'hui majoritaire : la production ne
// porte que cinq appels tracés sur 712 leads. Rendre 0 ou une moyenne
// masquerait exactement ce que le superviseur doit voir.

const recu = "2026-11-01T10:00:00Z";
eq("aucun appel → délai null", delaiPremierAppelMin(nu(), recu), null);
eq("aucune date de réception → null",
  delaiPremierAppelMin(nu({ appels: [appel("2026-11-01T11:00:00Z", "joint")] }), null), null);
eq("appel une heure après → 60 minutes",
  delaiPremierAppelMin(nu({ appels: [appel("2026-11-01T11:00:00Z", "sans_reponse")] }), recu), 60);
// Le délai de PREMIER APPEL et celui de PREMIER CONTACT sont deux mesures.
const deuxTemps = nu({
  appels: [appel("2026-11-01T11:00:00Z", "sans_reponse"), appel("2026-11-01T14:00:00Z", "joint")],
});
eq("premier appel → 60 min", delaiPremierAppelMin(deuxTemps, recu), 60);
eq("premier contact → 240 min", delaiPremierContactMin(deuxTemps, recu), 240);
eq("sans contact, le délai de contact est null",
  delaiPremierContactMin(nu({ appels: [appel("2026-11-01T11:00:00Z", "sans_reponse")] }), recu), null);

// ══════════════════════════════════════════════════════════════════════
console.log("\n7. Déclaré et confirmé ne se mélangent jamais");
// ══════════════════════════════════════════════════════════════════════
//
// Exigence du client : « distinguer les appels déclarés manuellement des
// appels confirmés par Ringover ». Un total unique effacerait la différence
// entre une parole et une preuve.

const mixte = [
  appel("2026-11-01T10:00:00Z", "sans_reponse", "declare"),
  appel("2026-11-02T10:00:00Z", "joint", "ringover"),
  appel("2026-11-03T10:00:00Z", "joint", "declare"),
];
eq("compteurs séparés par source",
  compterAppels(mixte), { declares: 2, ringover: 1, joints: 2, sansReponse: 1 });

// ══════════════════════════════════════════════════════════════════════
console.log("\n8. Dédoublonnage déclaré / Ringover");
// ══════════════════════════════════════════════════════════════════════
//
// Le jour où la ligne sera portée, le commercial déclarera son appel ET
// Ringover le remontera. Sans dédoublonnage, le superviseur verrait une
// activité doublée.

const doublon = dedoublonnerAppels([
  appel("2026-11-01T10:00:00Z", "joint", "declare"),
  appel("2026-11-01T10:05:00Z", "joint", "ringover"),
]);
eq("deux traces du même appel → une seule", doublon.length, 1);
eq("et c'est la PREUVE qui est gardée, pas la déclaration",
  doublon[0]?.source, "ringover" as Appel["source"]);

const deuxVrais = dedoublonnerAppels([
  appel("2026-11-01T10:00:00Z", "joint", "declare"),
  appel("2026-11-01T11:00:00Z", "joint", "ringover"),
]);
eq("une heure d'écart → deux appels distincts", deuxVrais.length, 2);

const resultatsDifferents = dedoublonnerAppels([
  appel("2026-11-01T10:00:00Z", "sans_reponse", "declare"),
  appel("2026-11-01T10:05:00Z", "joint", "ringover"),
]);
eq("résultats différents → jamais fusionnés", resultatsDifferents.length, 2);

const sansRingover = dedoublonnerAppels([
  appel("2026-11-01T10:00:00Z", "joint", "declare"),
  appel("2026-11-01T10:03:00Z", "joint", "declare"),
]);
eq("deux déclarations rapprochées → une seule", sansRingover.length, 1);
eq("et elle reste une déclaration", sansRingover[0]?.source, "declare" as Appel["source"]);

// ══════════════════════════════════════════════════════════════════════
console.log("\n9. Helpers de tri");
// ══════════════════════════════════════════════════════════════════════

const desordre = [
  appel("2026-11-03T10:00:00Z", "joint"),
  appel("2026-11-01T10:00:00Z", "sans_reponse"),
  appel("2026-11-02T10:00:00Z", "rappel"),
];
eq("tri chronologique", appelsTries(desordre).map((a) => a.le.slice(8, 10)), ["01", "02", "03"]);
eq("premier appel = le plus ancien", premierAppel(desordre)?.le.slice(8, 10), "01");
eq("premier contact = le premier « joint »", premierContact(desordre)?.le.slice(8, 10), "03");
eq("aucun appel → premierAppel null", premierAppel([]), null);
eq("aucun joint → premierContact null",
  premierContact([appel("2026-11-01T10:00:00Z", "sans_reponse")]), null);

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
