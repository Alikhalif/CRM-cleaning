// M1 — types et libellés de l'historique des versions. PUR.
//
// ── POURQUOI CE MODULE EST SÉPARÉ ────────────────────────────────────
//
// `versions-server.ts` commence par `import "server-only"` : il lit la base.
// Le panneau qui affiche l'historique est un composant CLIENT, et importer un
// module `server-only` depuis le navigateur est une erreur de compilation —
// que `tsc --noEmit` ne signale pas, parce qu'elle n'apparaît qu'au build de
// Next.
//
// C'est la convention du dépôt, documentée dans CLAUDE.md : `-server.ts` fait
// l'I/O, `-shared.ts` porte ce que les deux côtés emploient.

/** D'où vient une version. C'est le champ qui porte la valeur de preuve. */
export type OrigineVersion = "moteur" | "assiste" | "manuel" | "emission";

export const LIBELLE_ORIGINE: Record<OrigineVersion, string> = {
  moteur: "Rédigé par le moteur",
  assiste: "Rédaction assistée",
  manuel: "Réécrit à la main",
  emission: "Version envoyée au client",
};

export type VersionDocument = {
  id: string;
  version: number;
  designation: string;
  notes: string;
  origine: OrigineVersion;
  /** Fonctions de rédaction assistée employées, quand `origine = 'assiste'`. */
  regles: string[];
  note: string;
  creeLe: string;
  creePar: string | null;
  auteur: string | null;
};

export type Historique =
  | { disponible: true; versions: VersionDocument[] }
  /** La table n'existe pas : la migration M1 n'a pas été appliquée. */
  | { disponible: false; motif: string };

/**
 * La version qui engage : celle figée à l'envoi au client.
 *
 * C'est elle qu'on produira en cas de litige. `null` s'il n'y en a pas — un
 * devis jamais envoyé n'a pas de version d'émission, et c'est normal.
 */
export function versionDEmission(h: Historique): VersionDocument | null {
  if (!h.disponible) return null;
  return h.versions.find((v) => v.origine === "emission") ?? null;
}
