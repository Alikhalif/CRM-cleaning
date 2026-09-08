import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getRules, getThresholdsConfig } from "@/lib/presence/alerts-server";
import AlertSettings from "./AlertSettings";
import styles from "../presence.module.scss";

export const metadata = { title: "Paramètres des alertes — Présence & Actions" };
export const dynamic = "force-dynamic";

export default async function PresenceSettingsPage() {
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.roles.some((r) => r.slug === "admin") ?? false;
  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <p className={styles.denied}><Icon name="alert" size={14} /> Module réservé au Super Admin.</p>
      </div>
    );
  }

  const [rules, thresholds] = await Promise.all([getRules(), getThresholdsConfig()]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link href="/presence" className={styles.back}><Icon name="chevron-down" size={14} /> Retour</Link>
          <h1 className={styles.title}>Paramètres des alertes</h1>
          <p className={styles.subtitle}>Seuils modifiables sans toucher au code · Super Admin</p>
        </div>
      </header>
      <AlertSettings rules={rules} thresholds={thresholds} />
    </div>
  );
}
