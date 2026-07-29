"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon/Icon";
import {
  RINGOVER_CALL_EVENT,
  RINGOVER_STATUS_EVENT,
  type RingoverCallInfo,
  type RingoverCallState,
  type RingoverStatus,
} from "@/lib/ringover-webphone";
import styles from "./CallScreenPop.module.scss";

// Designed call card. NOT shown permanently — it appears only when a call is
// started (the "Appeler" button fires RINGOVER_CALL_EVENT), reflects the SDK
// call lifecycle (dialing → ringing → answered → ended), shows a live timer,
// and auto-dismisses shortly after the call ends.

const STATUS_LABEL: Record<RingoverCallState, string> = {
  dialing: "Appel en cours…",
  ringing: "Ça sonne…",
  answered: "En communication",
  ended: "Appel terminé",
};

function fmt(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallScreenPop() {
  const [call, setCall] = useState<RingoverCallInfo | null>(null);
  const [state, setState] = useState<RingoverCallState>("dialing");
  const [seconds, setSeconds] = useState(0);
  // The card stays hidden until a REAL call event arrives (ringing/answered) —
  // clicking "Appeler" only arms the pending info; it does not show the popup.
  const [visible, setVisible] = useState(false);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismiss = () => {
    if (dismissRef.current) {
      clearTimeout(dismissRef.current);
      dismissRef.current = null;
    }
  };

  useEffect(() => {
    const onCall = (e: Event) => {
      const detail = (e as CustomEvent<RingoverCallInfo>).detail;
      if (!detail) return;
      // Arm the pending call info but keep the popup hidden until the SDK
      // reports the call is actually ringing / answered.
      clearDismiss();
      setCall(detail);
      setState("dialing");
      setSeconds(0);
      setVisible(false);
    };
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<RingoverStatus>).detail;
      if (!detail) return;
      setState(detail.state);
      // Reveal only on a genuine call event.
      if (detail.state === "ringing" || detail.state === "answered") {
        setVisible(true);
      }
      if (detail.state === "ended") {
        clearDismiss();
        // Only linger if the card was actually shown; otherwise drop silently.
        setVisible((wasVisible) => {
          if (wasVisible) {
            dismissRef.current = setTimeout(() => {
              setCall(null);
              setVisible(false);
            }, 3000);
            return true;
          }
          setCall(null);
          return false;
        });
      }
    };
    window.addEventListener(RINGOVER_CALL_EVENT, onCall);
    window.addEventListener(RINGOVER_STATUS_EVENT, onStatus);
    return () => {
      window.removeEventListener(RINGOVER_CALL_EVENT, onCall);
      window.removeEventListener(RINGOVER_STATUS_EVENT, onStatus);
      clearDismiss();
    };
  }, []);

  // Live timer once the call is answered.
  useEffect(() => {
    if (state !== "answered") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  if (!call || !visible) return null;

  const active = state === "dialing" || state === "ringing";

  return (
    <div className={styles.wrap} role="dialog" aria-live="polite" aria-label="Appel en cours">
      <div
        className={styles.card}
        data-state={state}
        style={{ ["--sc" as string]: call.sectorVar ? `var(${call.sectorVar})` : "var(--color-brand-500)" }}
      >
        <span className={styles.accent} aria-hidden="true" />

        <button
          type="button"
          className={styles.close}
          onClick={() => {
            clearDismiss();
            setCall(null);
          }}
          aria-label="Masquer"
          title="Masquer"
        >
          <Icon name="x" size={15} />
        </button>

        <div className={styles.head}>
          <span className={styles.avatar} data-pulse={active} aria-hidden="true">
            {call.initials || call.name.slice(0, 2).toUpperCase()}
          </span>
          <div className={styles.who}>
            <div className={styles.name}>{call.name}</div>
            {call.sublabel && <div className={styles.sub}>{call.sublabel}</div>}
            <div className={styles.phone}>
              <Icon name="phone" size={12} /> {call.phone}
            </div>
          </div>
        </div>

        <div className={styles.statusRow} data-state={state}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.statusText}>{STATUS_LABEL[state]}</span>
          {(state === "answered" || state === "ended") && seconds > 0 && (
            <span className={styles.timer}>{fmt(seconds)}</span>
          )}
        </div>

        {call.leadId && (
          <Link href={`/leads/${call.leadId}`} className={styles.openBtn}>
            <Icon name="leads" size={14} /> Ouvrir la fiche
          </Link>
        )}
      </div>
    </div>
  );
}
