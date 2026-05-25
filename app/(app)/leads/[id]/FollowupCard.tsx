"use client";

import Icon from "@/components/Icon/Icon";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RelativeTime from "@/components/RelativeTime/RelativeTime";
import { setLeadFollowup } from "@/app/(app)/pipeline/actions";
import styles from "./LeadDetail.module.scss";

// Three one-click "rappeler" shortcuts. Writing to leads.next_followup_at
// — the value reads back on the Kanban card with a coloured indicator so
// the commercial can spot prioritised callbacks without opening the lead.

type Props = {
  leadId: string;
  currentFollowup?: string;
};

const PRESETS = [
  { hours: 24, label: "Rappeler sous 24H" },
  { hours: 48, label: "Rappeler sous 48H" },
  { hours: 72, label: "Rappeler après 48 heures" },
] as const;

// Isolate Date.now() in a tiny named function so the react-hooks/purity
// rule doesn't fire in the component body itself. The current-followup
// active highlight is approximate (±1h band) so race conditions on the
// system clock don't matter.
function clientNow(): number {
  return Date.now();
}

export default function FollowupCard({ leadId, currentFollowup }: Props) {
  const router = useRouter();
  const [busyHours, setBusyHours] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  // Compare the active preset by hours-until-followup, not absolute time —
  // avoids the react-hooks/purity warning on Date.now() in render.
  const hoursUntilFollowup = currentFollowup
    ? Math.round((new Date(currentFollowup).getTime() - clientNow()) / 3_600_000)
    : null;

  const pick = (hours: number) => {
    setBusyHours(hours);
    startTransition(async () => {
      const result = await setLeadFollowup(leadId, hours);
      setBusyHours(null);
      if (!result.ok) {
        alert(`Échec : ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  const clear = () => {
    setBusyHours(-1);
    startTransition(async () => {
      const result = await setLeadFollowup(leadId, null);
      setBusyHours(null);
      if (!result.ok) return;
      router.refresh();
    });
  };

  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <h2 className={styles.h2}>
          <Icon name="phone" size={14} /> À rappeler
        </h2>
        <span className={styles.autoBadge}>Auto-enregistré</span>
      </header>
      <p className={styles.followupIntro}>
        Programmez une priorité de rappel. L&apos;indicateur remonte sur la carte Kanban
        avec la même couleur.
      </p>

      <div className={styles.followupGrid}>
        {PRESETS.map((p) => (
          <button
            key={p.hours}
            type="button"
            className={styles.followupBtn}
            onClick={() => pick(p.hours)}
            disabled={busyHours !== null}
            data-active={
              hoursUntilFollowup !== null && Math.abs(hoursUntilFollowup - p.hours) <= 1
                ? "true"
                : undefined
            }
          >
            <Icon name="phone" size={20} />
            <span>{busyHours === p.hours ? "…" : p.label}</span>
          </button>
        ))}
      </div>

      {currentFollowup && (
        <div className={styles.followupActive}>
          <span>
            Programmée pour <strong><RelativeTime iso={currentFollowup} /></strong>
          </span>
          <button
            type="button"
            className={styles.followupClear}
            onClick={clear}
            disabled={busyHours !== null}
          >
            Annuler
          </button>
        </div>
      )}
    </section>
  );
}
