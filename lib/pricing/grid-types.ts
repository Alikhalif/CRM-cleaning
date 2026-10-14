// Modèle de la grille tarifaire — PUR, partagé serveur et client.
//
// Une grille = des sections, chaque section = une liste de lignes portant une
// fourchette (min/max en €, ou minPct/maxPct pour les majorations). Les
// sections à tranches (volume, distance, étages) portent en plus `from`/`to`.
//
// Volontairement générique : chaque activité a ses propres unités (m³, m²,
// heures, passages) et le Super Admin doit pouvoir ajouter une ligne sans
// migration.

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
};

export type GridSection =
  | "volume" | "distance" | "floors"
  | "access" | "heavy" | "demontage" | "emballage" | "materiel"
  | "majorations";

export const SECTION_LABEL: Record<GridSection, string> = {
  volume: "Volume / surface",
  distance: "Distance",
  floors: "Étages sans ascenseur",
  access: "Difficultés d'accès",
  heavy: "Objets lourds et fragiles",
  demontage: "Démontage / remontage",
  emballage: "Emballage et protection",
  materiel: "Matériel et moyens",
  majorations: "Majorations (%)",
};

// Sections à TRANCHES : une seule ligne s'applique, celle qui contient la
// valeur. Les autres sont des listes d'options cumulables.
export const BAND_SECTIONS: GridSection[] = ["volume", "distance", "floors"];

export const SECTIONS: GridSection[] = [
  "volume", "distance", "floors", "access", "heavy",
  "demontage", "emballage", "materiel", "majorations",
];

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
      if ((l.min ?? 0) > 0 || (l.max ?? 0) > 0 || (l.minPct ?? 0) > 0 || (l.maxPct ?? 0) > 0) n += 1;
    }
  }
  return n;
}

export function countLines(grid: Grid): number {
  return SECTIONS.reduce((n, s) => n + (grid[s]?.length ?? 0), 0);
}
