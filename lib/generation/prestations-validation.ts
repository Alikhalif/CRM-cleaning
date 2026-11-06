// VALIDATION DES PRESTATIONS — contrôle INDÉPENDANT du moteur. Pur, sans I/O.
//
// ── POURQUOI CE MODULE EXISTE (anomalie B5 de l'audit du 2026-11-06) ──
//
// `aucunThemeComplementaireNonValide()` comparait les sections produites à
// `Analyse.themes` — c'est-à-dire à la liste que le moteur venait lui-même de
// décider. Un garde-fou circulaire : il ne pouvait détecter qu'une section
// apparue HORS analyse, jamais un thème que l'analyse avait admis à tort.
//
// C'est précisément ce qui s'est produit à l'audit : le devis Diogène promettait
// un « Traitement des nuisibles » que la découverte n'avait jamais validé — et
// les 369 assertions passaient.
//
// Ce module tranche autrement : il part des DONNÉES DE DÉCOUVERTE et des choix
// explicites du commercial, pas de l'analyse. Il est donc capable de contredire
// le moteur.
//
// ── LA RÈGLE DE FOND ─────────────────────────────────────────────────
//
// UNE OBSERVATION N'EST JAMAIS UNE AUTORISATION DE PRESTATION.
//
// Constater des nuisibles, des odeurs, de la nicotine ou des moisissures
// renseigne le CONTEXTE de l'intervention. Cela n'autorise pas à promettre un
// traitement : un devis est un engagement contractuel, pas un compte rendu de
// visite. D'où quatre états, et non deux.

import {
  estComplementaire,
  titreDe,
  type Theme,
} from "./bibliotheque-redaction";

/**
 * État d'une prestation au regard de la découverte.
 *
 * La distinction `non_renseigne` / `exclu` est la clé : un silence n'est pas
 * un refus, mais il n'est pas non plus un accord. Et `a_confirmer` existe
 * parce qu'un devis ne doit jamais promettre ce qui reste à trancher.
 */
export type EtatPrestation = "inclus" | "exclu" | "non_renseigne" | "a_confirmer";

export const ETAT_LABEL: Record<EtatPrestation, string> = {
  inclus: "incluse",
  exclu: "exclue",
  non_renseigne: "non renseignée",
  a_confirmer: "à confirmer",
};

/**
 * Thèmes qui EXIGENT une validation explicite pour figurer au devis.
 *
 * Surensemble de `THEMES_COMPLEMENTAIRES` : `nuisibles` y est ajouté, alors
 * qu'il en était absent. C'est l'omission qui a produit l'anomalie B3 — une
 * case « présence de nuisibles » cochée en découverte ouvrait une section qui
 * engage l'entreprise auprès du client.
 *
 * `debarras_prealable` n'y figure PAS : sur un chantier insalubre ou Diogène,
 * le débarras n'est pas un complément, c'est la première phase du chantier.
 * L'exclure explicitement reste possible — c'est le rôle de `exclusions`.
 */
export const THEMES_A_VALIDER: readonly Theme[] = [
  "vitrerie", "murs", "plafonds", "desinfection", "decontamination",
  "desodorisation", "debarras_inclus", "nuisibles",
] as const;

export function exigeValidation(t: Theme): boolean {
  return (THEMES_A_VALIDER as readonly string[]).includes(t);
}

/**
 * Clés d'exclusion de la découverte → thème exclu.
 *
 * ⚠️ UNE EXCLUSION PRIME SUR TOUT. Elle n'est pas l'inverse d'une validation :
 * elle est un refus opposable, qui doit survivre à une régénération, à un
 * enrichissement rédactionnel et à une modification manuelle. C'est ce que
 * l'audit a montré manquant — seuls `vitrerie`, `murs` et `plafonds`
 * s'excluaient, et uniquement par la valeur « non » de leur propre champ.
 */
export const EXCLUSION_PAR_CLE: Record<string, Theme> = {
  excl_debarras: "debarras_inclus",
  excl_debarras_prealable: "debarras_prealable",
  excl_desinfection: "desinfection",
  excl_decontamination: "decontamination",
  excl_desodorisation: "desodorisation",
  excl_nuisibles: "nuisibles",
  excl_murs: "murs",
  excl_plafonds: "plafonds",
  excl_vitrerie: "vitrerie",
  excl_exterieurs: "exterieurs",
};

/** Libellé de réserve par thème exclu. Au singulier, sans « nous ne ». */
export const LIBELLE_EXCLUSION: Partial<Record<Theme, string>> = {
  debarras_inclus: "le débarras et l'évacuation des encombrants",
  debarras_prealable: "le débarras préalable du logement",
  desinfection: "la désinfection des surfaces",
  decontamination: "la décontamination",
  desodorisation: "le traitement des odeurs",
  nuisibles: "le traitement des nuisibles (dératisation, désinsectisation)",
  murs: "le lessivage des murs",
  plafonds: "le lessivage des plafonds",
  vitrerie: "le nettoyage de la vitrerie",
  exterieurs: "le nettoyage des espaces extérieurs",
};

// ══════════════════════════════════════════════════════════════════════
//  Le contrôle de conformité
// ══════════════════════════════════════════════════════════════════════

export type Violation = {
  /** `promesse` = prestation non autorisée ; `perte` = validée mais absente. */
  genre: "promesse_non_validee" | "prestation_exclue" | "perte_validee";
  theme: Theme;
  /** Phrase exploitable telle quelle par l'interface. */
  message: string;
};

export type Conformite = { ok: boolean; violations: Violation[] };

/**
 * Les sections produites sont-elles conformes aux états de la découverte ?
 *
 * Trois questions, dans l'ordre de gravité :
 *
 *   1. une prestation EXCLUE figure-t-elle au devis ? (le pire : on promet ce
 *      que le client a refusé) ;
 *   2. une prestation exigeant validation figure-t-elle sans être incluse ?
 *      (`non_renseigne` et `a_confirmer` ne valent PAS accord) ;
 *   3. une prestation INCLUSE a-t-elle disparu ? (une validation perdue est
 *      une prestation non facturée et un client mécontent).
 *
 * Prend les TITRES des sections et non l'analyse : ainsi le même contrôle
 * s'applique à un texte régénéré, enrichi ou modifié à la main.
 */
export function controlerConformite(
  etats: Partial<Record<Theme, EtatPrestation>>,
  titresSections: readonly string[],
): Conformite {
  const violations: Violation[] = [];
  const presents = new Set(titresSections.map((t) => t.trim()));

  for (const [cle, etat] of Object.entries(etats) as [Theme, EtatPrestation][]) {
    const titre = titreDe(cle);
    const present = presents.has(titre);

    if (etat === "exclu" && present) {
      violations.push({
        genre: "prestation_exclue",
        theme: cle,
        message: `« ${titre} » figure au devis alors que cette prestation est EXCLUE `
          + `de la découverte. Une exclusion n'est pas négociable par la rédaction.`,
      });
      continue;
    }
    if (present && etat !== "inclus" && exigeValidation(cle)) {
      violations.push({
        genre: "promesse_non_validee",
        theme: cle,
        message: `« ${titre} » figure au devis sans validation explicite `
          + `(état : ${ETAT_LABEL[etat]}). Une observation faite en découverte `
          + `n'autorise pas à promettre la prestation correspondante.`,
      });
      continue;
    }
    if (etat === "inclus" && !present && exigeValidation(cle)) {
      violations.push({
        genre: "perte_validee",
        theme: cle,
        message: `« ${titre} » a été validée en découverte mais ne figure pas `
          + `au devis. Une prestation validée ne doit jamais disparaître.`,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Marqueurs textuels d'une prestation, pour contrôler un texte LIBRE.
 *
 * Après une modification manuelle ou un enrichissement, il n'y a plus de
 * sections typées : seulement du texte. Ce contrôle est donc nécessairement
 * plus grossier que le précédent — il cherche des mots. Il est là pour
 * empêcher le contournement le plus probable, pas pour prouver la conformité.
 *
 * ⚠️ IL NE REMPLACE PAS `controlerConformite()`. Un texte qui passe ici n'est
 * pas réputé conforme ; un texte qui échoue est en revanche certainement
 * fautif, et c'est ce qui compte pour bloquer.
 */
const MARQUEURS: Partial<Record<Theme, RegExp>> = {
  desinfection: /\bd[ée]sinfect/i,
  decontamination: /\bd[ée]contamin/i,
  desodorisation: /\b(?:d[ée]sodoris|traitement des odeurs)/i,
  nuisibles: /\b(?:nuisible|d[ée]ratis|d[ée]sinsectis|punaise|blatte|rongeur)/i,
  murs: /\blessivage\s+(?:des\s+)?murs/i,
  plafonds: /\blessivage\s+(?:des\s+)?plafonds/i,
  vitrerie: /\b(?:vitrerie|surfaces\s+vitr[ée]es|vitrages?)\b/i,
  debarras_inclus: /\bd[ée]barras|encombrants/i,
  debarras_prealable: /\bd[ée]barras\s+pr[ée]alable/i,
  exterieurs: /\b(?:terrasse|balcon|espaces?\s+ext[ée]rieurs?)\b/i,
};

/**
 * Un texte libre réintroduit-il une prestation exclue ?
 *
 * On ne contrôle QUE les exclusions : chercher l'absence d'une prestation
 * validée dans du texte libre produirait des faux positifs à chaque
 * reformulation, et le commercial a le droit de réécrire comme il l'entend
 * tant qu'il ne promet pas l'interdit.
 *
 * Les RÉSERVES mentionnent légitimement les exclusions (« le lessivage des
 * murs n'est pas compris ») : la partie du texte qui suit l'intitulé
 * « RÉSERVES » est donc ignorée. Sans cela, toute exclusion correctement
 * énoncée serait signalée comme sa propre violation.
 */
/**
 * Intitulés après lesquels le texte ne PROMET plus rien.
 *
 * Deux blocs nomment légitimement une prestation sans l'engager :
 *
 *   — RÉSERVES, dont c'est précisément le rôle (« le lessivage des murs n'est
 *     pas compris dans le présent devis ») ;
 *   — « Éléments relevés lors de la découverte », qui rapporte ce qui a été
 *     constaté chez le client — des nuisibles, des odeurs — sans rien
 *     commander. Le client a le droit de le savoir, et le brief du 2026-11-06
 *     le demande explicitement : « Mention possible dans le contexte.
 *     Traitement non ajouté sans validation. »
 *
 * Sans cette coupe, une exclusion correctement énoncée et une observation
 * correctement rapportée étaient signalées comme leurs propres violations.
 */
const FINS_DE_PROMESSE = ["RÉSERVES", "Éléments relevés lors de la découverte"];

export function controlerTexteConforme(
  etats: Partial<Record<Theme, EtatPrestation>>,
  texte: string,
): Conformite {
  let fin = texte.length;
  for (const marqueur of FINS_DE_PROMESSE) {
    const i = texte.indexOf(marqueur);
    if (i >= 0 && i < fin) fin = i;
  }
  const corps = texte.slice(0, fin);

  const violations: Violation[] = [];
  for (const [cle, etat] of Object.entries(etats) as [Theme, EtatPrestation][]) {
    if (etat !== "exclu") continue;
    const re = MARQUEURS[cle];
    if (re && re.test(corps)) {
      violations.push({
        genre: "prestation_exclue",
        theme: cle,
        message: `Le descriptif mentionne ${LIBELLE_EXCLUSION[cle] ?? titreDe(cle)}, `
          + `alors que cette prestation est EXCLUE de la découverte.`,
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Les prestations à rappeler en réserve : celles qui sont explicitement
 * exclues, et elles seules.
 *
 * Une prestation `non_renseigne` n'est PAS rappelée : écrire « la désinfection
 * n'est pas comprise » sur un devis où personne n'a parlé de désinfection
 * alourdit le document et suggère un manque. Un refus explicite, lui, se
 * rappelle — c'est ce qui protège l'entreprise.
 */
export function exclusionsARappeler(
  etats: Partial<Record<Theme, EtatPrestation>>,
): Theme[] {
  return (Object.entries(etats) as [Theme, EtatPrestation][])
    .filter(([, e]) => e === "exclu")
    .map(([t]) => t)
    .filter((t) => LIBELLE_EXCLUSION[t] !== undefined);
}

/** Vrai si le thème est un complément au sens du §6.B — réexporté par commodité. */
export { estComplementaire };
