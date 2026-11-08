// Rotation des clés de chiffrement, et premier chiffrement des coordonnées
// bancaires. La DÉCISION, et elle seule.
//
// ── POURQUOI CE MODULE EST SÉPARÉ DU SCRIPT ─────────────────────────
//
// Un script qui réécrit des colonnes chiffrées ne peut pas être éprouvé
// contre une base qui n'existe pas encore. Mais sa décision — « que faire de
// cette valeur » — n'a besoin d'aucune base pour être exercée. Elle vit donc
// ici, pure, et le script ne fait plus que de l'entrée-sortie autour d'elle.
//
// C'est ce qui permet de prouver AUJOURD'HUI qu'une valeur illisible ne sera
// jamais réécrite, sans attendre la recette.
//
// ── LA RÈGLE QUI COMMANDE TOUT ──────────────────────────────────────
//
//   UNE VALEUR QU'ON NE SAIT PAS DÉCHIFFRER N'EST JAMAIS RÉÉCRITE.
//
// L'écraser avec du vide la perdrait définitivement. Le lot entier est donc
// refusé dès qu'une seule valeur est illisible : mieux vaut s'arrêter et
// comprendre que convertir 199 valeurs sur 200 et découvrir la 200e trop
// tard.

import { formeEnveloppe, kidDeLEnveloppe } from "./field-encryption";

/** Ce qu'il faut faire d'une valeur stockée. */
export type ActionRotation =
  | "vide"              // rien à faire : la colonne est nulle ou vide
  | "laisser"           // du clair qu'on ne convertit pas (hors périmètre)
  | "deja_convertie"    // déjà scellée par la clé cible
  | "a_convertir"       // lisible, à resceller avec la clé cible
  | "illisible";        // 🔴 aucune clé disponible ne l'ouvre — NE PAS TOUCHER

export type DecisionRotation = {
  action: ActionRotation;
  /** Le clair, seulement quand `action = "a_convertir"`. */
  clair?: string;
  /** Pourquoi, en une phrase, pour le journal. */
  motif: string;
};

export type OptionsRotation = {
  /** Identifiant de la clé avec laquelle on veut que tout soit scellé. */
  kidCible: string;
  /**
   * Faut-il chiffrer les valeurs EN CLAIR ?
   *
   * `false` pour une rotation ordinaire : le clair hérité n'est pas l'objet.
   * `true` pour le premier chiffrement d'une colonne — c'est le cas de
   * l'IBAN (anomalie D17), stocké en clair aujourd'hui.
   */
  chiffrerLeClair: boolean;
  /** Déchiffrement injecté : rend "" en cas d'échec, comme `decryptField`. */
  dechiffrer: (valeur: string) => string;
};

/**
 * Que faire de cette valeur ?
 *
 * ⚠️ L'ordre des cas n'est pas indifférent. « Déjà convertie » est examiné
 * AVANT toute tentative de déchiffrement : sur une base en cours de
 * conversion, la grande majorité des valeurs est déjà faite, et les
 * déchiffrer pour rien coûterait des heures sur de gros volumes.
 */
export function deciderRotation(
  valeur: string | null | undefined,
  o: OptionsRotation,
): DecisionRotation {
  if (valeur === null || valeur === undefined || valeur === "") {
    return { action: "vide", motif: "colonne vide" };
  }

  const forme = formeEnveloppe(valeur);

  if (forme === "clair") {
    if (!o.chiffrerLeClair) {
      return { action: "laisser", motif: "texte clair hérité, hors périmètre de cette passe" };
    }
    return {
      action: "a_convertir",
      clair: valeur,
      motif: "texte clair à chiffrer pour la première fois",
    };
  }

  if (forme === "v2" && kidDeLEnveloppe(valeur) === o.kidCible) {
    return { action: "deja_convertie", motif: "déjà scellée par la clé cible" };
  }

  const clair = o.dechiffrer(valeur);
  if (clair === "") {
    return {
      action: "illisible",
      motif:
        forme === "v2"
          ? `scellée par la clé ${kidDeLEnveloppe(valeur) ?? "inconnue"}, qui n'est pas disponible`
          : "enveloppe encv1 qu'aucune clé disponible n'ouvre",
    };
  }

  return {
    action: "a_convertir",
    clair,
    motif: forme === "v2" ? "scellée par une autre clé" : "enveloppe encv1 à moderniser",
  };
}

// ══════════════════════════════════════════════════════════════════════
//  Le résumé d'un lot, et l'autorisation d'écrire
// ══════════════════════════════════════════════════════════════════════

export type ResumeLot = {
  vides: number;
  laissees: number;
  dejaConverties: number;
  aConvertir: number;
  illisibles: number;
  total: number;
};

export const LOT_VIDE: ResumeLot = {
  vides: 0,
  laissees: 0,
  dejaConverties: 0,
  aConvertir: 0,
  illisibles: 0,
  total: 0,
};

export function resumer(decisions: DecisionRotation[]): ResumeLot {
  const r: ResumeLot = { ...LOT_VIDE, total: decisions.length };
  for (const d of decisions) {
    if (d.action === "vide") r.vides++;
    else if (d.action === "laisser") r.laissees++;
    else if (d.action === "deja_convertie") r.dejaConverties++;
    else if (d.action === "a_convertir") r.aConvertir++;
    else r.illisibles++;
  }
  return r;
}

export function additionner(a: ResumeLot, b: ResumeLot): ResumeLot {
  return {
    vides: a.vides + b.vides,
    laissees: a.laissees + b.laissees,
    dejaConverties: a.dejaConverties + b.dejaConverties,
    aConvertir: a.aConvertir + b.aConvertir,
    illisibles: a.illisibles + b.illisibles,
    total: a.total + b.total,
  };
}

export type Autorisation = { ok: true } | { ok: false; raison: string };

/**
 * Peut-on écrire ce lot ?
 *
 * **Non, dès qu'une seule valeur est illisible.** C'est la garde centrale de
 * toute la procédure : on ne convertit pas une base dont on ne sait pas tout
 * relire. Un lot partiellement converti sur une base partiellement illisible
 * est exactement la situation dont on ne se sort plus.
 */
export function autorisationEcriture(r: ResumeLot): Autorisation {
  if (r.illisibles > 0) {
    return {
      ok: false,
      raison:
        `${r.illisibles} valeur(s) ILLISIBLE(S) : aucune clé disponible ne les ` +
        `ouvre. Rien n'est écrit. Déclarez la clé manquante dans ` +
        `FIELD_ENCRYPTION_KEYS_ANCIENNES, ou constatez la perte avant de ` +
        `poursuivre — les réécrire les perdrait définitivement.`,
    };
  }
  return { ok: true };
}

/** La conversion est-elle terminée ? */
export function conversionTerminee(r: ResumeLot): boolean {
  return r.aConvertir === 0 && r.illisibles === 0;
}

// ══════════════════════════════════════════════════════════════════════
//  Le périmètre : ce que la procédure touche, et rien d'autre
// ══════════════════════════════════════════════════════════════════════

export type ColonneChiffree = {
  table: string;
  colonne: string;
  /** Colonne lisible qui sert à nommer la ligne dans les journaux. */
  etiquette: string;
  /** `true` = colonne stockée en clair aujourd'hui (premier chiffrement). */
  enClairAujourdhui: boolean;
  /** Pourquoi cette colonne est confidentielle. */
  pourquoi: string;
};

/**
 * Les 12 colonnes de la procédure unifiée D14 + D17.
 *
 * Établies par recherche exhaustive des appels à `encryptField()` /
 * `decryptField()` le 2026-11-08, plus les deux colonnes bancaires de D17.
 *
 * ⚠️ Cette liste est le périmètre EXACT. Le script ne touche rien d'autre :
 * une colonne absente d'ici ne sera jamais réécrite, même par erreur de
 * paramètre.
 */
export const COLONNES_CHIFFREES: ColonneChiffree[] = [
  {
    table: "leads",
    colonne: "immob_travaux_annotation",
    etiquette: "short_id",
    enClairAujourdhui: false,
    pourquoi: "annotation Immobilier/Travaux — permission granulaire (CDC §3.5)",
  },
  ...(["source_url", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"] as const).map(
    (c) => ({
      table: "leads",
      colonne: c,
      etiquette: "short_id",
      enClairAujourdhui: false,
      pourquoi: "provenance marketing — un commercial ne doit JAMAIS la voir",
    }),
  ),
  {
    table: "docusign_connections",
    colonne: "access_token_enc",
    etiquette: "id",
    enClairAujourdhui: false,
    pourquoi: "jeton OAuth DocuSign — se refait par un nouveau consentement",
  },
  {
    table: "docusign_connections",
    colonne: "refresh_token_enc",
    etiquette: "id",
    enClairAujourdhui: false,
    pourquoi: "jeton de rafraîchissement DocuSign — accès permanent s'il fuit",
  },
  {
    table: "legal_entities",
    colonne: "iban",
    etiquette: "legal_name",
    enClairAujourdhui: true,
    pourquoi: "coordonnée bancaire — anomalie D17, en clair contrairement au CDC",
  },
  {
    table: "legal_entities",
    colonne: "bic",
    etiquette: "legal_name",
    enClairAujourdhui: true,
    pourquoi: "coordonnée bancaire — anomalie D17",
  },
];

/** Les colonnes aujourd'hui en clair : le volet D17 de la procédure. */
export function colonnesEnClair(): ColonneChiffree[] {
  return COLONNES_CHIFFREES.filter((c) => c.enClairAujourdhui);
}

/** Les colonnes déjà chiffrées : le volet D14. */
export function colonnesDejaChiffrees(): ColonneChiffree[] {
  return COLONNES_CHIFFREES.filter((c) => !c.enClairAujourdhui);
}
