"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { DossierWithContext } from "@/lib/dossiers-shared";
import {
  sendInterventionConfirmation,
  type ConfirmInterventionInput,
  type Result,
} from "./actions";
// Reuse the planification modal stylesheet — same overlay/footer pattern.
import styles from "./PlanifyDossierModal.module.scss";

type Props = {
  row: DossierWithContext;
  onClose: () => void;
  onDone: () => void;
};

const DATE_LONG = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});
const TIME_HM = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

function defaultSubject(plannedAt: string | undefined): string {
  if (!plannedAt) return "Confirmation de votre intervention";
  const d = new Date(plannedAt);
  return `Confirmation de votre intervention — ${DATE_LONG.format(d)}`;
}

function defaultMessage(row: DossierWithContext): string {
  const plannedAt = row.dossier.plannedAt;
  const dateLine = plannedAt
    ? `le ${DATE_LONG.format(new Date(plannedAt))} à ${TIME_HM.format(new Date(plannedAt))}`
    : "à la date convenue";
  const technicianLine = row.technician
    ? `\n\nNotre intervenant ${row.technician.name} sera sur place pour effectuer la prestation.`
    : "";
  const durationLine = row.dossier.durationHours
    ? `\n\nDurée estimée : ${row.dossier.durationHours} heure${row.dossier.durationHours > 1 ? "s" : ""}.`
    : "";

  return `Bonjour ${row.lead.client},

Nous vous confirmons votre intervention ${dateLine}.${technicianLine}${durationLine}

Merci de vous assurer qu'un accès au site sera possible à cette heure-ci. En cas d'empêchement, n'hésitez pas à nous contacter au plus tôt.

Cordialement,
L'équipe planification`;
}

export default function ConfirmInterventionModal({ row, onClose, onDone }: Props) {
  const [recipient, setRecipient] = useState(row.lead.email);
  const [subject, setSubject] = useState(() => defaultSubject(row.dossier.plannedAt));
  const [message, setMessage] = useState(() => defaultMessage(row));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);
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
    setError(null);
    setSubmitting(true);
    const payload: ConfirmInterventionInput = { recipient, subject, message };
    const result: Result = await sendInterventionConfirmation(row.dossier.id, payload);
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
      aria-labelledby="confirm-intervention-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="confirm-intervention-title" className={styles.title}>
              Confirmer l&apos;intervention au client
            </h2>
            <p className={styles.subtitle}>
              {row.lead.client} · {row.lead.shortId} — email transactionnel via Brevo
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
            <span className={styles.label}>Destinataire</span>
            <input
              ref={firstInputRef}
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
              className={styles.input}
              placeholder="client@exemple.fr"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Objet</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className={styles.input}
              required
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
            disabled={submitting || !recipient}
          >
            {submitting ? "Envoi…" : "Envoyer la confirmation"}
          </button>
        </footer>
      </form>
    </div>
  );
}
