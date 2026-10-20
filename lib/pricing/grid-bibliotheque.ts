// Moteur « bibliothèque tarifaire » — PUR, aucune I/O.
//
// Second mode de calcul, à côté du modèle d'origine (grid-compute.ts). Il suit
// l'ordre imposé par le cahier des charges du 2026-10-20 :
//
//    1. activité   2. prestation   3. données de découverte   4. quantité
//    5. prix de base   6. coefficients   7. options   8. frais spécifiques
//    9. forfait minimum   10. prix de marché ajusté   11. majoration
//   12. prix recommandé   13. fourchette
//
// Trois règles qui ne se négocient pas :
//
//   • Le forfait minimum est un PLANCHER, jamais une addition.
//       prix retenu = MAX(prix calculé, forfait minimum)
//   • La majoration commerciale s'applique UNE SEULE FOIS, à la fin.
//   • Aucun prix n'est inventé. Une ligne absente de la grille ne produit
//     rien ; une donnée manquante est signalée, pas devinée.
//
// Le résultat emprunte le type GridResult du moteur d'origine : les écrans de
// découverte et la pop-up d'argumentaire restent strictement inchangés.

import type { GridInput, GridResult, GridResultLine } from "./grid-compute";
import type { Grid, GridLine, PricingGrid, QuantiteSource, Unite } from "./grid-types";

// Arrondi à la dizaine SUPÉRIEURE (§10). Volontairement différent de l'arrondi
// commercial du mode d'origine, qui arrondit au plus proche.
export const arrondirSup = (n: number, pas: number): number =>
  pas > 0 ? Math.ceil(n / pas) * pas : Math.ceil(n);

/**
 * Quantité disponible pour une source donnée, ou null si non renseignée.
 *
 * `unite` sert de garde-fou : un tarif « 12 € l'unité » ou « 60 € l'heure » ne
 * doit JAMAIS retomber sur la surface ou le volume faute de mieux. Sans ce
 * test, douze euros par volet devenaient douze euros du mètre carré — soit
 * 1 200 € pour un logement de 100 m². Mieux vaut ne rien chiffrer et le dire.
 */
function quantite(
  input: GridInput,
  source: QuantiteSource | undefined,
  unite: Unite | undefined,
): number | null {
  const q = input.quantites ?? {};
  switch (source) {
    case "exterieur": return input.exteriorQuantity ?? q.exterieur ?? null;
    case "distance": return input.distanceKm ?? null;
    case "desinfection": return q.desinfection ?? input.quantity ?? null;
    case "etages": return (input.floorsDepart ?? 0) + (input.floorsArrivee ?? 0) || null;
    case "unites": return q.unites ?? null;
    case "vitrerie": return q.vitrerie ?? null;
    case "heures": return q.heures ?? null;
    case "volume":
    case "surface": return input.quantity ?? null;
    default:
      // Aucune source déclarée : on n'accepte le repli que pour les unités de
      // mesure qui correspondent effectivement à la quantité principale.
      return unite === "u" || unite === "h" ? null : input.quantity ?? null;
  }
}

/** Montant d'une ligne : prix unitaire × quantité, ou montant fixe. */
function montantLigne(l: GridLine, input: GridInput): { montant: number; manque: string | null } {
  if ((l.prixUnitaire ?? 0) > 0) {
    const q = quantite(input, l.source, l.unite);
    if (q == null || q <= 0) return { montant: 0, manque: l.label };
    return { montant: l.prixUnitaire! * q, manque: null };
  }
  // Pas de prix unitaire : montant fixe. On accepte `min` comme montant du
  // mode d'origine, ce qui permet de réutiliser une ligne déjà saisie.
  return { montant: l.min ?? 0, manque: null };
}

const ligneRes = (section: GridResultLine["section"], l: GridLine, montant: number): GridResultLine => ({
  section, key: l.key, label: l.label, min: Math.round(montant), max: Math.round(montant),
});

export function computeBibliotheque(g: PricingGrid, input: GridInput): GridResult {
  if (g.status !== "active") return { ok: false, reason: "brouillon", missing: [] };

  const grid: Grid = g.grid ?? {};
  const choisies = new Set(input.options);
  const lines: GridResultLine[] = [];
  const assumptions: string[] = [];
  const custom: string[] = [];
  const missing: string[] = [];

  // ── 4. Quantité applicable ────────────────────────────────────────────
  // Le volume RÉELLEMENT renseigné prime toujours. À défaut seulement, on
  // l'estime à partir de la surface et du ratio d'encombrement (§7.3) — et on
  // le signale, car une estimation n'est pas une mesure.
  const travail: GridInput = { ...input, quantites: { ...(input.quantites ?? {}) } };
  if ((travail.quantity == null || travail.quantity <= 0)) {
    const surface = travail.quantites?.surface ?? null;
    const r = (grid.ratios ?? []).find((l) => choisies.has(l.key) && (l.ratio ?? 0) > 0);
    if (surface != null && surface > 0 && r) {
      const estime = Math.round(surface * r.ratio!);
      travail.quantity = estime;
      travail.quantites!.volume = estime;
      assumptions.push(
        `volume estimé à ${estime} m³ (${surface} m² × ${r.ratio} — ${r.label.toLowerCase()})`,
      );
    }
  }

  // ── 5. Prix de base : la prestation sélectionnée × la quantité ────────
  // Une grille peut n'avoir AUCUNE section `base` : le déménagement se chiffre
  // sur la matrice volume × distance. On ne réclame donc une prestation que si
  // la grille en propose vraiment.
  const base = (grid.base ?? []).find((l) => choisies.has(l.key));
  if (!base) {
    if ((grid.base ?? []).length > 0) {
      missing.push("le type de prestation (aucun tarif de référence ne correspond)");
    }
  } else if (base.custom) {
    custom.push(base.label);
  } else {
    const { montant, manque } = montantLigne(base, travail);
    if (manque) {
      missing.push(base.unite === "m3" ? "le volume" : "la surface");
    } else if (montant > 0) {
      lines.push(ligneRes("base", base, montant));
    }
  }

  // ── 5 bis. Matrice volume × distance (déménagement) ───────────────────
  // Le tarif au m³ dépend de la tranche de distance ET de la formule. La
  // matrice intègre DÉJÀ la distance : le tarif kilométrique n'est donc
  // jamais additionné, il ne sert que de contrôle de cohérence (§8.3).
  const matrice = grid.matrice_m3 ?? [];
  if (matrice.length > 0 && travail.quantity != null && travail.quantity > 0) {
    if (travail.distanceKm == null) {
      assumptions.push("distance non renseignée — tranche la plus courte retenue");
    }
    const km = travail.distanceKm ?? 0;
    const candidates = matrice.filter((l) => {
      const from = l.from ?? 0;
      const to = l.to ?? Number.POSITIVE_INFINITY;
      return km >= from && km <= to;
    });
    // Formule choisie si elle est cochée, « standard » sinon.
    const ligne = candidates.find((l) => choisies.has(l.key))
      ?? candidates.find((l) => l.key.endsWith("_standard"))
      ?? candidates[0];
    if (ligne) {
      if (ligne.custom) custom.push(ligne.label);
      else {
        if (!candidates.some((l) => choisies.has(l.key))) {
          assumptions.push("formule non renseignée — « standard » retenue");
        }
        lines.push(ligneRes("matrice_m3", ligne, (ligne.prixUnitaire ?? 0) * travail.quantity));
      }
    }
  }

  const sousTotalBase = lines.reduce((s, l) => s + l.min, 0);

  // ── 6. Coefficients de difficulté ─────────────────────────────────────
  // MULTIPLICATIFS et dédoublonnés : deux champs qui désignent la même
  // difficulté ne doivent pas majorer deux fois (§5).
  const coefs: { label: string; valeur: number }[] = [];
  const vus = new Set<string>();
  for (const l of grid.coefficients ?? []) {
    if (!choisies.has(l.key) && !travail.majorations.includes(l.key)) continue;
    const famille = l.source ?? l.key; // `source` sert ici de famille de difficulté
    if (vus.has(famille)) continue;
    vus.add(famille);
    const c = l.coef ?? 1;
    if (c !== 1) coefs.push({ label: l.label, valeur: c });
  }
  const coefTotal = coefs.reduce((p, c) => p * c.valeur, 1);
  const apresCoef = sousTotalBase * coefTotal;

  // ── 7. Options, facturées seulement si sélectionnées ──────────────────
  let optionsTotal = 0;
  for (const section of ["postes", "complements"] as const) {
    for (const l of grid[section] ?? []) {
      if (!choisies.has(l.key)) continue;
      if (l.custom) { custom.push(l.label); continue; }
      const { montant, manque } = montantLigne(l, travail);
      if (manque) { assumptions.push(`${l.label} : quantité manquante, non chiffré`); continue; }
      if (montant > 0) {
        lines.push(ligneRes(section, l, montant));
        optionsTotal += montant;
      }
    }
  }

  // ── 8. Frais spécifiques : majorations en % (accès, étages, urgence) ──
  const majApplied: { key: string; label: string; minPct: number; maxPct: number }[] = [];
  let pctTotal = 0;
  for (const l of grid.majorations ?? []) {
    if (!choisies.has(l.key) && !travail.majorations.includes(l.key)) continue;
    const pct = l.minPct ?? 0;
    if (pct === 0) continue;
    majApplied.push({ key: l.key, label: l.label, minPct: pct, maxPct: l.maxPct ?? pct });
    pctTotal += pct;
  }
  // Étages sans ascenseur : une ligne par étage concerné, bornée par la grille.
  for (const l of grid.floors ?? []) {
    const n = (travail.floorsDepart ?? 0) + (travail.floorsArrivee ?? 0);
    if (n <= 0) continue;
    const from = l.from ?? 0;
    const to = l.to ?? Number.POSITIVE_INFINITY;
    if (n < from || n > to) continue;
    if ((l.minPct ?? 0) > 0) {
      majApplied.push({ key: l.key, label: l.label, minPct: l.minPct!, maxPct: l.maxPct ?? l.minPct! });
      pctTotal += l.minPct!;
    } else if ((l.prixUnitaire ?? 0) > 0) {
      const montant = l.prixUnitaire! * n;
      lines.push(ligneRes("floors", l, montant));
      optionsTotal += montant;
    }
    break; // une seule tranche d'étages s'applique
  }

  if (custom.length > 0) return { ok: false, reason: "validation", missing: custom };
  if (missing.length > 0) return { ok: false, reason: "manquant", missing };
  if (lines.length === 0) return { ok: false, reason: "vide", missing: [] };

  const avecFrais = (apresCoef + optionsTotal) * (1 + pctTotal / 100);

  // ── 9 & 10. Forfait minimum, puis prix de marché ajusté ───────────────
  // Le forfait est un PLANCHER sur la prestation de base coefficientée : les
  // options explicitement demandées s'ajoutent par-dessus, elles ne sont pas
  // absorbées par le minimum (§10).
  const forfait = (grid.minimums ?? []).find((l) => choisies.has(l.key));
  const socle = apresCoef * (1 + pctTotal / 100);
  let ajuste = avecFrais;
  if (forfait && (forfait.forfaitMin ?? 0) > 0 && socle < forfait.forfaitMin!) {
    assumptions.push(`forfait minimum « ${forfait.label} » appliqué (${forfait.forfaitMin} €)`);
    ajuste = forfait.forfaitMin! + optionsTotal * (1 + pctTotal / 100);
  }
  // Plancher global de la grille, s'il est renseigné.
  if (g.floorPrice > 0 && ajuste < g.floorPrice) {
    assumptions.push(`plancher de ${g.floorPrice} € appliqué`);
    ajuste = g.floorPrice;
  }

  // ── 11 & 12. Majoration commerciale, une seule fois ───────────────────
  const recommande = arrondirSup(ajuste * (1 + g.majorationPct / 100), g.rounding || 10);

  // Même garde-fou que le mode d'origine : aucune ligne valorisée ⇒ aucun
  // prix. Mieux vaut « barème à compléter » qu'un 0 € annonçable.
  if (recommande <= 0) return { ok: false, reason: "vide", missing: [] };

  // ── 13. Fourchette ────────────────────────────────────────────────────
  const demi = g.fourchettePct / 100;
  const pas = g.rounding || 10;
  const min = arrondirSup(recommande * (1 - demi), pas);
  const max = arrondirSup(recommande * (1 + demi), pas);

  return {
    ok: true,
    min,
    max,
    conseille: recommande,
    lines,
    majorations: majApplied,
    assumptions,
    vatRate: g.vatRate,
  };
}
