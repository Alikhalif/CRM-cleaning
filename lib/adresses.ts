// Adresses postales — PUR, aucune I/O, importable côté client.
//
// Les découvertes saisissaient l'adresse en un seul champ libre. La séparer en
// rue / code postal / ville permet de valider le code postal, de réutiliser la
// ville ailleurs, et de donner au calcul d'itinéraire une adresse qu'il
// comprend mieux qu'une chaîne approximative.

import type { Country } from "./leads";

/** Format du code postal par pays, avec un exemple pour l'aide à la saisie. */
export const CODE_POSTAL: Record<Country, { motif: RegExp; exemple: string; aide: string }> = {
  FR: { motif: /^\d{5}$/, exemple: "75011", aide: "5 chiffres" },
  CH: { motif: /^\d{4}$/, exemple: "1203", aide: "4 chiffres" },
  LU: { motif: /^\d{4}$/, exemple: "1420", aide: "4 chiffres" },
  BE: { motif: /^\d{4}$/, exemple: "1000", aide: "4 chiffres" },
  // Canada : lettre-chiffre-lettre, espace facultatif, chiffre-lettre-chiffre.
  CA: { motif: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, exemple: "H2X 1Y4", aide: "A1A 1A1" },
};

/**
 * Le code postal est-il cohérent avec le pays ?
 *
 * `null` = rien à dire : champ vide (la saisie n'est pas finie) ou pays
 * inconnu. On ne signale une erreur que lorsqu'on est sûr de soi — un
 * avertissement prématuré pendant la frappe est plus nuisible qu'utile.
 */
export function validerCodePostal(
  cp: string | null | undefined,
  pays: Country | null | undefined,
): { ok: boolean; attendu: string } | null {
  const v = (cp ?? "").trim();
  if (!v) return null;
  if (!pays || !CODE_POSTAL[pays]) return null;
  const { motif, aide, exemple } = CODE_POSTAL[pays];
  return { ok: motif.test(v), attendu: `${aide} (ex. ${exemple})` };
}

/**
 * Compose une adresse lisible à partir des champs séparés.
 *
 * Tolère les champs vides : pendant la transition, les anciens dossiers n'ont
 * que la rue — qui contenait souvent la ville entière (« paris »). Dans ce cas
 * on renvoie ce qu'on a, plutôt que rien.
 */
export function composerAdresse(parts: {
  rue?: string | null;
  cp?: string | null;
  ville?: string | null;
}): string {
  const rue = (parts.rue ?? "").trim();
  const cp = (parts.cp ?? "").trim();
  const ville = (parts.ville ?? "").trim();
  const bas = [cp, ville].filter(Boolean).join(" ");
  return [rue, bas].filter(Boolean).join(", ");
}

/** Libellé court pour un devis ou un récapitulatif : ville si connue. */
export function villeOuAdresse(parts: {
  rue?: string | null;
  cp?: string | null;
  ville?: string | null;
}): string {
  const ville = (parts.ville ?? "").trim();
  if (ville) return ville;
  return (parts.rue ?? "").trim();
}
