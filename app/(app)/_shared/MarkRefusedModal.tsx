"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import { markDocumentRefused } from "./document-actions";
// Reuses the planification modal SCSS — overlay/card/footer pattern is shared
// across all 5 modals in the app at this point.
import styles from "@/app/(app)/planification/PlanifyDossierModal.module.scss";

// Preset motifs follow what was already used by the LeadActions MarkLost
// flow, plus "Trop cher" which is the most common devis-refusal motif.
const PRESETS = [
  "Trop cher",
  "Concurrence — devis moins cher",
  "Pas de budget",
  "Projet reporté",
  "Pas réactif",
  "Hors zone",
  "Autre",
] as const;

type Props = {
  docId: string;
  docNum: string;
  onClose: () => void;
  onDone: () => void;
};

export default function MarkRefusedModal({ docId, docNum, onClose, onDone }: Props) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>("Trop cher");
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
    if (preset === "Autre" && !details.trim()) {
      setError("Précisez le motif quand vous sélectionnez « Autre ».");
      return;
    }
    setError(null);
    setSubmitting(true);
    const composed = details.trim() ? `${preset} — ${details.trim()}` : preset;
    const result = await markDocumentRefused(docId, composed);
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
      aria-labelledby="mark-refused-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="mark-refused-title" className={styles.title}>
              Marquer le devis refusé
            </h2>
            <p className={styles.subtitle}>
              {docNum} — capture le motif pour permettre un re-devis adapté.
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
            <span className={styles.label}>Motif principal</span>
            <select
              ref={firstInputRef}
              value={preset}
              onChange={(e) => setPreset(e.target.value as (typeof PRESETS)[number])}
              className={styles.input}
              required
            >
              {PRESETS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Détails {preset === "Autre" ? "(requis)" : <span className={styles.optional}>(optionnel)</span>}
            </span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder={
                preset === "Concurrence — devis moins cher"
                  ? "ex. devis 20% moins cher chez Artisan local"
                  : preset === "Trop cher"
                    ? "ex. budget limité à 5000 €"
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
            {submitting ? "Enregistrement…" : "Marquer refusé"}
          </button>
        </footer>
      </form>
    </div>
  );
}
