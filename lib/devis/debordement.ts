// Que faire d'un descriptif qui ne tient pas dans l'encadré du gabarit ?
//
// ── POURQUOI CETTE DÉCISION EST SORTIE DES MOTEURS DE RENDU ──────────
//
// Elle y était écrite deux fois — cinq lignes pour le gabarit nettoyage, neuf
// pour le gabarit déménagement — à l'intérieur de fonctions qui ouvrent des
// fichiers, embarquent des polices et produisent des octets. Impossible à
// tester sans rendre un PDF.
//
// Le test par mutation l'a montré : on pouvait remettre la troncature
// silencieuse sans qu'aucun contrôle ne bronche, parce que les contrôles
// cherchaient des CHAÎNES dans le code au lieu d'éprouver un COMPORTEMENT.
// Un contrôle qui ne sait pas échouer ne prouve rien.
//
// La décision vit donc ici : pure, sans I/O, éprouvable en trois lignes.
//
// ── CE QUI EST EN JEU ────────────────────────────────────────────────
//
// Le moteur de rédaction produit PRESTATION / DÉTAIL / RÉSERVES, soit
// quarante à soixante lignes. Un encadré qui en imprime cinq et jette le
// reste EN SILENCE supprime toutes les réserves du devis — la clause de
// réévaluation, les exclusions, les éléments non signalés. Un devis amputé
// de ses réserves n'oppose plus rien au client.

export type Repartition = {
  /** Lignes à imprimer dans l'encadré du gabarit. */
  encadre: string[];
  /** Vrai si un renvoi doit être posé et des pages de suite ajoutées. */
  deborde: boolean;
};

/**
 * Répartit un descriptif entre l'encadré et les pages de suite.
 *
 * Quand tout tient, l'encadré reçoit tout et rien n'est ajouté : le rendu est
 * identique à ce qu'il était. Quand ça déborde, l'encadré reçoit UNE LIGNE DE
 * MOINS que sa capacité — la dernière est réservée au renvoi, sans quoi le
 * lecteur ne saurait pas que le document continue.
 *
 * `tientDans` doit valoir au moins 2 : il faut une ligne de texte et une
 * ligne de renvoi. En deçà, on considère que rien ne tient.
 */
export function repartirDescriptif(lignes: string[], tientDans: number): Repartition {
  if (lignes.length === 0) return { encadre: [], deborde: false };
  if (tientDans < 2) return { encadre: [], deborde: true };
  if (lignes.length <= tientDans) return { encadre: lignes, deborde: false };
  return { encadre: lignes.slice(0, tientDans - 1), deborde: true };
}

/** Texte du renvoi, identique sur les deux gabarits. */
export const RENVOI_PAGE_SUITE = "Descriptif détaillé et réserves : voir page 2.";

/**
 * Découpe un texte en pages de `parPage` lignes.
 *
 * Au moins une page, même pour un texte vide : une page de suite annoncée
 * doit exister, sinon le renvoi de la première page pointe sur rien.
 */
export function paginer(lignes: string[], parPage: number): string[][] {
  const n = Math.max(1, parPage);
  if (lignes.length === 0) return [[]];
  const out: string[][] = [];
  for (let i = 0; i < lignes.length; i += n) out.push(lignes.slice(i, i + n));
  return out;
}

/**
 * Cette ligne est-elle un intertitre du moteur de rédaction ?
 *
 * Les intertitres — « PRESTATION », « RÉSERVES », « 1. Nettoyage… » — se
 * reconnaissent sans analyser le texte : ils n'ont pas de puce, et ils sont
 * soit entièrement en capitales, soit numérotés.
 */
export function estIntertitre(ligne: string): boolean {
  return /^(?:[A-ZÀ-Ý][A-ZÀ-Ý\s'’]{3,}|\d+\.\s)/.test(ligne);
}
