import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import { getRecentNotifications } from "@/lib/notifications";
import { markAllRead } from "./actions";
import styles from "./Notifications.module.scss";

// Thin wrapper so the form action matches Next's expected signature
// (formData → void). The real action returns a Result we want to keep for
// programmatic callers, so we drop the result here.
async function markAllReadFormAction() {
  "use server";
  await markAllRead();
}

export const metadata = { title: "Notifications" };

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
        {notifications.map((n) => {
          const unread = n.read_at === null;
          const body = (
            <>
              <div className={styles.itemHead}>
                <span className={styles.kind} data-kind={n.kind}>
                  {labelForKind(n.kind)}
                </span>
                <RelativeTime iso={n.created_at} className={styles.relTime} />
              </div>
              <p className={styles.itemTitle}>{n.title}</p>
              {n.body && <p className={styles.itemBody}>{n.body}</p>}
            </>
          );
          return (
            <li key={n.id} className={`${styles.item} ${unread ? styles.itemUnread : ""}`}>
              {n.href ? (
                <Link href={n.href} className={styles.itemLink}>{body}</Link>
              ) : (
                <div className={styles.itemLink}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Short human label for the kind chip. Stays string-keyed so adding new
// kinds doesn't require a type extension — unknowns fall back to the raw string.
function labelForKind(kind: string): string {
  return {
    "email.reply": "Réponse email",
    "call.missed.inbound": "Appel manqué",
    "call.missed.outbound": "Appel non répondu",
    "call.inbound": "Appel entrant",
    "lead.assigned": "Lead attribué",
    "lead.lost": "Lead perdu",
  }[kind] ?? kind;
}
