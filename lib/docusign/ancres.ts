// Chaînes d'ancrage de la signature électronique — PUR.
//
// Référence UNIQUE, partagée entre deux endroits qui doivent absolument
// s'accorder : le rendu du PDF (`lib/pdf/SousTraitancePdf.tsx`), qui écrit
// ces jetons, et la création de l'enveloppe DocuSign, qui les cherche. Si les
// deux divergeaient, DocuSign ne trouverait aucune ancre et refuserait
// l'enveloppe — ou, pire, la créerait sans champ de signature.
//
// Pourquoi des jetons plutôt que du texte existant : « Le Sous-traitant »
// revient des dizaines de fois dans les articles, et DocuSign pose un champ à
// CHAQUE occurrence d'une ancre. Un contrat se retrouverait criblé de cases à
// signer. Ces jetons, eux, n'apparaissent qu'une fois, à l'endroit voulu.
//
// Ils sont écrits à la couleur du papier : invisibles à la lecture comme à
// l'impression. Ils n'ajoutent pas un mot au contenu contractuel.

/** Emplacement de la signature de l'entité émettrice. */
export const ANCRE_DONNEUR_ORDRE = "\sDO\\";

/** Emplacement de la signature du prestataire. */
export const ANCRE_SOUS_TRAITANT = "\sST\\";

/**
 * Décalage des champs par rapport à l'ancre, en pixels.
 *
 * L'ancre est posée juste au-dessus du trait de signature ; le champ se place
 * donc légèrement en dessous, sur le trait, et non par-dessus le jeton.
 */
export const DECALAGE_ANCRE = { x: 0, y: 8 } as const;
