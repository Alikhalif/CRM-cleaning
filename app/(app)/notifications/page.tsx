import Icon from "@/components/Icon/Icon";
import { getRecentNotifications } from "@/lib/notifications";
import { markAllRead } from "./actions";
import NotificationRow from "./NotificationRow";
import styles from "./Notifications.module.scss";

export const metadata = { title: "Notifications" };

// Thin wrapper so the form action matches Next's expected signature
// (formData → void). The real action returns a Result we want to keep for
// programmatic callers, so we drop the result here.
async function markAllReadFormAction() {
  "use server";
  await markAllRead();
}

export default async function NotificationsPage() {
  const notifications = await getRecentNotifications(100);
  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Notifications</h1>
          <p className={styles.subtitle}>
            {unreadCount > 0
              ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""} · `
              : "Toutes lues · "}
            {notifications.length} récente{notifications.length > 1 ? "s" : ""}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllReadFormAction}>
            <button type="submit" className={styles.markAllBtn}>
              <Icon name="check" size={14} /> Tout marquer comme lu
            </button>
          </form>
        )}
      </header>

      <ul className={styles.list}>
        {notifications.length === 0 && (
          <li className={styles.empty}>
            Aucune notification pour l&apos;instant. Vous serez prévenu·e ici dès qu&apos;un client
            répond à un devis, qu&apos;un appel arrive, ou qu&apos;un lead vous est attribué.
          </li>
        )}
        {notifications.map((n) => (
          <NotificationRow key={n.id} notification={n} />
        ))}
      </ul>
    </div>
  );
}
