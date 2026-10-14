import { requireAdmin } from "@/lib/access-server";

// Les barèmes tarifaires sont modifiables par le SUPER ADMIN seul (exigence
// client : un commercial ne doit jamais pouvoir changer une règle de prix).
// La RLS de pricing_params applique la même règle côté base — cette garde
// évite seulement d'afficher un écran qui échouerait à l'écriture.
export default async function PricingSettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
