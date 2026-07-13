"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import { SECTOR_LABEL, type Technician } from "@/lib/leads";
import { distanceByPostalCodeKm, isInServiceZone } from "@/lib/geo";
import type { DossierWithContext } from "@/lib/dossiers-shared";
import type { PlanifyInput, Result } from "./actions";
import styles from "./PlanifyDossierModal.module.scss";

type Props = {
  row: DossierWithContext;
  technicians: Technician[];
  onClose: () => void;
  onSubmit: (input: PlanifyInput) => Promise<Result>;
};

// Rayon d'intervention cible (CDC / call 2026-06-10). Beyond it, technicians
// are still selectable but flagged "hors 100 km" and the radius is considered
// widened.
const RADIUS_KM = 100;

type AnnotatedTech = {
  tech: Technician;
  distanceKm: number | null; // null when a postal code can't be resolved
  inZone: boolean;
};

// Annotate + sort: in-zone first, then nearest (unknown distance last).
function annotate(techs: Technician[], clientPostal: string): AnnotatedTech[] {
  return techs
    .map((tech) => ({
      tech,
      distanceKm: distanceByPostalCodeKm(tech.basePostalCode, clientPostal),
      inZone: isInServiceZone(clientPostal, tech.serviceDepartments),
    }))
    .sort((a, b) => {
      if (a.inZone !== b.inZone) return a.inZone ? -1 : 1;
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
}

function optionLabel(a: AnnotatedTech, suggestedId: string | null): string {
  const parts: string[] = [a.tech.name];
  if (a.distanceKm != null) {
    parts.push(`${a.distanceKm} km${a.distanceKm > RADIUS_KM ? " (hors 100 km)" : ""}`);
  } else {
    parts.push("distance inconnue");
  }
  if (a.inZone) parts.push("zone couverte");
  if (a.tech.id === suggestedId) parts.push("suggéré");
  return parts.join(" · ");
}

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
  const clientPostal = row.lead.postalCode;

  // Competent-sector techs first, then the rest — each group ranked in-zone →
  // nearest. Auto-suggest the nearest competent tech within the radius, widening
  // to the nearest competent one overall when none qualifies. Planner can override.
  const matching = annotate(
    technicians.filter((t) => t.sectors.includes(row.lead.sector)),
    clientPostal,
  );
  const otherTechs = annotate(
    technicians.filter((t) => !t.sectors.includes(row.lead.sector)),
    clientPostal,
  );
  const suggested =
    matching.find((a) => a.distanceKm != null && a.distanceKm <= RADIUS_KM) ??
    matching[0] ??
    null;

  const [date, setDate] = useState(slot.date);
  const [time, setTime] = useState(slot.time);
  const [technicianId, setTechnicianId] = useState(
    row.dossier.technicianId ?? suggested?.tech.id ?? "",
  );
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
              {matching.length > 0 && (
                <optgroup label={`Secteur ${SECTOR_LABEL[row.lead.sector]} · par proximité`}>
                  {matching.map((a) => (
                    <option key={a.tech.id} value={a.tech.id}>
                      {optionLabel(a, suggested?.tech.id ?? null)}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherTechs.length > 0 && (
                <optgroup label="Autres intervenants (hors secteur)">
                  {otherTechs.map((a) => (
                    <option key={a.tech.id} value={a.tech.id}>
                      {optionLabel(a, suggested?.tech.id ?? null)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {suggested && suggested.distanceKm != null && (
              <span
                style={{ display: "block", marginTop: 6, fontSize: "0.8125rem", color: "var(--text-muted)" }}
              >
                {suggested.distanceKm <= RADIUS_KM
                  ? `Plus proche du secteur : ${suggested.tech.name} — ${suggested.distanceKm} km${suggested.inZone ? ", zone couverte" : ""} (pré-sélectionné).`
                  : `Aucun intervenant du secteur sous ${RADIUS_KM} km — le plus proche : ${suggested.tech.name} (${suggested.distanceKm} km).`}
              </span>
            )}
            {!clientPostal && (
              <span
                style={{ display: "block", marginTop: 6, fontSize: "0.8125rem", color: "var(--text-muted)" }}
              >
                Code postal du client absent — tri par distance indisponible.
              </span>
            )}
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
