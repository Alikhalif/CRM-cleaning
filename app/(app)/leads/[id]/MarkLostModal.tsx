"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { Lead } from "@/lib/leads";
import { markLeadLost } from "@/app/(app)/pipeline/actions";
import styles from "@/app/(app)/planification/PlanifyDossierModal.module.scss";

// CDC §2.3 standard motifs. Free-text "Autre" lets the commercial capture
// anything outside this list — combined with the optional details field,
// the resulting lost_reason is queryable by category (`like 'Concurrence%'`)
// while still preserving the qualitative detail for review.
const LOST_REASONS = [
  "Pas de budget",
  "Concurrence",
  "Pas réactif",
  "Hors zone",
  "Projet reporté",
  "Autre",
] as const;
type LostReason = (typeof LOST_REASONS)[number];

type Props = {
  lead: Lead;
  onClose: () => void;
  onDone: () => void;
};

export default function MarkLostModal({ lead, onClose, onDone }: Props) {
  const [reason, setReason] = useState<LostReason>("Pas de budget");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // "Autre" requires details — the category alone wouldn't be useful.
    if (reason === "Autre" && !details.trim()) {
      setError("Précisez le motif quand vous sélectionnez « Autre ».");
      return;
    }
    setError(null);
    setSubmitting(true);
    const composed = details.trim() ? `${reason} — ${details.trim()}` : reason;
    const result = await markLeadLost(lead.id, composed);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-lost-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="mark-lost-title" className={styles.title}>
              Marquer le lead perdu
            </h2>
            <p className={styles.subtitle}>
              {lead.client} · {lead.shortId} — cette action est définitive (status perdu).
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.label}>Motif</span>
            <select
              ref={firstInputRef}
              value={reason}
              onChange={(e) => setReason(e.target.value as LostReason)}
              className={styles.input}
              required
            >
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Détails {reason === "Autre" ? "(requis)" : <span className={styles.optional}>(optionnel)</span>}
            </span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder={
                reason === "Concurrence"
                  ? "ex. devis 30% moins cher chez X"
                  : reason === "Pas de budget"
                    ? "ex. projet reporté à Q3"
                    : "Contexte supplémentaire…"
              }
              className={styles.input}
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">
              <Icon name="alert" size={14} /> {error}
            </p>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={submitting}
          >
            {submitting ? "Enregistrement…" : "Marquer perdu"}
          </button>
        </footer>
      </form>
    </div>
  );
}
