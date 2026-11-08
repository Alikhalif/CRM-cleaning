// D32 — LA règle de périmètre d'une planificatrice, en TypeScript PUR.
//
// Miroir exact de la fonction SQL `planif_perimetre()` (migration
// 20261109000008). Deux implémentations d'une même règle sont un risque : elles
// sont éprouvées sur la MÊME matrice — cinq pays × modes × entités — ici
// (scripts/recette-check/d32-cloisonnement.ts) et en base (section 10 de
// `npm run recette:facturation`).
//
//   strict — pays dans `countries` ET entité dans `entitesAutorisees`.
//            Aucune entité cochée = AUCUN accès ; pays ou entité inconnus =
//            refus. Mode de tout NOUVEAU compte.
//   herite — accès d'avant D32, inchangé : posé sur les planificatrices
//            EXISTANTES par la migration, levé compte par compte après
//            inventaire et validation du client.

export type PerimetrePlanif = { herite: boolean; countries: string[]; entitesAutorisees: string[] };
export type Objet = { pays: string | null; entiteId: string | null };

export function planifPeutVoir(u: PerimetrePlanif, o: Objet): boolean {
  if (u.herite) return true;
  return o.pays !== null && u.countries.includes(o.pays)
    && o.entiteId !== null && u.entitesAutorisees.includes(o.entiteId);
}
