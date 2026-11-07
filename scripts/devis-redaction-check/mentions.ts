// MENTION DES PRODUITS D'ENTRETIEN — correction C1, révisée le 2026-11-06.
//
// ── LE DÉFAUT CORRIGÉ ────────────────────────────────────────────────
//
// `analyserNettoyage()` posait `mentionProduits: true` EN DUR. La phrase
// « produits de nettoyage 100 % français et écoresponsables » partait donc
// sur les devis des SEPT sociétés du CRM, dans les CINQ pays, sans qu'aucune
// règle métier ne l'autorise et sans que personne puisse la retirer.
//
// C'est une affirmation sur l'origine et sur le caractère environnemental d'un
// produit. Elle engage la société qui l'écrit, devis après devis.
//
// ── POURQUOI UNE DEUXIÈME VERSION DE CES CONTRÔLES ───────────────────
//
// La première correction attachait la mention à la SOCIÉTÉ, saisie à la main.
// Elle réglait l'urgence mais laissait écrire « 100 % français » sur une
// société suisse. Le client a arbitré le 2026-11-06 : c'est le PAYS DE LA
// SOCIÉTÉ ÉMETTRICE qui décide, par une table figée dans le code.
//
// ── CE QUE CES CONTRÔLES FIGENT ──────────────────────────────────────
//
// 1. Aucune mention par défaut — le silence, pas une affirmation.
// 2. Le pays décide, automatiquement : personne ne choisit à la main.
// 3. La mention française n'atteint JAMAIS une société étrangère.
// 4. Un pays absent, inconnu ou non activé ne produit rien, et DIT pourquoi.
// 5. Aucun mélange de pays, aucune duplication dans un même devis.
// 6. Un réglage malformé ne fait jamais réapparaître une affirmation.
// 7. La réserve des dégradations préexistantes, qui était accrochée à cette
//    mention, ne disparaît PAS avec elle — c'était le piège de la correction.
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret.

import {
  AVERTISSEMENT_PAYS,
  COUNTRIES,
  LONGUEUR_MAX_MENTION,
  MENTION_PAR_PAYS,
  controlerMention,
  formulationEffective,
  lireReglages,
  paysReconnu,
  resoudreMention,
  type Country,
  type ReglagesMentions,
} from "@/lib/generation/mentions-produits";
import { genererContenuDevis, type Decouverte } from "@/lib/generation/devis-contenu";

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

/** Tous les pays activés — l'état « l'entreprise assume partout ». */
const TOUS: ReglagesMentions = Object.fromEntries(
  COUNTRIES.map((p) => [p, { active: true, texte: "" }]),
);
/** Aucun pays activé — l'état par défaut d'une installation neuve. */
const AUCUN: ReglagesMentions = {};

/** Découverte de nettoyage approfondi, le cas où la mention s'imprimait. */
const nettoyage = (mention?: string | null): Decouverte => ({
  sector: "nettoyage",
  surfaceM2: 85,
  etatSalete: "important",
  details: { typeNettoyage: "approfondi", typeBienNet: "appartement", nbSdb: 1 },
  contexteIntervention: null,
  mentionProduits: mention,
});

// ══════════════════════════════════════════════════════════════════════
console.log("\n1. Aucune mention par défaut — le silence, pas une affirmation");
// ══════════════════════════════════════════════════════════════════════

const sansMention = genererContenuDevis(nettoyage());
vrai("devis produit", sansMention !== null);
vrai("AUCUNE phrase sur les produits",
  !/produits d['’ ]?entretien|produits de nettoyage/i.test(sansMention?.detail ?? ""),
  sansMention?.detail?.slice(-200));
vrai("ni « 100 % français »", !/100\s*%\s*fran[çc]ais/i.test(sansMention?.detail ?? ""));
vrai("ni « écoresponsable »", !/[ée]coresponsable/i.test(sansMention?.detail ?? ""));
vrai("ni « écologique »", !/[ée]cologique/i.test(sansMention?.detail ?? ""));

const vide = genererContenuDevis(nettoyage("   "));
vrai("un texte fait d'espaces ne produit rien non plus",
  !/produits d['’ ]?entretien/i.test(vide?.detail ?? ""));

// ══════════════════════════════════════════════════════════════════════
console.log("\n2. LE PAYS DÉCIDE — automatiquement, et la table est figée");
// ══════════════════════════════════════════════════════════════════════
//
// Le client a arrêté la correspondance. Elle est vérifiée AU MOT, parce que
// ce sont des allégations réglementaires : une reformulation silencieuse du
// code changerait ce que la société affirme devant un client.

eq("France → produits 100 % français et 100 % écologiques",
  resoudreMention("FR", TOUS),
  { mention: "Utilisation de produits 100 % français et 100 % écologiques.", pays: "FR" });

for (const pays of ["CH", "BE", "LU"] as Country[]) {
  eq(`${pays} → conformité aux normes européennes`,
    resoudreMention(pays, TOUS),
    {
      mention: "Utilisation de produits 100 % conformes aux normes européennes.",
      pays,
    });
}

eq("Canada → exigences réglementaires canadiennes",
  resoudreMention("CA", TOUS),
  {
    mention: "Utilisation de produits d'entretien conformes aux exigences réglementaires canadiennes applicables.",
    pays: "CA",
  });

vrai("les cinq pays du CRM ont tous une formulation",
  COUNTRIES.every((p) => (MENTION_PAR_PAYS[p] ?? "").trim().length > 20),
  JSON.stringify(COUNTRIES.filter((p) => !MENTION_PAR_PAYS[p])));

// La casse et les espaces viennent de la base : ils ne doivent pas décider.
eq("« fr » en minuscules est reconnu", resoudreMention("fr", TOUS).pays, "FR");
eq("« ch » entouré d'espaces aussi", resoudreMention("  ch  ", TOUS).pays, "CH");

// ══════════════════════════════════════════════════════════════════════
console.log("\n3. LA MENTION FRANÇAISE N'ATTEINT JAMAIS UNE SOCIÉTÉ ÉTRANGÈRE");
// ══════════════════════════════════════════════════════════════════════
//
// C'est l'interdiction explicite du client, et c'était le trou de la
// première version : rien n'empêchait de saisir la phrase française sur une
// société suisse. Désormais le texte ne vient plus d'une saisie par société.

const FRANCAISE = /100\s*%\s*fran[çc]ais|[ée]cologiques?\b/i;
for (const pays of ["CH", "BE", "LU", "CA"] as Country[]) {
  const r = resoudreMention(pays, TOUS);
  vrai(`${pays} : aucune allégation d'origine ou d'écologie française`,
    !FRANCAISE.test(r.mention ?? ""), r.mention ?? "(aucune)");
}
vrai("le Canada n'invoque pas non plus les normes européennes",
  !/europ[ée]enne/i.test(resoudreMention("CA", TOUS).mention ?? ""));
vrai("la France n'invoque pas les normes européennes",
  !/europ[ée]enne/i.test(resoudreMention("FR", TOUS).mention ?? ""));

// ══════════════════════════════════════════════════════════════════════
console.log("\n4. Pays absent, inconnu, non activé : RIEN, et on dit pourquoi");
// ══════════════════════════════════════════════════════════════════════
//
// « En cas d'absence ou d'incohérence du pays, signaler le problème et ne pas
// inventer de mention. » Un `null` muet ferait croire à un oubli du moteur :
// le motif remonte donc jusqu'à l'appelant.

eq("pays nul", resoudreMention(null, TOUS), { mention: null, motif: "pays_inconnu", pays: null });
eq("pays vide", resoudreMention("", TOUS), { mention: null, motif: "pays_inconnu", pays: null });
eq("pays hors référentiel (DE)",
  resoudreMention("DE", TOUS), { mention: null, motif: "pays_inconnu", pays: null });
eq("libellé au lieu du code (« France »)",
  resoudreMention("France", TOUS), { mention: null, motif: "pays_inconnu", pays: null });
eq("pays reconnu mais non activé",
  resoudreMention("FR", AUCUN), { mention: null, motif: "pays_non_active", pays: "FR" });
eq("activation explicitement retirée",
  resoudreMention("FR", { FR: { active: false, texte: "Texte resté en base." } }),
  { mention: null, motif: "pays_non_active", pays: "FR" });
eq("intervention sans produits d'entretien",
  resoudreMention("FR", TOUS, false), { mention: null, motif: "hors_prestation", pays: "FR" });

vrai("un pays inconnu ne retombe JAMAIS sur la formulation française",
  resoudreMention("DE", TOUS).mention === null
  && resoudreMention("XX", TOUS).mention === null
  && resoudreMention(undefined, TOUS).mention === null);

// L'activation d'un pays n'active pas les autres : pas d'effet de bord.
const seulementFR: ReglagesMentions = { FR: { active: true, texte: "" } };
eq("activer la France n'active pas la Suisse",
  resoudreMention("CH", seulementFR), { mention: null, motif: "pays_non_active", pays: "CH" });
eq("… ni le Canada",
  resoudreMention("CA", seulementFR), { mention: null, motif: "pays_non_active", pays: "CA" });

// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Aucun mélange de pays, aucune duplication dans le devis");
// ══════════════════════════════════════════════════════════════════════

for (const pays of COUNTRIES) {
  const r = resoudreMention(pays, TOUS);
  const c = genererContenuDevis(nettoyage(r.mention));
  const detail = c?.detail ?? "";
  const phrase = r.mention ?? "";

  // Une seule occurrence : le moteur ajoute la mention en fin de descriptif,
  // et rien d'autre ne doit la réécrire ailleurs.
  const occurrences = phrase ? detail.split(phrase).length - 1 : 0;
  eq(`${pays} : la mention figure exactement une fois`, occurrences, 1);

  // Et les formulations des AUTRES pays n'y sont pas.
  const autres = COUNTRIES.filter((p) => MENTION_PAR_PAYS[p] !== phrase);
  vrai(`${pays} : aucune formulation d'un autre pays`,
    autres.every((p) => !detail.includes(MENTION_PAR_PAYS[p])),
    autres.filter((p) => detail.includes(MENTION_PAR_PAYS[p])).join(", "));
}

// Le texte est porté TEL QUEL : le moteur ne reformule pas une allégation.
const perso = "Produits conformes aux normes suisses d'hygiène en vigueur.";
vrai("une formulation adaptée est portée à l'identique",
  (genererContenuDevis(nettoyage(perso))?.detail ?? "").includes(perso));
vrai("et la formulation de référence n'est pas ajoutée par-dessus",
  !(genererContenuDevis(nettoyage(perso))?.detail ?? "").includes("100 % français"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n6. LE PIÈGE : la réserve des supports ne disparaît PAS avec la mention");
// ══════════════════════════════════════════════════════════════════════
//
// `RESERVE_SUPPORTS` était conditionnée par `a.niveau >= 2 && a.mentionProduits`.
// Comme la mention valait `true` pour toute la famille nettoyage, la condition
// signifiait « nettoyage au niveau 2 ou plus ». Garder ce test aurait fait
// disparaître une clause qui PROTÈGE l'entreprise de tous les devis dont le
// pays n'est pas activé. Le lien est rétabli sur la famille.

const RESERVE_SUPPORTS = "dégradations préexistantes";
const avecMention = genererContenuDevis(nettoyage(MENTION_PAR_PAYS.FR));
vrai("sans mention, la réserve des dégradations est TOUJOURS là",
  (sansMention?.reserves ?? "").includes(RESERVE_SUPPORTS), sansMention?.reserves?.slice(0, 200));
vrai("avec mention, elle y est aussi",
  (avecMention?.reserves ?? "").includes(RESERVE_SUPPORTS));
// Les réserves contractuelles restent indépendantes de la mention : le client
// l'a demandé — « conserver les réserves contractuelles indépendamment ».
eq("les réserves sont identiques avec et sans mention",
  sansMention?.reserves, avecMention?.reserves);
// Et elle reste bien conditionnée au niveau : un nettoyage courant n'y a pas droit.
const courant = genererContenuDevis({
  sector: "nettoyage", surfaceM2: 40, etatSalete: "leger",
  details: { typeNettoyage: "classique", typeBienNet: "studio" },
  contexteIntervention: null,
});
vrai("un nettoyage courant (niveau 1) ne la porte pas",
  !(courant?.reserves ?? "").includes(RESERVE_SUPPORTS));

// ══════════════════════════════════════════════════════════════════════
console.log("\n7. Les activités hors nettoyage n'ont jamais de mention");
// ══════════════════════════════════════════════════════════════════════

for (const sector of ["debarras", "demenagement", "transport"]) {
  const c = genererContenuDevis({
    sector, surfaceM2: null, etatSalete: null,
    details: { volume: "20", villeDepart: "Paris", villeArrivee: "Lyon" },
    contexteIntervention: null,
    // Même résolue pour la France, elle ne s'applique pas : ce n'est pas du
    // nettoyage, et aucun produit d'entretien n'est employé.
    mentionProduits: MENTION_PAR_PAYS.FR,
  });
  vrai(`« ${sector} » : aucune mention de produits`,
    !/produits d['’ ]?entretien/i.test(c?.detail ?? ""));
}

// ══════════════════════════════════════════════════════════════════════
console.log("\n8. Un réglage malformé ne réveille jamais une affirmation");
// ══════════════════════════════════════════════════════════════════════
//
// `app_settings.value` est du jsonb sans schéma : la ligne peut avoir été
// écrite à la main, ou rester au format de la première version (société →
// texte). Tout ce qui n'est pas exploitable est ignoré — mais JAMAIS remplacé
// par un défaut qui affirmerait quelque chose.

eq("null → aucun réglage", lireReglages(null), {});
eq("chaîne → aucun réglage", lireReglages("100 % français"), {});
eq("tableau → aucun réglage", lireReglages(["FR"]), {});
eq("valeurs non structurées ignorées", lireReglages({ FR: 42, CH: true, CA: "oui" }), {});
eq("ancien format (société → texte) ignoré",
  lireReglages({ "7f3c1e00-0000-4000-8000-000000000001": "Produits 100 % français." }), {});
eq("pays hors référentiel écarté",
  lireReglages({ DE: { active: true, texte: "Deutsch." }, FR: { active: true, texte: "" } }),
  { FR: { active: true, texte: "" } });
eq("`active` autre que `true` vaut faux",
  lireReglages({ FR: { active: "oui", texte: "T." } }), { FR: { active: false, texte: "T." } });
eq("texte non textuel vaut vide, pas une invention",
  lireReglages({ FR: { active: true, texte: 42 } }), { FR: { active: true, texte: "" } });
vrai("un texte trop long est tronqué, pas rejeté silencieusement",
  (lireReglages({ FR: { active: true, texte: "x".repeat(600) } }).FR?.texte ?? "").length
  === LONGUEUR_MAX_MENTION);

// Un réglage illisible laisse les devis SANS mention — la conséquence qui compte.
eq("réglage illisible → aucune mention en France",
  resoudreMention("FR", lireReglages("n'importe quoi")),
  { mention: null, motif: "pays_non_active", pays: "FR" });

// ══════════════════════════════════════════════════════════════════════
console.log("\n9. Formulation adaptée : le Super Admin peut, le commercial non");
// ══════════════════════════════════════════════════════════════════════
//
// La sélection est automatique, l'activation est une décision administrative.
// Le texte vide signifie « la formulation de référence » : le Super Admin n'a
// pas à recopier une phrase validée pour l'activer.

eq("texte vide → formulation de référence",
  resoudreMention("FR", { FR: { active: true, texte: "" } }).mention, MENTION_PAR_PAYS.FR);
eq("texte adapté → formulation adaptée",
  resoudreMention("CH", { CH: { active: true, texte: "Produits homologués OChim." } }).mention,
  "Produits homologués OChim.");
eq("formulationEffective sans réglage → référence",
  formulationEffective("CA", {}), MENTION_PAR_PAYS.CA);
eq("formulationEffective avec adaptation → adaptation",
  formulationEffective("CA", { CA: { active: true, texte: "Conforme SIMDUT." } }),
  "Conforme SIMDUT.");

// La découverte ne porte QUE le texte résolu : aucun champ de découverte, et
// donc aucune saisie commerciale, ne peut changer le pays retenu.
vrai("la résolution n'accepte aucune entrée du commercial",
  resoudreMention("FR", TOUS).mention === MENTION_PAR_PAYS.FR
  && resoudreMention("FR", TOUS, true).mention === MENTION_PAR_PAYS.FR);

// Les pays sensibles portent un avertissement destiné au Super Admin.
for (const pays of ["FR", "CH", "CA"] as Country[]) {
  vrai(`${pays} : un avertissement est présenté avant activation`,
    (AVERTISSEMENT_PAYS[pays] ?? "").length > 60);
}
vrai("l'avertissement suisse rappelle que l'Europe ne vaut pas la Suisse",
  /suisse/i.test(AVERTISSEMENT_PAYS.CH ?? "") && /ne vaut pas|ne dispense/i.test(AVERTISSEMENT_PAYS.CH ?? ""));

// ══════════════════════════════════════════════════════════════════════
console.log("\n10. Contrôle à la saisie : refuser, et AVERTIR sans bloquer");
// ══════════════════════════════════════════════════════════════════════

vrai("texte vide refusé", !controlerMention("").ok);
vrai("espaces refusés", !controlerMention("    ").ok);
vrai("non-chaîne refusée", !controlerMention(42).ok);
vrai("au-delà de la longueur maximale, refusé", !controlerMention("x".repeat(401)).ok);
vrai("une mention neutre passe sans avertissement",
  controlerMention("Produits adaptés aux surfaces traitées.").ok === true
  && (controlerMention("Produits adaptés aux surfaces traitées.") as { avertissement: string | null })
    .avertissement === null);

// Les allégations passent — c'est à la société de les assumer — mais elles
// sont signalées. C'est exactement la phrase qui a causé le problème.
// Le second membre documente ce qui est signalé ; l'assertion ne vérifie que
// la PRÉSENCE d'un avertissement, pas son libellé exact — un libellé figé se
// casserait à chaque reformulation sans rien prouver de plus.
for (const [texte] of [
  [MENTION_PAR_PAYS.FR, "origine française"],
  [MENTION_PAR_PAYS.CH, "conformité réglementaire"],
  [MENTION_PAR_PAYS.CA, "conformité réglementaire"],
  ["Produits écologiques et biodégradables.", "écologique"],
  ["Produits certifiés Ecolabel.", "certification"],
  ["Produits naturels.", "naturel"],
  ["Nettoyants fabriqués en France.", "fabrication française"],
] as [string, string][]) {
  const c = controlerMention(texte);
  vrai(`« ${texte.slice(0, 44)}… » est acceptée MAIS signalée`,
    c.ok === true && Boolean((c as { avertissement: string | null }).avertissement),
    JSON.stringify(c).slice(0, 180));
}

// Les cinq formulations de référence passent le contrôle : sans cela, le
// Super Admin ne pourrait activer aucun pays sans réécrire la phrase.
for (const pays of COUNTRIES) {
  vrai(`la formulation de référence ${pays} est acceptable`,
    controlerMention(MENTION_PAR_PAYS[pays]).ok === true);
}

// ══════════════════════════════════════════════════════════════════════
console.log("\n11. paysReconnu : la frontière du référentiel");
// ══════════════════════════════════════════════════════════════════════

eq("FR", paysReconnu("FR"), "FR");
eq("minuscules", paysReconnu("be"), "BE");
eq("espaces", paysReconnu(" LU "), "LU");
eq("inconnu", paysReconnu("DE"), null);
eq("vide", paysReconnu(""), null);
eq("nul", paysReconnu(null), null);
eq("indéfini", paysReconnu(undefined), null);
eq("code à trois lettres", paysReconnu("FRA"), null);

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
