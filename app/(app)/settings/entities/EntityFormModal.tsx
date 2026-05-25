"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { LegalEntity, LegalForm } from "@/lib/leads";
import { createEntity, updateEntity, type EntityInput } from "./actions";
// Reuses the shared modal stylesheet — same overlay/footer pattern.
import styles from "@/app/(app)/planification/PlanifyDossierModal.module.scss";

const LEGAL_FORMS: LegalForm[] = ["SAS", "SARL", "EURL", "SASU", "EI", "SCI"];

type Props = {
  // Pass null to create a new entity, or an existing entity to edit it.
  existing: LegalEntity | null;
  onClose: () => void;
  onDone: () => void;
};

function emptyInput(): EntityInput {
  return {
    legalName: "",
    legalForm: "SAS",
    siret: "",
    apeCode: "",
    vatNumber: "",
    addressLine: "",
    postalCode: "",
    city: "",
    contactEmail: "",
    contactPhone: "",
    iban: "",
    bic: "",
    defaultVatRate: 20,
    legalMentions: "",
    color: "#5b4bcc",
  };
}

function fromExisting(e: LegalEntity): EntityInput {
  return {
    legalName: e.legalName,
    legalForm: e.legalForm,
    siret: e.siret,
    apeCode: e.apeCode,
    vatNumber: e.vatNumber,
    addressLine: e.addressLine,
    postalCode: e.postalCode,
    city: e.city,
    contactEmail: e.contactEmail,
    contactPhone: e.contactPhone,
    iban: e.iban,
    bic: e.bic,
    defaultVatRate: e.defaultVatRate,
    legalMentions: e.legalMentions,
    color: e.color,
  };
}

export default function EntityFormModal({ existing, onClose, onDone }: Props) {
  const [v, setV] = useState<EntityInput>(() =>
    existing ? fromExisting(existing) : emptyInput(),
  );
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

  // Helper to keep the JSX shorter — `field("legalName", "Raison sociale", true)`.
  const set = <K extends keyof EntityInput>(key: K, val: EntityInput[K]) =>
    setV((cur) => ({ ...cur, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = existing
      ? await updateEntity(existing.id, v)
      : await createEntity(v);
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
      aria-labelledby="entity-form-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} style={{ maxWidth: 720 }} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="entity-form-title" className={styles.title}>
              {existing ? "Modifier la société" : "Nouvelle société émettrice"}
            </h2>
            <p className={styles.subtitle}>
              Multi-entité (CDC §4.2) — chaque devis/facture peut être émis depuis n&apos;importe laquelle.
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
          {/* Identity */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Raison sociale</span>
              <input
                ref={firstInputRef}
                type="text"
                value={v.legalName}
                onChange={(e) => set("legalName", e.target.value)}
                required
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Forme juridique</span>
              <select
                value={v.legalForm}
                onChange={(e) => set("legalForm", e.target.value as LegalForm)}
                className={styles.input}
                required
              >
                {LEGAL_FORMS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>SIRET (14 chiffres)</span>
              <input
                type="text"
                value={v.siret}
                onChange={(e) => set("siret", e.target.value)}
                required
                inputMode="numeric"
                className={styles.input}
                placeholder="12345678900012"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Code APE</span>
              <input
                type="text"
                value={v.apeCode}
                onChange={(e) => set("apeCode", e.target.value)}
                className={styles.input}
                placeholder="4321A"
              />
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>N° TVA intracom.</span>
              <input
                type="text"
                value={v.vatNumber}
                onChange={(e) => set("vatNumber", e.target.value)}
                className={styles.input}
                placeholder="FR12345678900"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>TVA par défaut (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={v.defaultVatRate}
                onChange={(e) => set("defaultVatRate", Number(e.target.value))}
                className={styles.input}
              />
            </label>
          </div>

          {/* Address */}
          <label className={styles.field}>
            <span className={styles.label}>Adresse</span>
            <input
              type="text"
              value={v.addressLine}
              onChange={(e) => set("addressLine", e.target.value)}
              className={styles.input}
              placeholder="N° et nom de rue"
            />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Code postal</span>
              <input
                type="text"
                value={v.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
                className={styles.input}
                inputMode="numeric"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Ville</span>
              <input
                type="text"
                value={v.city}
                onChange={(e) => set("city", e.target.value)}
                className={styles.input}
              />
            </label>
          </div>

          {/* Contact */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Email contact</span>
              <input
                type="email"
                value={v.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Téléphone contact</span>
              <input
                type="tel"
                value={v.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                className={styles.input}
              />
            </label>
          </div>

          {/* Banking */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>IBAN</span>
              <input
                type="text"
                value={v.iban}
                onChange={(e) => set("iban", e.target.value)}
                className={styles.input}
                placeholder="FR76 ..."
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>BIC</span>
              <input
                type="text"
                value={v.bic}
                onChange={(e) => set("bic", e.target.value)}
                className={styles.input}
              />
            </label>
          </div>

          {/* Branding */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Couleur d&apos;accent</span>
              <input
                type="color"
                value={v.color}
                onChange={(e) => set("color", e.target.value)}
                className={styles.input}
                style={{ height: 40, padding: 4 }}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>
                Mentions légales <span className={styles.optional}>(affichées sur le PDF)</span>
              </span>
              <textarea
                value={v.legalMentions}
                onChange={(e) => set("legalMentions", e.target.value)}
                rows={2}
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
          <button type="button" className={styles.btnGhost} onClick={onClose} disabled={submitting}>
            Annuler
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={submitting}>
            {submitting ? "Enregistrement…" : existing ? "Mettre à jour" : "Créer la société"}
          </button>
        </footer>
      </form>
    </div>
  );
}
