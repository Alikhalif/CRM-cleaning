"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { Lead } from "@/lib/leads";
import { updateLeadContact, type ContactInput } from "@/app/(app)/pipeline/actions";
import styles from "@/app/(app)/planification/PlanifyDossierModal.module.scss";

type Props = {
  lead: Lead;
  onClose: () => void;
  onDone: () => void;
};

export default function EditContactModal({ lead, onClose, onDone }: Props) {
  // Pre-fill from the lead's raw name parts when available, falling back to
  // the composed display name so legacy rows still pre-fill something usable.
  const [firstName, setFirstName] = useState(lead.firstName ?? "");
  const [lastName, setLastName] = useState(lead.lastName ?? "");
  const [company, setCompany] = useState(lead.company ?? (lead.isCompany ? lead.client : ""));
  const [email, setEmail] = useState(lead.email);
  const [phone, setPhone] = useState(lead.phone);
  const [addressLine, setAddressLine] = useState(lead.address);
  const [postalCode, setPostalCode] = useState(lead.postalCode);
  const [city, setCity] = useState(lead.city);
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
    const payload: ContactInput = {
      firstName, lastName, company, email, phone,
      addressLine, postalCode, city,
    };
    const result = await updateLeadContact(lead.id, lead.isCompany, payload);
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
      aria-labelledby="edit-contact-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="edit-contact-title" className={styles.title}>
              Modifier les coordonnées
            </h2>
            <p className={styles.subtitle}>
              {lead.shortId} · {lead.isCompany ? "Compte pro" : "Particulier"}
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
          {lead.isCompany ? (
            <label className={styles.field}>
              <span className={styles.label}>Raison sociale</span>
              <input
                ref={firstInputRef}
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                className={styles.input}
              />
            </label>
          ) : (
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>Prénom</span>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={styles.input}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Nom</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={styles.input}
                />
              </label>
            </div>
          )}

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Téléphone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={styles.input}
                placeholder="+33 6 12 34 56 78"
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Adresse</span>
            <input
              type="text"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              className={styles.input}
              placeholder="N° et nom de rue"
            />
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Code postal</span>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className={styles.input}
                inputMode="numeric"
                pattern="[0-9 ]*"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Ville</span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={styles.input}
              />
            </label>
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
