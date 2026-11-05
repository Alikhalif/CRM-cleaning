// Lanceur des contrôles du module Superviseur.
//
// Le dépôt n'a volontairement pas de framework de test (cf. CLAUDE.md). Ce
// script suit le précédent de `scripts/docusign-check/run.mjs` : un
// vérificateur autonome, lancé à la main, qui ne pèse sur aucune autre
// commande. Il reste séparé plutôt que fondu dans l'autre pour que chaque lot
// du module Superviseur garde son propre verdict, lisible d'un coup d'œil.
//
// Il compile chaque suite avec esbuild — déjà présent en devDependency — puis
// l'exécute avec Node. `--alias:@=.` reproduit l'alias de chemin du tsconfig ;
// sans lui, `@/lib/...` ne se résout pas hors de Next.
//
// PORTÉE : uniquement la logique PURE et la lecture de fichiers locaux. Aucun
// appel réseau, aucune base, aucun secret. Ces contrôles sont donc exécutables
// à tout moment, y compris sur une machine sans `.env.local`.
//
// CE QU'ILS NE REMPLACENT PAS : la vérification en session réelle avec un
// compte superviseur de test. Elle demande l'accord du client (consigne du
// 2026-11-05, §12) et reste à faire dans l'application.
//
//   node scripts/superviseur-check/run.mjs
//   npm run check:superviseur

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, "..", "..");

const SUITES = [
  { fichier: "perimetre.ts", titre: "Périmètre fermé par défaut (Option A)" },
  { fichier: "taxonomie.ts", titre: "Deux familles, six branches — et découvertes intactes" },
  { fichier: "cloisonnement.ts", titre: "Cloisonnement, chaîne d'accès et journal d'audit" },
];

const sortie = mkdtempSync(join(tmpdir(), "superviseur-check-"));
let echecs = 0;

try {
  for (const { fichier, titre } of SUITES) {
    console.log(`\n${"═".repeat(70)}\n  ${titre}\n${"═".repeat(70)}`);
    const bundle = join(sortie, fichier.replace(/\.ts$/, ".cjs"));
    try {
      execFileSync(
        process.execPath,
        [
          join(racine, "node_modules", "esbuild", "bin", "esbuild"),
          join(ici, fichier),
          "--bundle",
          "--platform=node",
          "--format=cjs",
          "--alias:@=.",
          // `server-only` est fourni par Next.js et ne se résout pas ici. Ce
          // n'est qu'un garde-fou de COMPILATION, sans comportement à
          // l'exécution : le neutraliser permet d'inspecter un module serveur
          // sans rien relâcher dans le build de l'application.
          "--alias:server-only=./scripts/superviseur-check/stubs/server-only.ts",
          `--outfile=${bundle}`,
          "--log-level=warning",
        ],
        { cwd: racine, stdio: ["ignore", "inherit", "inherit"] },
      );
    } catch {
      console.error(`  ÉCHEC DE COMPILATION — ${fichier}`);
      echecs++;
      continue;
    }
    try {
      execFileSync(process.execPath, [bundle], { cwd: racine, stdio: "inherit" });
    } catch {
      // La suite sort en code 1 quand une assertion échoue ; elle a déjà
      // détaillé laquelle sur la sortie standard.
      echecs++;
    }
  }
} finally {
  rmSync(sortie, { recursive: true, force: true });
}

console.log(`\n${"═".repeat(70)}`);
if (echecs === 0) {
  console.log(`  ${SUITES.length} suites — TOUT PASSE`);
} else {
  console.log(`  ${echecs} échec(s)`);
}
console.log("═".repeat(70));
process.exit(echecs === 0 ? 0 : 1);
