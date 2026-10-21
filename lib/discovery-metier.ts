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

// ── Transport ─────────────────────────────────────────────────────────
// Le transport déplace des OBJETS désignés, là où le déménagement vide un
// logement entier. D'où un inventaire d'objets plutôt qu'un volume global,
// et un poids — déterminant pour le véhicule et l'équipage.
export const TYPE_OBJET: Option[] = opt([
  ["mobilier", "Mobilier"],
  ["electromenager", "Électroménager"],
  ["piano", "Piano"],
  ["coffre_fort", "Coffre-fort"],
  ["oeuvre_art", "Œuvre d'art"],
  ["materiel_pro", "Matériel professionnel"],
  ["marchandise", "Marchandise / palette"],
  ["materiaux", "Matériaux de chantier"],
  ["vehicule", "Véhicule / deux-roues"],
  ["colis", "Cartons / colis"],
  ["autre", "Autre"],
]);

// Cases à cocher de la découverte Transport. Chaque clé est aussi la clé de
// ligne attendue dans la grille tarifaire Transport : ce que le commercial
// coche est exactement ce que le moteur cherche à chiffrer.
export const OPTIONS_TRANSPORT: Option[] = opt([
  ["fragile", "Objet fragile"],
  ["lourd", "Objet lourd"],
  ["volumineux", "Objet volumineux"],
  ["manutention", "Manutention particulière"],
  ["demontage", "Démontage"],
  ["remontage", "Remontage"],
  ["protection", "Protection / emballage"],
  ["urgence", "Urgence"],
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
