import Planification from "./Planification";
import ActionsAttendues from "./ActionsAttendues";
import { planifPeutVoir } from "@/lib/perimetre/regle-shared";
import { getAllDossiers, getAllTechnicians } from "@/lib/planification-server";
import { getIntervenantTemplates, getActiveSmsTemplates } from "@/lib/message-templates-server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { profileCapabilities } from "@/lib/leads";

export const metadata = { title: "Planification" };

// CDC §11 — planification par pays : un planificateur ne voit que les
// interventions des pays qui lui sont attribués (users.countries). Les admins
// gardent la vision globale. Le scoping se fait ici, en amont du client.

export default async function PlanificationPage() {
  const [rows, technicians, me, intervenantTemplates, smsTemplates] = await Promise.all([
    getAllDossiers(),
    getAllTechnicians(),
    getCurrentUserProfile(),
    getIntervenantTemplates(),
    getActiveSmsTemplates(),
  ]);

  const isAdmin = (me?.roles ?? []).some((r) => r.slug === "admin");
  const isPlanif = (me?.roles ?? []).some((r) => r.slug === "planification");
  // La planificatrice a l'appel + SMS Ringover (décision client 2026-08-05).
  const { canUseRingover } = profileCapabilities(me?.commercialProfiles ?? [], isAdmin, isPlanif);

  let myCountries: string[] = [];
  // D31 : périmètre d'ENTITÉS (vide = toutes). `select("*")` : la colonne
  // n'existe qu'avec la migration 20261109000007.
  let myEntites: string[] = [];
  // D32 : sans la migration …08, la colonne manque → mode hérité.
  let monHerite = true;
  if (isPlanif && !isAdmin && me) {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("users").select("*").eq("id", me.id).maybeSingle<{ countries: string[] | null; entites_autorisees?: string[] | null; perimetre_herite?: boolean }>();
    myCountries = data?.countries ?? [];
    myEntites = data?.entites_autorisees ?? [];
    monHerite = data?.perimetre_herite ?? true;
  }

  // A17 — sécurité par défaut : un planificateur (non-admin) est TOUJOURS scopé
  // à ses pays (CDC §11). Un scope vide ne signifie plus « voit tout » mais
  // « ne voit rien » — il faut lui affecter des pays dans Réglages. Les admins
  // conservent la vision globale.
  const scoped =
    isPlanif && !isAdmin
      ? rows.filter((r) =>
          // A17 (CDC §11) : la planification se lit TOUJOURS par pays, même en
          // mode hérité — c'était déjà le cas avant D32.
          r.lead.country != null && myCountries.includes(r.lead.country)
          // D32 : LA règle de périmètre, la même que la base. En mode hérité,
          // aucune restriction d'entité (comportement d'avant D32).
          && (monHerite
              ? (myEntites.length === 0 || (r.lead.entityId != null && myEntites.includes(r.lead.entityId)))
              : planifPeutVoir({ herite: false, countries: myCountries, entitesAutorisees: myEntites },
                  { pays: r.lead.country ?? null, entiteId: r.lead.entityId ?? null })))
      : rows;

  return (
    <Planification
      initialRows={scoped}
      technicians={technicians}
      intervenantTemplates={intervenantTemplates}
      smsTemplates={smsTemplates}
      canUseRingover={canUseRingover}
      actionsAttendues={<ActionsAttendues />}
    />
  );
}
