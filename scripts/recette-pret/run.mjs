// Lanceur de `npm run recette:pret` : esbuild compile, Node exécute.
// Voir principal.ts pour les verrous.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, "..", "..");
const sortie = mkdtempSync(join(tmpdir(), "recette-pret-"));
const bundle = join(sortie, "principal.cjs");
let code = 0;
try {
  execFileSync(process.execPath, [
    join(racine, "node_modules", "esbuild", "bin", "esbuild"), join(ici, "principal.ts"),
    "--bundle", "--platform=node", "--format=cjs", "--alias:@=.", `--outfile=${bundle}`, "--log-level=warning",
  ], { cwd: racine, stdio: ["ignore", "inherit", "inherit"] });
  try {
    execFileSync(process.execPath, [bundle, ...process.argv.slice(2)], { cwd: racine, stdio: "inherit" });
  } catch (e) {
    code = typeof e?.status === "number" ? e.status : 1;
  }
} finally {
  rmSync(sortie, { recursive: true, force: true });
}
process.exit(code);
