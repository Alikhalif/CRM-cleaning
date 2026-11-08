// Décision PURE : peut-on pousser les migrations ? (testée sans réseau)
//
// Le client, 2026-11-09 : « aucune migration ne doit être lancée avant
// vérification formelle de son rattachement à la recette. »
//
// Trois identités doivent concorder, et une quatrième doit DIFFÉRER :
//   1. le projet lié à la CLI          (supabase/.temp/project-ref)
//   2. le projet de .env.recette       (NEXT_PUBLIC_SUPABASE_URL)
//   3. le mode déclaré                 (CGK_ENV=recette, aucun motif bloquant)
//   ≠ le projet de PRODUCTION          (CGK_SUPABASE_URL_PRODUCTION)
//
// Si une seule manque ou se contredit : refus. On ne devine jamais.

export type EntreeGarde = {
  modeRecette: boolean;
  motifsBloquants: string[];
  refCli: string | null;
  urlRecette: string | undefined;
  urlProduction: string | undefined;
};

export type DecisionGarde = { ok: true; ref: string } | { ok: false; raisons: string[] };

/** `https://abcd1234.supabase.co` → `abcd1234`. Toute autre forme → null. */
export function refDepuisUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.toLowerCase();
    const m = /^([a-z0-9]{20})\.supabase\.co$/.exec(h);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function deciderMigration(e: EntreeGarde): DecisionGarde {
  const raisons: string[] = [];
  const refRecette = refDepuisUrl(e.urlRecette);
  const refProd = refDepuisUrl(e.urlProduction);
  const cli = e.refCli?.trim().toLowerCase() || null;

  if (!e.modeRecette) raisons.push("Le fichier ne déclare pas CGK_ENV=recette.");
  for (const m of e.motifsBloquants) raisons.push(`Cible refusée : ${m}`);
  if (!refRecette) raisons.push("NEXT_PUBLIC_SUPABASE_URL de .env.recette absente ou illisible.");
  if (!refProd) raisons.push("CGK_SUPABASE_URL_PRODUCTION absente : sans elle, on ne peut pas prouver qu'on N'EST PAS en production.");
  if (!cli) raisons.push("La CLI n'est liée à aucun projet (supabase/.temp/project-ref absent).");

  if (cli && refProd && cli === refProd) {
    raisons.push("La CLI est liée à la PRODUCTION. Refus absolu.");
  }
  if (refRecette && refProd && refRecette === refProd) {
    raisons.push(".env.recette pointe sur la PRODUCTION. Refus absolu.");
  }
  if (cli && refRecette && cli !== refRecette) {
    raisons.push(`La CLI (${cli}) n'est pas liée au projet de .env.recette (${refRecette}).`);
  }

  if (raisons.length > 0 || !cli) return { ok: false, raisons };
  return { ok: true, ref: cli };
}
