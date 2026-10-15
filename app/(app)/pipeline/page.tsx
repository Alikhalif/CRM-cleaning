import NewLeadButton from "./NewLeadButton";
import PipelineBoard from "./PipelineBoard";
import PipelineShell from "./PipelineShell";
import { getSuiviData } from "@/lib/suivi-server";
import styles from "./Pipeline.module.scss";
import { isN8nSequenceEnabled } from "@/lib/app-settings";
import { getAllCommerciaux, getAllLeads } from "@/lib/leads-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { profileCapabilities, visibleSectorsForUser } from "@/lib/leads";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const [leads, commerciaux, n8nEnabled, user, suivi] = await Promise.all([
    getAllLeads(),
    getAllCommerciaux(),
    isN8nSequenceEnabled(),
    getCurrentUserProfile(),
    // MÊME source que le Suivi commercial : un seul système de statuts, donc
    // aucune désynchronisation possible entre les deux modules.
    getSuiviData(),
  ]);

  // Droit de créer un lead — dérivé du profil (auto). Le profil « Divers »
  // (nettoyage) ne peut pas créer de lead ; l'admin le peut toujours.
  const isAdmin = (user?.roles ?? []).some((r) => r.slug === "admin");
  const isPlanner = (user?.roles ?? []).some((r) => r.slug === "planification");
  const { canAddLead } = profileCapabilities(user?.commercialProfiles ?? [], isAdmin);

  // Restriction par activité : ne montrer que les secteurs affectés au user.
  const visibleSectors = visibleSectorsForUser({ isAdmin, isPlanner, activities: user?.activities ?? [] });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Pipeline commercial</h1>
          <p className={styles.subtitle}>
            Vue rapide de l&apos;avancement. Le travail commercial se fait dans le Suivi commercial.
          </p>
        </div>
        {canAddLead && (
          <NewLeadButton commerciaux={commerciaux} currentUserId={user?.id ?? ""} visibleSectors={visibleSectors} />
        )}
      </header>
      <PipelineShell
        rows={suivi.rows}
        kanban={
          <PipelineBoard initialLeads={leads} commerciaux={commerciaux} n8nEnabled={n8nEnabled} visibleSectors={visibleSectors} />
        }
      />
    </div>
  );
}
