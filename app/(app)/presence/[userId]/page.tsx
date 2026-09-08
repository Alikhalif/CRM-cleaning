import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import { getCurrentUserProfile } from "@/lib/users-server";
import { getUserDay, getActions, todayParis } from "@/lib/presence/presence-server";
import { getUserAlerts } from "@/lib/presence/alerts-server";
import UserDetail from "./UserDetail";
import styles from "../presence.module.scss";

export const metadata = { title: "Activité utilisateur — Présence & Actions" };
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ date?: string }>;
};

export default async function UserPresencePage({ params, searchParams }: PageProps) {
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.roles.some((r) => r.slug === "admin") ?? false;
  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <p className={styles.denied}><Icon name="alert" size={14} /> Module réservé au Super Admin.</p>
      </div>
    );
  }

  const { userId } = await params;
  const { date } = await searchParams;
  const day = date || todayParis();

  const [summary, alerts, actions] = await Promise.all([
    getUserDay(userId, day),
    getUserAlerts(userId, day),
    getActions({ userId, day, limit: 500 }),
  ]);

  if (!summary) {
    return (
      <div className={styles.page}>
        <header className={styles.head}><h1 className={styles.title}>Utilisateur introuvable</h1></header>
        <p><Link href="/presence" className={styles.link}>← Retour</Link></p>
      </div>
    );
  }

  return <UserDetail summary={summary} alerts={alerts} actions={actions.events} day={day} />;
}
