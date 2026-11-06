// Lanceur des contrôles du moteur de rédaction des devis.
//
// Le dépôt n'a volontairement pas de framework de test (cf. CLAUDE.md). Ce
// script suit le précédent de `scripts/superviseur-check/run.mjs` : un
// vérificateur autonome, lancé à la main, qui ne pèse sur aucune autre
// commande.
//
// Il compile chaque suite avec esbuild — déjà présent en devDependency — puis
// l'exécute avec Node. `--alias:@=.` reproduit l'alias de chemin du tsconfig ;
// sans lui, `@/lib/...` ne se résout pas hors de Next.
//
// PORTÉE : la logique PURE du moteur (niveaux A, B et C du §14). Aucun appel
// réseau, aucune base, aucun secret — ces contrôles sont exécutables à tout
// moment, y compris sur une machine sans `.env.local`.
//
// CE QU'ILS NE REMPLACENT PAS : la relecture humaine d'un devis réel. Ils
// prouvent que la structure, les exclusions et les interdictions sont tenues ;
// ils ne jugent pas si le texte « sonne » juste à l'oreille d'un
// professionnel. C'est au client de le dire sur un dossier réel.
//
//   node scripts/devis-redaction-check/run.mjs
//   npm run check:devis

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, "..", "..");

const SUITES = [
  { fichier: "structure.ts", titre: "Structure obligatoire — titre, introduction, sections (§2 à §5, §10, §14)" },
  { fichier: "metier.ts", titre: "Les 14 tests métier du §20" },
  { fichier: "interdictions.ts", titre: "Les 28 interdictions absolues du §19" },
  { fichier: "exclusions.ts", titre: "Exclusions, observations et contrôle indépendant (B3, B4, B5)" },
];

const sortie = mkdtempSync(join(tmpdir(), "devis-redaction-check-"));
let echecs = 0;

try {
  for (const { fichier, titre } of SUITES) {
    console.log(`\n${"═".repeat(74)}\n  ${titre}\n${"═".repeat(74)}`);
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
      echecs++;
    }
  }
} finally {
  rmSync(sortie, { recursive: true, force: true });
}

console.log(`\n${"═".repeat(74)}`);
if (echecs === 0) {
  console.log(`  ${SUITES.length} suites — TOUT PASSE`);
} else {
  console.log(`  ${echecs} échec(s)`);
}
console.log("═".repeat(74));
process.exit(echecs === 0 ? 0 : 1);
