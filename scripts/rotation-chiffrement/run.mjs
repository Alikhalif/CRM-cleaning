// Lanceur de la procédure de rotation du chiffrement.
//
//   npm run rotation                        → SIMULATION, n'écrit rien
//   npm run rotation -- --ecrire            → écrit (hors production seulement)
//   npm run rotation -- --env .env.recette
//
// Même motif que les autres outils du dépôt : esbuild compile, Node exécute.
// `--alias:@=.` reproduit l'alias du tsconfig.
//
// ⚠️ Le script refuse la production SANS CONDITION : il n'existe aucun drapeau
// pour y écrire. Voir l'en-tête de `rotation.ts`.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, "..", "..");
const sortie = mkdtempSync(join(tmpdir(), "rotation-"));

let code = 0;
try {
  const bundle = join(sortie, "rotation.cjs");
  execFileSync(
    process.execPath,
    [
      join(racine, "node_modules", "esbuild", "bin", "esbuild"),
      join(ici, "rotation.ts"),
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--alias:@=.",
      // `server-only` est fourni par Next et ne se résout pas ici. Ce n'est
      // qu'un garde-fou de compilation, sans comportement à l'exécution.
      "--alias:server-only=./scripts/recette-check/stubs/server-only.ts",
      `--outfile=${bundle}`,
      "--log-level=warning",
    ],
    { cwd: racine, stdio: ["ignore", "inherit", "inherit"] },
  );

  execFileSync(process.execPath, [bundle, ...process.argv.slice(2)], {
    cwd: racine,
    stdio: "inherit",
  });
} catch {
  // Le programme sort en code non nul quand il refuse ou qu'il trouve des
  // valeurs illisibles. Il a déjà tout dit.
  code = 1;
}

rmSync(sortie, { recursive: true, force: true });
process.exit(code);
