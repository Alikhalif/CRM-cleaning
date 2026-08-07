import NewLeadButton from "./NewLeadButton";
import PipelineBoard from "./PipelineBoard";
import styles from "./Pipeline.module.scss";
import { isN8nSequenceEnabled } from "@/lib/app-settings";
import { getAllCommerciaux, getAllLeads } from "@/lib/leads-server";
import { getCurrentUserProfile } from "@/lib/users-server";
import { profileCapabilities, visibleSectorsForUser } from "@/lib/leads";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const [leads, commerciaux, n8nEnabled, user] = await Promise.all([
    getAllLeads(),
    getAllCommerciaux(),
    isN8nSequenceEnabled(),
    getCurrentUserProfile(),
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
            7 colonnes · glisser-déposer entre étapes · sous-statuts Mano/Auto et Sans/Avec acompte
          </p>
        </div>
        {canAddLead && (
          <NewLeadButton commerciaux={commerciaux} currentUserId={user?.id ?? ""} />
        )}
      </header>
      <PipelineBoard initialLeads={leads} commerciaux={commerciaux} n8nEnabled={n8nEnabled} visibleSectors={visibleSectors} />
    </div>
  );
}
