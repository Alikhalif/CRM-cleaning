// Reformulation d'un texte de devis — PUR, aucune I/O, AUCUNE IA.
//
// ── CE QUE CE MODULE EST, ET CE QU'IL N'EST PAS ─────────────────────
//
// C'est un correcteur DÉTERMINISTE : une liste de règles nommées, appliquées
// dans un ordre fixe, dont chaque effet est traçable. Deux exécutions sur le
// même texte donnent le même résultat, et le rapport dit quelle règle a
// produit quelle substitution.
//
// Ce n'est PAS un modèle de langue. Le projet n'a aucune capacité d'IA, et le
// client ne l'a pas autorisée. Appeler « reformulation intelligente » une
// expression régulière serait un mensonge commode ; ce fichier s'en abstient.
//
// ── LA LIGNE DE PARTAGE : CORRIGER OU SIGNALER ──────────────────────
//
// Un devis est un document contractuel. Deux familles de défauts s'y
// rencontrent, et elles ne se traitent pas de la même façon :
//
//   • LE MÉCANIQUE se corrige. Une apostrophe courbe, un « 100% » sans
//     espace, un mot doublé, une majuscule absente : aucune lecture du sens
//     n'est nécessaire, donc aucun risque de contresens.
//
//   • LE CONTRACTUEL se SIGNALE, sans être réécrit. « Impeccable »,
//     « garanti », « comme neuf » engagent l'entreprise au-delà de ce que le
//     référentiel promet. Les remplacer en silence déciderait à la place du
//     commercial sur le fond du devis — et masquerait le problème au lieu de
//     le résoudre. Ils remontent donc comme points à revoir.
//
// ── CE QUE CE MODULE NE SAIT PAS FAIRE, ET L'ASSUME ─────────────────
//
// Il ne corrige NI les accords NI les conjugaisons. « des sanitaire », « les
// vitres est » : il faudrait une analyse grammaticale pour trancher, et une
// heuristique se tromperait — dans un document qui engage l'entreprise, une
// correction fausse est pire qu'une faute laissée visible. Ne sont traités que
// les défauts décidables sans ambiguïté : mot doublé, ponctuation doublée,
// espaces, unités, ordinaux, vocabulaire du référentiel.
//
// ── POURQUOI TOUT RESTE EN CARACTÈRES SIMPLES ───────────────────────
//
// `lib/devis/layout.ts` remplace, à l'impression, les apostrophes courbes par
// des droites et les espaces insécables par des espaces ordinaires : Poppins
// ne porte pas ces glyphes. Introduire ici une fine insécable avant un
// deux-points produirait un texte différent à l'écran et au PDF pour un
// résultat imprimé identique. Le référentiel de rédaction suit déjà cette
// règle : sur ses 123 opérations, zéro apostrophe courbe et zéro insécable.

/** Une substitution réellement appliquée. */
export type Correction = {
  /** Nom de la règle, tel qu'il s'affiche au commercial. */
  regle: string;
  avant: string;
  apres: string;
};

/** Un point à revoir, laissé tel quel dans le texte. */
export type ARevoir = {
  regle: string;
  extrait: string;
  pourquoi: string;
};

export type Reformulation = {
  texte: string;
  corrections: Correction[];
  aRevoir: ARevoir[];
  /** Règles écartées parce qu'elles auraient renforcé un engagement. */
  bloquees: Correction[];
};

// ══════════════════════════════════════════════════════════════════════
//  Le garde-fou : une reformulation ne promet JAMAIS davantage
// ══════════════════════════════════════════════════════════════════════

/**
 * Termes qui ENGAGENT l'entreprise sur un résultat.
 *
 * Aucune règle ne doit en introduire un. Le garde-fou compte les occurrences
 * avant et après : s'il y en a plus après, la règle est écartée et la
 * substitution remonte dans `bloquees`. Par construction la table de règles
 * n'en introduit aucun — mais une règle ajoutée demain le pourrait, et un
 * garde-fou qui ne sert jamais est un garde-fou qui marche.
 */
const ENGAGEANTS: RegExp[] = [
  /\bgarantis?\b/gi,
  /\bgarantie\b/gi,
  /\bimpeccables?\b/gi,
  /\bparfaitement\b/gi,
  /\bcomme neufs?\b/gi,
  /\bà neuf\b/gi,
  /\btotalement\b/gi,
  /\bintégralement\b/gi,
  /\bentièrement\b/gi,
  // Présent dans le GARDE-FOU, absent des signalements plus bas : la mention
  // des produits — validée par l'administrateur, pièces à l'appui — porte un
  // « 100 % » par construction. Le signaler sur chaque devis français serait
  // du bruit que le commercial ne peut pas traiter : cette discussion a son
  // propre écran, avec son propre avertissement.
  /\b100\s*%/gi,
  /\bsans aucune?\b/gi,
  /\baucune trace\b/gi,
  /\bnickel\b/gi,
  /\béradication\b/gi,
  /\bdésinfection\b/gi,
  /\bstérilisation\b/gi,
];

function compterEngagements(t: string): number {
  let n = 0;
  for (const re of ENGAGEANTS) n += (t.match(re) ?? []).length;
  return n;
}

/**
 * LA DÉCISION DU GARDE-FOU, isolée et exportée.
 *
 * `reformuler` ne décide pas lui-même : il passe par ici, pour chaque règle.
 * C'est volontaire. Aucune règle actuelle n'introduit de promesse, donc le
 * garde-fou ne se déclenche jamais en exploitation — et un garde-fou dormant
 * est un garde-fou qu'on ne sait pas tester de bout en bout. Exposé ici, il se
 * contrôle directement, et une mutation qui le neutralise se voit.
 *
 * Retourne `false` dès que la version proposée affirme PLUS que la version
 * courante. Pas « différemment » : plus. Une règle qui retire une promesse
 * est acceptée.
 */
export function retenirSousGardeFou(avant: string, apres: string): boolean {
  return compterEngagements(apres) <= compterEngagements(avant);
}

// ══════════════════════════════════════════════════════════════════════
//  Les règles mécaniques — l'ordre compte
// ══════════════════════════════════════════════════════════════════════

type Regle = { nom: string; appliquer: (t: string) => string };

/**
 * Typographie et registre, dans l'ordre d'application.
 *
 * L'ordre n'est pas décoratif. Les caractères sont unifiés AVANT que les
 * règles lexicales ne cherchent leurs motifs, sinon « produits d'entretien »
 * écrit avec une apostrophe courbe échapperait à la table du vocabulaire. Et
 * la ponctuation doublée passe avant la ponctuation collée, pour la raison
 * donnée sur la règle elle-même.
 */
const REGLES: Regle[] = [
  {
    nom: "apostrophes et espaces unifiés",
    appliquer: (t) => t
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[    ]/g, " ")
      .replace(/[–—]/g, "-"),
  },
  {
    nom: "espaces en trop",
    // L'indentation en début de ligne est préservée : une puce peut être
    // indentée dans le textarea, ce n'est pas une faute.
    appliquer: (t) => t.replace(/([^\s\n]) {2,}/g, "$1 ").replace(/[ \t]+$/gm, ""),
  },
  {
    // ⚠️ AVANT « ponctuation collée », et ce n'est pas indifférent : l'ordre
    // inverse insérait d'abord une espace entre les deux « ! » de « !! », ce
    // qui cassait le motif de dédoublement et laissait « ! ! ». Un correcteur
    // qui fabrique la faute qu'il doit retirer.
    nom: "ponctuation doublée",
    appliquer: (t) => t
      .replace(/\betc\s*\.{2,}/gi, "etc.")
      .replace(/([!?])[ \t]*(?:\1[ \t]*)+/g, "$1")
      .replace(/(?<![.\s])\.{2}(?!\.)/g, "."),
  },
  {
    nom: "ponctuation collée",
    appliquer: (t) => t
      // Pas d'espace AVANT une virgule ou un point.
      .replace(/[ \t]+([,.])/g, "$1")
      // Mais un espace APRÈS, quand une lettre ou un chiffre suit.
      .replace(/([,;:])(?=[A-Za-zÀ-ÿ0-9])/g, "$1 ")
      // Espace avant deux-points, point-virgule, exclamation, interrogation :
      // usage français. Un espace ordinaire, pas une fine insécable, pour la
      // raison expliquée en tête de fichier.
      .replace(/([^\s])([;:!?])/g, "$1 $2")
      .replace(/[ \t]+$/gm, ""),
  },
  {
    nom: "mot doublé",
    // Deux fois le même mot à la suite. Le seuil est à DEUX lettres, et pas
    // trois : « du du sol », « le le mur », « de de la cuisine » sont les
    // doublons qu'on produit vraiment en tapant vite, et ils échappaient tous
    // à un seuil de trois.
    //
    // Deux exclusions, parce qu'un pronom réfléchi répète légitimement son
    // sujet : « nous nous chargeons », « vous vous déplacez ».
    appliquer: (t) => t.replace(
      /\b([A-Za-zÀ-ÿ]{2,})[ \t]+\1\b/gi,
      (m, mot: string) => (/^(?:nous|vous)$/i.test(mot) ? m : mot),
    ),
  },
  {
    nom: "unités et pourcentages",
    appliquer: (t) => t
      .replace(/(\d)[ \t]*%/g, "$1 %")
      .replace(/(\d)[ \t]*m2\b/gi, "$1 m²")
      .replace(/(\d)[ \t]*m3\b/gi, "$1 m³")
      .replace(/(\d)[ \t]*(m²|m³)/g, "$1 $2"),
  },
  {
    nom: "ordinaux",
    // « 2ème », « 2eme » → « 2e », la forme employée partout dans le dépôt.
    //
    // ⚠️ « 1er » N'EST PAS « 1re » : l'un est masculin (premier étage),
    // l'autre féminin (première ligne). Un motif qui lisait « er » comme
    // « ere » transformait « 1er étage » en « 1re étage ». Les deux formes
    // sont donc traitées séparément, et « 1er » n'est que resserré.
    appliquer: (t) => t
      .replace(/\b(\d+)[ \t]*(?:ème|eme)\b/gi, "$1e")
      .replace(/\b1[ \t]*(?:ère|ere)\b/gi, "1re")
      .replace(/\b1[ \t]+er\b/g, "1er"),
  },
  {
    nom: "vocabulaire du référentiel",
    // Substitutions de MÊME portée : même sens, même nombre, même engagement.
    // Rien ici ne promet davantage — c'est ce que le garde-fou vérifie.
    //
    // ⚠️ « au niveau de » a été RETIRÉ de cette table. La première version
    // remplaçait « au niveau de la cuisine » par « sur cuisine » : elle
    // dégageait l'article et produisait du français faux. L'expression a trop
    // de lectures — spatiale, figurée, administrative — pour qu'une expression
    // régulière choisisse la bonne préposition. Elle est désormais signalée.
    appliquer: (t) => t
      .replace(/\bproduits de nettoyage\b/gi, "produits d'entretien")
      .replace(/\bproduit de nettoyage\b/gi, "produit d'entretien")
      .replace(/\bnettoyage à fond\b/gi, "nettoyage approfondi")
      .replace(/\bnettoyer à fond\b/gi, "nettoyer en profondeur")
      .replace(/\btrès sales\b/gi, "fortement encrassés")
      .replace(/\btrès sale\b/gi, "fortement encrassé")
      .replace(/\bafin de pouvoir\b/gi, "afin de")
      .replace(/\bdans le but de\b/gi, "afin de")
      .replace(/\bpas mal de\b/gi, "plusieurs")
      // ⚠️ Les trois sont insensibles à la casse. La première version
      // écrivait `/\bsdb\b/g` : « Sdb » en début de puce échappait
      // à la règle, « sdb » non. Une abréviation se tape dans les
      // deux casses et son développement est le même → la majuscule
      // initiale est ensuite remise par la règle des puces.
      .replace(/\bsdb\b/gi, "salle de bains")
      .replace(/\brdc\b/gi, "rez-de-chaussée")
      .replace(/\bwc\b/gi, "WC"),
  },
];

// ══════════════════════════════════════════════════════════════════════
//  Ce qui se signale sans se réécrire
// ══════════════════════════════════════════════════════════════════════

const A_SIGNALER: { regle: string; re: RegExp; pourquoi: string }[] = [
  {
    regle: "promesse de résultat",
    re: /\b(impeccables?|parfaitement|nickel|comme neufs?|à neuf|sans aucune? trace|aucune trace)\b/gi,
    pourquoi:
      "engage l'entreprise sur un résultat que le référentiel ne promet pas. "
      + "Un client peut l'opposer à la livraison.",
  },
  {
    regle: "garantie",
    re: /\bgarantis?e?s?\b/gi,
    pourquoi:
      "une garantie a une portée juridique propre. Si elle est voulue, elle "
      + "s'écrit dans les conditions, pas dans le descriptif d'une prestation.",
  },
  {
    regle: "totalité affirmée",
    re: /\b(totalement|intégralement|entièrement)\b/gi,
    pourquoi:
      "une totalité ne souffre aucune exception : une seule zone inaccessible "
      + "suffit à mettre l'entreprise en défaut.",
  },
  {
    regle: "délai ou durée",
    re: /\b(?:en|sous)[ \t]+\d+[ \t]*(?:heures?|jours?|h)\b|\ble jour même\b/gi,
    pourquoi:
      "un délai dans le descriptif devient contractuel. Les délais se "
      + "négocient et s'écrivent séparément.",
  },
  {
    regle: "prix dans le texte",
    // ⚠️ Pas de `\b` après l'alternative : « € » n'est pas un
    // caractère de mot, et en fin de chaêne il n'y a donc aucune
    // frontière à trouver. « 80 € » échappait au contrôle
    // → un prix dans le descriptif, et personne pour le dire. La
    // frontière est portée par les seules formes alphabétiques, qui en
    // ont besoin (« 3 journées » n'est pas « 3 EUR »).
    re: /\b\d+(?:[.,]\d+)?[ \t]*(?:€|euros?\b|EUR\b)/gi,
    pourquoi:
      "le descriptif ne porte aucun montant : le prix vient des lignes du "
      + "devis, et un chiffre répété dans le texte finit par les contredire.",
  },
  {
    // Signalé, et PAS corrigé automatiquement : voir la note sur la table du
    // vocabulaire. Une préposition se choisit sur le sens, pas sur un motif.
    regle: "tic de langage",
    re: /\bau niveau (?:de la|du|des|de l'|de)\b/gi,
    pourquoi:
      "alourdit la phrase sans rien préciser. Selon le sens voulu : « dans la "
      + "cuisine », « sur les plinthes », ou simplement le complément seul.",
  },
  {
    regle: "formulation à la première personne",
    re: /(?:^|\n)[ \t]*-?[ \t]*(?:on|je)[ \t]+[a-zà-ÿ]+/gi,
    pourquoi:
      "un devis s'écrit de façon impersonnelle. « On nettoie » devient "
      + "« Nettoyage de… » : c'est une prestation, pas un récit.",
  },
];

/** Points à revoir d'un texte, sans le modifier. */
export function pointsARevoir(texte: string): ARevoir[] {
  const t = texte ?? "";
  const out: ARevoir[] = [];
  for (const { regle, re, pourquoi } of A_SIGNALER) {
    const vus = new Set<string>();
    for (const m of t.matchAll(re)) {
      const extrait = m[0].trim().replace(/^-\s*/, "");
      const cle = extrait.toLowerCase();
      if (!extrait || vus.has(cle)) continue;
      vus.add(cle);
      out.push({ regle, extrait, pourquoi });
    }
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════
//  La reformulation
// ══════════════════════════════════════════════════════════════════════

/**
 * Majuscule initiale et point final des puces.
 *
 * Mesuré sur le référentiel de rédaction : 101 de ses opérations se terminent
 * par un point, les 22 autres sont des TITRES de famille, pas des puces. Le
 * point final est donc la convention des puces, et on l'applique.
 */
function normaliserLesPuces(texte: string): string {
  return texte
    .split("\n")
    .map((l) => {
      const m = /^([ \t]*-[ \t]+)(\S.*)$/.exec(l);
      if (!m) return l;
      let corps = m[2].trimEnd();
      corps = corps.charAt(0).toLocaleUpperCase("fr-FR") + corps.slice(1);
      // Aucun point ajouté après une ponctuation déjà finale, ni après un
      // deux-points qui annonce une énumération.
      if (/[\p{L}\p{N})²³%]$/u.test(corps)) corps += ".";
      return m[1] + corps;
    })
    .join("\n");
}

const TOUTES_LES_REGLES: Regle[] = [
  ...REGLES,
  { nom: "puces normalisées", appliquer: normaliserLesPuces },
];

/** Noms des règles, dans l'ordre — pour l'interface et les contrôles. */
export const NOMS_DE_REGLES: string[] = TOUTES_LES_REGLES.map((r) => r.nom);

/**
 * Reformule un texte de devis.
 *
 * Chaque règle est appliquée séparément et son effet est mesuré : une règle
 * qui ne change rien n'apparaît pas dans le rapport, et une règle qui
 * renforcerait un engagement est écartée. Le texte rendu est donc toujours
 * explicable par la liste des corrections retournée.
 */
export function reformuler(texte: string): Reformulation {
  const depart = texte ?? "";
  if (!depart.trim()) {
    return { texte: depart, corrections: [], aRevoir: [], bloquees: [] };
  }

  let courant = depart;
  const corrections: Correction[] = [];
  const bloquees: Correction[] = [];

  for (const { nom, appliquer } of TOUTES_LES_REGLES) {
    const propose = appliquer(courant);
    if (propose === courant) continue;

    // LE GARDE-FOU. Une règle ne peut pas augmenter le nombre de termes qui
    // engagent l'entreprise. Si elle le fait, elle est écartée — pas corrigée,
    // écartée : une règle qui promet davantage est une règle fausse.
    if (!retenirSousGardeFou(courant, propose)) {
      bloquees.push({ regle: nom, avant: courant, apres: propose });
      continue;
    }

    corrections.push({ regle: nom, avant: courant, apres: propose });
    courant = propose;
  }

  return { texte: courant, corrections, aRevoir: pointsARevoir(courant), bloquees };
}

/**
 * Reformule UNE prestation — une ligne isolée.
 *
 * Même chaîne de règles, sur une seule puce. Le tiret est ajouté puis retiré
 * pour que la règle des puces (majuscule, point final) s'applique aussi à une
 * ligne saisie sans tiret dans un champ.
 */
export function reformulerPrestation(ligne: string): Reformulation {
  const nue = (ligne ?? "").trim().replace(/^-\s*/, "");
  if (!nue) return { texte: "", corrections: [], aRevoir: [], bloquees: [] };
  const r = reformuler(`- ${nue}`);
  return { ...r, texte: r.texte.replace(/^[ \t]*-[ \t]*/, "") };
}
