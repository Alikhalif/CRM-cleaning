// Aucun secret serveur dans le bundle NAVIGATEUR.
//
// ── POURQUOI CE SCRIPT EXISTE ────────────────────────────────────────
//
// Le CDC §8.2 exige que ce contrôle soit AUTOMATISÉ : « No service-role key in
// the browser bundle. CI must scan the build artifact. » Le dépôt n'a aucune
// intégration continue (`.github/workflows/` n'existe pas), et ce contrôle
// n'existait donc que les jours où quelqu'un pensait à le faire à la main.
//
// Le voici en commande. Il ne remplace pas une CI — il la rend possible en une
// ligne de configuration.
//
// ── IL N'IMPRIME AUCUN SECRET ────────────────────────────────────────
//
// Les valeurs cherchées ne sortent jamais : seuls sortent le NOM de la
// variable, le nombre de fichiers où elle apparaît, et le cas échéant leur
// chemin. Une fuite est signalée sans être aggravée.
//
//   npm run check:bundle                 (lit .env.local)
//   npm run check:bundle -- .env.recette
//
// Prérequis : `npm run build` doit avoir été lancé (le bundle doit exister).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const FICHIER_ENV = process.argv[2] ?? ".env.local";

// Les secrets qui ne doivent JAMAIS atteindre le navigateur. La règle est
// simple : toute variable sans le préfixe `NEXT_PUBLIC_` est serveur.
const A_CHERCHER = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "FIELD_ENCRYPTION_KEY",
  "BREVO_API_KEY",
  "DOCUSIGN_CLIENT_SECRET",
  "DOCUSIGN_CONNECT_HMAC_SECRET",
  "PRESENCE_CRON_SECRET",
  "LEADS_INBOUND_SECRET",
  "RINGOVER_API_KEY",
  "DEVIS_TRACK_SECRET",
  "SMTP_PASS",
  "BREVO_INBOUND_SECRET",
  "BREVO_EVENTS_TOKEN",
  "RINGOVER_WEBHOOK_SECRET",
  "N8N_TO_CRM_BEARER",
];

// Longueur minimale d'une valeur pour être cherchée. Une valeur courte
// produirait des correspondances fortuites dans du code minifié, et un
// contrôle qui crie au loup finit ignoré.
const LONGUEUR_MINIMALE = 12;

function lireEnv(chemin) {
  const out = {};
  if (!existsSync(chemin)) return out;
  for (const brute of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const l = brute.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i <= 0) continue;
    out[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function fichiers(racine) {
  const out = [];
  if (!existsSync(racine)) return out;
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin));
    else out.push(chemin);
  }
  return out;
}

const env = lireEnv(FICHIER_ENV);
const racineBundle = join(".next", "static");

const barre = "═".repeat(72);
console.log(barre);
console.log("  SECRETS DANS LE BUNDLE NAVIGATEUR — aucune valeur n'est imprimée");
console.log(barre);

if (!existsSync(racineBundle)) {
  console.error(
    `Le bundle est introuvable (${racineBundle}).\n` +
      `Lancez « npm run build » d'abord : sans artefact, ce contrôle ne prouve rien.`,
  );
  process.exit(1);
}

const liste = fichiers(racineBundle);
console.log(`Fichier d'environnement : ${FICHIER_ENV}`);
console.log(`Fichiers de bundle      : ${liste.length}`);
console.log("");

// On charge les fichiers une seule fois : le bundle est petit, les relire par
// secret coûterait quatorze passes pour rien.
const contenus = liste.map((f) => ({ f, texte: readFileSync(f, "latin1") }));

let fuites = 0;
let testes = 0;
let ignores = 0;

for (const nom of A_CHERCHER) {
  const valeur = (env[nom] ?? "").trim();
  if (valeur.length < LONGUEUR_MINIMALE) {
    console.log(`  ${nom.padEnd(30)} non définie ou trop courte → non testable`);
    ignores++;
    continue;
  }
  testes++;
  const touches = contenus.filter((c) => c.texte.includes(valeur)).map((c) => relative(".", c.f));
  if (touches.length === 0) {
    console.log(`  ${nom.padEnd(30)} absent du bundle`);
  } else {
    fuites++;
    console.log(`  ${nom.padEnd(30)} *** PRÉSENT dans ${touches.length} fichier(s) ***`);
    for (const t of touches.slice(0, 5)) console.log(`      ${t}`);
  }
}

console.log("");
console.log(`Testés : ${testes} · non testables : ${ignores} · fuites : ${fuites}`);
console.log(barre);

if (fuites > 0) {
  console.error(
    "ÉCHEC — un secret serveur est présent dans le bundle navigateur.\n" +
      "Cherchez un import d'un module `server-only` depuis un composant client,\n" +
      "ou une variable serveur préfixée par erreur de `NEXT_PUBLIC_`.",
  );
  process.exit(1);
}

if (testes === 0) {
  console.error(
    "ÉCHEC — aucun secret n'a pu être testé : le contrôle ne prouve rien.\n" +
      "Un contrôle qui ne peut pas échouer n'est pas un contrôle.",
  );
  process.exit(1);
}

console.log("OK — aucun secret serveur dans le bundle navigateur.");
