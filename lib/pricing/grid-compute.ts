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

import {
  calculerVitrerie, paramsVitrerieDepuis,
  type ResultatVitrerie, type SaisieVitrerie,
} from "./vitrerie";
import { computeBibliotheque } from "./grid-bibliotheque";
import type { Grid, GridLine, GridSection, PricingGrid } from "./grid-types";

export type GridInput = {
  // Valeur de la tranche volume/surface (m³ ou m²).
  quantity: number | null;
  // Nombre de pièces (nettoyage). null = non renseigné : on le signale,
  // on ne bloque pas le chiffrage pour autant.
  pieces: number | null;
  // Surface EXTÉRIEURE en m², chiffrée à part. Le tarif intérieur ne
  // s'applique jamais à une terrasse (consigne client).
  exteriorQuantity: number | null;
  distanceKm: number | null;
  // Étages SANS ascenseur, départ et arrivée comptés séparément : le CDC
  // demande explicitement de tenir compte des deux.
  floorsDepart: number;
  floorsArrivee: number;
  // Clés cochées, toutes sections d'options confondues.
  options: string[];
  // Clés de majorations à appliquer.
  majorations: string[];
  // Quantités nommées, pour les options au prix unitaire de la bibliothèque
  // tarifaire (« surface à désinfecter », « surface extérieure »…). Absente =
  // le moteur retombe sur la quantité principale.
  quantites?: Record<string, number>;
  // Vitrerie saisie dans la découverte. Absente = aucun supplément, et le
  // prix du nettoyage sort du moteur strictement inchangé.
  vitrerie?: SaisieVitrerie;
};

// `key` : la clé de la ligne de grille retenue. Elle permet à l'argumentaire
// commercial de relier une justification à un élément RÉELLEMENT chiffré, et
// d'éviter de le répéter s'il est aussi présent dans la découverte.
export type GridResultLine = { section: GridSection; key: string; label: string; min: number; max: number };

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
      majorations: { key: string; label: string; minPct: number; maxPct: number }[];
      // Données absentes qui dégradent la fiabilité sans bloquer.
      assumptions: string[];
      vatRate: number | null;
      // Supplément vitrerie, quand des vitrages ont été saisis. Le détail est
      // conservé pour l'argumentaire : le commercial doit pouvoir expliquer
      // d'où vient la majoration.
      vitrerie?: ResultatVitrerie;
      // Prix du nettoyage AVANT supplément — ce que le barème a calculé seul.
      conseilleHorsVitrerie?: number;
    }
  | {
      ok: false;
      // `diffusion` : le barème existe et est publié, mais le Super Admin ne
      // l'a pas ouvert à ce rôle. Distinct de « vide », qui signifie qu'aucune
      // ligne ne s'applique — confondre les deux rend le diagnostic impossible.
      reason: "brouillon" | "vide" | "manquant" | "validation" | "diffusion";
      missing: string[];
    };

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

/**
 * Prix conseillé, supplément vitrerie compris.
 *
 * Le barème de nettoyage tourne d'abord, exactement comme avant : la fonction
 * ci-dessous ne le touche pas, elle ajoute par-dessus. C'est la garantie
 * demandée — « le calcul initial du nettoyage doit rester strictement
 * inchangé ».
 */
export function computeGrid(g: PricingGrid | null, input: GridInput): GridResult {
  const base = calculerBareme(g, input);
  if (!base.ok || !input.vitrerie) return base;

  const params = paramsVitrerieDepuis(g?.grid);
  const v = calculerVitrerie(base.conseille, input.vitrerie, params);
  if (!v) return base;

  // La fourchette suit la même majoration, pour rester cohérente avec le
  // prix conseillé : annoncer 1 350 EUR dans une fourchette qui s'arrête à
  // 1 100 EUR n'aurait aucun sens au téléphone.
  const majorer = (n: number) => n + Math.round((n * v.pct) / 100);
  return {
    ...base,
    conseilleHorsVitrerie: base.conseille,
    conseille: base.conseille + v.supplement,
    min: majorer(base.min),
    max: majorer(base.max),
    vitrerie: v,
    assumptions: [...base.assumptions, ...v.alertes],
  };
}

function calculerBareme(g: PricingGrid | null, input: GridInput): GridResult {
  if (!g) return { ok: false, reason: "vide", missing: [] };
  // Diffusion fermée : aucun calcul, et surtout aucun montant transmis.
  if (g.nonDiffusee) return { ok: false, reason: "diffusion", missing: [] };
  // Une grille non publiée n'est JAMAIS utilisée, quelles que soient les autres
  // options : c'est la garantie demandée par le client.
  if (g.status !== "active") return { ok: false, reason: "brouillon", missing: [] };

  // Aiguillage : chaque grille porte son mode de calcul. Les grilles déjà
  // configurées restent en « fourchette » et ne changent pas d'un iota.
  if (g.mode === "bibliotheque") return computeBibliotheque(g, input);

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
      else lines.push({ section: "volume", key: l.key, label: l.label, min: l.min ?? 0, max: l.max ?? 0 });
    }
  }

  // ── Nombre de pièces ─────────────────────────────────────
  const pieceLines = grid.pieces ?? [];
  if (pieceLines.length > 0) {
    if (input.pieces == null || input.pieces <= 0) {
      assumptions.push("nombre de pièces non renseigné");
    } else {
      const l = band(pieceLines, input.pieces);
      if (l?.custom) custom.push(l.label);
      else if (l && ((l.min ?? 0) > 0 || (l.max ?? 0) > 0)) {
        lines.push({ section: "pieces", key: l.key, label: l.label, min: l.min ?? 0, max: l.max ?? 0 });
      }
    }
  }

  // ── Surface extérieure : TOUJOURS séparée de l'intérieur ───────────
  // Absence de terrasse = absence de ligne, pas une information manquante.
  const extLines = grid.exterieur ?? [];
  if (extLines.length > 0 && input.exteriorQuantity != null && input.exteriorQuantity > 0) {
    const l = band(extLines, input.exteriorQuantity);
    if (!l) assumptions.push("aucune tranche extérieure ne couvre cette surface");
    else if (l.custom) custom.push(l.label);
    else if ((l.min ?? 0) > 0 || (l.max ?? 0) > 0) {
      lines.push({ section: "exterieur", key: l.key, label: l.label, min: l.min ?? 0, max: l.max ?? 0 });
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
        lines.push({ section: "distance", key: l.key, label: l.label, min: l.min ?? 0, max: l.max ?? 0 });
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
        lines.push({ section: "floors", key: `${l.key}-${ou}`, label: `${l.label} (${ou})`, min: l.min ?? 0, max: l.max ?? 0 });
      }
    }
  }

  // ── Options cumulables ────────────────────────────────────────────────
  // Un Set : une même clé cochée deux fois ne compte qu'une fois.
  const choisies = new Set(input.options);
  const sectionsOptions: GridSection[] = [
    "access", "heavy", "demontage", "emballage", "materiel",
    "postes", "exterieur_options", "complements",
  ];
  for (const section of sectionsOptions) {
    for (const l of grid[section] ?? []) {
      if (!choisies.has(l.key)) continue;
      if (l.custom) { custom.push(l.label); continue; }
      if ((l.min ?? 0) > 0 || (l.max ?? 0) > 0) {
        lines.push({ section, key: l.key, label: l.label, min: l.min ?? 0, max: l.max ?? 0 });
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
  const majApplied: { key: string; label: string; minPct: number; maxPct: number }[] = [];
  let minPctTotal = 0;
  let maxPctTotal = 0;
  for (const l of grid.majorations ?? []) {
    if (!majChoisies.has(l.key)) continue;
    const a = l.minPct ?? 0;
    const b = l.maxPct ?? 0;
    if (a === 0 && b === 0) continue;
    majApplied.push({ key: l.key, label: l.label, minPct: a, maxPct: b });
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

  // Garde-fou : une grille dont toutes les lignes sont à zéro produisait un
  // « prix conseillé : 0 € », qu'un commercial pouvait annoncer tel quel.
  // Zéro n'est pas un tarif, c'est une grille non remplie — on le dit.
  if (conseille <= 0 && max <= 0) return { ok: false, reason: "vide", missing: [] };

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
  diffusion: "Barème non diffusé à votre rôle — à ouvrir par le Super Admin.",
  vide: "Aucun barème configuré pour cette activité.",
  manquant: "Calcul impossible, il manque :",
  validation: "Validation tarifaire du super administrateur nécessaire :",
};
