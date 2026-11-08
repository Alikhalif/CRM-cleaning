// Assertions des contrôles de recette. Même forme que
// `scripts/devis-redaction-check/commun.ts`, pour qu'une suite se lise pareil
// d'un dossier à l'autre.

let ok = 0;
const echecs: string[] = [];

export function vrai(nom: string, cond: boolean, detail?: string) {
  if (cond) {
    ok++;
    console.log(`  ok    ${nom}`);
  } else {
    echecs.push(nom);
    console.log(`  ÉCHEC ${nom}${detail ? `  → ${detail}` : ""}`);
  }
}

export function faux(nom: string, cond: boolean, detail?: string) {
  vrai(nom, !cond, detail);
}

export function eq<T>(nom: string, obtenu: T, attendu: T) {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  vrai(nom, bon, bon ? undefined : `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
}

export function titre(s: string) {
  console.log(`\n── ${s} ${"─".repeat(Math.max(0, 66 - s.length))}`);
}

export function bilan(nom: string): never {
  console.log("");
  if (echecs.length === 0) {
    console.log(`  ${ok} assertions · TOUT PASSE — ${nom}`);
    process.exit(0);
  }
  console.log(`  ${echecs.length} ÉCHEC(S) sur ${ok + echecs.length} — ${nom}`);
  for (const e of echecs) console.log(`    · ${e}`);
  process.exit(1);
}
