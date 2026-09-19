"use client";

import Icon from "@/components/Icon/Icon";
import { useStoredValue, setStoredValue } from "@/lib/client-store";
import { NOTIF_SOUND_KEY } from "@/lib/notif-preferences";
import styles from "./Notifications.module.scss";

// Réglage « Son des nouveaux leads : ON / OFF » (chaîne d'arrivée §17).
// Préférence par utilisateur, persistée en localStorage (pub/sub client-store) ;
// lue au moment de jouer le bip dans RealtimeNotifications. Défaut = ON.
export default function NotifSoundToggle() {
  const value = useStoredValue(NOTIF_SOUND_KEY, "on");
  const on = value !== "off";
  return (
    <button
      type="button"
      className={styles.markAllBtn}
      onClick={() => setStoredValue(NOTIF_SOUND_KEY, on ? "off" : "on")}
      aria-pressed={on}
      title={
        on
          ? "Son des nouveaux leads activé — cliquer pour couper"
          : "Son des nouveaux leads coupé — cliquer pour activer"
      }
    >
      <Icon name="bell" size={14} /> Son&nbsp;: {on ? "activé" : "coupé"}
    </button>
  );
}
