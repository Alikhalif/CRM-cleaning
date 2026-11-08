// D31 — périmètre d'une notification : règle PURE, MIROIR EXACT de la
// fonction SQL `notification_dans_perimetre()` (migration 20261109000007).
//
// Deux implémentations d'une même règle, c'est un risque : elles sont donc
// éprouvées sur la MÊME matrice — cinq pays × rôles — par
// scripts/recette-check/notifications-perimetre.ts (ici) et par la section 9
// de `npm run recette:facturation` (en base).

export type Destinataire = {
  roles: string[];
  countries: string[];
  /**
   * D32 : en mode « herite » (comptes existants, avant validation), vide =
   * toutes les entités, comme D31 ; en mode STRICT, vide = AUCUNE.
   */
  entitesAutorisees: string[];
  /** D32 — vrai : compte existant en mode hérité. Absent = strict. */
  herite?: boolean;
};

/** Portée d'une notification. `pays` null = notification PERSONNELLE. */
export type Portee = { pays: string | null; entiteId: string | null };

export function dansPerimetre(d: Destinataire, p: Portee): boolean {
  if (p.pays === null) return true;
  if (d.roles.includes("admin")) return true;
  if (d.roles.includes("planification")) {
    if (!d.countries.includes(p.pays)) return false;
    if (d.herite && d.entitesAutorisees.length === 0) return true;
    return p.entiteId !== null && d.entitesAutorisees.includes(p.entiteId);
  }
  // Autres rôles : seulement des notifications qui les visent personnellement.
  return true;
}
