// Modèle de la grille tarifaire — PUR, partagé serveur et client.
//
// Une grille = des sections, chaque section = une liste de lignes portant une
// fourchette (min/max en €, ou minPct/maxPct pour les majorations). Les
// sections à tranches (volume, distance, étages) portent en plus `from`/`to`.
//
// Volontairement générique : chaque activité a ses propres unités (m³, m²,
// heures, passages) et le Super Admin doit pouvoir ajouter une ligne sans
// migration.

import { estFamilleNettoyage } from "@/lib/discovery-nettoyage";

// D'où vient la quantité qui multiplie un prix unitaire. Une option au m²
// ne porte pas forcément sur la surface du logement : une terrasse se facture
// sur SA surface, une désinfection partielle sur la sienne.
export type QuantiteSource =
  | "surface" | "volume" | "exterieur" | "distance" | "desinfection" | "etages"
  | "unites" | "heures" | "vitrerie";

export const QUANTITE_LABEL: Record<QuantiteSource, string> = {
  surface: "Surface intérieure",
  volume: "Volume",
  exterieur: "Surface extérieure",
  distance: "Distance",
  desinfection: "Surface à désinfecter",
  etages: "Nombre d'étages",
  unites: "Nombre d'unités (volets, pièces…)",
  heures: "Nombre d'heures",
  vitrerie: "Surface de vitrage",
};

export type Unite = "m2" | "m3" | "km" | "h" | "u";

export const UNITE_LABEL: Record<Unite, string> = {
  m2: "€/m²", m3: "€/m³", km: "€/km", h: "€/heure", u: "€/unité",
};

export type GridLine = {
  key: string;
  label: string;
  // Tranches : borne basse incluse, borne haute incluse. `to: null` = ouvert.
  from?: number;
  to?: number | null;
  min?: number;
  max?: number;
  // Majorations : en pourcentage du sous-total.
  minPct?: number;
  maxPct?: number;
  // « Calcul personnalisé » : le moteur REFUSE de chiffrer et demande une
  // validation, au lieu d'extrapoler un montant.
  custom?: boolean;

  // ── Mode « bibliothèque » ─────────────────────────────────────────────
  // Prix unitaire multiplié par une quantité : 11,50 €/m² × 80 m².
  prixUnitaire?: number;
  unite?: Unite;
  source?: QuantiteSource;
  // Coefficient MULTIPLICATEUR (état du logement, difficulté). 1 = neutre.
  coef?: number;
  // Forfait PLANCHER. Jamais additionné : on retient le maximum entre le
  // calcul et ce montant.
  forfaitMin?: number;
  // Ratio d'estimation d'une quantité à partir d'une autre (0,50 m³/m²).
  ratio?: number;
};

export type GridSection =
  | "volume" | "pieces" | "distance" | "floors"
  | "access" | "heavy" | "demontage" | "emballage" | "materiel"
  | "postes" | "exterieur" | "exterieur_options" | "complements"
  | "majorations"
  // ── Sections de la bibliothèque tarifaire ───────────────────────────
  | "base" | "minimums" | "coefficients" | "ratios" | "matrice_m3" | "kilometrique";

export const SECTION_LABEL: Record<GridSection, string> = {
  volume: "Volume / surface",
  pieces: "Nombre de pièces",
  distance: "Distance",
  floors: "Étages sans ascenseur",
  access: "Difficultés d'accès",
  heavy: "Objets lourds et fragiles",
  demontage: "Démontage / remontage",
  emballage: "Emballage et protection",
  materiel: "Matériel et moyens",
  postes: "Postes de nettoyage (intérieur)",
  exterieur: "Surface extérieure",
  exterieur_options: "Extérieur — revêtement et état",
  complements: "Prestations complémentaires",
  majorations: "Majorations (%)",
  base: "Tarifs de référence (par prestation)",
  minimums: "Forfaits minimums",
  coefficients: "Coefficients de difficulté",
  ratios: "Ratios d'estimation",
  matrice_m3: "Matrice volume × distance",
  kilometrique: "Tarif kilométrique",
};

// Sections à TRANCHES : une seule ligne s'applique, celle qui contient la
// valeur. Les autres sont des listes d'options cumulables.
export const BAND_SECTIONS: GridSection[] = ["volume", "pieces", "distance", "floors", "exterieur"];

export const SECTIONS: GridSection[] = [
  "base", "minimums", "coefficients", "ratios", "matrice_m3", "kilometrique",
  "volume", "pieces", "distance", "floors", "access", "heavy",
  "demontage", "emballage", "materiel",
  "postes", "exterieur", "exterieur_options", "complements",
  "majorations",
];

// Sections propres au mode « bibliothèque ». Elles n'apparaissent dans
// l'éditeur que pour les grilles qui l'utilisent.
export const SECTIONS_BIBLIOTHEQUE: GridSection[] = [
  "base", "minimums", "coefficients", "ratios", "matrice_m3", "kilometrique",
  "postes", "complements", "floors", "access", "majorations",
];

// Deux modes de calcul coexistent, par grille :
//   • fourchette   — modèle d'origine : chaque ligne porte un min et un max en
//                    euros, on additionne, et le prix conseillé se positionne
//                    dans l'intervalle obtenu.
//   • bibliotheque — modèle de la bibliothèque tarifaire : prix unitaire ×
//                    quantité, coefficients, options, forfait plancher, puis
//                    majoration commerciale et fourchette à ± x %.
// Une grille déjà configurée garde son mode : rien n'est réinterprété.
export type GridMode = "fourchette" | "bibliotheque";

export const MODE_LABEL: Record<GridMode, string> = {
  fourchette: "Fourchette par ligne (modèle d'origine)",
  bibliotheque: "Bibliothèque tarifaire (prix unitaire × quantité)",
};

// Toutes les sections n'ont pas de sens pour toutes les activités : on ne
// demande pas à l'administrateur de configurer un « emballage » pour du
// nettoyage, ni des « plafonds » pour un déménagement. L'éditeur n'affiche
// que les sections utiles à la famille de l'activité.
const SECTIONS_NETTOYAGE: GridSection[] = [
  "volume", "pieces", "postes", "exterieur", "exterieur_options",
  "complements", "floors", "access", "majorations",
];
const SECTIONS_TRANSPORT: GridSection[] = [
  "volume", "distance", "floors", "access", "heavy",
  "demontage", "emballage", "materiel", "majorations",
];

export function sectionsFor(activitySlug: string, mode: GridMode = "fourchette"): GridSection[] {
  if (mode === "bibliotheque") {
    // Le déménagement est le seul à utiliser la matrice volume × distance et
    // le tarif kilométrique ; inutile de les proposer ailleurs.
    return activitySlug === "demenagement"
      ? SECTIONS_BIBLIOTHEQUE
      : SECTIONS_BIBLIOTHEQUE.filter((x) => x !== "matrice_m3" && x !== "kilometrique");
  }
  return estFamilleNettoyage(activitySlug) ? SECTIONS_NETTOYAGE : SECTIONS_TRANSPORT;
}

export type Grid = Partial<Record<GridSection, GridLine[]>>;

export type GridStatus = "brouillon" | "active" | "inactive";

export const STATUS_LABEL: Record<GridStatus, string> = {
  brouillon: "Brouillon",
  active: "Active",
  inactive: "Inactive",
};

export type PricingGrid = {
  activityId: string;
  activitySlug: string;
  activityLabel: string;
  status: GridStatus;
  version: number;
  mode: GridMode;
  // Majoration commerciale appliquée UNE SEULE FOIS au prix de marché ajusté.
  majorationPct: number;
  // Demi-largeur de la fourchette annoncée, en % du prix recommandé.
  fourchettePct: number;
  grid: Grid;
  visibleToCommercial: boolean;
  visibleToSubcontractor: boolean;
  allowCommercialOverride: boolean;
  maxDiscountPct: number;
  floorPrice: number;
  positioningPct: number;
  // null = aucun taux configuré → les montants sont annoncés HT et l'interface
  // le dit. On ne suppose aucun taux universel.
  vatRate: number | null;
  rounding: number;
  updatedAt: string | null;
  publishedAt: string | null;
};

// Nombre de lignes réellement chiffrées — sert au compteur « paramètres
// configurés » du tableau de bord. Une ligne à 0/0 ne compte pas : elle existe
// mais n'a pas encore de tarif.
export function countConfigured(grid: Grid): number {
  let n = 0;
  for (const section of SECTIONS) {
    for (const l of grid[section] ?? []) {
      if (
        (l.min ?? 0) > 0 || (l.max ?? 0) > 0 || (l.minPct ?? 0) > 0 || (l.maxPct ?? 0) > 0
        || (l.prixUnitaire ?? 0) > 0 || (l.forfaitMin ?? 0) > 0 || (l.ratio ?? 0) > 0
        // Un coefficient neutre (1) n'est pas « configuré » : il ne change rien.
        || ((l.coef ?? 1) !== 1)
      ) n += 1;
    }
  }
  return n;
}

export function countLines(grid: Grid): number {
  return SECTIONS.reduce((n, s) => n + (grid[s]?.length ?? 0), 0);
}
