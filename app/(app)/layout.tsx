import CallScreenPop from "@/components/CallScreenPop/CallScreenPop";
import CommandPalette from "@/components/CommandPalette/CommandPalette";
import MobileTabBar from "@/components/MobileTabBar/MobileTabBar";
import PresenceHeartbeat from "@/components/PresenceHeartbeat/PresenceHeartbeat";
import RealtimeNotifications from "@/components/RealtimeNotifications/RealtimeNotifications";
import RingoverPhone from "@/components/RingoverPhone/RingoverPhone";
import RolePreviewBanner from "@/components/RolePreview/RolePreviewBanner";
import RolePreviewMain from "@/components/RolePreview/RolePreviewMain";
import Sidebar from "@/components/Sidebar/Sidebar";
import Topbar from "@/components/Topbar/Topbar";
import { getUnreadCount } from "@/lib/notifications";
import { getCurrentUserProfile } from "@/lib/users-server";
import { isAdminRole, isPlannerRole } from "@/lib/access-shared";
import { profileCapabilities } from "@/lib/leads";
import styles from "./layout.module.scss";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Proxy redirects unauthenticated traffic before we get here, so user
  // should always be present — but Topbar is defensive and renders a
  // sign-out fallback if not.
  const [user, unreadCount] = await Promise.all([
    getCurrentUserProfile(),
    getUnreadCount(),
  ]);

  // Le webphone Ringover n'est monté que pour les profils qui téléphonent
  // (mêmes capacités que le bouton « Appeler »). Exceptions : le profil « Divers »
  // a aussi accès au bouton « SMS NRP », et la planificatrice a accès à l'appel +
  // SMS Ringover (décisions client 2026-08-02 / 2026-08-05).
  // Slugs des rôles détenus — pilotent le périmètre visible (sidebar + ⌘K),
  // voir lib/access-shared.ts. Les gardes de route vivent dans les layout.tsx
  // de chaque module hors périmètre commercial.
  const roleSlugs = (user?.roles ?? []).map((r) => r.slug);
  const isAdmin = isAdminRole(roleSlugs);
  const isPlanificateur = isPlannerRole(roleSlugs);
  const { canUseRingover } = profileCapabilities(user?.commercialProfiles ?? [], isAdmin, isPlanificateur);
  const isDivers = (user?.commercialProfiles ?? []).includes("divers");
  const showWebphone = canUseRingover || isDivers;

  // Rôle pour la navigation mobile (barre d'onglets) — priorité admin > planif.
  const mobileRole = isAdmin ? "admin" : isPlanificateur ? "planification" : "commercial";

  return (
    <div className={styles.shell}>
      <Sidebar roles={roleSlugs} />
      <div className={styles.main}>
        <Topbar user={user} unreadCount={unreadCount} />
        <RolePreviewBanner />
        <RolePreviewMain className={styles.content}>{children}</RolePreviewMain>
      </div>
      <CommandPalette roles={roleSlugs} />
      {user && <RealtimeNotifications userId={user.id} />}
      {user && <PresenceHeartbeat userId={user.id} />}
      {user && <MobileTabBar role={mobileRole} />}
      {showWebphone && <RingoverPhone />}
      {showWebphone && <CallScreenPop />}
    </div>
  );
}
