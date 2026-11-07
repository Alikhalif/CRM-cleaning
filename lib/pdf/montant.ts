// Montants dans les PDF : l'espace fine insécable n'y survit pas.
//
// ── LE DÉFAUT ────────────────────────────────────────────────────────
//
// `formatEUR` s'appuie sur `Intl.NumberFormat("fr-FR")`, qui sépare les
// milliers par une ESPACE FINE INSÉCABLE (U+202F) et précède le symbole € par
// une espace insécable (U+00A0). C'est la typographie française correcte, et
// le navigateur l'affiche parfaitement.
//
// Les polices intégrées de react-pdf — Helvetica et consorts — n'ont pas ces
// deux glyphes. Leur encodage fait tomber U+202F sur la barre oblique :
//
//     4 850,00 €   devient   4/850,00 €
//
// Vérifié le 2026-11-07 par extraction de la couche texte d'un devis rendu :
// le PDF contient bien U+002F. Ce n'est donc pas un artefact d'affichage, le
// client lit réellement « 4/850 € ».
//
// ── POURQUOI CORRIGER ICI, ET PAS DANS `formatEUR` ──────────────────
//
// `formatEUR` sert aussi l'interface, où la typographie fine est juste et
// souhaitable. On ne dégrade pas l'écran pour réparer le PDF : la
// substitution appartient au rendu PDF, et à lui seul.
//
// ⚠️ Ce module ne corrige QUE le séparateur. Il ne reformate pas, n'arrondit
// pas et ne change pas la devise : un montant faux vaut pire qu'un montant
// mal espacé.

import { formatEUR } from "@/lib/leads";

/** Espaces que les polices intégrées du PDF ne savent pas rendre. */
const ESPACES_FINES = /[   ]/g;

/**
 * Montant en euros, lisible dans un PDF.
 *
 * Même valeur que `formatEUR`, avec les espaces insécables remplacées par
 * des espaces ordinaires. La séparation des milliers reste visible : on perd
 * l'insécabilité, pas la lisibilité.
 */
export function euroPdf(montant: number): string {
  return formatEUR(montant).replace(ESPACES_FINES, " ");
}

/**
 * Même substitution sur un texte déjà composé.
 *
 * Sert pour les libellés qui portent un montant interpolé ailleurs que par
 * `euroPdf` — une mention légale, un commentaire de ligne.
 */
export function texteLisiblePdf(texte: string): string {
  return texte.replace(ESPACES_FINES, " ");
}
