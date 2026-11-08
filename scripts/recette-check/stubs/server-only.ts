// Remplaçant du paquet `server-only` pour le lanceur des contrôles de recette.
//
// `server-only` est fourni par Next.js : il n'existe pas comme dépendance
// résolvable hors de son bundler, et esbuild échoue donc sur l'import. Ce
// n'est qu'un garde-fou de COMPILATION, sans aucun comportement à
// l'exécution : le neutraliser permet d'inspecter un module serveur sans rien
// relâcher dans le build de l'application.
export {};
