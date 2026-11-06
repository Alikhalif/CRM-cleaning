// DÉCOUVERTE ENRICHIE — corrections C3 et C6 du 2026-11-06.
//
// ── CE QUI MANQUAIT ─────────────────────────────────────────────────
//
// L'audit du moteur a montré que six éléments de l'énoncé client n'avaient
// AUCUN champ de découverte :
//
//   • les radiateurs — le catalogue portait l'opération à son palier 3, mais
//     aucune donnée ne pouvait la déclencher ;
//   • le nombre de niveaux — « maison sur deux niveaux » se perdait en texte
//     libre et le devis n'en disait rien ;
//   • la nicotine — elle n'existait que comme origine d'une désodorisation
//     VALIDÉE, pas comme état de surface ;
//   • l'étendue des suies — la famille ouvrait la section, rien n'en disait
//     l'ampleur ;
//   • le contenu des placards — on savait qu'il y en avait, pas s'ils étaient
//     vides ou occupés ;
//   • les particularités techniques — noyées dans le contexte libre, qui était
//     recopié mot pour mot dans le devis.
//
// ── LA RÈGLE QUI GOUVERNE LEUR EXPLOITATION ─────────────────────────
//
// Aucun de ces champs n'AJOUTE une prestation. Ce sont des constats : ils
// adaptent la description d'une prestation déjà validée, appellent une réserve
// quand ils bornent le faisable, ou nourrissent les observations. C'est
// l'arbitrage du 2026-11-06 — « une observation n'autorise jamais une
// prestation » — et un champ de plus ne doit pas devenir une porte pour le
// contourner. C'est ce que ces contrôles vérifient en premier.
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret.

import {
  controlerDevis,
  genererContenuDevis,
  type ContenuDevis,
  type Decouverte,
} from "@/lib/generation/devis-contenu";
import {
  NICOTINE, NIVEAUX, PARTICULARITES, PLACARDS_CONTENU, RADIATEURS, SUIE,
} from "@/lib/discovery-nettoyage";

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

/** Nettoyage approfondi de référence, au niveau 2 (le catalogue n'y parle pas
 *  de radiateurs : c'est le cas qui exerce nos ajouts). */
const net = (details: Record<string, unknown>, extra: Partial<Decouverte> = {}): Decouverte => ({
  sector: "nettoyage",
  surfaceM2: 85,
  etatSalete: "important",
  details: { typeNettoyage: "approfondi", typeBienNet: "appartement", nbSdb: 1, ...details },
  contexteIntervention: null,
  ...extra,
});

const T = (c: ContenuDevis | null) => (c?.detail ?? "").toLowerCase();
const R = (c: ContenuDevis | null) => (c?.reserves ?? "").toLowerCase();
const SECTIONS = (c: ContenuDevis | null) => (c?.sections ?? []).map((s) => s.titre);

// ══════════════════════════════════════════════════════════════════════
console.log("\n1. AUCUN de ces champs ne crée de prestation");
// ══════════════════════════════════════════════════════════════════════

// Tous renseignés d'un coup, au maximum : le nombre de sections ne doit pas
// bouger d'une seule unité par rapport au même dossier sans ces champs.
const nu = genererContenuDevis(net({}));
const charge = genererContenuDevis(net({
  radiateurs: "rad_derriere",
  nbNiveaux: "3",
  nicotine: "nicotine_importante",
  suie: "suie_generalisee",
  dressings: "oui",
  dressingsInterieur: "oui",
  placardsContenu: "placards_occupes",
  particularites: [
    "part_hauteur", "part_sans_eau", "part_sans_electricite", "part_sans_ascenseur",
    "part_acces_etroit", "part_occupe", "part_animaux", "part_fragile",
    "part_amiante_suspecte",
  ],
}));
eq("mêmes sections, aux mêmes titres", SECTIONS(charge), SECTIONS(nu));
vrai("et le contrôle indépendant reste conforme", controlerDevis(charge!).ok,
  controlerDevis(charge!).violations.map((v) => v.message).join(" | "));
vrai("aucune section « désinfection » n'apparaît",
  !SECTIONS(charge).includes("Désinfection"));
vrai("aucune section « traitement des odeurs »",
  !SECTIONS(charge).includes("Traitement des odeurs"));
vrai("aucune section « traitement des nuisibles »",
  !SECTIONS(charge).includes("Traitement des nuisibles"));
vrai("le descriptif est néanmoins plus riche",
  (charge?.detail.length ?? 0) > (nu?.detail.length ?? 0),
  `${nu?.detail.length} → ${charge?.detail.length} caractères`);

// ══════════════════════════════════════════════════════════════════════
console.log("\n2. Radiateurs — l'accès décide, et on ne répète pas le catalogue");
// ══════════════════════════════════════════════════════════════════════

vrai("les quatre valeurs sont déclarées", RADIATEURS.length === 4);

const radAcc = genererContenuDevis(net({ radiateurs: "rad_accessibles" }));
vrai("accessibles → l'opération figure", T(radAcc).includes("radiateurs et de leurs parties accessibles"));
vrai("mais pas le « derrière »", !T(radAcc).includes("derrière les radiateurs"));

const radDer = genererContenuDevis(net({ radiateurs: "rad_derriere" }));
vrai("« derrière possible » → la précision y est", T(radDer).includes("derrière les radiateurs"));

const radEnc = genererContenuDevis(net({ radiateurs: "rad_encastres" }));
vrai("encastrés → parties visibles seulement", T(radEnc).includes("parties visibles des radiateurs"));
vrai("et une réserve dit qu'on ne nettoie pas derrière",
  R(radEnc).includes("encastrés ou inaccessibles"));
vrai("encastrés → surtout PAS de promesse « derrière »",
  !T(radEnc).includes("derrière les radiateurs"));

// Le piège : au palier 3, le catalogue parle DÉJÀ des radiateurs. Notre ligne
// ne doit pas s'ajouter à la sienne — deux puces sur le même sujet, que
// l'anti-répétition ne voit pas puisqu'il compare des textes exacts.
const niveau3 = genererContenuDevis({
  sector: "diogene", surfaceM2: 60, etatSalete: "extreme",
  details: {
    typeNettoyage: "insalubre", typeBienNet: "appartement", nbSdb: 1,
    dioEncombrement: "dio_enc_important", radiateurs: "rad_accessibles",
  },
  contexteIntervention: null,
});
const lignesRad = (niveau3?.detail ?? "").split("\n").filter((l) => /radiateur/i.test(l));
eq("au palier 3, UNE seule ligne sur les radiateurs", lignesRad.length, 1);

// ══════════════════════════════════════════════════════════════════════
console.log("\n3. Nombre de niveaux");
// ══════════════════════════════════════════════════════════════════════

vrai("quatre valeurs déclarées", NIVEAUX.length === 4);
vrai("deux niveaux → la mention figure au descriptif",
  T(genererContenuDevis(net({ nbNiveaux: "2" }))).includes("répartie sur 2 niveaux"));
vrai("quatre et plus → le libellé est repris",
  T(genererContenuDevis(net({ nbNiveaux: "4plus" }))).includes("4 niveaux ou plus"));
vrai("non renseigné → rien n'est inventé",
  !T(nu).includes("répartie sur"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n4. Placards : vides, occupés, en partie");
// ══════════════════════════════════════════════════════════════════════

vrai("trois valeurs déclarées", PLACARDS_CONTENU.length === 3);

const vides = genererContenuDevis(net({ dressings: "oui", dressingsInterieur: "oui", placardsContenu: "placards_vides" }));
vrai("vides → nettoyage intérieur promis",
  T(vides).includes("intérieur des placards et rangements vides"));
vrai("et aucune réserve restrictive", !R(vides).includes("ne sont pas vidés"));

const occupes = genererContenuDevis(net({ dressings: "oui", dressingsInterieur: "oui", placardsContenu: "placards_occupes" }));
vrai("occupés → façades et parties accessibles seulement",
  T(occupes).includes("façades et des parties accessibles des rangements"));
vrai("et une réserve dit qu'on ne vide pas", R(occupes).includes("ne sont pas vidés"));
vrai("occupés → PAS de promesse d'intérieur",
  !T(occupes).includes("intérieur des placards et rangements vides"));

// Le piège : l'ancien champ `dressings` produisait déjà une phrase proche.
const lignesPlacards = (vides?.detail ?? "").split("\n")
  .filter((l) => /placards?|rangements|dressings/i.test(l) && !/cuisine/i.test(l));
eq("une seule phrase sur les placards hors cuisine", lignesPlacards.length, 1);
vrai("sans `placardsContenu`, l'ancienne phrase subsiste",
  T(genererContenuDevis(net({ dressings: "oui", dressingsInterieur: "oui" })))
    .includes("placards et dressings, intérieur compris"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Nicotine — un état de surface, et une réserve honnête");
// ══════════════════════════════════════════════════════════════════════

vrai("quatre valeurs déclarées", NICOTINE.length === 4);
const nico = genererContenuDevis(net({ nicotine: "nicotine_marquee" }));
vrai("le nettoyage est ADAPTÉ", T(nico).includes("surfaces marquées par le tabac"));
vrai("l'observation est rapportée", T(nico).includes("traces de tabac"));
vrai("la réserve borne l'attente",
  R(nico).includes("imprégnées dans les supports poreux"));
vrai("et elle renvoie la remise en peinture hors devis",
  R(nico).includes("remise en peinture"));
vrai("AUCUNE section de traitement n'apparaît",
  SECTIONS(nico).length === SECTIONS(nu).length);
vrai("« non » ne produit rien", !T(genererContenuDevis(net({ nicotine: "non" }))).includes("tabac"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n6. Suie — l'étendue, sans ouvrir la section hors sinistre");
// ══════════════════════════════════════════════════════════════════════

vrai("quatre valeurs déclarées", SUIE.length === 4);
const suieHorsSinistre = genererContenuDevis(net({ suie: "suie_generalisee" }));
vrai("sur un nettoyage approfondi, AUCUNE section « suies »",
  !SECTIONS(suieHorsSinistre).includes("Traitement des suies et résidus de combustion"),
  SECTIONS(suieHorsSinistre).join(" · "));
vrai("mais l'observation est rapportée", T(suieHorsSinistre).includes("dépôts de suie"));

const incendie = genererContenuDevis({
  sector: "nettoyage", surfaceM2: 120, etatSalete: "tres_important",
  details: {
    typeNettoyage: "apres_sinistre", typeBienNet: "maison", nbSdb: 2,
    complements: ["decontamination"], decontaminationOrigine: "incendie",
    suie: "suie_etendue",
  },
  contexteIntervention: null,
});
vrai("après incendie, la section existe (par la FAMILLE)",
  SECTIONS(incendie).includes("Traitement des suies et résidus de combustion"));
vrai("et l'étendue y est précisée", T(incendie).includes("étendue des dépôts constatée"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n7. Particularités techniques — des réserves, pas des prestations");
// ══════════════════════════════════════════════════════════════════════

vrai("neuf particularités déclarées", PARTICULARITES.length === 9);

for (const [cle, attendu] of [
  ["part_hauteur", "situées en hauteur"],
  ["part_sans_eau", "pas d'eau courante"],
  ["part_sans_electricite", "pas d'électricité"],
  ["part_occupe", "présence des occupants"],
  ["part_fragile", "supports fragiles ou anciens"],
  ["part_amiante_suspecte", "amiante est suspectée"],
] as [string, string][]) {
  const c = genererContenuDevis(net({ particularites: [cle] }));
  vrai(`« ${cle} » → réserve « ${attendu} »`, R(c).includes(attendu), R(c).slice(0, 220));
  vrai(`« ${cle} » → aucune section de plus`,
    SECTIONS(c).length === SECTIONS(nu).length);
}

// Les deux contraintes d'accès vont bien dans les CONDITIONS D'ACCÈS, pas
// dans les prestations ni dans les observations.
const acces = genererContenuDevis(net({
  particularites: ["part_sans_ascenseur", "part_acces_etroit"],
}));
vrai("sans ascenseur → condition d'accès",
  T(acces).includes("conditions d'accès relevées") && T(acces).includes("sans ascenseur"));
vrai("accès étroit → condition d'accès", T(acces).includes("cage d'escalier étroits"));

// L'amiante est le cas le plus sérieux : la réserve doit être explicite sur
// ce qui n'est PAS fait.
const amiante = genererContenuDevis(net({ particularites: ["part_amiante_suspecte"] }));
vrai("amiante → rien n'est percé, gratté ni déposé",
  R(amiante).includes("percé, gratté ni déposé"));
vrai("amiante → le traitement est renvoyé à une entreprise certifiée",
  R(amiante).includes("entreprise certifiée"));

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
