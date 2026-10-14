// Moteur de la « fourchette tarifaire recommandée » — PUR, aucune I/O, donc
// importable depuis un composant client et recalculable à chaque frappe.
//
// Règle absolue : ce fichier ne contient AUCUN tarif. Tout vient de
// pricing_params, saisi par le Super Admin. Si les paramètres ne sont pas
// configurés, ou si la découverte ne donne pas de quoi calculer, on ne propose
// RIEN et on dit ce qui manque. Une fourchette inventée serait annoncée à un
// vrai client.

export type PricingParams = {
  enabled: boolean;
  basePrice: number;
  unit: "none" | "m3" | "m2";
  pricePerUnit: number;
  includedKm: number;
  pricePerKm: number;
  pricePerFloorNoLift: number;
  urgencyPct: number;
  difficultyPct: number;
  options: Record<string, number>;
  minPrice: number;
  rangeLowPct: number;
  rangeHighPct: number;
};

// Ce que la découverte sait du dossier, déjà normalisé.
export type PricingInput = {
  // Volume en m³ (déménagement / débarras) ou surface en m² (nettoyage).
  quantity: number | null;
  distanceKm: number | null;
  // Étages SANS ascenseur, départ + arrivée cumulés.
  floorsNoLift: number;
  urgent: boolean;
  difficult: boolean;
  // Clés d'options cochées dans la découverte (doivent exister dans params.options).
  options: string[];
};

export type PricingLine = { label: string; amount: number };

export type PricingResult =
  | {
      ok: true;
      min: number;
      max: number;
      point: number;
      // Détail du calcul — affiché au commercial pour qu'il comprenne d'où
      // sort le chiffre et puisse l'argumenter au téléphone.
      lines: PricingLine[];
      // Ce qui manque sans empêcher le calcul : la fourchette est alors moins
      // fiable, on le dit plutôt que de le taire.
      assumptions: string[];
    }
  | { ok: false; reason: "not_configured" | "missing_data"; missing: string[] };

const round5 = (n: number) => Math.round(n / 5) * 5;

export function computeRange(params: PricingParams | null, input: PricingInput): PricingResult {
  if (!params || !params.enabled) {
    return { ok: false, reason: "not_configured", missing: [] };
  }

  const missing: string[] = [];
  const assumptions: string[] = [];
  const lines: PricingLine[] = [];

  // ── Inducteur de taille ──────────────────────────────────────────────
  if (params.unit !== "none") {
    const unitLabel = params.unit === "m3" ? "m³" : "m²";
    if (input.quantity == null || input.quantity <= 0) {
      missing.push(params.unit === "m3" ? "le volume estimé (m³)" : "la surface (m²)");
    } else if (params.pricePerUnit > 0) {
      lines.push({
        label: `${input.quantity} ${unitLabel} × ${params.pricePerUnit} €`,
        amount: input.quantity * params.pricePerUnit,
      });
    }
  }

  // ── Déplacement ──────────────────────────────────────────────────────
  if (params.pricePerKm > 0) {
    if (input.distanceKm == null) {
      // Non bloquant : beaucoup de dossiers sont locaux. On le signale.
      assumptions.push("distance non renseignée — trajet compté comme inclus");
    } else {
      const facturables = Math.max(0, input.distanceKm - params.includedKm);
      if (facturables > 0) {
        lines.push({
          label: `${facturables.toFixed(0)} km au-delà des ${params.includedKm} km inclus`,
          amount: facturables * params.pricePerKm,
        });
      }
    }
  }

  // ── Portage ──────────────────────────────────────────────────────────
  if (params.pricePerFloorNoLift > 0 && input.floorsNoLift > 0) {
    lines.push({
      label: `${input.floorsNoLift} étage(s) sans ascenseur`,
      amount: input.floorsNoLift * params.pricePerFloorNoLift,
    });
  }

  // ── Options ──────────────────────────────────────────────────────────
  for (const key of input.options) {
    const montant = params.options[key];
    if (typeof montant === "number" && montant > 0) {
      lines.push({ label: key, amount: montant });
    }
  }

  // Sans aucune ligne variable ni forfait, il n'y a rien à annoncer.
  if (missing.length > 0) {
    return { ok: false, reason: "missing_data", missing };
  }
  if (params.basePrice <= 0 && lines.length === 0) {
    return { ok: false, reason: "not_configured", missing: [] };
  }

  if (params.basePrice > 0) {
    lines.unshift({ label: "Forfait de prise en charge", amount: params.basePrice });
  }

  let total = lines.reduce((sum, l) => sum + l.amount, 0);

  // ── Majorations ──────────────────────────────────────────────────────
  if (input.urgent && params.urgencyPct > 0) {
    const maj = total * (params.urgencyPct / 100);
    lines.push({ label: `Urgence (+${params.urgencyPct} %)`, amount: maj });
    total += maj;
  }
  if (input.difficult && params.difficultyPct > 0) {
    const maj = total * (params.difficultyPct / 100);
    lines.push({ label: `Difficulté (+${params.difficultyPct} %)`, amount: maj });
    total += maj;
  }

  // ── Plancher commercial ──────────────────────────────────────────────
  if (params.minPrice > 0 && total < params.minPrice) {
    assumptions.push(`plancher de ${params.minPrice} € appliqué`);
    total = params.minPrice;
  }

  const min = round5(total * (1 - params.rangeLowPct / 100));
  const max = round5(total * (1 + params.rangeHighPct / 100));

  return { ok: true, min, max, point: round5(total), lines, assumptions };
}
