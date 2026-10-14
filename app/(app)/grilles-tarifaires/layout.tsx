import { requireAdmin } from "@/lib/access-server";

// Module réservé au SUPER ADMIN. Garde placée dans le layout : elle couvre
// toutes les sous-routes, présentes et futures. Un accès par URL directe
// renvoie un 404 — le module n'existe pas pour les autres rôles. La RLS de
// pricing_grids applique la même règle en base : masquer l'onglet ne suffirait
// pas.
export default async function GrillesTarifairesLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
