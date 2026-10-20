// Requêtes « WHERE colonne IN (…) » découpées en lots.
//
// POURQUOI — PostgREST passe la liste d'identifiants dans l'URL. Au-delà
// d'environ 16 Ko de ligne de requête, le client HTTP de Node (undici) refuse
// la requête avec UND_ERR_HEADERS_OVERFLOW, APRÈS ~8 secondes d'attente.
// Mesuré sur la base de production le 2026-10-19 :
//
//     300 identifiants · 11 122 octets → HTTP 200 en   451 ms
//     400 identifiants · 14 822 octets → échec    en 8 332 ms
//     530 identifiants · 19 622 octets → échec    en 8 369 ms
//
// Les appels échouaient silencieusement (`const { data } = await …` sans test
// d'erreur) : les pages s'affichaient lentement ET incomplètes. D'où les deux
// garanties de ce module : des lots toujours sous le seuil, et une erreur qui
// ne peut pas passer inaperçue.
//
// ⚠️ L'ORDRE N'EST PAS PRÉSERVÉ ENTRE LES LOTS. Chaque lot est trié par
// PostgREST indépendamment des autres ; leur concaténation ne l'est pas. Tout
// appelant dont la logique dépend de l'ordre (« le premier gagne », « premier
// passage à… ») DOIT passer `trier`. C'est la seule façon de reproduire ce que
// faisait la requête unique.

export type ReponseLot<T> = {
  data: T[] | null;
  error: { message: string; code?: string; details?: string | null } | null;
};

// 200 identifiants ≈ 7 400 octets d'URL : moitié moins que le premier échec
// observé, avec de la marge pour les autres paramètres de la requête.
const MAX_IDS_PAR_LOT = 200;
// Plafond en caractères, qui prime sur le nombre : si un jour les identifiants
// ne sont plus des UUID de 36 caractères, le découpage reste correct.
const MAX_CARACTERES_PAR_LOT = 8_000;
// Nombre de lots simultanés. Au-delà on bombarde l'API pour rien : 530
// identifiants ne font que 3 lots.
const LOTS_SIMULTANES = 4;

export class ErreurRequeteLot extends Error {
  constructor(
    readonly table: string,
    readonly cause: { message: string; code?: string },
    readonly nbIds: number,
  ) {
    super(`[${table}] requête par lots échouée (${nbIds} identifiants) : ${cause.message}`);
    this.name = "ErreurRequeteLot";
  }
}

/** Découpe en respectant À LA FOIS le nombre d'ids et la longueur d'URL. */
export function decouper(ids: readonly string[]): string[][] {
  const lots: string[][] = [];
  let courant: string[] = [];
  let longueur = 0;
  for (const id of ids) {
    const coutId = id.length + 1; // +1 pour la virgule séparatrice
    if (courant.length > 0 && (courant.length >= MAX_IDS_PAR_LOT || longueur + coutId > MAX_CARACTERES_PAR_LOT)) {
      lots.push(courant);
      courant = [];
      longueur = 0;
    }
    courant.push(id);
    longueur += coutId;
  }
  if (courant.length > 0) lots.push(courant);
  return lots;
}

/**
 * Exécute `requete` sur des lots d'identifiants et renvoie toutes les lignes.
 *
 * Le client Supabase n'est jamais remplacé ni contourné : `requete` reçoit un
 * sous-ensemble d'identifiants et rien d'autre. La RLS s'applique donc
 * exactement comme avec la requête d'origine.
 *
 * @param ids        identifiants à filtrer (les doublons sont écartés)
 * @param requete    construit la requête pour un lot
 * @param contexte   table + filtre, pour le journal. AUCUNE donnée métier.
 * @param trier      OBLIGATOIRE si la requête d'origine portait un `.order()`
 *                   dont dépend la logique de l'appelant.
 * @throws ErreurRequeteLot si un lot échoue — jamais de tableau vide silencieux.
 */
export async function selectEnLots<T>(
  ids: readonly string[],
  requete: (lot: string[]) => PromiseLike<ReponseLot<T>>,
  contexte: { table: string; filtre: string; trier?: (a: T, b: T) => number },
): Promise<T[]> {
  // Dédoublonnage en entrée : deux fois le même identifiant produirait deux
  // fois les mêmes lignes si les doublons tombaient dans des lots différents.
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) return [];

  const lots = decouper(uniques);
  const resultats: T[] = [];

  for (let i = 0; i < lots.length; i += LOTS_SIMULTANES) {
    const tranche = lots.slice(i, i + LOTS_SIMULTANES);
    const reponses = await Promise.all(tranche.map((lot) => requete(lot)));
    for (const r of reponses) {
      if (r.error) {
        // Journal volontairement pauvre : table, filtre, code, message et
        // NOMBRE d'identifiants. Jamais les identifiants eux-mêmes, jamais une
        // ligne de données — ce journal part dans les logs du conteneur.
        console.error(
          `[selectEnLots] ${contexte.table} (${contexte.filtre}) — ` +
          `${uniques.length} identifiants en ${lots.length} lot(s) — ` +
          `${r.error.code ?? "sans code"} : ${r.error.message}`,
        );
        throw new ErreurRequeteLot(contexte.table, r.error, uniques.length);
      }
      if (r.data) resultats.push(...r.data);
    }
  }

  return contexte.trier ? resultats.sort(contexte.trier) : resultats;
}

/**
 * Variante tolérante : journalise et rend ce qui a pu être lu, au lieu de
 * lever. À n'employer que là où une donnée partielle vaut mieux qu'une page en
 * erreur — et la dégradation est alors un CHOIX tracé, pas un accident.
 */
export async function selectEnLotsTolerant<T>(
  ids: readonly string[],
  requete: (lot: string[]) => PromiseLike<ReponseLot<T>>,
  contexte: { table: string; filtre: string; trier?: (a: T, b: T) => number },
): Promise<{ rows: T[]; degrade: boolean }> {
  try {
    return { rows: await selectEnLots(ids, requete, contexte), degrade: false };
  } catch (e) {
    console.error(
      `[selectEnLots] ${contexte.table} (${contexte.filtre}) — lecture DÉGRADÉE, ` +
      `résultat partiel ou vide : ${e instanceof Error ? e.message : String(e)}`,
    );
    return { rows: [], degrade: true };
  }
}
