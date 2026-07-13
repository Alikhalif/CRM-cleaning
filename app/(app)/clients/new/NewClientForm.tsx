"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Icon from "@/components/Icon/Icon";
import {
  SECTOR_LABEL,
  SECTOR_VAR,
  type ClientType,
  type Sector,
} from "@/lib/leads";
import { createDirectClient } from "./actions";
import styles from "./NewClient.module.scss";

const SECTORS: Sector[] = ["urgence", "nettoyage", "enr", "renovation", "debarras"];

export default function NewClientForm() {
  const router = useRouter();
  const [type, setType] = useState<ClientType>("particulier");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [siret, setSiret] = useState("");
  const [vatIntra, setVatIntra] = useState("");
  const [sectors, setSectors] = useState<Set<Sector>>(new Set());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggleSector = (s: Sector) => {
    setSectors((cur) => {
      const next = new Set(cur);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSubmitting(true);
    startTransition(async () => {
      const result = await createDirectClient({
        type,
        name,
        contactName,
        email,
        phone,
        address,
        postalCode,
        city,
        siret,
        vatIntra,
        sectors: [...sectors],
        note,
      });
      setSubmitting(false);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      // Land the user on the newly-created client's detail page so they can
      // immediately verify and start working from there.
      router.push(`/clients/${result.id}`);
    });
  };

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Type</legend>
        <div className={styles.segmented} role="radiogroup" aria-label="Type de client">
          <button
            type="button"
            className={`${styles.segment} ${type === "particulier" ? styles.segmentOn : ""}`}
            onClick={() => setType("particulier")}
            aria-pressed={type === "particulier"}
          >
            Particulier
          </button>
          <button
            type="button"
            className={`${styles.segment} ${type === "pro" ? styles.segmentOn : ""}`}
            onClick={() => setType("pro")}
            aria-pressed={type === "pro"}
          >
            Professionnel
          </button>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Identité</legend>
        <div className={styles.grid}>
          <Field label={type === "pro" ? "Raison sociale" : "Nom complet"} required>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              placeholder={type === "pro" ? "Atelier Vidal SARL" : "Léa Dubois"}
            />
          </Field>
          {type === "pro" && (
            <Field label="Contact référent">
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={styles.input}
                placeholder="Aurélie Mansard"
              />
            </Field>
          )}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Coordonnées</legend>
        <div className={styles.grid}>
          <Field label="Email" required>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="contact@exemple.fr"
            />
          </Field>
          <Field label="Téléphone" required>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={styles.input}
              placeholder="+33 6 12 34 56 78"
            />
          </Field>
          <Field label="Adresse" required full>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={styles.input}
              placeholder="14 rue Pasteur"
            />
          </Field>
          <Field label="Code postal" required>
            <input
              type="text"
              required
              pattern="\d{5}"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className={styles.input}
              placeholder="33000"
            />
          </Field>
          <Field label="Ville" required>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={styles.input}
              placeholder="Bordeaux"
            />
          </Field>
        </div>
      </fieldset>

      {type === "pro" && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Informations légales</legend>
          <div className={styles.grid}>
            <Field label="SIRET" required>
              <input
                type="text"
                required
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                className={styles.input}
                placeholder="123 456 789 00012"
              />
            </Field>
            <Field label="N° TVA intracommunautaire">
              <input
                type="text"
                value={vatIntra}
                onChange={(e) => setVatIntra(e.target.value)}
                className={styles.input}
                placeholder="FR12345678901"
              />
            </Field>
          </div>
        </fieldset>
      )}

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Activités historisées</legend>
        <div className={styles.chips}>
          {SECTORS.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.chip} ${sectors.has(s) ? styles.chipOn : ""}`}
              style={{ ["--sc" as string]: `var(${SECTOR_VAR[s]})` }}
              onClick={() => toggleSector(s)}
              aria-pressed={sectors.has(s)}
            >
              {SECTOR_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Note</legend>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={styles.textarea}
          rows={3}
          placeholder="Contexte, contact bouche-à-oreille, contraintes particulières…"
        />
      </fieldset>

      {serverError && (
        <p className={styles.errorBanner} role="alert">
          <Icon name="alert" size={14} /> {serverError}
        </p>
      )}

      <div className={styles.actions}>
        <Link href="/clients" className={styles.btnGhost}>Annuler</Link>
        <button type="submit" className={styles.btnPrimary} disabled={submitting}>
          {submitting ? "Création…" : "Créer le client"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`${styles.field} ${full ? styles.fieldFull : ""}`}>
      <span className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.required} aria-hidden="true">*</span>}
      </span>
      {children}
    </label>
  );
}
