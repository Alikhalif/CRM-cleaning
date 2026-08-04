import Planification from "./Planification";
import { getAllDossiers, getAllTechnicians } from "@/lib/planification-server";
import { getIntervenantTemplates } from "@/lib/message-templates-server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/users-server";

export const metadata = { title: "Planification" };

// CDC §11 — planification par pays : un planificateur ne voit que les
// interventions des pays qui lui sont attribués (users.countries). Les admins
// gardent la vision globale. Le scoping se fait ici, en amont du client.

export default async function PlanificationPage() {
  const [rows, technicians, me, intervenantTemplates] = await Promise.all([
    getAllDossiers(),
    getAllTechnicians(),
    getCurrentUserProfile(),
    getIntervenantTemplates(),
  ]);

  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");
  const isPlanif = (me?.roles ?? []).some((r) => r.slug === "planification");

  let myCountries: string[] = [];
  if (isPlanif && !isAdmin && me) {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("users").select("countries").eq("id", me.id).maybeSingle<{ countries: string[] | null }>();
    myCountries = data?.countries ?? [];
  }

  // Planificateur (non-admin) with a country scope → restrict to those countries.
  const scoped =
    isPlanif && !isAdmin && myCountries.length > 0
      ? rows.filter((r) => r.lead.country && myCountries.includes(r.lead.country))
      : rows;

  return <Planification initialRows={scoped} technicians={technicians} intervenantTemplates={intervenantTemplates} />;
}
