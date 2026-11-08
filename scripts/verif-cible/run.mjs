// Lanceur de la vérification de cible.
//
// Même motif que les autres vérificateurs du dépôt (cf.
// `scripts/superviseur-check/run.mjs`) : esbuild compile le programme, Node
// l'exécute. `--alias:@=.` reproduit l'alias de chemin du tsconfig.
//
//   npm run verif:cible
//   npm run verif:cible -- .env.recette
//
// Sortie 0 = cible acceptable. Sortie 1 = CIBLE REFUSÉE.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, "..", "..");
const sortie = mkdtempSync(join(tmpdir(), "verif-cible-"));

try {
  const bundle = join(sortie, "cible.cjs");
  execFileSync(
    process.execPath,
    [
      join(racine, "node_modules", "esbuild", "bin", "esbuild"),
      join(ici, "cible.ts"),
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--alias:@=.",
      `--outfile=${bundle}`,
      "--log-level=warning",
    ],
    { cwd: racine, stdio: ["ignore", "inherit", "inherit"] },
  );

  // Les arguments de l'utilisateur sont transmis tels quels (le fichier
  // d'environnement à inspecter).
  execFileSync(process.execPath, [bundle, ...process.argv.slice(2)], {
    cwd: racine,
    stdio: "inherit",
  });
} catch {
  // Le programme sort en 1 quand la cible est refusée ; il a déjà tout dit.
  rmSync(sortie, { recursive: true, force: true });
  process.exit(1);
}

rmSync(sortie, { recursive: true, force: true });
