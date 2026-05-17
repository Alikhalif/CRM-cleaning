"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import { SECTOR_LABEL, type Technician } from "@/lib/leads";
import type { DossierWithContext } from "@/lib/dossiers-shared";
import type { PlanifyInput, Result } from "./actions";
import styles from "./PlanifyDossierModal.module.scss";

type Props = {
  row: DossierWithContext;
  technicians: Technician[];
  onClose: () => void;
  onSubmit: (input: PlanifyInput) => Promise<Result>;
};

// Combine a date (YYYY-MM-DD) + time (HH:mm) from the form into an ISO
// timestamp interpreted in the browser's local zone (Europe/Paris for the
// target user base). new Date("2026-05-20T09:30") parses as local time.
function toIsoTimestamp(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

// Reasonable default planning slot: tomorrow at 09:00 local.
function defaultSlot(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const date = d.toISOString().slice(0, 10);
  return { date, time: "09:00" };
}

export default function PlanifyDossierModal({ row, technicians, onClose, onSubmit }: Props) {
  const slot = defaultSlot();
  const [date, setDate] = useState(slot.date);
  const [time, setTime] = useState(slot.time);
  const [technicianId, setTechnicianId] = useState(row.dossier.technicianId ?? "");
  const [duration, setDuration] = useState<string>(
    row.dossier.durationHours ? String(row.dossier.durationHours) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateInputRef = useRef<HTMLInputElement>(null);

  // Focus the date input on open + dismiss on Escape.
  useEffect(() => {
    dateInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Filter technician list to those who cover this dossier's sector, but
  // keep "all others" listed below — sometimes a planner overrides.
  const matchingTechs = technicians.filter((t) => t.sectors.includes(row.lead.sector));
  const otherTechs = technicians.filter((t) => !t.sectors.includes(row.lead.sector));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) {
      setError("Date et heure d'intervention requises.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await onSubmit({
      plannedAt: toIsoTimestamp(date, time),
      technicianId: technicianId || null,
      durationHours: duration ? Number(duration) : null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="planify-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="planify-title" className={styles.title}>
              Planifier l&apos;intervention
            </h2>
            <p className={styles.subtitle}>
              {row.lead.client} · {SECTOR_LABEL[row.lead.sector]} · {row.lead.city}
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
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Date</span>
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Heure</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className={styles.input}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>
              Intervenant <span className={styles.optional}>(optionnel)</span>
            </span>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              className={styles.input}
            >
              <option value="">— Aucun intervenant —</option>
              {matchingTechs.length > 0 && (
                <optgroup label={`Secteur ${SECTOR_LABEL[row.lead.sector]}`}>
                  {matchingTechs.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              )}
              {otherTechs.length > 0 && (
                <optgroup label="Autres intervenants">
                  {otherTechs.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Durée estimée (heures) <span className={styles.optional}>(optionnel)</span>
            </span>
            <input
              type="number"
              min={0.5}
              max={999}
              step={0.5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="ex. 2.5"
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
            {submitting ? "Planification…" : "Planifier l'intervention"}
          </button>
        </footer>
      </form>
    </div>
  );
}
