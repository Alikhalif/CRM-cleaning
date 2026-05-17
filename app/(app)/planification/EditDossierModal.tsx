"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import {
  DOSSIER_FLAG_LABEL,
  SECTOR_LABEL,
  type DossierFlag,
  type Technician,
} from "@/lib/leads";
import type { DossierWithContext } from "@/lib/dossiers-shared";
import type { EditDossierInput, Result } from "./actions";
import styles from "./PlanifyDossierModal.module.scss";

type Props = {
  row: DossierWithContext;
  technicians: Technician[];
  onClose: () => void;
  onSubmit: (input: EditDossierInput) => Promise<Result>;
};

const FLAGS: DossierFlag[] = ["a_rappeler", "attente_retour", "litige", "bloque"];

// Parse the dossier's stored ISO timestamp back into date + time inputs in
// the browser's local zone. Empty when the dossier hasn't been scheduled.
function splitIso(iso: string | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

function toIsoTimestamp(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

export default function EditDossierModal({ row, technicians, onClose, onSubmit }: Props) {
  const initial = splitIso(row.dossier.plannedAt);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [technicianId, setTechnicianId] = useState(row.dossier.technicianId ?? "");
  const [duration, setDuration] = useState<string>(
    row.dossier.durationHours ? String(row.dossier.durationHours) : "",
  );
  const [notes, setNotes] = useState(row.dossier.notes ?? "");
  const [flags, setFlags] = useState<Set<DossierFlag>>(new Set(row.dossier.flags));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus the first input on open + dismiss on Escape.
  useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matchingTechs = technicians.filter((t) => t.sectors.includes(row.lead.sector));
  const otherTechs = technicians.filter((t) => !t.sectors.includes(row.lead.sector));

  const toggleFlag = (f: DossierFlag) =>
    setFlags((cur) => {
      const next = new Set(cur);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Date+time are optional here — a dossier in "à_planifier" status can be
    // edited without scheduling. But if one is set, both must be set.
    if ((date && !time) || (!date && time)) {
      setError("Renseignez à la fois la date et l'heure, ou laissez-les vides.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await onSubmit({
      plannedAt: date && time ? toIsoTimestamp(date, time) : null,
      technicianId: technicianId || null,
      durationHours: duration ? Number(duration) : null,
      notes: notes.trim() || null,
      flags: [...flags],
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
      aria-labelledby="edit-dossier-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="edit-dossier-title" className={styles.title}>
              Modifier le dossier
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
              <span className={styles.label}>
                Date <span className={styles.optional}>(optionnel)</span>
              </span>
              <input
                ref={firstInputRef}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>
                Heure <span className={styles.optional}>(optionnel)</span>
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
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

          <label className={styles.field}>
            <span className={styles.label}>
              Notes <span className={styles.optional}>(optionnel)</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Commentaires internes, contraintes accès, etc."
              className={styles.input}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Drapeaux</span>
            <div className={styles.flagsRow}>
              {FLAGS.map((f) => {
                const on = flags.has(f);
                return (
                  <button
                    key={f}
                    type="button"
                    className={`${styles.flagChip} ${on ? styles.flagChipOn : ""}`}
                    onClick={() => toggleFlag(f)}
                    aria-pressed={on}
                  >
                    {DOSSIER_FLAG_LABEL[f]}
                  </button>
                );
              })}
            </div>
          </div>

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
            {submitting ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      </form>
    </div>
  );
}
