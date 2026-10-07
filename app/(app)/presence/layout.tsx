import { requireAdmin } from "@/lib/access-server";

// Garde de module — pilotage d'équipe / supervision, réservé au Super Admin
// (CDC §3 : la visibilité « Commerciaux » et « Présence & Actions » lui est
// exclusive).
//
// Placée dans le layout et non dans la page : la garde couvre ainsi TOUTES les
// sous-routes, présentes et futures. Un accès par URL directe renvoie un 404.
export default async function AdminModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return children;
}
