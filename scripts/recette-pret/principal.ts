// `npm run recette:pret` — où en est la préparation de la recette, et qui
// doit agir maintenant. Lecture de fichiers locaux seulement : aucun réseau,
// aucune commande Supabase, aucun secret imprimé (seulement des PRÉSENCES).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bloquants, evaluerCible, modeEffectif, type Config } from "@/lib/env/cible";
import { prochaineEtape } from "./etat";

function lireEnv(fichier: string): Record<string, string> {
  if (!existsSync(fichier)) return {};
  const out: Record<string, string> = {};
  for (const brut of readFileSync(fichier, "utf8").split(/\r?\n/)) {
    const l = brut.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i <= 0) continue;
    let v = l.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[l.slice(0, i).trim()] = v;
  }
  return out;
}

const env = lireEnv(".env.recette");
const config = {
  cgkEnv: env.CGK_ENV, nodeEnv: env.NODE_ENV ?? "development",
  supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL, supabaseUrlProduction: env.CGK_SUPABASE_URL_PRODUCTION,
  signatureBaseUrl: env.SIGNATURE_BASE_URL, appUrl: env.NEXT_PUBLIC_APP_URL,
  domainesPublics: env.CGK_DOMAINES_PUBLICS, fieldEncryptionKey: env.FIELD_ENCRYPTION_KEY,
  empreinteCleProduction: env.CGK_EMPREINTE_CLE_PRODUCTION, docusignEnv: env.DOCUSIGN_ENV,
  brevoApiKey: env.BREVO_API_KEY, envoiReelAutorise: env.CGK_ENVOI_REEL,
  destinatairesAutorises: env.CGK_DESTINATAIRES_AUTORISES, cronSecret: env.PRESENCE_CRON_SECRET,
} as Config;
const refFichier = join("supabase", ".temp", "project-ref");

const r = prochaineEtape({
  envRecetteExiste: existsSync(".env.recette"),
  modeRecette: modeEffectif(config) === "recette",
  motifsBloquants: bloquants(evaluerCible(config)).map((g) => `${g.code} — ${g.message}`),
  urlRecette: env.NEXT_PUBLIC_SUPABASE_URL,
  urlProduction: env.CGK_SUPABASE_URL_PRODUCTION,
  refCli: existsSync(refFichier) ? readFileSync(refFichier, "utf8") : null,
  comptesTestRenseignes: !!(env.CGK_TEST_COMMERCIAL_MOT_DE_PASSE && env.CGK_TEST_PLANIFICATION_MOT_DE_PASSE),
  scriptsRecettePresents: ["00_marqueur_environnement.sql", "10_comptes_de_test.sql", "20_societes_de_test.sql"]
    .every((f) => existsSync(join("supabase", "recette", f))),
});

console.log("═".repeat(72));
console.log(`  PRÉPARATION DE LA RECETTE — ${r.pret ? "PRÊTE pour les migrations" : "PAS ENCORE PRÊTE"}`);
console.log("═".repeat(72));
for (const c of r.constats) console.log(`  · ${c}`);
console.log(`\nÉtape suivante (n° ${r.etape.numero}) — ${r.etape.qui.toUpperCase()}${r.etape.autorisation ? " — demande VOTRE AUTORISATION" : ""} :`);
console.log(`  ${r.etape.quoi}`);
console.log("\nAucune ressource créée, aucune commande Supabase lancée.");
process.exit(r.pret ? 0 : 3);
