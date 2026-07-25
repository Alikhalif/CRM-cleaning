"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import {
  SECTOR_LABEL,
  type Commercial,
  type Sector,
} from "@/lib/leads";
import { createLead, type NewLeadInput } from "./actions";
// Reuse the planification modal stylesheet — same overlay/footer pattern.
import styles from "@/app/(app)/planification/PlanifyDossierModal.module.scss";

type Props = {
  commerciaux: Commercial[];
  defaultOwnerId: string; // current user id — pre-selected
  onClose: () => void;
};

// DB-slugs for the source dropdown — must match lead_sources.slug values
// (snake_case in DB, kebab-case in the UI mapper). We submit the DB form.
const SOURCES: { slug: NewLeadInput["sourceSlug"]; label: string }[] = [
  { slug: "telephone",      label: "Téléphone" },
  { slug: "site_web",       label: "Site web" },
  { slug: "google_ads",     label: "Google Ads" },
  { slug: "meta_ads",       label: "Meta Ads" },
  { slug: "recommandation", label: "Recommandation" },
];

const SECTORS: Sector[] = ["urgence", "nettoyage", "enr", "renovation", "debarras", "demenagement", "diogene"];

export default function NewLeadModal({ commerciaux, defaultOwnerId, onClose }: Props) {
  const router = useRouter();

  const [isCompany, setIsCompany] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [activitySlug, setActivitySlug] = useState<Sector>("nettoyage");
  const [sourceSlug, setSourceSlug] = useState<NewLeadInput["sourceSlug"]>("telephone");
  const [ownerId, setOwnerId] = useState<string>(defaultOwnerId || commerciaux[0]?.id || "");
  const [estimatedAmount, setEstimatedAmount] = useState<string>("");
  const [surfaceM2, setSurfaceM2] = useState<string>("");
  const [typeService, setTypeService] = useState<string>("");
  const [isExtreme, setIsExtreme] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input on open + dismiss on Escape.
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

    const payload: NewLeadInput = {
      isCompany,
      firstName,
      lastName,
      companyName,
      email,
      phone,
      addressLine,
      postalCode,
      city,
      activitySlug,
      sourceSlug,
      ownerId,
      estimatedAmount: estimatedAmount ? Number(estimatedAmount) : null,
      surfaceM2: surfaceM2 ? Number(surfaceM2) : null,
      typeService,
      isExtreme,
      notes,
    };

    const result = await createLead(payload);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Land on the new lead detail so the user can keep enriching it.
    router.push(`/leads/${result.id}`);
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-lead-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="new-lead-title" className={styles.title}>
              Nouveau lead
            </h2>
            <p className={styles.subtitle}>
              Création manuelle — entrée Lead par défaut, le commercial peut enrichir ensuite.
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
          {/* Type toggle ─────────────────────────────────────────── */}
          <div className={styles.field}>
            <span className={styles.label}>Type de client</span>
            <div className={styles.flagsRow}>
              <button
                type="button"
                className={`${styles.flagChip} ${!isCompany ? styles.flagChipOn : ""}`}
                onClick={() => setIsCompany(false)}
                aria-pressed={!isCompany}
              >
                Particulier
              </button>
              <button
                type="button"
                className={`${styles.flagChip} ${isCompany ? styles.flagChipOn : ""}`}
                onClick={() => setIsCompany(true)}
                aria-pressed={isCompany}
              >
                Professionnel
              </button>
            </div>
          </div>

          {/* Identity ─────────────────────────────────────────────── */}
          {isCompany ? (
            <label className={styles.field}>
              <span className={styles.label}>Raison sociale</span>
              <input
                ref={firstInputRef}
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
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

          {/* Contact ──────────────────────────────────────────────── */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Téléphone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className={styles.input}
                placeholder="+33 6 12 34 56 78"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>
                Email <span className={styles.optional}>(optionnel)</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
            </label>
          </div>

          {/* Address ──────────────────────────────────────────────── */}
          <label className={styles.field}>
            <span className={styles.label}>
              Adresse <span className={styles.optional}>(optionnel)</span>
            </span>
            <input
              type="text"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="N° et nom de rue"
              className={styles.input}
            />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>
                Code postal <span className={styles.optional}>(optionnel)</span>
              </span>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                inputMode="numeric"
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>
                Ville <span className={styles.optional}>(optionnel)</span>
              </span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={styles.input}
              />
            </label>
          </div>

          {/* Routing — required ───────────────────────────────────── */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Activité</span>
              <select
                value={activitySlug}
                onChange={(e) => setActivitySlug(e.target.value as Sector)}
                required
                className={styles.input}
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{SECTOR_LABEL[s]}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Source</span>
              <select
                value={sourceSlug}
                onChange={(e) => setSourceSlug(e.target.value as NewLeadInput["sourceSlug"])}
                required
                className={styles.input}
              >
                {SOURCES.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Commercial responsable</span>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                required
                className={styles.input}
              >
                {commerciaux.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>
                Montant estimé (€) <span className={styles.optional}>(optionnel)</span>
              </span>
              <input
                type="number"
                value={estimatedAmount}
                onChange={(e) => setEstimatedAmount(e.target.value)}
                min={0}
                step={100}
                placeholder="ex. 5000"
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>
                Superficie (m²) <span className={styles.optional}>(optionnel)</span>
              </span>
              <input
                type="number"
                value={surfaceM2}
                onChange={(e) => setSurfaceM2(e.target.value)}
                min={0}
                step={1}
                placeholder="ex. 120"
                className={styles.input}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>
              Type de service <span className={styles.optional}>(optionnel)</span>
            </span>
            <input
              type="text"
              value={typeService}
              onChange={(e) => setTypeService(e.target.value)}
              placeholder="ex. longue distance, succession, fin de chantier…"
              className={styles.input}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isExtreme}
              onChange={(e) => setIsExtreme(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span className={styles.label} style={{ margin: 0 }}>
              Demande extrême <span className={styles.optional}>(routage vers le pool extrême si une règle l&apos;exige)</span>
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Notes <span className={styles.optional}>(optionnel)</span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Contexte initial, demande spécifique du client…"
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
            {submitting ? "Création…" : "Créer le lead"}
          </button>
        </footer>
      </form>
    </div>
  );
}
