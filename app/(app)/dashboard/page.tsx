import Dashboard from "./Dashboard";
import AlerteNouveauxLeads from "./AlerteNouveauxLeads";
import { getLeadsNonTraites } from "@/lib/leads-non-traites-server";
import { getDashboardSeries, getImmobAnnotations } from "@/lib/dashboard-server";
import { getAllCommerciaux } from "@/lib/leads-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getPhotoWaitingCount } from "@/lib/commercial-actions/read-server";
import { getDevisARealiserCount } from "@/lib/devis-a-realiser/server";
import { visibleSectorsForUser } from "@/lib/leads";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [series, commerciaux, annotations, profile, nonTraites] = await Promise.all([
    getDashboardSeries(),
    getAllCommerciaux(),
    getImmobAnnotations(),
    getCurrentUserProfile(),
    // Déjà lu par le layout dans le même rendu : `cache()` évite la seconde
    // paire de requêtes.
    getLeadsNonTraites(),
  ]);
  const isAdmin = profile?.roles.some((r) => r.slug === "admin") ?? false;
  const isPlanner = profile?.roles.some((r) => r.slug === "planification") ?? false;
  const isSuperviseur = profile?.roles.some((r) => r.slug === "superviseur") ?? false;
  // Indicateur « en attente de photos » : périmètre global pour manager, sinon
  // les dossiers du commercial connecté.
  const photoWaitingCount = await getPhotoWaitingCount(isAdmin || isPlanner ? undefined : profile?.id);
  // Devis à réaliser (§2). Le périmètre est celui de l'utilisateur : la RLS
  // restreint déjà les dossiers, aucun paramètre de rôle n'est nécessaire.
  const devisARealiser = await getDevisARealiserCount();
  const visibleSectors = visibleSectorsForUser({ isAdmin, isPlanner, activities: profile?.activities ?? [] });
  return (
    <>
      {/* Bandeau d'alerte AVANT les indicateurs : un lead non rappelé passe
          devant n'importe quel chiffre de performance. */}
      <AlerteNouveauxLeads
        nonTraites={nonTraites}
        isBackOffice={isAdmin || isPlanner || isSuperviseur}
      />
      <Dashboard
        series={series}
        commerciaux={commerciaux}
        annotations={isAdmin ? annotations : []}
        firstName={profile?.firstName ?? profile?.displayName ?? ""}
        currentUserId={profile?.id ?? ""}
        isAdmin={isAdmin}
        isBackOffice={isAdmin || isPlanner || isSuperviseur}
        visibleSectors={visibleSectors}
        photoWaitingCount={photoWaitingCount}
        devisARealiser={devisARealiser}
      />
    </>
  );
}
