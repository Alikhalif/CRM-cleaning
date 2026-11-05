// Outils partagés par les suites de contrôle du moteur de rédaction.

import type { ContenuDevis, Decouverte } from "@/lib/generation/devis-contenu";

let ko = 0;
let total = 0;

export function vrai(nom: string, cond: boolean, detail?: string) {
  total++;
  if (cond) {
    console.log(`  ok    ${nom}`);
  } else {
    console.log(`  ECHEC ${nom}${detail ? `\n          ${detail}` : ""}`);
    ko++;
  }
}

export function faux(nom: string, cond: boolean, detail?: string) {
  vrai(nom, !cond, detail);
}

export function eq<T>(nom: string, obtenu: T, attendu: T) {
  total++;
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a === b) {
    console.log(`  ok    ${nom}`);
  } else {
    console.log(`  ECHEC ${nom}\n          obtenu  ${a}\n          attendu ${b}`);
    ko++;
  }
}

/** Le texte contient-il l'extrait, insensible à la casse et aux accents ? */
export function contient(texte: string, extrait: string): boolean {
  return normaliser(texte).includes(normaliser(extrait));
}

function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function titre(s: string) {
  console.log(`\n── ${s}`);
}

export function bilan(nom: string): never {
  console.log(`\n  ${total} assertions · ${ko === 0 ? "TOUT PASSE" : `${ko} ÉCHEC(S)`} — ${nom}`);
  process.exit(ko === 0 ? 0 : 1);
}

/** Tout le texte d'un contenu, pour les contrôles d'absence. */
export function texteComplet(c: ContenuDevis): string {
  return [
    c.designation,
    c.introduction,
    c.detail,
    c.reserves,
  ].join("\n");
}

/** Découverte de nettoyage, avec les seuls champs fournis. */
export function decouverteNettoyage(
  details: Record<string, unknown>,
  extra: Partial<Decouverte> = {},
): Decouverte {
  return {
    sector: "nettoyage",
    surfaceM2: null,
    etatSalete: null,
    details,
    ...extra,
  };
}
