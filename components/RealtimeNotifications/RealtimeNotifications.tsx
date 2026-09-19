"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { NOTIF_SOUND_KEY } from "@/lib/notif-preferences";
import styles from "./RealtimeNotifications.module.scss";

// Mounted once in the app layout. Subscribes to Supabase Realtime on
// `notifications` filtered by the current user. On every change it triggers
// router.refresh() so the topbar bell badge re-fetches its unread count.
//
// En plus (chaîne d'arrivée §16-17) : sur une INSERTION (nouveau lead / nouvelle
// notification), on affiche un TOAST cliquable et on joue un SON (configurable
// ON/OFF, préférence par utilisateur en localStorage). Le contenu du toast est
// exactement celui de la notification stockée — donc déjà filtré par rôle
// (un commercial ne reçoit jamais de provenance). Aucune donnée n'est révélée
// ici qui ne le serait pas déjà dans le centre de notifications.
//
// RLS est appliquée sur le canal realtime, donc le filtre client est ceinture +
// bretelles : Postgres n'émet que les lignes où user_id = auth.uid().

type Props = { userId: string };

type Toast = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
};

const TOAST_TTL_MS = 8000;
const MAX_TOASTS = 4;

// Bip court via Web Audio — pas de fichier binaire à embarquer. Best-effort :
// si la politique d'autoplay du navigateur bloque le contexte audio, on échoue
// en silence (le toast visuel reste, lui, toujours affiché).
function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    void ctx.resume?.();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    // Enveloppe rapide pour éviter les clics, volume modéré.
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
    osc.onended = () => {
      try {
        void ctx.close();
      } catch {
        /* noop */
      }
    };
  } catch {
    /* autoplay bloqué ou Web Audio indisponible — silencieux */
  }
}

function soundEnabled(): boolean {
  try {
    return (localStorage.getItem(NOTIF_SOUND_KEY) ?? "on") !== "off";
  } catch {
    return true; // localStorage indisponible (mode privé) → défaut ON
  }
}

export default function RealtimeNotifications({ userId }: Props) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const supabase = supabaseBrowser();

    // Unique channel name per user so multiple tabs don't collide on the
    // server side (Supabase Realtime multiplexes channels per connection).
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT for new arrivals, UPDATE for mark-read toggles
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Met à jour le badge (relit getUnreadCount côté layout).
          router.refresh();

          // Alerte forte uniquement à l'ARRIVÉE (INSERT), pas sur un mark-read.
          if (payload.eventType !== "INSERT") return;
          const row = payload.new as Partial<Toast> & { id?: string };
          if (!row?.id) return;
          const toast: Toast = {
            id: row.id,
            kind: row.kind ?? "",
            title: row.title ?? "Nouvelle notification",
            body: row.body ?? null,
            href: row.href ?? null,
          };
          setToasts((cur) => [toast, ...cur].slice(0, MAX_TOASTS));
          const timer = setTimeout(() => dismiss(toast.id), TOAST_TTL_MS);
          timers.current.set(toast.id, timer);
          if (soundEnabled()) playBeep();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router, dismiss]);

  // Nettoyage de tous les timers au démontage.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastStack} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast} data-kind={t.kind}>
          <button
            type="button"
            className={styles.toastBody}
            onClick={() => {
              if (t.href) router.push(t.href);
              dismiss(t.id);
            }}
          >
            <span className={styles.toastIcon} aria-hidden="true">
              <Icon name="leads" size={16} />
            </span>
            <span className={styles.toastText}>
              <span className={styles.toastTitle}>{t.title}</span>
              {t.body && <span className={styles.toastSub}>{t.body}</span>}
            </span>
          </button>
          <button
            type="button"
            className={styles.toastClose}
            onClick={() => dismiss(t.id)}
            aria-label="Fermer la notification"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
