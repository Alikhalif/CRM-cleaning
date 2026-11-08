// Lanceur des contrôles de sécurisation de la recette (Lot C).
//
// Même motif que les trois autres vérificateurs du dépôt : esbuild compile
// chaque suite, Node l'exécute. `--alias:@=.` reproduit l'alias du tsconfig.
//
// PORTÉE : logique PURE et lecture de fichiers locaux. Aucun appel réseau,
// aucune base, aucun secret — ces contrôles tournent sur une machine sans
// `.env.local`.
//
// CE QU'ILS PROUVENT : qu'une configuration dangereuse est refusée, qu'aucun
// des deux transports d'e-mail ne contourne le goulet, et qu'aucun des cinq
// points de génération d'URL ne porte plus de domaine de production en dur.
//
// CE QU'ILS NE PROUVENT PAS : qu'un écran s'affiche. Ils ne remplacent pas la
// recette en session authentifiée, qui attend l'environnement du Lot C.
//
//   npm run check:recette

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, "..", "..");

const SUITES = [
  { fichier: "cible.ts", titre: "Refus des configurations dangereuses (garde-fou de démarrage)" },
  { fichier: "envoi.ts", titre: "Les DEUX transports d'e-mail, et le goulet qu'aucun ne contourne" },
  { fichier: "urls.ts", titre: "Les cinq points de génération d'URL publiques" },
  { fichier: "chiffrement.ts", titre: "Chiffrement : identifiant de clé et rotation progressive" },
  { fichier: "rotation.ts", titre: "Rotation D14 + D17 : décision, périmètre fermé et cinq gardes" },
  { fichier: "iban.ts", titre: "Coordonnées bancaires : cinq pays, et le Canada qui n'a pas d'IBAN" },
  { fichier: "ux.ts", titre: "UX/UI : jetons CSS valides et cellules étiquetées (I1, I2, I3)" },
  { fichier: "facturation.ts", titre: "Facturation : validation, numéro à l'émission, factures figées" },
  { fichier: "contrat-lien.ts", titre: "D23 — liens de contrat : 60 minutes, renouvelables, tracés" },
  { fichier: "migrer.ts", titre: "Garde des migrations : la recette, et jamais la production" },
  { fichier: "pdf-brouillon.tsx", titre: "D28 — le PDF d'une facture brouillon le dit (rendu réel)" },
  { fichier: "encaissement.ts", titre: "D29 · D30 — l'encaissement et la facture OPTIMIVV au back-office" },
  { fichier: "series.ts", titre: "D26 — séries de factures par société : indépendantes, datées, figées" },
  { fichier: "actions-back-office.ts", titre: "Notifications intermodules : naissance, persistance, escalade, pays" },
  { fichier: "notifications-perimetre.ts", titre: "D31 — périmètre des notifications : cinq pays, rôles, entités" },
  { fichier: "recette-pret.ts", titre: "Préparation de la recette : l'étape suivante, et qui doit agir" },
];

const sortie = mkdtempSync(join(tmpdir(), "recette-check-"));
let echecs = 0;

try {
  for (const { fichier, titre } of SUITES) {
    console.log(`\n${"═".repeat(70)}\n  ${titre}\n${"═".repeat(70)}`);
    const bundle = join(sortie, fichier.replace(/\.tsx?$/, ".cjs"));
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
          "--alias:server-only=./scripts/recette-check/stubs/server-only.ts",
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

console.log(`\n${"═".repeat(70)}`);
if (echecs === 0) console.log(`  ${SUITES.length} suites — TOUT PASSE`);
else console.log(`  ${echecs} échec(s)`);
console.log("═".repeat(70));
process.exit(echecs === 0 ? 0 : 1);
