// Remplaçant du paquet `server-only` pour le lanceur de contrôles.
//
// `server-only` est fourni par Next.js : il n'existe pas comme dépendance
// résolvable hors du bundler de Next, et esbuild échoue donc sur
// « Could not resolve "server-only" ».
//
// Son rôle réel est d'être un GARDE-FOU DE COMPILATION : importé depuis un
// composant client, il fait échouer le build. Il n'a aucun comportement à
// l'exécution. Le neutraliser ici ne retire donc rien aux contrôles — cela
// permet seulement de tester un module serveur, comme
// `lib/crypto/field-encryption.ts`, dont la logique est purement
// calculatoire (AES-GCM, lecture d'une variable d'environnement).
//
// Ce que cet alias NE fait PAS : il ne s'applique qu'au lanceur de contrôles
// (`scripts/docusign-check/run.mjs`). Le build de l'application continue
// d'utiliser le vrai `server-only`, et un `import "server-only"` ajouté par
// erreur dans un composant client cassera toujours `npm run build`.
export {};
