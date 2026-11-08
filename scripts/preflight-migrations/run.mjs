// Pré-vol des 177 migrations, sur le PostgreSQL local.
//
//   npm run preflight            → crée une base jetable, rejoue tout, la supprime
//   npm run preflight -- --garder → garde la base pour inspection
//
// ── POURQUOI CE SCRIPT EXISTE ───────────────────────────────────────
//
// Les 177 migrations n'ont JAMAIS été rejouées depuis une base vide. C'est la
// seule étape du Lot C dont je ne peux pas prédire la durée, et la plus
// susceptible de révéler des surprises : 81 insèrent des données de référence
// et peuvent collisionner, 9 réécrivent des données.
//
// Un PostgreSQL 15 est installé sur ce poste. Avec la couche de compatibilité
// (`compat-supabase.sql`), on peut donc savoir AUJOURD'HUI, à coût nul et sans
// créer la moindre ressource cloud, laquelle échoue — et pourquoi.
//
// ── CE QU'IL NE TOUCHE JAMAIS ───────────────────────────────────────
//
// Il crée une base au nom HORODATÉ (`cgk_preflight_<date>`), et c'est la seule
// qu'il écrit. Aucune base existante n'est lue, modifiée ni supprimée. Si une
// base du même nom existait déjà — ce qui est improbable, l'horodatage étant à
// la seconde — il s'arrête.
//
// ── ET IL NE DEMANDE AUCUN MOT DE PASSE ─────────────────────────────
//
// `psql` lit `%APPDATA%\postgresql\pgpass.conf` tout seul. Si la connexion
// échoue, le script explique quoi écrire dans ce fichier et s'arrête. Aucun
// secret ne transite par la conversation, et le script n'ouvre jamais ce
// fichier lui-même.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const GARDER = process.argv.includes("--garder");

const barre = "═".repeat(74);
const ligne = "─".repeat(74);

// ── Trouver psql ─────────────────────────────────────────────────────

function trouverPsql() {
  const candidats = [
    "psql",
    ...[17, 16, 15, 14].map((v) => `C:/Program Files/PostgreSQL/${v}/bin/psql.exe`),
  ];
  for (const c of candidats) {
    try {
      const r = spawnSync(c, ["--version"], { encoding: "utf8" });
      if (r.status === 0) return { bin: c, version: (r.stdout || "").trim() };
    } catch {
      // candidat suivant
    }
  }
  return null;
}

console.log(barre);
console.log("  PRÉ-VOL DES MIGRATIONS — PostgreSQL local, base jetable");
console.log(barre);

const psql = trouverPsql();
if (!psql) {
  console.error("psql est introuvable. Aucun client PostgreSQL utilisable.");
  console.error("Le serveur peut être installé sans que ses binaires soient dans le PATH :");
  console.error("  cherchez psql.exe sous « C:/Program Files/PostgreSQL/<version>/bin ».");
  process.exit(2);
}
console.log(`Client                  : ${psql.version}`);

// ── Vérifier la connexion, sans jamais demander de mot de passe ──────

// ⚠️ L'UTILISATEUR DOIT ÊTRE EXPLICITE, et son absence a produit un faux
// diagnostic au premier essai : psql se connecte par défaut sous le nom de
// l'utilisateur du SYSTÈME (`dell` ici), qui n'existe pas comme rôle
// PostgreSQL. Le journal du serveur disait « Le rôle « dell » n'existe pas »
// — et l'instruction que j'allais donner (un mot de passe pour `postgres`)
// n'aurait rien débloqué.
const UTILISATEUR = process.env.PGUSER?.trim() || "postgres";

const ENV_PSQL = {
  ...process.env,
  PGUSER: UTILISATEUR,
  PGCONNECT_TIMEOUT: "5",
  PGCLIENTENCODING: "UTF8",
};

function psqlExec(base, args, sql) {
  return spawnSync(
    psql.bin,
    [
      "-v", "ON_ERROR_STOP=1",
      "-X",  // ignorer ~/.psqlrc : son contenu ne doit pas changer le résultat
      "-q",
      // ⚠️ `-w` EST INDISPENSABLE, et son absence a fait se bloquer ce script
      // à son premier essai. Sans elle, psql DEMANDE le mot de passe en
      // interactif : le processus attend une saisie qui ne viendra jamais, et
      // rien ne dit pourquoi. Avec elle, il échoue immédiatement, et le script
      // peut expliquer quoi faire.
      "-w",
      "-d", base,
      ...args,
    ],
    { encoding: "utf8", env: ENV_PSQL, input: sql, windowsHide: true, timeout: 120_000 },
  );
}

const test = psqlExec("postgres", ["-t", "-A", "-c", "select version()"], "");
if (test.status !== 0) {
  console.error("");
  console.error("CONNEXION IMPOSSIBLE au PostgreSQL local.");
  console.error(ligne);
  console.error((test.stderr || "").trim().split("\n").slice(0, 3).join("\n"));
  console.error(ligne);
  console.error("");
  console.error(`Utilisateur essayé      : ${UTILISATEUR}`);
  console.error("");
  console.error("DEUX FAÇONS DE DÉBLOQUER, et la première ne laisse RIEN derrière elle.");
  console.error("");
  console.error("── Option A — rien n'est écrit sur le disque (recommandée) ──────");
  console.error("");
  console.error("  Dans VOTRE terminal, le temps de cette session seulement :");
  console.error("");
  console.error("      $env:PGPASSWORD = \"<mot de passe de postgres>\"");
  console.error("      npm run preflight");
  console.error("");
  console.error("  Le mot de passe vit dans votre session et disparaît en la fermant.");
  console.error("  La sortie, elle, ne contient AUCUN secret : des noms de migrations");
  console.error("  et des messages d'erreur. Vous pouvez la coller telle quelle.");
  console.error("");
  console.error("── Option B — un fichier, si vous voulez que je puisse relancer ──");
  console.error("");
  console.error("      %APPDATA%\\postgresql\\pgpass.conf");
  console.error(`      localhost:5432:*:${UTILISATEUR}:VOTRE_MOT_DE_PASSE`);
  console.error("");
  console.error("  psql le lit tout seul. Ce script ne l'ouvre jamais.");
  console.error("");
  console.error("Si votre rôle n'est pas « postgres », posez PGUSER avant de relancer.");
  process.exit(2);
}
console.log(`Serveur                 : ${(test.stdout || "").trim().split(",")[0]}`);

// ── La base jetable ──────────────────────────────────────────────────

const horodatage = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
const BASE = `cgk_preflight_${horodatage}`;

const existe = psqlExec(
  "postgres",
  ["-t", "-A", "-c", `select 1 from pg_database where datname = '${BASE}'`],
  "",
);
if ((existe.stdout || "").trim() === "1") {
  console.error(`La base ${BASE} existe déjà. Arrêt : ce script ne touche jamais une base existante.`);
  process.exit(2);
}

console.log(`Base jetable            : ${BASE}`);
console.log("");

const creation = psqlExec("postgres", ["-c", `create database ${BASE}`], "");
if (creation.status !== 0) {
  console.error("Création de la base impossible :");
  console.error((creation.stderr || "").trim().split("\n").slice(0, 4).join("\n"));
  process.exit(2);
}

function nettoyer() {
  if (GARDER) {
    console.log("");
    console.log(`Base conservée : ${BASE}`);
    console.log(`Pour l'inspecter : psql -d ${BASE}`);
    console.log(`Pour la supprimer : psql -d postgres -c "drop database ${BASE}"`);
    return;
  }
  const r = psqlExec("postgres", ["-c", `drop database if exists ${BASE}`], "");
  console.log("");
  console.log(r.status === 0 ? "Base jetable supprimée." : `⚠️ Suppression impossible : ${BASE} subsiste.`);
}

// ── La couche de compatibilité ───────────────────────────────────────

const compat = join("scripts", "preflight-migrations", "compat-supabase.sql");
const rCompat = psqlExec(BASE, ["-f", compat], "");
if (rCompat.status !== 0) {
  console.error("La couche de compatibilité a échoué — rien n'est exploitable au-delà :");
  console.error((rCompat.stderr || "").trim().split("\n").slice(0, 6).join("\n"));
  nettoyer();
  process.exit(2);
}
console.log("Couche de compatibilité : appliquée");
console.log("");

// ── Les migrations, dans l'ordre ─────────────────────────────────────

const dossier = join("supabase", "migrations");
if (!existsSync(dossier)) {
  console.error("Répertoire des migrations introuvable.");
  nettoyer();
  process.exit(2);
}
const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();

console.log(`${fichiers.length} migrations à rejouer, dans l'ordre lexicographique.`);
console.log(ligne);

const echecs = [];
let appliquees = 0;

for (const f of fichiers) {
  const r = psqlExec(BASE, ["-f", join(dossier, f)], "");
  if (r.status === 0) {
    appliquees++;
    continue;
  }
  // Première ligne d'erreur utile : psql préfixe par « psql:fichier:ligne: ».
  const brut = (r.stderr || "").trim().split("\n");
  const premiere =
    brut.find((l) => /ERROR|ERREUR/.test(l)) ?? brut[0] ?? "(erreur sans message)";
  echecs.push({ fichier: f, erreur: premiere.replace(/^psql:[^:]*:\d+:\s*/, "").trim() });
  console.log(`  ÉCHEC  ${f}`);
  console.log(`         ${echecs[echecs.length - 1].erreur.slice(0, 160)}`);
}

// ── Le rapport ───────────────────────────────────────────────────────

console.log(ligne);
console.log("");
console.log(barre);
console.log("  RÉSULTAT");
console.log(barre);
console.log(`Migrations appliquées   : ${appliquees} / ${fichiers.length}`);
console.log(`Échecs                  : ${echecs.length}`);

if (echecs.length > 0) {
  console.log("");
  console.log("Les échecs, dans l'ordre :");
  for (const e of echecs) {
    console.log(`  ${e.fichier}`);
    console.log(`    ${e.erreur.slice(0, 200)}`);
  }
}

console.log("");
console.log("⚠️  CE QUE CE RÉSULTAT NE DIT PAS :");
console.log("    · Postgres LOCAL est en 15, la production en 17.6.1 — un échec ici");
console.log("      peut être un faux positif de version, et l'inverse est vrai aussi ;");
console.log("    · `auth.uid()` rend une valeur FIXE : les politiques RLS se créent,");
console.log("      mais ne discriminent rien. Aucune tenancy n'est éprouvée ici ;");
console.log("    · ni l'authentification, ni le stockage, ni le temps réel, ni");
console.log("      PostgREST ne sont en jeu.");
console.log("");
console.log("    Un succès ici ne dispense donc PAS du rejeu sur la recette. Il dit");
console.log("    seulement que le DDL tient debout, ce qui est déjà la question la");
console.log("    plus coûteuse à découvrir trop tard.");

nettoyer();
console.log(barre);
process.exit(echecs.length === 0 ? 0 : 1);
