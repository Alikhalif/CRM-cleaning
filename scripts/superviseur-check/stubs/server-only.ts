// Remplaçant du paquet `server-only` pour le lanceur de contrôles du module
// Superviseur.
//
// `server-only` est fourni par Next.js : il n'existe pas comme dépendance
// résolvable hors du bundler de Next, et esbuild échoue donc sur
// « Could not resolve "server-only" ».
//
// Son rôle réel est d'être un GARDE-FOU DE COMPILATION : importé depuis un
// composant client, il fait échouer le build. Il n'a aucun comportement à
// l'exécution. Le neutraliser ici ne retire donc rien aux contrôles — cela
// permet seulement d'inspecter un module serveur sans l'exécuter.
//
// Ce que cet alias NE fait PAS : il ne s'applique qu'à
// `scripts/superviseur-check/run.mjs`. Le build de l'application continue
// d'utiliser le vrai `server-only`, et un `import "server-only"` ajouté par
// erreur dans un composant client cassera toujours `npm run build`.
//
// Copie volontaire de scripts/docusign-check/stubs/server-only.ts : les deux
// lanceurs restent indépendants, pour qu'un contrôle ne casse pas parce que
// l'autre a bougé.
export {};
