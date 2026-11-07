// Terminologie du devis selon le PAYS de la société émettrice — PUR, aucune I/O.
//
// ── UN SEUL MOTEUR, UNE PROJECTION À LA FIN ─────────────────────────
//
// Le client a été explicite : « ne pas créer cinq moteurs différents ». Ce
// module n'en crée aucun. Le référentiel de rédaction reste unique, écrit en
// français de France, et c'est lui la référence. Ce fichier applique, au
// moment du rendu, une PROJECTION TERMINOLOGIQUE : il remplace les quelques
// termes dont l'usage diffère réellement d'un pays à l'autre.
//
// Conséquence directe, et c'est ce qui rend l'opération sûre : pour une
// société française, la projection est l'identité. Le texte ressort
// caractère pour caractère identique à ce que le moteur produisait avant.
// Les sept sociétés du CRM étant aujourd'hui toutes françaises, C2 n'a aucun
// effet observable en production — il ouvre la porte, il ne déplace rien.
//
// ── POURQUOI SI PEU DE TERMES ───────────────────────────────────────
//
// Parce que je ne sais pas davantage, et qu'inventer du vocabulaire
// contractuel serait plus grave que de n'en traduire aucun.
//
// Ce qui EST établi : au Québec, le document qui chiffre une prestation
// s'appelle une SOUMISSION. « Devis » y désigne plutôt le cahier des charges
// technique — employer « devis » dans une soumission québécoise, c'est se
// tromper de document. En Suisse, en Belgique et au Luxembourg, « devis » est
// l'usage courant ; la Suisse dit aussi « offre », mais les deux se
// comprennent et rien n'impose l'une.
//
// Ce qui N'EST PAS établi, et attend donc un arbitrage du client plutôt qu'une
// invention de ma part : les régimes de TVA (TPS/TVQ au Canada, taux suisses),
// les devises, les mentions légales obligatoires par pays, et les unités
// usuelles. Ces points sont listés dans `ARBITRAGES_EN_ATTENTE` — un tableau
// de code plutôt qu'une note perdue, pour qu'ils ne se perdent pas.
//
// ── LA LANGUE EST CONFIGURÉE, ELLE N'EST PAS DÉDUITE ────────────────
//
// Le client demande une « langue configurée ». Elle l'est : `Langue` est un
// paramètre, et la seule valeur servie aujourd'hui est `fr`. Les cinq pays du
// CRM ont tous une population francophone, et le référentiel est écrit en
// français — produire une version allemande ou néerlandaise de ses 123
// opérations reviendrait à rédiger un document contractuel dans une langue
// que personne n'a relue. `LANGUES_SERVIES` dit ce qui existe, et
// `langueServie()` refuse le reste au lieu de retomber silencieusement sur le
// français : un devis dans la mauvaise langue est un devis qu'on ne peut pas
// opposer.

import { COUNTRIES, COUNTRY_LABEL, type Country } from "@/lib/leads";

export type { Country };
export { COUNTRIES, COUNTRY_LABEL };

/** Langues dans lesquelles le référentiel de rédaction existe RÉELLEMENT. */
export const LANGUES_SERVIES = ["fr"] as const;
export type Langue = (typeof LANGUES_SERVIES)[number];

/**
 * Langues plausibles par pays, pour l'écran de réglages.
 *
 * Descriptif, pas prescriptif : dire qu'une société luxembourgeoise pourrait
 * vouloir de l'allemand n'est pas dire que le CRM sait le produire. Seules
 * les langues de `LANGUES_SERVIES` sont servies.
 */
export const LANGUES_PLAUSIBLES: Record<Country, readonly string[]> = {
  FR: ["fr"],
  CH: ["fr", "de", "it"],
  BE: ["fr", "nl", "de"],
  LU: ["fr", "de", "lb"],
  CA: ["fr", "en"],
};

/**
 * Langue effectivement servie pour une demande.
 *
 * Retourne `null` quand la langue demandée n'existe pas dans le référentiel.
 * ⚠️ PAS de repli sur le français : un devis rendu en français alors que la
 * société attendait de l'allemand est un devis qu'elle ne pourra pas opposer,
 * et l'erreur ne se verrait qu'au moment du litige.
 */
export function langueServie(demandee: string | null | undefined): Langue | null {
  const l = (demandee ?? "").trim().toLowerCase().slice(0, 2);
  return (LANGUES_SERVIES as readonly string[]).includes(l) ? (l as Langue) : null;
}

// ══════════════════════════════════════════════════════════════════════
//  Les termes qui varient
// ══════════════════════════════════════════════════════════════════════

export type Terminologie = {
  pays: Country;
  langue: Langue;
  /** Nom du document, au singulier, sans article : « devis », « soumission ». */
  document: string;
  /** Au pluriel, pour les rares formulations qui en ont besoin. */
  documentPluriel: string;
  /** Genre grammatical du nom du document — « le présent » / « la présente ». */
  genre: "m" | "f";
};

const FR_FR: Terminologie = {
  pays: "FR", langue: "fr", document: "devis", documentPluriel: "devis", genre: "m",
};

/**
 * Terminologie par pays, en français.
 *
 * ⚠️ Seules les entrées qui DIFFÈRENT réellement du français de France sont
 * renseignées autrement. Recopier le même mot cinq fois donnerait l'illusion
 * d'un travail de localisation qui n'a pas eu lieu.
 */
const TABLE_FR: Record<Country, Terminologie> = {
  FR: FR_FR,
  CH: { ...FR_FR, pays: "CH" },
  BE: { ...FR_FR, pays: "BE" },
  LU: { ...FR_FR, pays: "LU" },
  // Québec : le document qui chiffre une prestation est une SOUMISSION, et
  // « soumission » est féminin — d'où « la présente soumission ».
  CA: {
    pays: "CA", langue: "fr",
    document: "soumission", documentPluriel: "soumissions", genre: "f",
  },
};

/** Terminologie d'un pays. Le français de France est la référence. */
export function terminologieDe(pays: Country, langue: Langue = "fr"): Terminologie {
  if (langue !== "fr") return { ...TABLE_FR[pays], langue };
  return TABLE_FR[pays];
}

/** La référence : français de France. */
export const TERMINOLOGIE_REFERENCE = FR_FR;

/**
 * Le pays est-il l'un des cinq que le CRM connaît ?
 *
 * Doublon apparent avec `paysReconnu` de `mentions-produits.ts`, et c'est
 * assumé : faire dépendre la terminologie du module des mentions créerait un
 * couplage entre deux règles qui n'ont en commun que de lire le même champ.
 * La fonction tient en deux lignes ; le couplage, lui, se paierait longtemps.
 */
export function paysReconnuPourTerminologie(brut: string | null | undefined): Country | null {
  const p = (brut ?? "").trim().toUpperCase();
  return (COUNTRIES as readonly string[]).includes(p) ? (p as Country) : null;
}

/** Le pays appelle-t-il le document autrement que « devis » ? */
export function terminologieDifferente(t: Terminologie): boolean {
  return t.document !== TERMINOLOGIE_REFERENCE.document;
}

// ══════════════════════════════════════════════════════════════════════
//  La projection
// ══════════════════════════════════════════════════════════════════════

/**
 * Projette un texte du référentiel vers la terminologie d'un pays.
 *
 * ⚠️ POUR LE FRANÇAIS DE FRANCE, C'EST L'IDENTITÉ — retour immédiat, aucune
 * substitution, aucun risque. C'est la propriété qui rend C2 déployable sans
 * rien casser : les sept sociétés du CRM sont françaises.
 *
 * Les accords sont traités, parce qu'ils ne sont pas optionnels : « le présent
 * devis » devient « la présente soumission », « du présent devis » devient
 * « de la présente soumission ». Un accord faux dans un document contractuel
 * se remarque, et il décrédibilise le reste.
 */
/**
 * Participes et adjectifs qui peuvent suivre le nom du document, avec leur
 * féminin.
 *
 * ── POURQUOI UNE TABLE FERMÉE, ET PAS UNE RÉGLE ────────────────────
 *
 * Parce que l'accord est le seul point où cette projection peut produire du
 * français faux, et qu'une règle générale (« ajouter un e ») se
 * tromperait sur « soumis » → « soumise », pas « soumisé ».
 *
 * MESURE : le référentiel n'en contient AUJOURD'HUI qu'un seul,
 * « établi », en quatre endroits. Les autres entrées anticipent ce qu'un
 * rédacteur écrira plausiblement demain. Et pour ce que la table ne couvre
 * pas, `controlerTerminologie` détecte l'accord manquant au lieu de le
 * laisser partir : une table fermée sans détecteur serait un piège.
 */
const ACCORDS_FEMININ: Record<string, string> = {
  "établi": "établie",
  "établis": "établies",
  fondé: "fondée",
  limité: "limitée",
  rédigé: "rédigée",
  soumis: "soumise",
  annexé: "annexée",
  accepté: "acceptée",
  signé: "signée",
  daté: "datée",
  annulé: "annulée",
  validé: "validée",
  caduc: "caduque",
};

/** Copules après lesquelles un participe s'accorde avec le sujet. */
const COPULES = "est|sera|a été|avait été|serait|demeure|reste";

export function projeter(texte: string, t: Terminologie): string {
  const src = texte ?? "";
  if (!terminologieDifferente(t)) return src;

  const doc = t.document;
  const docPluriel = t.documentPluriel;
  const fem = t.genre === "f";

  let out = src;

  if (fem) {
    // Les formes contractées d'abord : « du présent devis » ne peut pas se
    // réduire à « de la présente devis » si « devis » a déjà été remplacé.
    out = out
      .replace(/\bdu présent devis\b/g, `de la présente ${doc}`)
      .replace(/\bau présent devis\b/g, `à la présente ${doc}`)
      .replace(/\bdu devis\b/g, `de la ${doc}`)
      .replace(/\bau devis\b/g, `à la ${doc}`)
      .replace(/\ble présent devis\b/g, `la présente ${doc}`)
      .replace(/\bLe présent devis\b/g, `La présente ${doc}`)
      .replace(/\ble devis\b/g, `la ${doc}`)
      .replace(/\bLe devis\b/g, `La ${doc}`)
      .replace(/\bce devis\b/g, `cette ${doc}`)
      .replace(/\bCe devis\b/g, `Cette ${doc}`)
      .replace(/\bprésent devis\b/g, `présente ${doc}`);
  }

  // Le PLURIEL, avant les emplois nus : « les devis » deviendrait sinon
  // « les soumission ». Le référentiel n'en contient aucun aujourd'hui,
  // mais un commercial peut l'écrire à la main dans le textarea.
  out = out
    .replace(/\b(les|des|ces) devis\b/g, (_m, art: string) => `${art} ${docPluriel}`)
    .replace(/\b(Les|Des|Ces) devis\b/g, (_m, art: string) => `${art} ${docPluriel}`)
    .replace(/\baux devis\b/g, `aux ${docPluriel}`);

  // Les occurrences restantes, sans article accordé : « compris au devis »
  // a déjà été traité au-dessus ; il reste les emplois nus.
  out = out
    .replace(/\bdevis\b/g, doc)
    .replace(/\bDevis\b/g, doc.charAt(0).toUpperCase() + doc.slice(1));

  // L'ACCORD, en dernier : le sujet vient de changer de genre, et le participe
  // qui le suit doit suivre. « La présente soumission est établi » est du
  // français faux, et dans un document contractuel ça se remarque.
  if (fem) out = accorderAuFeminin(out, doc, docPluriel);

  return out;
}

/** Accorde les participes qui suivent immédiatement le sujet projeté. */
function accorderAuFeminin(texte: string, doc: string, docPluriel: string): string {
  const mots = Object.keys(ACCORDS_FEMININ).join("|");
  const sujetSing = `(?:la|La|cette|Cette)(?: présente)? ${doc}`;
  const sujetPlur = `(?:les|Les|ces|Ces) ${docPluriel}`;
  return texte
    .replace(
      new RegExp(`(${sujetSing}\\s+(?:${COPULES})\\s+)(${mots})\\b`, "g"),
      (_m, debut: string, mot: string) => debut + (ACCORDS_FEMININ[mot] ?? mot),
    )
    .replace(
      new RegExp(`(${sujetPlur}\\s+(?:sont|seront|ont été)\\s+)(${mots})\\b`, "g"),
      (_m, debut: string, mot: string) => {
        const f = ACCORDS_FEMININ[mot] ?? mot;
        return debut + (f.endsWith("s") ? f : `${f}s`);
      },
    );
}

// ══════════════════════════════════════════════════════════════════════
//  Le contrôle : aucun mélange de pays
// ══════════════════════════════════════════════════════════════════════

export type ControleTerminologie = {
  ok: boolean;
  /** Termes relevant d'un AUTRE pays que celui de la société émettrice. */
  intrus: { terme: string; appartientA: Country[] }[];
  /**
   * Accords restés au masculin après une projection vers un nom féminin.
   *
   * `ACCORDS_FEMININ` est une table FERMÉE : elle couvre ce que le référentiel
   * contient aujourd'hui, plus ce qu'un rédacteur écrira plausiblement. Le jour
   * où quelqu'un ajoute « la soumission est réputé accepté », la table ne
   * saura pas l'accorder — et c'est ce champ qui le dira, au lieu de laisser
   * partir du français faux dans un document contractuel.
   */
  accordsManquants: string[];
};

/** Tous les noms de document connus, avec les pays qui les emploient. */
function nomsDeDocument(): Map<string, Country[]> {
  const m = new Map<string, Country[]>();
  for (const pays of COUNTRIES) {
    const nom = TABLE_FR[pays].document;
    m.set(nom, [...(m.get(nom) ?? []), pays]);
  }
  return m;
}

/**
 * Le texte emploie-t-il la terminologie d'un seul pays ?
 *
 * Le client l'a demandé : « ne jamais mélanger les pays ». Un texte qui dit
 * « la présente soumission » puis « le présent devis » laisse penser que deux
 * documents se superposent — et donne une prise à qui veut en contester un.
 */
export function controlerTerminologie(
  texte: string,
  t: Terminologie,
): ControleTerminologie {
  const src = texte ?? "";
  const intrus: { terme: string; appartientA: Country[] }[] = [];
  for (const [nom, pays] of nomsDeDocument()) {
    if (nom === t.document) continue;
    if (pays.includes(t.pays)) continue;
    const re = new RegExp(`\\b${nom}\\b`, "i");
    if (re.test(src)) intrus.push({ terme: nom, appartientA: pays });
  }

  // Un participe au masculin après un sujet devenu féminin. On ne liste que
  // ce que la table d'accords NE SAIT PAS traiter : le reste est déjà
  // accordé par `projeter`, et le signaler serait du bruit.
  const accordsManquants: string[] = [];
  if (t.genre === "f") {
    const re = new RegExp(
      `(?:la|La|cette|Cette)(?: présente)? ${t.document}\\s+(?:${COPULES})\\s+([a-zà-ÿ]+)`,
      "g",
    );
    for (const m of src.matchAll(re)) {
      const mot = m[1];
      // Déjà au féminin : rien à signaler.
      if (Object.values(ACCORDS_FEMININ).includes(mot)) continue;
      // Connu de la table mais toujours au masculin : `projeter` n'a pas été
      // appliqué, ou le texte a été réécrit à la main après coup.
      // Inconnu de la table : personne ne sait l'accorder.
      accordsManquants.push(m[0].trim());
    }
  }

  return {
    ok: intrus.length === 0 && accordsManquants.length === 0,
    intrus,
    accordsManquants,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  Ce qui n'est PAS tranché
// ══════════════════════════════════════════════════════════════════════

/**
 * Points qui demandent une décision du client, pas une invention du code.
 *
 * Écrits ici, dans le code, et non dans une note : un tableau se lit au
 * moment où l'on touche le fichier, une note se perd. Chacun est un point sur
 * lequel se tromper coûterait un document inopposable.
 */
export const ARBITRAGES_EN_ATTENTE: { pays: Country[]; sujet: string; pourquoi: string }[] = [
  {
    pays: ["CA"],
    sujet: "« soumission » plutôt que « devis »",
    pourquoi:
      "l'usage québécois est établi, mais la décision d'y basculer appartient "
      + "au client : c'est le nom du document qu'il signe. Aucune société "
      + "canadienne n'est enregistrée à ce jour, donc rien ne change encore.",
  },
  {
    pays: ["CA"],
    sujet: "TPS et TVQ au lieu de la TVA",
    pourquoi:
      "le Canada n'a pas de TVA. Les taux, les numéros d'inscription et les "
      + "mentions obligatoires relèvent du fiscaliste, pas du moteur de "
      + "rédaction.",
  },
  {
    pays: ["CH"],
    sujet: "taux de TVA suisse et numéro IDE",
    pourquoi:
      "les taux suisses diffèrent des taux français et le numéro d'identification "
      + "des entreprises a son propre format. À renseigner sur la société "
      + "émettrice, pas à déduire.",
  },
  {
    pays: ["CH", "CA"],
    sujet: "devise du document",
    pourquoi:
      "franc suisse et dollar canadien. Le descriptif ne porte aucun montant "
      + "— c'est une interdiction du moteur — donc la devise concerne les "
      + "lignes du devis et le PDF, pas le texte rédigé.",
  },
  {
    pays: ["BE", "LU", "CH"],
    sujet: "mentions légales obligatoires",
    pourquoi:
      "chaque pays impose ses propres mentions sur un document commercial. "
      + "Elles se saisissent sur la société émettrice, où le champ existe "
      + "déjà, et non dans le référentiel de rédaction.",
  },
  {
    pays: ["CH", "BE", "LU", "CA"],
    sujet: "langues autres que le français",
    pourquoi:
      "le référentiel compte 123 opérations et une trentaine de réserves "
      + "contractuelles. Les traduire sans relecture juridique produirait un "
      + "document inopposable. `langueServie()` refuse donc explicitement, au "
      + "lieu de retomber sur le français sans le dire.",
  },
];
