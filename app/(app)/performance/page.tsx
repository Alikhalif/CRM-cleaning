import { getAllLeads, getAllCommerciaux } from "@/lib/leads-server";
import PerformanceClient from "./PerformanceClient";

export const metadata = { title: "Performance commerciale" };

// CDC §14 — tableau de performance par commercial, filtrable par société, pays,
// secteur, commercial et période. RLS-scoped : un commercial ne voit que ses
// propres leads (donc sa propre ligne) ; un admin voit toute l'équipe.

export default async function PerformancePage() {
  const [leads, commerciaux] = await Promise.all([getAllLeads(), getAllCommerciaux()]);
  return <PerformanceClient leads={leads} commerciaux={commerciaux} />;
}
