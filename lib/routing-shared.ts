// Pure routing-decision helpers (no I/O, no server-only) — safe to import
// anywhere and to unit-test in isolation. The DB-backed pool selection and
// round-robin live in lib/routing.ts; this module only maps a lead's
// attributes to the target commercial profile(s).

// Subset of RoutingInput needed for the profile decision (Lot B).
export type ProfileRoutingInput = {
  sectorSlug: string;
  surfaceM2: number | null;
  isUrgent: boolean;
  lpType: "generale" | "famille" | null;
};

export const DEFAULT_PERFORMANT_THRESHOLD = 100;

// Secteur (catégorie) + type de LP (+ urgence / surface) → profil(s) cible.
// Renvoie une LISTE de profils éligibles (le pool est l'union) car certaines
// combinaisons sont partagées (ex. Famille-nettoyage → Appel entrant OU Divers).
// Règles :
//   • Diogène                          → diogene
//   • Débarras / Déménagement          → debarras_demenagement
//   • Nettoyage difficile              → performant
//   • Nettoyage (+ hérités) urgent     → performant
//   • Nettoyage (+ hérités) surf>seuil → performant
//   • Nettoyage Générale               → appel_entrant
//   • Nettoyage Famille / sans type    → appel_entrant OU nettoyage (Divers)
export function targetProfiles(input: ProfileRoutingInput, threshold: number): string[] {
  const s = input.sectorSlug;
  if (s === "diogene") return ["diogene"];
  if (s === "debarras" || s === "demenagement") return ["debarras_demenagement"];
  if (s === "nettoyage_difficile") return ["performant"];

  // Famille "nettoyage" (nettoyage + secteurs hérités urgence/enr/renovation).
  if (input.isUrgent || (input.surfaceM2 != null && input.surfaceM2 > threshold)) return ["performant"];
  if (input.lpType === "generale") return ["appel_entrant"];
  return ["appel_entrant", "nettoyage"]; // Famille (ou sans type) → union des deux pools
}
