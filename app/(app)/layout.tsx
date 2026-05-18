import CommandPalette from "@/components/CommandPalette/CommandPalette";
import RealtimeNotifications from "@/components/RealtimeNotifications/RealtimeNotifications";
import Sidebar from "@/components/Sidebar/Sidebar";
import Topbar from "@/components/Topbar/Topbar";
import { getUnreadCount } from "@/lib/notifications";
import { getCurrentUserProfile } from "@/lib/users-server";
import styles from "./layout.module.scss";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Proxy redirects unauthenticated traffic before we get here, so user
  // should always be present — but Topbar is defensive and renders a
  // sign-out fallback if not.
  const [user, unreadCount] = await Promise.all([
    getCurrentUserProfile(),
    getUnreadCount(),
  ]);

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar user={user} unreadCount={unreadCount} />
        <main className={styles.content}>{children}</main>
      </div>
      <CommandPalette />
      {user && <RealtimeNotifications userId={user.id} />}
    </div>
  );
}
