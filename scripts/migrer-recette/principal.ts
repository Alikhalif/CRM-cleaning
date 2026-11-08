// `npm run migrer:recette`              → vérifie, puis SIMULE (db push --dry-run)
// `npm run migrer:recette -- --appliquer` → vérifie, puis APPLIQUE à la recette
//
// Il n'existe AUCUN chemin vers la production : la garde refuse si la CLI ou
// .env.recette désigne le projet déclaré comme production. Lever ce refus
// demanderait de modifier ce fichier — et ce serait visible dans un diff.
//
// Les secrets ne sont jamais imprimés : seules les références de projet
// (publiques, dans l'URL) apparaissent.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bloquants, evaluerCible, modeEffectif, type Config } from "@/lib/env/cible";
import { deciderMigration } from "./garde";

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

const appliquer = process.argv.includes("--appliquer");
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
const decision = deciderMigration({
  modeRecette: modeEffectif(config) === "recette",
  motifsBloquants: bloquants(evaluerCible(config)).map((g) => `${g.code} — ${g.message}`),
  refCli: existsSync(refFichier) ? readFileSync(refFichier, "utf8") : null,
  urlRecette: env.NEXT_PUBLIC_SUPABASE_URL,
  urlProduction: env.CGK_SUPABASE_URL_PRODUCTION,
});

console.log("═".repeat(72));
console.log(`  MIGRATIONS → RECETTE · ${appliquer ? "APPLICATION" : "SIMULATION"}`);
console.log("═".repeat(72));
if (!decision.ok) {
  console.log("REFUS — aucune commande Supabase n'a été lancée :");
  for (const r of decision.raisons) console.log(`  ✗ ${r}`);
  process.exit(2);
}
console.log(`Cible vérifiée : projet ${decision.ref} (recette, distinct de la production).`);

const args = ["supabase", "db", "push", ...(appliquer ? [] : ["--dry-run"])];
console.log(`Commande : npx ${args.join(" ")}\n`);
execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", args, { stdio: "inherit" });
