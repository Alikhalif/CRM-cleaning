// « Sur quoi vais-je taper ? » — à lancer AVANT toute commande Supabase.
//
// ── POURQUOI CE SCRIPT EXISTE ────────────────────────────────────────
//
// La CLI Supabase de ce poste est liée à la PRODUCTION (`supabase/.temp/
// project-ref`), et rien ne le signalait. Or `supabase db reset --linked`
// « resets the linked project » : lancée par distraction, elle détruit la base
// réelle. `db push` y applique des migrations non validées.
//
// Ce script répond à la question en clair, et refuse en sortie non nulle si la
// cible est dangereuse pour le mode déclaré. Il ne touche à RIEN : il lit des
// fichiers, et c'est tout. Aucun appel réseau, aucune commande Supabase.
//
// ── IL N'IMPRIME AUCUN SECRET ────────────────────────────────────────
//
// Les valeurs ne sortent jamais. Seuls sortent : le mode, l'HÔTE de la base
// (une URL publique), les NOMS des variables et leur état « configuré /
// absent ». Un rapport qu'on peut coller dans un échange sans rien divulguer.
//
//   npm run verif:cible                 (lit .env.local)
//   npm run verif:cible -- .env.recette

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { evaluerCible, rapporter, type Config } from "@/lib/env/cible";

// ── Lecture du fichier d'environnement ───────────────────────────────
//
// On ne peut pas s'appuyer sur `process.env` : c'est Next qui charge
// `.env.local`, pas Node. Le script doit donc lire le fichier lui-même, pour
// montrer ce que l'APPLICATION verrait — ce qui est tout l'intérêt.

function lireFichierEnv(chemin: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(chemin)) return out;
  for (const ligneBrute of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const ligne = ligneBrute.trim();
    // Une ligne commentée est ignorée : c'est ce que fait le chargeur de Next,
    // et c'est important ici — `.env.local` porte des blocs entiers commentés
    // (« compte 1 », « compte 2 »), dont un ancien projet supprimé.
    if (!ligne || ligne.startsWith("#")) continue;
    const egal = ligne.indexOf("=");
    if (egal <= 0) continue;
    const nom = ligne.slice(0, egal).trim();
    let valeur = ligne.slice(egal + 1).trim();
    if (
      (valeur.startsWith('"') && valeur.endsWith('"')) ||
      (valeur.startsWith("'") && valeur.endsWith("'"))
    ) {
      valeur = valeur.slice(1, -1);
    }
    out[nom] = valeur;
  }
  return out;
}

function configDepuis(env: Record<string, string>): Config {
  return {
    cgkEnv: env.CGK_ENV,
    nodeEnv: env.NODE_ENV ?? "development",
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseUrlProduction: env.CGK_SUPABASE_URL_PRODUCTION,
    brevoApiKey: env.BREVO_API_KEY,
    smtpHost: env.SMTP_HOST,
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    devisEmailTransport: env.DEVIS_EMAIL_TRANSPORT,
    envoiReelAutorise: env.CGK_ENVOI_REEL,
    destinatairesAutorises: env.CGK_DESTINATAIRES_AUTORISES,
    signatureBaseUrl: env.SIGNATURE_BASE_URL,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    domainesPublics: env.CGK_DOMAINES_PUBLICS,
    ringoverApiKey: env.RINGOVER_API_KEY,
    docusignClientId: env.DOCUSIGN_CLIENT_ID,
    docusignEnv: env.DOCUSIGN_ENV,
    fieldEncryptionKey: env.FIELD_ENCRYPTION_KEY,
    empreinteCleProduction: env.CGK_EMPREINTE_CLE_PRODUCTION,
    cronSecret: env.PRESENCE_CRON_SECRET,
  };
}

// ── Le projet lié à la CLI Supabase ──────────────────────────────────

function projetLie(): { ref: string | null; nom: string | null } {
  const refFichier = join("supabase", ".temp", "project-ref");
  const lienFichier = join("supabase", ".temp", "linked-project.json");
  const ref = existsSync(refFichier) ? readFileSync(refFichier, "utf8").trim() : null;
  let nom: string | null = null;
  if (existsSync(lienFichier)) {
    try {
      const j = JSON.parse(readFileSync(lienFichier, "utf8")) as { name?: string };
      nom = j.name ?? null;
    } catch {
      nom = null;
    }
  }
  return { ref, nom };
}

// ── Les migrations qui attendent ─────────────────────────────────────

function migrations(): { total: number; avecDonnees: number; dernieres: string[] } {
  const dossier = join("supabase", "migrations");
  if (!existsSync(dossier)) return { total: 0, avecDonnees: 0, dernieres: [] };
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();
  let avecDonnees = 0;
  for (const f of fichiers) {
    const sql = readFileSync(join(dossier, f), "utf8").toLowerCase();
    if (sql.includes("insert into")) avecDonnees++;
  }
  return { total: fichiers.length, avecDonnees, dernieres: fichiers.slice(-3) };
}

// ── Programme ────────────────────────────────────────────────────────

const fichier = process.argv[2] ?? ".env.local";
const env = lireFichierEnv(fichier);
const config = configDepuis(env);
const verdict = evaluerCible(config);

const barre = "═".repeat(72);
console.log(barre);
console.log("  VÉRIFICATION DE CIBLE — aucune valeur secrète n'est imprimée");
console.log(barre);
console.log(`Fichier lu        : ${fichier}${existsSync(fichier) ? "" : "  ⚠️ INTROUVABLE"}`);
console.log(`Variables lues    : ${Object.keys(env).length}`);
console.log("");

for (const ligne of rapporter(verdict, config)) console.log(ligne);

const { ref, nom } = projetLie();
const m = migrations();
console.log("");
console.log("─".repeat(72));
console.log("CLI Supabase");
console.log(`  projet lié      : ${ref ?? "(aucun)"}${nom ? `  « ${nom} »` : ""}`);
const hoteConfig = config.supabaseUrl ?? "";
if (ref && hoteConfig && !hoteConfig.includes(ref)) {
  console.log(
    `  ⚠️  Le projet LIÉ à la CLI n'est PAS celui que l'application vise.\n` +
      `      Une commande « supabase db push » irait sur le projet lié, pas\n` +
      `      sur celui du fichier d'environnement ci-dessus.`,
  );
}
console.log("");
console.log("Migrations");
console.log(`  fichiers        : ${m.total}  (dont ${m.avecDonnees} portant un « insert »)`);
console.log(`  trois dernières : ${m.dernieres.join(", ") || "(aucune)"}`);
console.log("");
console.log(
  "  ⚠️  « supabase db reset --linked » DÉTRUIT la base du projet lié.\n" +
    "      Aucune migration ne doit être lancée sans avoir lu les lignes\n" +
    "      ci-dessus.",
);
console.log(barre);

process.exit(verdict.ok ? 0 : 1);
