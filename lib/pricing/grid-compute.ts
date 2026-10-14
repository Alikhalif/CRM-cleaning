// Moteur de calcul des grilles tarifaires — PUR, aucune I/O.
//
// Principe : on additionne SÉPARÉMENT les minimums et les maximums de chaque
// ligne retenue, ce qui donne la fourchette. Le prix conseillé se place ensuite
// à `positioningPct` % de l'intervalle — 75 % par défaut, donc plutôt haut.
//
// Trois règles non négociables :
//   • Une grille en BROUILLON ne produit jamais de prix.
//   • Une ligne « calcul personnalisé » arrête le chiffrage et demande une
//     validation du Super Admin, au lieu d'extrapoler.
//   • Une difficulté n'est comptée qu'UNE fois, même si plusieurs champs de la
//     découverte la désignent (pas de double majoration).

import type { Grid, GridLine, GridSection, PricingGrid } from "./grid-types";

export type GridInput = {
  // Valeur de la tranche volume/surface (m³ ou m²).
  quantity: number | null;
  distanceKm: number | null;
  // Étages SANS ascenseur, départ et arrivée comptés séparément : le CDC
  // demande explicitement de tenir compte des deux.
  floorsDepart: number;
  floorsArrivee: number;
  // Clés cochées, toutes sections d'options confondues.
  options: string[];
  // Clés de majorations à appliquer.
  majorations: string[];
};

export type GridResultLine = { section: GridSection; label: string; min: number; max: number };

export type GridResult =
  | {
      ok: true;
      min: number;
      max: number;
      // Prix conseillé à annoncer, arrondi commercialement.
      conseille: number;
      lines: GridResultLine[];
      // Majorations appliquées, en % — affichées à part car elles portent sur
      // le sous-total et non sur une ligne.
      majorations: { label: string; minPct: number; maxPct: number }[];
      // Données absentes qui dégradent la fiabilité sans bloquer.
      assumptions: string[];
      vatRate: number | null;
    }
  | { ok: false; reason: "brouillon" | "vide" | "manquant" | "validation"; missing: string[] };

const band = (lines: GridLine[] | undefined, value: number): GridLine | null => {
  for (const l of lines ?? []) {
    const from = l.from ?? 0;
    const to = l.to ?? Number.POSITIVE_INFINITY;
    if (value >= from && value <= to) return l;
  }
  return null;
};

// Arrondi commercial : 2 847 € → 2 850 € avec un pas de 50.
const arrondir = (n: number, pas: number): number => (pas > 0 ? Math.round(n / pas) * pas : Math.round(n));

export function computeGrid(g: PricingGrid | null, input: GridInput): GridResult {
  if (!g) return { ok: false, reason: "vide", missing: [] };
  // Une grille non publiée n'est JAMAIS utilisée, quelles que soient les autres
  // options : c'est la garantie demandée par le client.
  if (g.status !== "active") return { ok: false, reason: "brouillon", missing: [] };

  const grid: Grid = g.grid ?? {};
  const lines: GridResultLine[] = [];
  const missing: string[] = [];
  const assumptions: string[] = [];
  const custom: string[] = [];

  // ── Tranche de volume / surface : socle du prix ───────────────────────
  const volumeLines = grid.volume ?? [];
  if (volumeLines.length > 0) {
    if (input.quantity == null || input.quantity <= 0) {
      missing.push("le volume (ou la surface)");
    } else {
      const l = band(volumeLines, input.quantity);
      if (!l) missing.push("une tranche de volume couvrant cette valeur");
      else if (l.custom) custom.push(l.label);
      else lines.push({ section: "volume", label: l.label, min: l.min ?? 0, max: l.max ?? 0 });
    }
  }

  // ── Distance ──────────────────────────────────────────────────────────
  const distLines = grid.distance ?? [];
  if (distLines.length > 0) {
    if (input.distanceKm == null) {
      assumptions.push("distance non renseignée — trajet compté comme local");
    } else {
      const l = band(distLines, input.distanceKm);
      if (l?.custom) custom.push(l.label);
      else if (l && ((l.min ?? 0) > 0 || (l.max ?? 0) > 0)) {
        lines.push({ section: "distance", label: l.label, min: l.min ?? 0, max: l.max ?? 0 });
      }
    }
  }

  // ── Étages : départ ET arrivée, comptés séparément ────────────────────
  const floorLines = grid.floors ?? [];
  for (const [etage, ou] of [[input.floorsDepart, "départ"], [input.floorsArrivee, "arrivée"]] as const) {
    if (etage > 0 && floorLines.length > 0) {
      const l = band(floorLines, etage);
      if (l?.custom) custom.push(`${l.label} (${ou})`);
      else if (l && ((l.min ?? 0) > 0 || (l.max ?? 0) > 0)) {
        lines.push({ section: "floors", label: `${l.label} (${ou})`, min: l.min ?? 0, max: l.max ?? 0 });
      }
    }
  }

  // ── Options cumulables ────────────────────────────────────────────────
  // Un Set : une même clé cochée deux fois ne compte qu'une fois.
  const choisies = new Set(input.options);
  const sectionsOptions: GridSection[] = ["access", "heavy", "demontage", "emballage", "materiel"];
  for (const section of sectionsOptions) {
    for (const l of grid[section] ?? []) {
      if (!choisies.has(l.key)) continue;
      if (l.custom) { custom.push(l.label); continue; }
      if ((l.min ?? 0) > 0 || (l.max ?? 0) > 0) {
        lines.push({ section, label: l.label, min: l.min ?? 0, max: l.max ?? 0 });
      }
    }
  }

  // Une ligne « calcul personnalisé » retenue → on ne chiffre pas.
  if (custom.length > 0) return { ok: false, reason: "validation", missing: custom };
  if (missing.length > 0) return { ok: false, reason: "manquant", missing };
  if (lines.length === 0) return { ok: false, reason: "vide", missing: [] };

  let min = lines.reduce((s, l) => s + l.min, 0);
  let max = lines.reduce((s, l) => s + l.max, 0);

  // ── Majorations, en % du sous-total, chacune une seule fois ───────────
  const majChoisies = new Set(input.majorations);
  const majApplied: { label: string; minPct: number; maxPct: number }[] = [];
  let minPctTotal = 0;
  let maxPctTotal = 0;
  for (const l of grid.majorations ?? []) {
    if (!majChoisies.has(l.key)) continue;
    const a = l.minPct ?? 0;
    const b = l.maxPct ?? 0;
    if (a === 0 && b === 0) continue;
    majApplied.push({ label: l.label, minPct: a, maxPct: b });
    minPctTotal += a;
    maxPctTotal += b;
  }
  min *= 1 + minPctTotal / 100;
  max *= 1 + maxPctTotal / 100;

  // ── Plancher ──────────────────────────────────────────────────────────
  if (g.floorPrice > 0 && min < g.floorPrice) {
    assumptions.push(`plancher de ${g.floorPrice} € appliqué`);
    min = g.floorPrice;
    if (max < min) max = min;
  }

  // ── Prix conseillé : positionné dans la fourchette ────────────────────
  const pos = Math.min(100, Math.max(0, g.positioningPct)) / 100;
  const conseille = arrondir(min + (max - min) * pos, g.rounding);

  return {
    ok: true,
    min: arrondir(min, g.rounding),
    max: arrondir(max, g.rounding),
    conseille,
    lines,
    majorations: majApplied,
    assumptions,
    vatRate: g.vatRate,
  };
}

export const REASON_LABEL: Record<Exclude<GridResult & { ok: false }, { ok: true }>["reason"], string> = {
  brouillon: "Grille en brouillon — non publiée par l'administrateur.",
  vide: "Aucun barème configuré pour cette activité.",
  manquant: "Calcul impossible, il manque :",
  validation: "Validation tarifaire du super administrateur nécessaire :",
};
