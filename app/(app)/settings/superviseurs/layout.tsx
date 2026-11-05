import { requireAdmin } from "@/lib/access-server";

// Garde de module — attribuer un périmètre de supervision est un acte
// d'administration : c'est ce qui décide qui voit quelles données
// commerciales. Réservé au Super Admin (consigne client 2026-11-05 : « Les
// autorisations sont définies exclusivement par le Super Admin »).
//
// Dans le layout et non dans la page : la garde couvre ainsi toutes les
// sous-routes, présentes et futures. Un accès par URL directe renvoie un 404.
export default async function PerimetresSuperviseursLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return children;
}
