import Planification from "./Planification";
import { getAllDossiers, getAllTechnicians } from "@/lib/planification-server";

export const metadata = { title: "Planification" };

export default async function PlanificationPage() {
  const [rows, technicians] = await Promise.all([
    getAllDossiers(),
    getAllTechnicians(),
  ]);
  return <Planification initialRows={rows} technicians={technicians} />;
}
