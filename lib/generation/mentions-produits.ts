// Mention des produits d'entretien portée par le devis — PUR, aucune I/O.
//
// ── CE QUE CE MODULE DÉCIDE, ET SUR QUELLE BASE ─────────────────────
//
// La mention dépend du PAYS DE L'ENTITÉ JURIDIQUE qui établit le devis. Pas
// de la société, pas du client, pas de son adresse, pas de son téléphone, pas
// de la langue du navigateur : du pays de l'émetteur.
//
// C'est la règle arbitrée par le client le 2026-11-06, et elle a une raison
// juridique. Une mention sur les produits est une allégation réglementaire :
// « 100 % français » relève du droit français de la consommation, « conforme
// aux normes européennes » n'a pas de sens au Canada, et la conformité
// européenne ne dispense pas des obligations suisses. Le pays de celui qui
// signe est donc le seul axe défendable.
//
// ── L'HISTOIRE DE CE FICHIER, PARCE QU'ELLE EXPLIQUE SA FORME ───────
//
// 1. Jusqu'au 2026-11-06, `analyserNettoyage()` posait `mentionProduits: true`
//    EN DUR. La phrase « 100 % français et écoresponsables » partait sur les
//    devis des sept sociétés, dans les cinq pays, sans qu'aucune règle ne
//    l'autorise.
// 2. Première correction (C1, commit 693c31f) : une carte société → texte,
//    saisie à la main. Elle réglait l'urgence mais laissait le Super Admin
//    recopier la même phrase pour chaque société d'un même pays — et rien
//    n'empêchait d'écrire la mention française sur une société suisse.
// 3. Correction retenue : le pays décide, la table de correspondance est
//    FIGÉE dans le code, et le Super Admin ACTIVE par pays après avoir
//    vérifié les justificatifs.
//
// ── POURQUOI UNE ACTIVATION, PUISQUE LA SÉLECTION EST AUTOMATIQUE ───
//
// Le client demande les deux : « la sélection doit être automatique selon le
// pays » ET « les formulations doivent être validées et justifiables avant
// leur activation ». Ce n'est pas contradictoire, c'est une séparation des
// rôles. Le pays décide QUELLE mention s'applique — personne ne la choisit à
// la main, et le commercial n'y touche pas. L'activation dit si l'entreprise
// ASSUME cette allégation pour ce pays, justificatifs en main. Tant qu'elle
// n'est pas activée, aucune mention ne part : le silence ne coûte rien, une
// allégation infondée coûte cher.

import { COUNTRIES, COUNTRY_LABEL, type Country } from "@/lib/leads";

export type { Country };

// ══════════════════════════════════════════════════════════════════════
//  La table de correspondance — FIGÉE
// ══════════════════════════════════════════════════════════════════════

/**
 * Formulation de référence par pays, telle que le client l'a arrêtée le
 * 2026-11-06.
 *
 * ⚠️ NE PAS MODIFIER CES TEXTES SANS DÉCISION ÉCRITE. Ce sont des
 * allégations réglementaires, pas des formules commerciales.
 *
 * Révision du 2026-11-07 (Lot A) : les formulations française et européenne
 * sont alignées sur les textes arrêtés par le client — « de produits » au lieu
 * de « de produits d'entretien », et sans le qualificatif « applicables ».
 * La formulation CANADIENNE est conservée telle quelle, sur sa demande
 * expresse. Le mécanisme de sélection n'a pas changé. Le Super Admin
 * peut les adapter dans l'écran de réglages — cette adaptation est
 * journalisée — mais le défaut du code reste la formulation validée.
 */
export const MENTION_PAR_PAYS: Record<Country, string> = {
  // Formulation ARRÊTÉE PAR LE CLIENT le 2026-11-08, reprise mot pour mot :
  // « Produits 100 % écologiques et 100 % français ». Elle remplace
  // « Utilisation de produits 100 % français et 100 % écologiques. » — même
  // couple d'allégations, ordre et attaque de phrase différents. Les deux
  // affirmations restent opposables et exigent les mêmes justificatifs.
  FR: "Produits 100 % écologiques et 100 % français.",
  CH: "Utilisation de produits 100 % conformes aux normes européennes.",
  BE: "Utilisation de produits 100 % conformes aux normes européennes.",
  LU: "Utilisation de produits 100 % conformes aux normes européennes.",
  // ⚠️ LE CANADA NE CHANGE PAS. Le client l'a demandé expressément le
  // 2026-11-07 : « conserver les formulations locales déjà développées ».
  // La formulation canadienne a été écrite en connaissance des exigences
  // locales ; l'aligner sur la forme européenne lui ferait perdre ce qui la
  // rend exacte.
  CA: "Utilisation de produits d'entretien conformes aux exigences réglementaires canadiennes applicables.",
};

/**
 * Avertissement propre à un pays, affiché au Super Admin AVANT activation.
 *
 * La Suisse n'est pas dans l'Espace économique européen : y annoncer une
 * conformité européenne est exact sur le produit mais ne dit rien des
 * obligations suisses (ChemV, OChim). Le client l'a demandé explicitement —
 * « la conformité européenne ne doit pas être présentée comme remplaçant les
 * obligations réglementaires suisses » — et c'est le genre de nuance qu'un
 * écran doit porter, pas un commentaire de code.
 */
export const AVERTISSEMENT_PAYS: Partial<Record<Country, string>> = {
  CH: "La Suisse n'applique pas le droit européen. Cette mention décrit la "
    + "conformité des produits aux normes européennes ; elle ne vaut pas "
    + "conformité aux obligations suisses (ordonnance sur les produits "
    + "chimiques). Vérifiez les exigences suisses applicables avant "
    + "d'activer, et conservez les fiches de données de sécurité.",
  CA: "⚠️ N'AJOUTEZ PAS d'allégation écologique au Canada sans justificatif "
    + "d'essai. Vérifié le 2026-11-08 à la demande du client : une déclaration "
    + "sur l'avantage environnemental d'un PRODUIT relève de l'alinéa "
    + "74.01(1)b.1) de la Loi sur la concurrence, qui exige une « épreuve "
    + "suffisante et appropriée » faite AVANT que la déclaration soit émise. "
    + "Les modifications sont en vigueur depuis le 26 mars 2026 et le Bureau de "
    + "la concurrence a actualisé ses lignes directrices le 23 octobre 2026. "
    + "Les sources secondaires DIVERGENT sur le fardeau de la preuve : à faire "
    + "confirmer par un conseil avant toute allégation. C'est pourquoi la "
    + "formulation canadienne reste une déclaration de CONFORMITÉ "
    + "réglementaire et non une allégation environnementale. Vérifiez aussi la "
    + "réglementation provinciale (SIMDUT / LCPE, et au Québec la Loi sur la "
    + "protection du consommateur).",
  FR: "« 100 % français » et « 100 % écologiques » sont des allégations "
    + "opposables. Elles exigent des justificatifs sur l'origine et sur les "
    + "caractéristiques environnementales de chaque produit employé.",
};

// ══════════════════════════════════════════════════════════════════════
//  Le réglage : activation et formulation, par pays
// ══════════════════════════════════════════════════════════════════════

export type ReglagePays = {
  /** Faux = aucune mention sur les devis de ce pays. C'est le défaut. */
  active: boolean;
  /**
   * Formulation retenue. Vide = la formulation de référence du pays.
   *
   * Permet au Super Admin d'adapter sans toucher au code, sans jamais
   * perdre la référence : `MENTION_PAR_PAYS` reste le défaut.
   */
  texte: string;
};

export type ReglagesMentions = Partial<Record<Country, ReglagePays>>;

/**
 * Réglages PAR SOCIÉTÉ : identifiant d'entité → réglages par pays.
 *
 * ── POURQUOI CETTE COUCHE EXISTE ────────────────────────────────────
 *
 * Jusqu'au 2026-11-08, l'activation était par PAYS seulement. Deux sociétés
 * françaises partageaient donc la même mention : activer la France faisait
 * porter « 100 % écologiques et 100 % français » par TOUTES les sociétés
 * françaises, y compris celle qui n'emploie pas ces produits. Une allégation
 * opposable portée par une société qui ne l'a pas assumée.
 *
 * Le client a tranché : « les mentions doivent dépendre de la société
 * émettrice et respecter son pays ».
 *
 * ── POURQUOI C'EST UNE COUCHE EN PLUS, ET NON UN REMPLACEMENT ───────
 *
 * Le réglage par pays est CONSERVÉ et reste lu. Le supprimer éteindrait d'un
 * coup les mentions déjà activées, ce qui « perturberait les devis
 * existants » — précisément ce que le client a exclu. Il devient donc un
 * repli, et ce repli est SIGNALÉ (origine `pays_herite`) pour que la
 * configuration société par société reste visible comme restant à faire.
 */
export type ReglagesParSociete = Record<string, ReglagesMentions>;

/** Clé réservée, dans le même réglage `app_settings`, pour la couche société. */
export const CLE_SOCIETES = "societes";

export const REGLAGE_FERME: ReglagePays = { active: false, texte: "" };

/** Longueur maximale : une mention, pas un argumentaire. */
export const LONGUEUR_MAX_MENTION = 400;

/**
 * Lecture sûre du réglage, tel qu'il revient de `app_settings` (jsonb).
 *
 * Rien n'est supposé : la valeur peut être nulle, une chaîne, un tableau, ou
 * un objet aux clés inattendues. Tout ce qui n'est pas exploitable est
 * ignoré — mais JAMAIS remplacé par une activation. Un réglage illisible
 * laisse les devis sans mention, il n'en invente pas une.
 */
export function lireReglages(brut: unknown): ReglagesMentions {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const src = brut as Record<string, unknown>;
  const out: ReglagesMentions = {};
  for (const pays of COUNTRIES) {
    const v = src[pays];
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    const texte = typeof o.texte === "string" ? o.texte.trim().slice(0, LONGUEUR_MAX_MENTION) : "";
    out[pays] = { active: o.active === true, texte };
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════
//  La résolution
// ══════════════════════════════════════════════════════════════════════

/** Pourquoi aucune mention n'est portée. Jamais silencieux. */
export type MotifAbsence =
  | "pays_inconnu"        // l'entité n'a pas de pays exploitable
  | "pays_non_active"      // aucune activation, ni pour la société ni pour le pays
  | "societe_non_activee"  // la société est configurée, mais pas pour ce pays
  | "hors_prestation";     // l'intervention n'emploie pas de produits

export const MOTIF_ABSENCE_LABEL: Record<MotifAbsence, string> = {
  pays_inconnu: "pays de la société émettrice absent ou non reconnu",
  pays_non_active: "mention non activée pour cette société ni pour son pays, dans Réglages › Intégrations",
  societe_non_activee: "mention non activée pour cette société émettrice, dans Réglages › Intégrations",
  hors_prestation: "intervention sans produits d'entretien",
};

export type ResolutionMention =
  | { mention: string; pays: Country }
  | { mention: null; motif: MotifAbsence; pays: Country | null };

/** Le pays est-il l'un des cinq que le CRM connaît ? */
export function paysReconnu(brut: string | null | undefined): Country | null {
  const p = (brut ?? "").trim().toUpperCase();
  return (COUNTRIES as string[]).includes(p) ? (p as Country) : null;
}

/**
 * Mention à porter au devis, d'après le pays de l'entité émettrice.
 *
 * ⚠️ UN PAYS ABSENT OU INCONNU NE PRODUIT JAMAIS DE MENTION PAR DÉFAUT, et
 * surtout jamais la mention française. Le client l'a exigé : « ne jamais
 * appliquer la mention française à une société étrangère » et « en cas
 * d'absence ou d'incohérence du pays, signaler le problème et ne pas
 * inventer de mention ». Le motif remonte jusqu'à l'écran.
 */
export function resoudreMention(
  paysEntite: string | null | undefined,
  reglages: ReglagesMentions,
  emploieDesProduits = true,
): ResolutionMention {
  const pays = paysReconnu(paysEntite);
  if (!pays) return { mention: null, motif: "pays_inconnu", pays: null };
  if (!emploieDesProduits) return { mention: null, motif: "hors_prestation", pays };

  const r = reglages[pays] ?? REGLAGE_FERME;
  if (!r.active) return { mention: null, motif: "pays_non_active", pays };

  // Texte vide = la formulation de référence du pays. Le Super Admin n'a pas
  // à recopier la phrase validée pour l'activer.
  return { mention: r.texte || MENTION_PAR_PAYS[pays], pays };
}

// ══════════════════════════════════════════════════════════════════════
//  La résolution PAR SOCIÉTÉ (2026-11-08)
// ══════════════════════════════════════════════════════════════════════

/** D'où vient l'activation qui a produit la mention. */
export type OrigineMention =
  | "societe"       // la société a explicitement assumé l'allégation
  | "pays_herite";  // repli sur l'ancien réglage par pays — à confirmer

export type ResolutionMentionSociete =
  | { mention: string; pays: Country; origine: OrigineMention }
  | { mention: null; motif: MotifAbsence; pays: Country | null };

/** Lecture de la couche société, sous la clé réservée `societes`. */
export function lireReglagesParSociete(brut: unknown): ReglagesParSociete {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const racine = (brut as Record<string, unknown>)[CLE_SOCIETES];
  if (!racine || typeof racine !== "object" || Array.isArray(racine)) return {};

  const out: ReglagesParSociete = {};
  for (const [entityId, v] of Object.entries(racine as Record<string, unknown>)) {
    // Un identifiant vide ne désigne aucune société : on ne devine pas.
    if (!entityId.trim()) continue;
    const parPays = lireReglages(v);
    if (Object.keys(parPays).length > 0) out[entityId] = parPays;
  }
  return out;
}

/**
 * Mention à porter au devis, d'après la SOCIÉTÉ ÉMETTRICE et son pays.
 *
 * Ordre de résolution, et il est volontaire :
 *
 *   1. la société a assumé l'allégation pour son pays → on la porte ;
 *   2. sinon, l'ancien réglage par pays est actif → on la porte QUAND MÊME,
 *      mais marquée `pays_herite`. C'est ce qui évite d'éteindre d'un coup
 *      ce qui fonctionne aujourd'hui ;
 *   3. sinon, aucune mention, avec le motif.
 *
 * ⚠️ Comme pour `resoudreMention`, un pays absent ou inconnu ne produit
 * JAMAIS de mention — et surtout jamais la française.
 */
export function resoudreMentionPourSociete(
  paysEntite: string | null | undefined,
  entityId: string | null | undefined,
  parSociete: ReglagesParSociete,
  parPays: ReglagesMentions,
  emploieDesProduits = true,
): ResolutionMentionSociete {
  const pays = paysReconnu(paysEntite);
  if (!pays) return { mention: null, motif: "pays_inconnu", pays: null };
  if (!emploieDesProduits) return { mention: null, motif: "hors_prestation", pays };

  // 1. La société, explicitement.
  const propre = entityId ? parSociete[entityId]?.[pays] : undefined;
  if (propre?.active) {
    return { mention: propre.texte || MENTION_PAR_PAYS[pays], pays, origine: "societe" };
  }

  // 2. Le repli par pays, signalé.
  const herite = parPays[pays];
  if (herite?.active) {
    return { mention: herite.texte || MENTION_PAR_PAYS[pays], pays, origine: "pays_herite" };
  }

  // 3. Rien, et on dit laquelle des deux couches manque.
  const societeConnue = Boolean(entityId && parSociete[entityId]);
  return {
    mention: null,
    motif: societeConnue ? "societe_non_activee" : "pays_non_active",
    pays,
  };
}

/** Formulation effective d'un pays, pour l'écran de réglages. */
export function formulationEffective(pays: Country, reglages: ReglagesMentions): string {
  return (reglages[pays]?.texte || MENTION_PAR_PAYS[pays]);
}

// ══════════════════════════════════════════════════════════════════════
//  Contrôle de saisie
// ══════════════════════════════════════════════════════════════════════

export type ControleMention =
  | { ok: false; motif: string }
  | { ok: true; avertissement: string | null };

const ALLEGATIONS: { re: RegExp; quoi: string }[] = [
  { re: /\b100\s*%\s*fran[çc]ais/i, quoi: "une origine française" },
  { re: /\bfabriqu[ée]s?\s+en\s+France\b/i, quoi: "une fabrication française" },
  { re: /\b[ée]coresponsables?\b/i, quoi: "un caractère écoresponsable" },
  { re: /\b[ée]cologiques?\b/i, quoi: "un caractère écologique" },
  { re: /\bbiod[ée]gradables?\b/i, quoi: "une biodégradabilité" },
  { re: /\bcertifi[ée]s?\b|\bnorme\b|\blabel\b|\becolabel\b/i, quoi: "une conformité ou une certification" },
  { re: /\bnaturels?\b|\bbio\b/i, quoi: "un caractère naturel" },
  { re: /\bconformes?\b/i, quoi: "une conformité réglementaire" },
];

/**
 * Contrôle d'une formulation à la saisie.
 *
 * Il ne juge PAS la véracité — aucun code ne peut vérifier qu'un produit est
 * français. Il refuse le vide et la longueur excessive, et il AVERTIT sur
 * toute allégation : c'est exactement la phrase qui a causé le problème
 * d'origine, et le Super Admin doit la lire avant de l'assumer.
 */
export function controlerMention(texte: unknown): ControleMention {
  const t = typeof texte === "string" ? texte.trim() : "";
  if (!t) return { ok: false, motif: "Texte vide : désactivez le pays pour n'afficher aucune mention." };
  if (t.length > LONGUEUR_MAX_MENTION) {
    return {
      ok: false,
      motif: `${t.length} caractères : une mention se limite à ${LONGUEUR_MAX_MENTION}. `
        + "Au-delà, ce n'est plus une mention mais un argumentaire commercial.",
    };
  }
  const trouvees = [...new Set(ALLEGATIONS.filter((a) => a.re.test(t)).map((a) => a.quoi))];
  if (trouvees.length) {
    return {
      ok: true,
      avertissement:
        `Cette mention affirme ${trouvees.join(", ")}. Elle engage la société sur `
        + "chaque devis où elle figure : ne l'activez que si les produits "
        + "réellement employés le justifient, pièces à l'appui.",
    };
  }
  return { ok: true, avertissement: null };
}

/** Libellé d'un pays, réexporté pour les écrans. */
export { COUNTRY_LABEL, COUNTRIES };
