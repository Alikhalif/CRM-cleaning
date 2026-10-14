// Traduit la découverte commerciale en entrée du moteur de grille. PUR.
//
// Le commercial ne ressaisit rien : tout vient des champs qu'il remplit déjà.
//
// ⚠️ La grille est plus FINE que la découverte. Elle distingue « lit double »
// de « grande armoire » là où la découverte ne demande qu'un oui/non au
// démontage. On mappe ce qui existe et on remonte le reste dans `nonCaptes` :
// l'interface le dit au commercial au lieu de laisser croire que tout a été
// pris en compte.

import type { GridInput } from "./grid-compute";

// Les volumes sont des libellés, pas des nombres : « 20 » (déménagement) ou
// « 10-20 » / « <5 » / « >100 » (débarras). Une tranche donne son MILIEU —
// annoncer le haut gonflerait le prix, annoncer le bas le sous-estimerait.
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

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Objets spécifiques de la découverte → lignes « objets lourds » de la grille.
// Les clés absentes de la grille sont simplement ignorées par le moteur.
const OBJET_VERS_GRILLE: Record<string, string> = {
  piano: "piano_droit",
  coffre_fort: "coffre_fort",
  billard: "mobilier_volumineux",
  electromenager_lourd: "frigo_americain",
  objets_fragiles: "mobilier_ancien",
  oeuvres_art: "oeuvre_art",
};

const DELAI_URGENT = new Set(["aujourdhui", "24h", "48h"]);

export type GridDiscovery = {
  sector: string;
  surfaceM2: number | null;
  details: Record<string, unknown>;
  delaiSouhaite: string | null;
  isUrgent: boolean;
};

export function buildGridInput(d: GridDiscovery): { input: GridInput; approx: boolean; nonCaptes: string[] } {
  const det = d.details ?? {};
  const options: string[] = [];
  const majorations: string[] = [];
  const nonCaptes: string[] = [];
  let approx = false;

  // ── Taille : m³ pour déménagement / débarras, m² sinon ───────────────
  let quantity: number | null = null;
  if (d.sector === "demenagement" || d.sector === "debarras" || d.sector === "diogene") {
    const v = parseVolume(det.volume);
    quantity = v.value;
    approx = v.approx;
  } else {
    quantity = d.surfaceM2 && d.surfaceM2 > 0 ? d.surfaceM2 : null;
  }

  const distRaw = det.distanceKm;
  const distanceKm =
    distRaw != null && distRaw !== "" && Number.isFinite(Number(distRaw)) ? Number(distRaw) : null;

  // ── Étages : seuls ceux SANS ascenseur comptent ──────────────────────
  let floorsDepart = 0;
  let floorsArrivee = 0;
  if (d.sector === "demenagement") {
    if (str(det.ascenseurDepart) === "non") floorsDepart = num(det.etagesDepart);
    if (str(det.ascenseurArrivee) === "non") floorsArrivee = num(det.etagesArrivee);

    const emballage = str(det.emballage);
    if (emballage === "partiel") options.push("fragiles");
    else if (emballage === "complet") options.push("logement_complet");

    if (str(det.monteMeubles) === "oui") options.push("monte_meubles");

    // La découverte dit « démontage : oui » sans dire de QUOI. La grille
    // tarifie au meuble : on ne devine pas, on le signale.
    if (str(det.demontage) === "oui") {
      nonCaptes.push("le détail du démontage (quels meubles)");
    }

    const objets = Array.isArray(det.objetsSpecifiques) ? det.objetsSpecifiques.map(String) : [];
    for (const o of objets) {
      const k = OBJET_VERS_GRILLE[o];
      if (k) options.push(k);
      else if (o === "autres") nonCaptes.push("la nature des « autres » objets spécifiques");
    }

    // La découverte ne capte pas la distance de portage ni les contraintes
    // d'accès détaillées : ce sont des lignes de grille sans source.
    nonCaptes.push("les difficultés d'accès (portage, stationnement, passage)");
  } else {
    const acces = str(det.acces);
    if (acces === "escaliers") floorsDepart = 1;
    if (acces === "plusieurs_etages") floorsDepart = 2;
    if (acces === "stationnement_difficile") options.push("sans_stationnement");
  }

  if (d.isUrgent || DELAI_URGENT.has(d.delaiSouhaite ?? "")) majorations.push("urgent_48h");

  return {
    input: { quantity, distanceKm, floorsDepart, floorsArrivee, options, majorations },
    approx,
    nonCaptes,
  };
}
