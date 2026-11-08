// Sur quoi tourne-t-on : production, recette, ou développement ?
//
// Ce fichier est séparé de `lib/env/cible.ts` POUR UNE RAISON PRÉCISE :
// `cible.ts` importe `node:crypto` (pour comparer des empreintes de secrets
// sans les stocker). Or la détection de mode est consultée par du code qui
// peut se retrouver dans le graphe d'un composant client — `lib/devis/sender.ts`
// par exemple. Un module avec `node:crypto` dans ce graphe fait échouer le
// build Next, et `tsc` ne le signale pas : l'erreur n'apparaît qu'au build.
//
// Aucune dépendance ici. Aucune lecture de `process.env` : tout entre par les
// paramètres, pour que la décision soit exerçable par une suite de contrôles.

export type Mode = "production" | "recette" | "developpement";

export const MODES: Mode[] = ["production", "recette", "developpement"];

/**
 * Mode effectif.
 *
 * `CGK_ENV` fait foi quand il est renseigné ET reconnu. Sinon on retombe sur
 * `NODE_ENV`, et c'est ce repli qui porte toute la prudence :
 *
 *   • `NODE_ENV=production`      → mode `production`. C'est le conteneur
 *     déployé : son comportement ne change PAS. Aucune régression possible
 *     sur l'existant, qui ne définit pas `CGK_ENV`.
 *   • tout le reste (`next dev`) → mode `developpement`, où les envois sont
 *     bloqués par défaut. Un serveur de développement n'a aucune raison
 *     d'écrire à un vrai client — et c'est pourtant ce qui était possible.
 *
 * Une valeur de `CGK_ENV` non reconnue est IGNORÉE, et signalée ailleurs par
 * `evaluerCible()` : on ne devine pas ce que « prod2 » voulait dire.
 */
export function modeEffectif(c: { cgkEnv?: string; nodeEnv?: string }): Mode {
  const declare = (c.cgkEnv ?? "").trim().toLowerCase();
  if ((MODES as string[]).includes(declare)) return declare as Mode;
  return c.nodeEnv === "production" ? "production" : "developpement";
}

/** Mode effectif lu depuis l'environnement du processus. */
export function modeCourant(): Mode {
  return modeEffectif({ cgkEnv: process.env.CGK_ENV, nodeEnv: process.env.NODE_ENV });
}

export function estProduction(m: Mode): boolean {
  return m === "production";
}

/** Les modes où aucun envoi réel ne part sans autorisation explicite. */
export function envoiBloqueParDefaut(m: Mode): boolean {
  return m !== "production";
}
