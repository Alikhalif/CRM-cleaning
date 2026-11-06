// Mention des produits d'entretien portée par le devis — PUR, aucune I/O.
//
// ── POURQUOI CE MODULE EXISTE (correction C1 du 2026-11-06) ──────────
//
// `analyserNettoyage()` posait `mentionProduits: true` EN DUR. La phrase
// « Intervention réalisée avec des produits de nettoyage 100 % français et
// écoresponsables » s'imprimait donc sur TOUS les devis de TOUTES les
// sociétés du CRM — sept sociétés, cinq pays — sans qu'aucune règle métier ne
// l'autorise et sans que personne puisse la retirer.
//
// C'est une affirmation commerciale sur l'origine et sur le caractère
// environnemental d'un produit. Elle engage l'entreprise qui l'écrit. La
// porter au nom d'une société qui n'utilise pas ces produits est une
// allégation infondée — et, pour une allégation environnementale, le risque
// n'est pas seulement commercial.
//
// ── LA RÈGLE RETENUE : FERMÉ PAR DÉFAUT ─────────────────────────────
//
// Aucune mention n'est écrite tant qu'un Super Admin n'a pas saisi, pour une
// société donnée, le texte qu'elle assume. Le silence est le défaut, parce
// qu'une mention absente ne coûte rien et qu'une mention fausse coûte cher.
//
// ⚠️ CONSÉQUENCE IMMÉDIATE, À CONNAÎTRE : la mention disparaît des devis
// d'OPTIMIVV NETTOYAGE jusqu'à sa saisie dans Réglages › Intégrations. C'est
// voulu — c'est le prix de ne plus affirmer au nom des six autres sociétés.
// Le texte historique est proposé à la saisie (`SUGGESTION_HISTORIQUE`), il
// n'est jamais appliqué tout seul.

/**
 * Mentions par société : `legal_entities.id` → texte assumé.
 *
 * Stocké en `app_settings` sous `devis_mentions_produits`, donc modifiable
 * sans redéploiement et sans migration. Une société absente de la carte, ou
 * dont le texte est vide, n'a pas de mention.
 */
export type MentionsProduits = Record<string, string>;

/**
 * Texte en service jusqu'au 2026-11-06, proposé comme point de départ dans
 * l'écran de saisie.
 *
 * ⚠️ CE N'EST PAS UN DÉFAUT. Il n'est jamais appliqué automatiquement : il
 * s'affiche en suggestion, et il faut un enregistrement explicite pour qu'il
 * figure sur un devis. Toute la correction C1 tient dans cette distinction.
 */
export const SUGGESTION_HISTORIQUE =
  "Intervention réalisée avec des produits de nettoyage 100 % français et "
  + "écoresponsables, adaptés aux surfaces et aux opérations prévues.";

/** Longueur maximale retenue : une mention, pas un paragraphe commercial. */
export const LONGUEUR_MAX_MENTION = 400;

/**
 * Lecture sûre de la carte, telle qu'elle revient de `app_settings` (jsonb).
 *
 * Rien n'est supposé : la valeur peut être nulle, une chaîne, un tableau, ou
 * un objet dont les valeurs ne sont pas des chaînes. Tout ce qui n'est pas
 * une entrée exploitable est ignoré silencieusement — un réglage malformé ne
 * doit pas empêcher d'émettre un devis.
 */
export function lireMentions(brut: unknown): MentionsProduits {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const out: MentionsProduits = {};
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    if (typeof valeur !== "string") continue;
    const t = valeur.trim();
    if (t) out[cle] = t.slice(0, LONGUEUR_MAX_MENTION);
  }
  return out;
}

/**
 * Mention à porter au devis pour cette société, ou `null`.
 *
 * `null` est un résultat normal et fréquent : il signifie « cette société n'a
 * pas déclaré de mention », pas « la lecture a échoué ».
 */
export function resoudreMentionProduits(
  entityId: string | null | undefined,
  mentions: MentionsProduits,
): string | null {
  if (!entityId) return null;
  const t = (mentions[entityId] ?? "").trim();
  return t || null;
}

/**
 * Contrôle d'une mention à la saisie.
 *
 * ── CE QUE CE CONTRÔLE REFUSE, ET POURQUOI ──────────────────────────
 *
 * Il ne juge PAS la véracité de l'affirmation — c'est à la société de
 * l'assumer, et aucun code ne peut vérifier qu'un produit est français. Il
 * refuse deux choses :
 *
 *   • un texte vide ou fait d'espaces, qui laisserait croire à une mention ;
 *   • un texte trop long, qui n'est plus une mention mais un argumentaire.
 *
 * Et il AVERTIT, sans bloquer, quand le texte avance une allégation
 * environnementale ou d'origine : le Super Admin doit lire cet avertissement
 * et confirmer, parce que c'est exactement la phrase qui a causé le problème.
 */
export type ControleMention =
  | { ok: false; motif: string }
  | { ok: true; avertissement: string | null };

const ALLEGATIONS: { re: RegExp; quoi: string }[] = [
  { re: /\b100\s*%\s*fran[çc]ais/i, quoi: "une origine française" },
  { re: /\bfabriqu[ée]s?\s+en\s+France\b/i, quoi: "une fabrication française" },
  { re: /\b[ée]coresponsables?\b/i, quoi: "un caractère écoresponsable" },
  { re: /\b[ée]cologiques?\b/i, quoi: "un caractère écologique" },
  { re: /\bbiod[ée]gradables?\b/i, quoi: "une biodégradabilité" },
  { re: /\bcertifi[ée]s?\b|\bnorme\b|\blabel\b|\becolabel\b/i, quoi: "une certification" },
  { re: /\bnaturels?\b|\bbio\b/i, quoi: "un caractère naturel" },
];

export function controlerMention(texte: unknown): ControleMention {
  const t = typeof texte === "string" ? texte.trim() : "";
  if (!t) return { ok: false, motif: "Texte vide : laissez le champ vide pour n'afficher aucune mention." };
  if (t.length > LONGUEUR_MAX_MENTION) {
    return {
      ok: false,
      motif: `${t.length} caractères : une mention se limite à ${LONGUEUR_MAX_MENTION}. `
        + "Au-delà, ce n'est plus une mention mais un argumentaire commercial.",
    };
  }
  const trouvees = ALLEGATIONS.filter((a) => a.re.test(t)).map((a) => a.quoi);
  if (trouvees.length) {
    return {
      ok: true,
      avertissement:
        `Cette mention affirme ${trouvees.join(", ")}. Elle engage la société sur `
        + "chaque devis où elle figure : ne l'enregistrez que si les produits "
        + "réellement employés le justifient, pièces à l'appui.",
    };
  }
  return { ok: true, avertissement: null };
}
