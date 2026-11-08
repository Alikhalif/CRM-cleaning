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

/**
 * Source privée de ses commentaires.
 *
 * ── POURQUOI CET UTILITAIRE EXISTE ──────────────────────────────────
 *
 * Trois fois dans ce lot, un contrôle s'est déclenché sur SA PROPRE
 * DOCUMENTATION : le commentaire qui explique « `assertBackOffice()`
 * laisserait passer la planification » contient `assertBackOffice(`, et un
 * contrôle qui cherche cette chaîne dans le fichier la trouve — dans la prose,
 * pas dans le code.
 *
 * Deux conséquences, et la seconde est la pire : un contrôle qui passe pour
 * la mauvaise raison, et un contrôle qui échoue alors que le code est juste.
 * Les deux détruisent la confiance qu'on peut avoir dans la suite.
 *
 * Toute inspection STRUCTURELLE passe donc par ici. Les inspections qui
 * portent VOLONTAIREMENT sur la prose — vérifier qu'un avertissement est
 * écrit, par exemple — lisent la source brute, et c'est voulu.
 *
 * ⚠️ Ce n'est pas un analyseur syntaxique : une barre oblique double dans une
 * chaîne de caractères serait prise pour un commentaire. Pour inspecter du
 * code, c'est suffisant ; pour transformer du code, ce ne le serait pas.
 */
export function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ") // blocs
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // lignes, sans casser « https:// »
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
