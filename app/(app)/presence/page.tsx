import Icon from "@/components/Icon/Icon";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getTeamToday } from "@/lib/presence/presence-server";
import { getDashboardStats, getOpenAlerts } from "@/lib/presence/alerts-server";
import PresenceDashboard from "./PresenceDashboard";
import styles from "./presence.module.scss";

export const metadata = { title: "Présence & Actions — Super Admin" };
export const dynamic = "force-dynamic";

export default async function PresencePage() {
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.roles.some((r) => r.slug === "admin") ?? false;
  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <header className={styles.head}><h1 className={styles.title}>Présence &amp; Actions</h1></header>
        <p className={styles.denied}>
          <Icon name="alert" size={14} /> Module réservé au Super Admin.
        </p>
      </div>
    );
  }

  const [team, stats, alerts] = await Promise.all([
    getTeamToday(),
    getDashboardStats(),
    getOpenAlerts(),
  ]);

  return <PresenceDashboard team={team} stats={stats} alerts={alerts} />;
}
