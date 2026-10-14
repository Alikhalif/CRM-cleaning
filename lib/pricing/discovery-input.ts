// Traduit la découverte commerciale en entrée du moteur tarifaire. PUR, donc
// recalculé à chaque frappe côté client, sans aller-retour serveur.
//
// Le commercial ne ressaisit RIEN : tout vient des champs qu'il remplit déjà.

import type { PricingInput } from "./compute";

// Les volumes sont des libellés, pas des nombres : « 20 » (déménagement) ou
// « 10-20 » / « <5 » / « >100 » (débarras). On en tire une valeur de calcul.
// Une tranche donne son MILIEU — annoncer le haut de tranche gonflerait le
// prix, annoncer le bas le sous-estimerait.
export function parseVolume(raw: unknown): { value: number | null; approx: boolean } {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return { value: null, approx: false };
  if (v.startsWith("<")) {
    const n = Number(v.slice(1));
    return Number.isFinite(n) ? { value: n / 2, approx: true } : { value: null, approx: false };
  }
  if (v.startsWith(">")) {
    const n = Number(v.slice(1));
    // Au-delà de la dernière tranche on ne sait pas : on retient le seuil et on
    // le signale, plutôt que d'extrapoler un volume inventé.
    return Number.isFinite(n) ? { value: n, approx: true } : { value: null, approx: false };
  }
  if (v.includes("-")) {
    const [a, b] = v.split("-").map(Number);
    if (Number.isFinite(a) && Number.isFinite(b)) return { value: (a + b) / 2, approx: true };
  }
  const n = Number(v);
  return Number.isFinite(n) ? { value: n, approx: false } : { value: null, approx: false };
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v : "");

// Encombrements qui justifient la majoration « difficulté ».
const ENCOMBREMENT_DIFFICILE = new Set(["important", "tres_important", "extreme"]);
// Délais qui valent une urgence.
const DELAI_URGENT = new Set(["aujourdhui", "24h", "48h"]);

export type DiscoverySnapshot = {
  sector: string;
  surfaceM2: number | null;
  details: Record<string, unknown>;
  delaiSouhaite: string | null;
  isUrgent: boolean;
  isExtreme: boolean;
};

export function buildPricingInput(d: DiscoverySnapshot): { input: PricingInput; approx: boolean } {
  const det = d.details ?? {};
  let approx = false;
  const options: string[] = [];

  // ── Inducteur de taille ──────────────────────────────────────────────
  let quantity: number | null = null;
  if (d.sector === "demenagement" || d.sector === "debarras" || d.sector === "diogene") {
    const vol = parseVolume(det.volume);
    quantity = vol.value;
    approx = approx || vol.approx;
    // Sans volume saisi, la surface sert de repli explicite (la découverte le
    // dit au commercial : l'estimation est alors moins fiable).
    if (quantity == null && d.surfaceM2) {
      quantity = null; // volontaire : on ne convertit PAS des m² en m³.
    }
  } else {
    quantity = d.surfaceM2 && d.surfaceM2 > 0 ? d.surfaceM2 : null;
  }

  // ── Déplacement (déménagement seul porte des adresses) ───────────────
  const distRaw = det.distanceKm;
  const distanceKm =
    distRaw != null && distRaw !== "" && Number.isFinite(Number(distRaw)) ? Number(distRaw) : null;

  // ── Portage : étages SANS ascenseur, départ + arrivée ────────────────
  let floorsNoLift = 0;
  if (d.sector === "demenagement") {
    if (str(det.ascenseurDepart) === "non") floorsNoLift += num(det.etagesDepart);
    if (str(det.ascenseurArrivee) === "non") floorsNoLift += num(det.etagesArrivee);
    if (str(det.emballage) === "partiel" || str(det.emballage) === "complet") options.push("emballage");
    if (str(det.demontage) === "oui") options.push("demontage");
    if (str(det.monteMeubles) === "oui") options.push("monte_meubles");
    if (Array.isArray(det.objetsSpecifiques) && det.objetsSpecifiques.length > 0) {
      options.push("objets_lourds");
    }
  } else {
    // Débarras / autres : l'accès est un choix unique, pas un nombre d'étages.
    const acces = str(det.acces);
    if (acces === "escaliers") floorsNoLift += 1;
    if (acces === "plusieurs_etages") floorsNoLift += 2;
    if (str(det.triDemande) === "oui") options.push("tri");
  }

  const difficult =
    d.isExtreme ||
    ENCOMBREMENT_DIFFICILE.has(str(det.encombrement)) ||
    str(det.monteMeubles) === "oui";

  const urgent = d.isUrgent || DELAI_URGENT.has(d.delaiSouhaite ?? "");

  return { input: { quantity, distanceKm, floorsNoLift, urgent, difficult, options }, approx };
}
