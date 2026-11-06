// MENTION DES PRODUITS D'ENTRETIEN — correction C1 du 2026-11-06.
//
// ── LE DÉFAUT CORRIGÉ ────────────────────────────────────────────────
//
// `analyserNettoyage()` posait `mentionProduits: true` EN DUR. La phrase
// « Intervention réalisée avec des produits de nettoyage 100 % français et
// écoresponsables » partait donc sur les devis des SEPT sociétés du CRM, dans
// les CINQ pays, sans qu'aucune règle métier ne l'autorise et sans que
// personne puisse la retirer.
//
// C'est une affirmation sur l'origine et sur le caractère environnemental d'un
// produit. Elle engage la société qui l'écrit, devis après devis.
//
// ── CE QUE CES CONTRÔLES FIGENT ──────────────────────────────────────
//
// 1. Aucune mention par défaut — le silence, pas une affirmation.
// 2. La mention suit la SOCIÉTÉ, et une société inconnue n'en a pas.
// 3. Un réglage malformé ne fait jamais réapparaître une affirmation.
// 4. La réserve des dégradations préexistantes, qui était accrochée à cette
//    mention, ne disparaît PAS avec elle — c'était le piège de la correction.
//
// PORTÉE : logique PURE. Aucun réseau, aucune base, aucun secret.

import {
  LONGUEUR_MAX_MENTION,
  SUGGESTION_HISTORIQUE,
  controlerMention,
  lireMentions,
  resoudreMentionProduits,
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

const OPTIMIVV = "7f3c1e00-0000-4000-8000-000000000001";
const AUTRE = "7f3c1e00-0000-4000-8000-000000000002";

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
  !/produits de nettoyage/i.test(sansMention?.detail ?? ""), sansMention?.detail?.slice(-200));
vrai("ni « 100 % français »", !/100\s*%\s*fran[çc]ais/i.test(sansMention?.detail ?? ""));
vrai("ni « écoresponsable »", !/[ée]coresponsable/i.test(sansMention?.detail ?? ""));

const vide = genererContenuDevis(nettoyage("   "));
vrai("un texte fait d'espaces ne produit rien non plus",
  !/produits de nettoyage/i.test(vide?.detail ?? ""));

// ══════════════════════════════════════════════════════════════════════
console.log("\n2. La mention déclarée est portée TELLE QUELLE");
// ══════════════════════════════════════════════════════════════════════

const declaree = genererContenuDevis(nettoyage(SUGGESTION_HISTORIQUE));
vrai("la phrase déclarée figure au descriptif",
  (declaree?.detail ?? "").includes(SUGGESTION_HISTORIQUE));
const perso = "Produits conformes aux normes suisses d'hygiène en vigueur.";
vrai("un texte propre à une société est porté à l'identique",
  (genererContenuDevis(nettoyage(perso))?.detail ?? "").includes(perso));
vrai("et le texte historique n'y est pas ajouté par-dessus",
  !(genererContenuDevis(nettoyage(perso))?.detail ?? "").includes("100 % français"));

// ══════════════════════════════════════════════════════════════════════
console.log("\n3. LE PIÈGE : la réserve des supports ne disparaît PAS avec la mention");
// ══════════════════════════════════════════════════════════════════════
//
// `RESERVE_SUPPORTS` était conditionnée par `a.niveau >= 2 && a.mentionProduits`.
// Comme la mention valait `true` pour toute la famille nettoyage, la condition
// signifiait « nettoyage au niveau 2 ou plus ». Garder ce test aurait fait
// disparaître une clause qui PROTÈGE l'entreprise de tous les devis dont la
// société n'a pas déclaré de mention. Le lien est rétabli sur la famille.

const RESERVE_SUPPORTS = "dégradations préexistantes";
vrai("sans mention, la réserve des dégradations est TOUJOURS là",
  (sansMention?.reserves ?? "").includes(RESERVE_SUPPORTS), sansMention?.reserves?.slice(0, 200));
vrai("avec mention, elle y est aussi",
  (declaree?.reserves ?? "").includes(RESERVE_SUPPORTS));
// Et elle reste bien conditionnée au niveau : un nettoyage courant n'y a pas droit.
const courant = genererContenuDevis({
  sector: "nettoyage", surfaceM2: 40, etatSalete: "leger",
  details: { typeNettoyage: "classique", typeBienNet: "studio" },
  contexteIntervention: null,
});
vrai("un nettoyage courant (niveau 1) ne la porte pas",
  !(courant?.reserves ?? "").includes(RESERVE_SUPPORTS));

// ══════════════════════════════════════════════════════════════════════
console.log("\n4. Les activités hors nettoyage n'ont jamais de mention");
// ══════════════════════════════════════════════════════════════════════

for (const sector of ["debarras", "demenagement", "transport"]) {
  const c = genererContenuDevis({
    sector, surfaceM2: null, etatSalete: null,
    details: { volume: "20", villeDepart: "Paris", villeArrivee: "Lyon" },
    contexteIntervention: null,
    // Même déclarée, elle ne s'applique pas : ce n'est pas du nettoyage.
    mentionProduits: SUGGESTION_HISTORIQUE,
  });
  vrai(`« ${sector} » : aucune mention de produits`,
    !/produits de nettoyage/i.test(c?.detail ?? ""));
}

// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Résolution par société");
// ══════════════════════════════════════════════════════════════════════

const carte = { [OPTIMIVV]: SUGGESTION_HISTORIQUE };
eq("la société déclarée obtient son texte",
  resoudreMentionProduits(OPTIMIVV, carte), SUGGESTION_HISTORIQUE);
eq("une société absente de la carte n'a RIEN",
  resoudreMentionProduits(AUTRE, carte), null);
eq("aucune société → rien", resoudreMentionProduits(null, carte), null);
eq("un texte vide en carte vaut absence",
  resoudreMentionProduits(OPTIMIVV, { [OPTIMIVV]: "   " }), null);

// ══════════════════════════════════════════════════════════════════════
console.log("\n6. Un réglage malformé ne réveille jamais une affirmation");
// ══════════════════════════════════════════════════════════════════════
//
// `app_settings.value` est du jsonb sans schéma : la ligne peut avoir été
// écrite à la main. Tout ce qui n'est pas exploitable est ignoré — mais
// JAMAIS remplacé par un défaut qui affirmerait quelque chose.

eq("null → carte vide", lireMentions(null), {});
eq("chaîne → carte vide", lireMentions("100 % français"), {});
eq("tableau → carte vide", lireMentions([SUGGESTION_HISTORIQUE]), {});
eq("valeurs non textuelles ignorées",
  lireMentions({ [OPTIMIVV]: 42, [AUTRE]: true }), {});
eq("entrées valides conservées, invalides écartées",
  lireMentions({ [OPTIMIVV]: " Texte assumé. ", [AUTRE]: null }),
  { [OPTIMIVV]: "Texte assumé." });
vrai("un texte trop long est tronqué, pas rejeté silencieusement",
  (lireMentions({ [OPTIMIVV]: "x".repeat(600) })[OPTIMIVV] ?? "").length === LONGUEUR_MAX_MENTION);

// ══════════════════════════════════════════════════════════════════════
console.log("\n7. Contrôle à la saisie : refuser, et AVERTIR sans bloquer");
// ══════════════════════════════════════════════════════════════════════

vrai("texte vide refusé", !controlerMention("").ok);
vrai("espaces refusés", !controlerMention("    ").ok);
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
  [SUGGESTION_HISTORIQUE, "origine française"],
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

console.log(ko === 0 ? "\n  TOUT PASSE" : `\n  ${ko} ECHEC(S)`);
process.exit(ko === 0 ? 0 : 1);
