// `npm run recette:pret` — la décision « quelle étape, et qui » — EXÉCUTÉE.
// Références de projet INVENTÉES (forme Supabase, 20 caractères).

import { existsSync, readdirSync } from "node:fs";
import { prochaineEtape, type Faits } from "../recette-pret/etat";

let ko = 0;
function vrai(nom: string, cond: boolean) {
  console.log(cond ? `  ok    ${nom}` : `  ECHEC ${nom}`);
  if (!cond) ko++;
}
const PROD = "aaaaaaaaaaaaaaaaaaaa";
const REC = "bbbbbbbbbbbbbbbbbbbb";
const url = (r: string) => `https://${r}.supabase.co`;
const pret: Faits = {
  envRecetteExiste: true, modeRecette: true, motifsBloquants: [], urlRecette: url(REC), urlProduction: url(PROD),
  refCli: REC, comptesTestRenseignes: true, scriptsRecettePresents: true,
};

console.log("\n1. L'étape suivante, cas par cas — EXÉCUTÉ");
vrai("aujourd'hui (pas de .env.recette) → étape 1, VOUS, avec autorisation", (() => {
  const r = prochaineEtape({ ...pret, envRecetteExiste: false });
  return !r.pret && r.etape.numero === 1 && r.etape.qui === "vous" && r.etape.autorisation;
})());
vrai(".env.recette pointant la PRODUCTION → étape 3, jamais plus loin", (() => {
  const r = prochaineEtape({ ...pret, urlRecette: url(PROD) });
  return !r.pret && r.etape.numero === 3;
})());
vrai("mode autre que recette → étape 3", prochaineEtape({ ...pret, modeRecette: false }).etape.numero === 3);
vrai("production non déclarée → étape 3", prochaineEtape({ ...pret, urlProduction: undefined }).etape.numero === 3);
vrai("CLI liée à la PRODUCTION → étape 5, la migration n'est jamais proposée", (() => {
  const r = prochaineEtape({ ...pret, refCli: PROD });
  return !r.pret && r.etape.numero === 5;
})());
vrai("tout concorde → prêt, étape 6 (migrations), et elle exige VOTRE autorisation", (() => {
  const r = prochaineEtape(pret);
  return r.pret && r.etape.numero === 6 && r.etape.autorisation;
})());
vrai("comptes de test absents : signalé, sans bloquer", (() => {
  const r = prochaineEtape({ ...pret, comptesTestRenseignes: false });
  return r.pret && r.constats.some((c) => c.includes("sections 7 et 9"));
})());

console.log("\n2. Le dépôt contient ce que la recette exige");
for (const f of ["00_marqueur_environnement.sql", "10_comptes_de_test.sql", "20_societes_de_test.sql"]) {
  vrai(`supabase/recette/${f}`, existsSync(`supabase/recette/${f}`));
}
const n = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).length;
vrai(`185 migrations à appliquer (mesuré : ${n})`, n === 185);
vrai("aucun script de recette n'est dans supabase/migrations (aucun db push ne les joue)",
  !readdirSync("supabase/migrations").some((f) => /marqueur|comptes_de_test|societes_de_test/.test(f)));

if (ko > 0) {
  console.log(`\n  ${ko} échec(s)`);
  process.exit(1);
}
console.log("\n  tout passe");
