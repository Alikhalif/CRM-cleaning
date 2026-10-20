import PageSkeleton from "@/components/PageSkeleton/PageSkeleton";

// Affiché pendant le rendu serveur de la page. Sans ce fichier, la navigation
// reste sur l'écran précédent sans aucun signal — la page paraît bloquée.
export default function Loading() {
  return <PageSkeleton cartes={6} lignes={4} filtres={false} />;
}
