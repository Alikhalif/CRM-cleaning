// Lanceur des contrôles DocuSign.
//
// Le dépôt n'a volontairement pas de framework de test (cf. CLAUDE.md). Ce
// script suit le précédent de `scripts/devis-compare` : un vérificateur
// autonome, lancé à la main, qui ne pèse sur aucune autre commande.
//
// Il compile chaque suite avec esbuild — déjà présent en devDependency —
// puis l'exécute avec Node. `--alias:@=.` reproduit l'alias de chemin du
// tsconfig ; sans lui, `@/lib/...` ne se résout pas hors de Next.
//
// PORTÉE : uniquement la logique PURE. Aucun appel réseau, aucune base,
// aucune enveloppe DocuSign envoyée. Ces contrôles sont donc exécutables à
// tout moment, y compris sur une machine sans secret configuré.
//
//   node scripts/docusign-check/run.mjs
//   npm run check:docusign

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, "..", "..");

const SUITES = [
  { fichier: "integration.ts", titre: "Intégration DocuSign (OAuth/PKCE, HMAC, états, reprise)" },
  { fichier: "entites.ts", titre: "Sociétés émettrices (représentant légal → contrat)" },
  { fichier: "envoi-devis.ts", titre: "Envoi des devis (aucun envoi automatique)" },
  { fichier: "generation-devis.ts", titre: "Génération du devis depuis la découverte" },
  { fichier: "prestataires.ts", titre: "Recherche prestataires et représentation des sociétés" },
  { fichier: "accessibilite.ts", titre: "Accessibilité depuis l'interface et cloisonnement des rôles" },
  { fichier: "pipeline-resume.ts", titre: "Résumé horizontal du pipeline commercial" },
  { fichier: "societes-emettrices.ts", titre: "Sociétés émettrices (null-safety, règles par pays)" },
];

const sortie = mkdtempSync(join(tmpdir(), "docusign-check-"));
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
  console.log(`  ${echecs} suite(s) en échec sur ${SUITES.length}`);
}
console.log("═".repeat(70));
process.exit(echecs === 0 ? 0 : 1);
