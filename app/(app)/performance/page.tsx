import { getAllLeads, getAllCommerciaux } from "@/lib/leads-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import PerformanceClient from "./PerformanceClient";

export const metadata = { title: "Performance commerciale" };

// CDC §14 — tableau de performance par commercial, filtrable par société, pays,
// secteur, commercial et période. RLS-scoped : un commercial ne voit que ses
// propres leads (donc sa propre ligne) ; un admin voit toute l'équipe.

export default async function PerformancePage() {
  const [leads, commerciaux, me] = await Promise.all([
    getAllLeads(),
    getAllCommerciaux(),
    getCurrentUserProfile(),
  ]);
  const roles = (me?.roles ?? []).map((r) => r.slug);
  const isBackOffice = roles.includes("admin") || roles.includes("planification");
  return <PerformanceClient leads={leads} commerciaux={commerciaux} isBackOffice={isBackOffice} />;
}
