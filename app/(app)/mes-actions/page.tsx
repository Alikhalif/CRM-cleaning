import { getCurrentUserProfile } from "@/lib/users-server";
import {
  getManagerData, getCommercialRules, getPhotoWaiting,
  type ManagerData, type CommercialRule, type PhotoWaitingRow,
} from "@/lib/commercial-actions/read-server";
import { getMesActions, getDossiersRattachables } from "@/lib/mes-actions/server";
import { getDevisARealiserCount } from "@/lib/devis-a-realiser/server";
import MesActions from "./MesActions";

export const metadata = { title: "Mes actions" };
export const dynamic = "force-dynamic";

export default async function MesActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string; tab?: string }>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) return null; // le proxy garde déjà l'accès

  const { filtre, tab } = await searchParams;
  const isAdmin = profile.roles.some((r) => r.slug === "admin");
  const isManager = isAdmin || profile.roles.some((r) => r.slug === "planification");

  const [donnees, dossiers, manager, rules, photoWaiting, devisARealiser] = await Promise.all([
    getMesActions(profile.id),
    getDossiersRattachables(profile.id, isManager),
    isManager ? getManagerData() : Promise.resolve<ManagerData | null>(null),
    isAdmin ? getCommercialRules() : Promise.resolve<CommercialRule[]>([]),
    // Le commercial ne voit QUE ses dossiers en attente de photos : la
    // restriction est posée ici, côté serveur.
    getPhotoWaiting(isManager ? {} : { ownerId: profile.id }),
    // §9 — le commercial retrouve ici ses devis à réaliser. On n'affiche
    // qu'un COMPTEUR vers la vue dédiée : le moteur d'actions crée déjà une
    // tâche « Envoyer le devis » passé le délai configuré, et en dupliquer la
    // liste ferait apparaître deux fois le même travail.
    getDevisARealiserCount(),
  ]);

  return (
    <MesActions
      items={donnees.items}
      erreur={donnees.erreur}
      serverNow={donnees.serverNow}
      dossiers={dossiers}
      meName={profile.displayName}
      isManager={isManager}
      isAdmin={isAdmin}
      manager={manager}
      rules={rules}
      photoWaiting={photoWaiting as PhotoWaitingRow[]}
      // L'ancienne adresse /ma-journee?tab=photos reste fonctionnelle : la
      // bannière du tableau de bord y renvoie, et elle n'a pas à être
      // modifiée pour cette refonte.
      devisARealiser={devisARealiser}
      filtreInitial={filtre ?? null}
      ouvrirPhotos={tab === "photos"}
    />
  );
}
