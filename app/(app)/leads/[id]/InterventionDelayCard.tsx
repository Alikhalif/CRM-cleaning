"use client";

import Icon from "@/components/Icon/Icon";
import { useEffect, useRef, useState } from "react";
import { updateInterventionDelay } from "@/app/(app)/pipeline/actions";
import {
  INTERVENTION_DELAY_LABEL,
  type InterventionDelay,
} from "@/lib/leads";
import styles from "./LeadDetail.module.scss";

// "Délai d'intervention souhaité" — CDC §4.5. Captured by the commercial
// post-signature; remonte to the planificatrice via the Planification
// queue (her view sorts by urgency). Five radio-style buckets + a free-text
// précisions textarea. Both fields autosave on change (debounced 800ms).

type Props = {
  leadId: string;
  initialDelay?: InterventionDelay;
  initialNotes: string;
};

const DELAYS: InterventionDelay[] = [
  "sous_72h",
  "1_semaine",
  "15_jours",
  "1_mois",
  "personnalise",
];

type SaveState = "idle" | "saving" | "saved" | "error";

export default function InterventionDelayCard({
  leadId,
  initialDelay,
  initialNotes,
}: Props) {
  const [delay, setDelay] = useState<InterventionDelay | undefined>(initialDelay);
  const [notes, setNotes] = useState(initialNotes);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const lastSavedRef = useRef<{ delay?: InterventionDelay; notes: string }>({
    delay: initialDelay,
    notes: initialNotes,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save. The radio (single click) and textarea (typing) both go
  // through here so the user can rapid-fire toggle and we still save once.
  useEffect(() => {
    const changed =
      delay !== lastSavedRef.current.delay ||
      notes !== lastSavedRef.current.notes;
    if (!changed) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    // Radio changes save fast (200ms); text changes slower (800ms) so the
    // user can type a sentence without 10 saves.
    const debounceMs = delay !== lastSavedRef.current.delay ? 200 : 800;
    timerRef.current = setTimeout(async () => {
      setState("saving");
      const result = await updateInterventionDelay(leadId, delay ?? null, notes);
      if (!result.ok) {
        setState("error");
        setError(result.error);
        return;
      }
      lastSavedRef.current = { delay, notes };
      setState("saved");
      setError(null);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [delay, notes, leadId]);

  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <h2 className={styles.h2}>
          <Icon name="check" size={14} /> Délai d&apos;intervention souhaité
          <span className={styles.postSignatureTag}>Post-signature</span>
        </h2>
        {state === "saving" && (
          <span className={styles.savedBadge} data-state="saving">Enregistrement…</span>
        )}
        {state === "saved" && (
          <span className={styles.savedBadge} data-state="saved">
            <Icon name="check" size={11} /> Enregistré
          </span>
        )}
        {state === "idle" && (initialDelay || initialNotes) && (
          <span className={styles.autoBadge}>Auto-enregistré</span>
        )}
        {state === "error" && (
          <span className={styles.savedBadge} data-state="error">
            <Icon name="alert" size={11} /> Échec
          </span>
        )}
      </header>

      <p className={styles.delayIntro}>
        Cochez le délai souhaité par le client. Cette information remonte
        automatiquement à l&apos;équipe Planification.
      </p>

      <div className={styles.delayGrid}>
        {DELAYS.map((d) => (
          <label key={d} className={styles.delayOption}>
            <input
              type="radio"
              name={`intervention-delay-${leadId}`}
              checked={delay === d}
              onChange={() => setDelay(d)}
              className={styles.delayInput}
            />
            <span className={styles.delayMark} aria-hidden="true" />
            <span className={styles.delayLabel}>{INTERVENTION_DELAY_LABEL[d]}</span>
          </label>
        ))}
      </div>

      {delay && (
        <button
          type="button"
          className={styles.delayClear}
          onClick={() => setDelay(undefined)}
        >
          Effacer la sélection
        </button>
      )}

      <div className={styles.delayPrecisions}>
        <span className={styles.delayPrecisionsLabel}>PRÉCISIONS</span>
        <textarea
          className={styles.notesArea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Ex : disponible uniquement le mercredi · présence d'un proche requise · contrainte de copropriété…"
        />
      </div>

      {error && <p className={styles.errorMessage}>{error}</p>}
    </section>
  );
}
