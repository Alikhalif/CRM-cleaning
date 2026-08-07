import Dashboard from "./Dashboard";
import { getDashboardSeries, getImmobAnnotations } from "@/lib/dashboard-server";
import { getAllCommerciaux } from "@/lib/leads-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { visibleSectorsForUser } from "@/lib/leads";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [series, commerciaux, annotations, profile] = await Promise.all([
    getDashboardSeries(),
    getAllCommerciaux(),
    getImmobAnnotations(),
    getCurrentUserProfile(),
  ]);
  const isAdmin = profile?.roles.some((r) => r.slug === "admin") ?? false;
  const isPlanner = profile?.roles.some((r) => r.slug === "planification") ?? false;
  const visibleSectors = visibleSectorsForUser({ isAdmin, isPlanner, activities: profile?.activities ?? [] });
  return (
    <Dashboard
      series={series}
      commerciaux={commerciaux}
      annotations={isAdmin ? annotations : []}
      firstName={profile?.firstName ?? profile?.displayName ?? ""}
      currentUserId={profile?.id ?? ""}
      isAdmin={isAdmin}
      visibleSectors={visibleSectors}
    />
  );
}
