"use client";

import { useEffect, useRef } from "react";

// Battement de présence — composant INVISIBLE (rend null), monté une seule fois
// dans le layout authentifié (comme RealtimeNotifications). Il n'affiche rien et
// ne change rien à l'expérience utilisateur : il envoie, en arrière-plan, un
// signal de présence à partir de l'usage NORMAL du CRM (souris/clavier/nav +
// visibilité de l'onglet). Aucune surveillance hors du CRM.
//
// « Actif » = une interaction a eu lieu dans la fenêtre récente ET l'onglet est
// visible. « Session ouverte » = l'onglet est ouvert (battement reçu). Le
// serveur distingue temps de session ≠ temps d'activité réelle.

const HEARTBEAT_MS = 45_000; // cadence d'envoi
const ACTIVE_WINDOW_MS = 60_000; // interaction récente = actif

export default function PresenceHeartbeat({ userId }: { userId: string }) {
  const lastInteraction = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;
    lastInteraction.current = Date.now();

    const bump = () => {
      lastInteraction.current = Date.now();
    };
    const events: (keyof DocumentEventMap)[] = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "click",
      "touchstart",
      "visibilitychange",
    ];
    for (const e of events) document.addEventListener(e, bump, { passive: true });

    const beat = () => {
      const visible = document.visibilityState === "visible";
      const active = visible && Date.now() - lastInteraction.current < ACTIVE_WINDOW_MS;
      const page = typeof window !== "undefined" ? window.location.pathname : null;
      // keepalive : le battement part même si la page se ferme juste après.
      fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active, page }),
        keepalive: true,
      }).catch(() => {
        /* présence best-effort */
      });
    };

    beat(); // battement immédiat à l'arrivée
    const id = window.setInterval(beat, HEARTBEAT_MS);

    // Fermeture d'onglet → signal hors-ligne fiable (sendBeacon).
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        try {
          navigator.sendBeacon("/api/presence/offline");
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);

    return () => {
      window.clearInterval(id);
      for (const e of events) document.removeEventListener(e, bump);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [userId]);

  return null;
}
