import PageSkeleton from "@/components/PageSkeleton/PageSkeleton";

// Affiché pendant le rendu serveur. Sans ce fichier, la navigation reste sur
// l'écran précédent sans aucun signal — la page paraît bloquée.
export default function Loading() {
  return <PageSkeleton cartes={4} lignes={6} filtres={true} />;
}
