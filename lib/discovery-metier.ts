// Jeux d'options des découvertes métier Débarras / Déménagement. Pur (aucune
// I/O), importable côté client. Les valeurs sont stockées dans le JSONB
// leads.discovery_details ; les labels servent à l'affichage (fiche + récap +
// planification).

export type Option = { value: string; label: string };

const opt = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));
export function labelOf(options: Option[], value: string | undefined | null): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}
export function labelsOf(options: Option[], values: string[] | undefined | null): string {
  if (!values || values.length === 0) return "—";
  return values.map((v) => labelOf(options, v)).join(", ");
}

// ── Commun ────────────────────────────────────────────────────────────
export const OUI_NON: Option[] = opt([["oui", "Oui"], ["non", "Non"]]);

// ── Débarras ──────────────────────────────────────────────────────────
export const TYPE_BIEN: Option[] = opt([
  ["appartement", "Appartement"], ["maison", "Maison"], ["cave", "Cave"],
  ["grenier", "Grenier"], ["garage", "Garage"], ["local_commercial", "Local commercial"],
  ["bureau", "Bureau"], ["entrepot", "Entrepôt"], ["commerce", "Commerce"], ["autre", "Autre"],
]);

export const VOLUME_DEBARRAS: Option[] = opt([
  ["<5", "Moins de 5 m³"], ["5-10", "5 à 10 m³"], ["10-20", "10 à 20 m³"],
  ["20-30", "20 à 30 m³"], ["30-40", "30 à 40 m³"], ["40-60", "40 à 60 m³"],
  ["60-80", "60 à 80 m³"], ["80-100", "80 à 100 m³"], [">100", "Plus de 100 m³"],
]);

export const ENCOMBREMENT: Option[] = opt([
  ["faible", "Faible"], ["moyen", "Moyen"], ["important", "Important"],
  ["tres_important", "Très important"], ["extreme", "Extrême (Diogène, accumulation…)"],
]);

export const ACCES: Option[] = opt([
  ["rdc", "RDC"], ["ascenseur", "Ascenseur"], ["escaliers", "Escaliers"],
  ["plusieurs_etages", "Plusieurs étages"], ["cour", "Cour"],
  ["stationnement_facile", "Stationnement facile"], ["stationnement_difficile", "Stationnement difficile"],
]);

// ── Déménagement ──────────────────────────────────────────────────────
export const LOGEMENT_TYPE: Option[] = opt([
  ["appartement", "Appartement"], ["maison", "Maison"], ["bureau", "Bureau"],
  ["commerce", "Commerce"], ["entrepot", "Entrepôt"],
]);

export const VOLUME_DEMENAGEMENT: Option[] = opt([
  ["5", "5 m³"], ["10", "10 m³"], ["15", "15 m³"], ["20", "20 m³"], ["30", "30 m³"],
  ["40", "40 m³"], ["50", "50 m³"], ["60", "60 m³"], ["80", "80 m³"], ["100", "100 m³"],
  [">100", "Plus de 100 m³"],
]);

export const EMBALLAGE: Option[] = opt([
  ["aucun", "Aucun"], ["partiel", "Partiel"], ["complet", "Complet"],
]);

export const OBJETS_SPECIFIQUES: Option[] = opt([
  ["piano", "Piano"], ["coffre_fort", "Coffre-fort"], ["billard", "Billard"],
  ["electromenager_lourd", "Électroménager lourd"], ["objets_fragiles", "Objets fragiles"],
  ["oeuvres_art", "Œuvres d'art"], ["autres", "Autres"],
]);
