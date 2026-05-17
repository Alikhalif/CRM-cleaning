import Dashboard from "./Dashboard";
import { getDashboardSeries } from "@/lib/dashboard-server";
import { getAllCommerciaux } from "@/lib/leads-server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  // Both fetched in parallel: the daily-metric series for the charts/KPIs,
  // and the commerciaux list so topCommerciaux can rank real owners (it
  // joins the series's ownerId against this list).
  const [series, commerciaux] = await Promise.all([
    getDashboardSeries(),
    getAllCommerciaux(),
  ]);
  return <Dashboard series={series} commerciaux={commerciaux} />;
}
