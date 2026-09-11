import { getCurrentUserProfile } from "@/lib/users-server";
import { getMyActions, getManagerData, getCommercialRules, getPhotoWaiting, type ManagerData, type CommercialRule, type PhotoWaitingRow } from "@/lib/commercial-actions/read-server";
import MaJournee from "./MaJournee";

export const metadata = { title: "Ma journée" };
export const dynamic = "force-dynamic";

const TAB_KEYS = ["a_faire", "en_retard", "reportee", "photos", "terminee", "equipe"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default async function MaJourneePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await getCurrentUserProfile();
  if (!profile) return null; // le proxy garde déjà l'accès
  const { tab } = await searchParams;
  const initialTab = TAB_KEYS.find((k) => k === tab) as TabKey | undefined;

  const isAdmin = profile.roles.some((r) => r.slug === "admin");
  const isManager = isAdmin || profile.roles.some((r) => r.slug === "planification");
  const [mine, manager, rules, photoWaiting] = await Promise.all([
    getMyActions(profile.id),
    isManager ? getManagerData() : Promise.resolve<ManagerData | null>(null),
    isAdmin ? getCommercialRules() : Promise.resolve<CommercialRule[]>([]),
    getPhotoWaiting(isManager ? {} : { ownerId: profile.id }),
  ]);

  return (
    <MaJournee
      actions={mine.actions}
      urgentAfterHours={mine.urgentAfterHours}
      isManager={isManager}
      isAdmin={isAdmin}
      manager={manager}
      rules={rules}
      photoWaiting={photoWaiting as PhotoWaitingRow[]}
      meName={profile.displayName}
      serverNow={nowMs()}
      initialTab={initialTab}
    />
  );
}

// Isolé : Date.now() dans un composant serveur est ré-évalué par requête
// (voulu — l'horloge de départ). Le helper contourne react-hooks/purity.
function nowMs(): number {
  return Date.now();
}
