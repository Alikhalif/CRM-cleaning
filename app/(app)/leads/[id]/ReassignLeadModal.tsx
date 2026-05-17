"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { Commercial, Lead } from "@/lib/leads";
import { reassignLead } from "@/app/(app)/pipeline/actions";
import styles from "@/app/(app)/planification/PlanifyDossierModal.module.scss";

type Props = {
  lead: Lead;
  commerciaux: Commercial[];
  onClose: () => void;
  onDone: () => void;
};

export default function ReassignLeadModal({ lead, commerciaux, onClose, onDone }: Props) {
  // Pre-select the current owner — makes the selector show "(actuel)" hint
  // and prevents an accidental no-op submission.
  const [newOwnerId, setNewOwnerId] = useState(lead.ownerId);
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
    if (!newOwnerId) {
      setError("Sélectionnez un commercial.");
      return;
    }
    if (newOwnerId === lead.ownerId) {
      setError("Ce commercial est déjà responsable du lead.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await reassignLead(lead.id, newOwnerId);
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
      aria-labelledby="reassign-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="reassign-title" className={styles.title}>
              Réassigner le lead
            </h2>
            <p className={styles.subtitle}>
              {lead.client} · {lead.shortId}
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
            <span className={styles.label}>Nouveau commercial</span>
            <select
              ref={firstInputRef}
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              className={styles.input}
              required
            >
              {commerciaux.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.id === lead.ownerId ? " (actuel)" : ""}
                </option>
              ))}
            </select>
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
            disabled={submitting || newOwnerId === lead.ownerId}
          >
            {submitting ? "Réassignation…" : "Réassigner"}
          </button>
        </footer>
      </form>
    </div>
  );
}
