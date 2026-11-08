// Garde de `npm run migrer:recette` — décision EXÉCUTÉE sur des cas fictifs.
// Les références de projet ci-dessous sont INVENTÉES (20 caractères, forme
// Supabase) : aucune n'est celle d'un projet réel.

import { readFileSync } from "node:fs";
import { deciderMigration, refDepuisUrl } from "../migrer-recette/garde";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}

const PROD = "aaaaaaaaaaaaaaaaaaaa";
const REC = "bbbbbbbbbbbbbbbbbbbb";
const url = (r: string) => `https://${r}.supabase.co`;
const base = { modeRecette: true, motifsBloquants: [], refCli: REC, urlRecette: url(REC), urlProduction: url(PROD) };

console.log("\n1. Les cas de refus — EXÉCUTÉS");
vrai("cas nominal : CLI = recette ≠ production → autorisé", deciderMigration(base).ok);
vrai("CLI liée à la PRODUCTION → refus", !deciderMigration({ ...base, refCli: PROD }).ok);
vrai(".env.recette pointant la PRODUCTION → refus", !deciderMigration({ ...base, urlRecette: url(PROD), refCli: PROD }).ok);
vrai("CLI liée à un AUTRE projet que .env.recette → refus", !deciderMigration({ ...base, refCli: "cccccccccccccccccccc" }).ok);
vrai("CLI non liée → refus", !deciderMigration({ ...base, refCli: null }).ok);
vrai("production non déclarée (impossible de prouver qu'on n'y est pas) → refus", !deciderMigration({ ...base, urlProduction: undefined }).ok);
vrai("mode autre que recette → refus", !deciderMigration({ ...base, modeRecette: false }).ok);
vrai("un motif bloquant de la cible → refus", !deciderMigration({ ...base, motifsBloquants: ["base_production"] }).ok);
vrai("référence de CLI avec espaces/majuscules : normalisée, pas contournée", !deciderMigration({ ...base, refCli: ` ${PROD.toUpperCase()}\n` }).ok);
vrai("URL non Supabase → illisible, refus", !deciderMigration({ ...base, urlRecette: "https://exemple.fr" }).ok);
vrai("lecture de la référence depuis l'URL", refDepuisUrl(url(REC)) === REC && refDepuisUrl("pas une url") === null);

console.log("\n2. Le programme — LU");
const P = readFileSync("scripts/migrer-recette/principal.ts", "utf8");
vrai("SIMULATION par défaut (--dry-run)", P.includes('appliquer ? [] : ["--dry-run"]'));
vrai("application seulement sur --appliquer explicite", P.includes('process.argv.includes("--appliquer")'));
vrai("la décision précède TOUTE commande Supabase", P.indexOf("if (!decision.ok)") < P.indexOf("execFileSync("));
vrai("ne lit QUE .env.recette (jamais .env.local)", P.includes('lireEnv(".env.recette")') && !P.includes(".env.local\""));

if (ko > 0) {
  console.log(`\n  ${ko} échec(s)`);
  process.exit(1);
}
console.log("\n  tout passe");
