// `register()` est appelé UNE FOIS au démarrage d'une instance de serveur
// Next, et doit se terminer avant que le serveur accepte des requêtes
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// instrumentation.md). C'est donc le seul endroit où « refuser de démarrer »
// signifie vraiment refuser de démarrer, plutôt que d'échouer sur la première
// page ouverte.
//
// On n'y fait qu'une chose : vérifier que la cible de cette instance n'est pas
// dangereuse pour le mode déclaré. Voir `lib/env/cible.ts` pour la décision.

export async function register(): Promise<void> {
  // Le garde-fou lit `process.env` et calcule une empreinte avec
  // `node:crypto` : il n'a de sens — et ne fonctionne — que dans le runtime
  // Node. Next appelle aussi `register()` pour le runtime Edge, où ces deux
  // choses n'existent pas.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { verifierAuDemarrage } = await import("@/lib/env/garde-demarrage");
  verifierAuDemarrage();
}
