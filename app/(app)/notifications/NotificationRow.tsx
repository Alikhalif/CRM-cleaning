"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import { markNotificationRead } from "./actions";
import styles from "./Notifications.module.scss";

// Small client island handling the click semantics on each notification row:
// clicking an unread row both marks it read AND navigates to its target.
// A read row just navigates (or does nothing if no href). Keyboard parity
// — Enter / Space activate the row.

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

type Props = { notification: Notification };

export default function NotificationRow({ notification }: Props) {
  const router = useRouter();
  // Local optimistic toggle so the strip + tint disappear immediately on
  // click — the server's eventual revalidate confirms the state.
  const [readOptimistic, setReadOptimistic] = useState(notification.read_at !== null);
  const [, startTransition] = useTransition();

  const activate = () => {
    if (!readOptimistic) {
      setReadOptimistic(true);
      startTransition(() => {
        void markNotificationRead(notification.id);
      });
    }
    if (notification.href) router.push(notification.href);
  };

  return (
    <li
      className={`${styles.item} ${readOptimistic ? "" : styles.itemUnread}`}
      role={notification.href ? "button" : undefined}
      tabIndex={notification.href ? 0 : undefined}
      onClick={notification.href ? activate : undefined}
      onKeyDown={(e) => {
        if (notification.href && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          activate();
        }
      }}
      style={notification.href ? { cursor: "pointer" } : undefined}
    >
      <div className={styles.itemLink}>
        <div className={styles.itemHead}>
          <span className={styles.kind} data-kind={notification.kind}>
            {labelForKind(notification.kind)}
          </span>
          <RelativeTime iso={notification.created_at} className={styles.relTime} />
        </div>
        <p className={styles.itemTitle}>{notification.title}</p>
        {notification.body && <p className={styles.itemBody}>{notification.body}</p>}
      </div>
    </li>
  );
}

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
