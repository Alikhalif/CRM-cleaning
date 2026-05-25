"use client";

import Icon from "@/components/Icon/Icon";
import { useEffect, useRef, useState } from "react";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import { updateLeadNotes } from "@/app/(app)/pipeline/actions";
import styles from "./LeadDetail.module.scss";

// Autosaving "Notes d'appel" card. Debounces input by 1.2s, fires the
// server action in a transition, and shows a small saved-at indicator.
// Writes to leads.notes — same column the existing UI displayed read-only.

type Props = {
  leadId: string;
  initialNotes: string;
  initialNextFollowup?: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function CallNotesCard({ leadId, initialNotes, initialNextFollowup }: Props) {
  const [value, setValue] = useState(initialNotes);
  const [state, setState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(initialNotes ? new Date().toISOString() : null);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(initialNotes);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save — 1.2s after the user stops typing.
  useEffect(() => {
    if (value === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setState("saving");
      const result = await updateLeadNotes(leadId, value);
      if (!result.ok) {
        setState("error");
        setError(result.error);
        return;
      }
      lastSavedRef.current = value;
      setSavedAt(new Date().toISOString());
      setState("saved");
      setError(null);
    }, 1200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, leadId]);

  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <h2 className={styles.h2}>
          <Icon name="edit" size={14} /> Notes d&apos;appel
        </h2>
        {state === "saving" && <span className={styles.savedBadge} data-state="saving">Enregistrement…</span>}
        {state === "saved" && savedAt && (
          <span className={styles.savedBadge} data-state="saved">
            <Icon name="check" size={11} /> Enregistré <RelativeTime iso={savedAt} />
          </span>
        )}
        {state === "idle" && savedAt && (
          <span className={styles.savedBadge} data-state="idle">
            Enregistré <RelativeTime iso={savedAt} />
          </span>
        )}
        {state === "error" && (
          <span className={styles.savedBadge} data-state="error">
            <Icon name="alert" size={11} /> Échec
          </span>
        )}
      </header>
      <textarea
        className={styles.notesArea}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="Résumé du dernier échange, blocages, contraintes…"
      />
      {error && <p className={styles.errorMessage}>{error}</p>}
      <p className={styles.followupHint}>
        Prochaine relance :{" "}
        {initialNextFollowup ? (
          <strong>
            <RelativeTime iso={initialNextFollowup} />
          </strong>
        ) : (
          <span className={styles.muted}>Aucune</span>
        )}
      </p>
    </section>
  );
}
