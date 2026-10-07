import { requireBackOffice } from "@/lib/access-server";

// Garde de module — périmètre APRÈS-SIGNATURE, réservé au back-office
// (Super Admin + Planification). Le commercial s'arrête à la signature.
//
// Placée dans le layout et non dans la page : la garde couvre ainsi TOUTES les
// sous-routes, présentes et futures. Un accès par URL directe renvoie un 404 —
// le module n'existe pas dans l'interface du commercial.
export default async function BackOfficeModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBackOffice();
  return children;
}
