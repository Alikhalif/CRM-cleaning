"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon/Icon";
import {
  COUNTRIES,
  COUNTRY_LABEL,
  IDENTIFIANT_LEGAL,
  type Country,
  type LegalEntity,
  type LegalForm,
} from "@/lib/leads";
import { createEntity, updateEntity } from "./actions";
// `EntityInput` vient du module PUR, pas de `actions.ts` : un fichier
// `"use server"` ne peut rien exporter d'autre que des fonctions async, type
// compris — s'y réexporter un type provoque un `ReferenceError` à
// l'évaluation du module côté serveur.
import type { EntityInput } from "@/lib/entities-shared";
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
    defaultVatRate: 20,
    legalMentions: "",
    color: "#5b4bcc",
    representativeName: "",
    representativeTitle: "",
    representativeCompanyName: "",
    // La France par defaut : c'est le pays de la majorite des societes du
    // CRM, et le seul ou le SIRET a 14 chiffres est exige.
    country: "FR",
    siren: "",
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
    defaultVatRate: e.defaultVatRate,
    legalMentions: e.legalMentions,
    color: e.color,
    representativeName: e.representativeName,
    representativeTitle: e.representativeTitle,
    representativeCompanyName: e.representativeCompanyName,
    country: e.country,
    siren: e.siren,
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

          {/* ── Pays d'établissement ────────────────────────────────────
              Le CRM opère dans cinq pays, et la colonne existait depuis le
              début — mais aucun écran ne l'exposait. Conséquence : toutes les
              sociétés étaient traitées comme françaises, et la validation
              exigeait un SIRET à 14 chiffres, inexistant hors de France. */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Pays d&apos;établissement</span>
              <select
                value={v.country}
                onChange={(e) => set("country", e.target.value as Country)}
                className={styles.input}
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{COUNTRY_LABEL[c]}</option>
                ))}
              </select>
              <span className={styles.subtitle}>
                Détermine l&apos;identifiant légal attendu et les mentions des documents.
              </span>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>
                {IDENTIFIANT_LEGAL[v.country].label}
              </span>
              <input
                type="text"
                value={v.siren}
                onChange={(e) => set("siren", e.target.value)}
                className={styles.input}
                placeholder={IDENTIFIANT_LEGAL[v.country].exemple}
              />
              <span className={styles.subtitle}>
                {IDENTIFIANT_LEGAL[v.country].aide}
              </span>
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>
                SIRET (14 chiffres){v.country !== "FR" ? " — France uniquement" : ""}
              </span>
              <input
                type="text"
                value={v.siret}
                onChange={(e) => set("siret", e.target.value)}
                required={v.country === "FR"}
                inputMode="numeric"
                className={styles.input}
                placeholder={v.country === "FR" ? "12345678900012" : "—"}
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

          {/* Représentant légal — exigé pour la sous-traitance.
              Ces deux colonnes existaient en base depuis le 31 octobre sans
              qu'aucun écran ne les renseigne : les sept sociétés du CRM
              étaient donc toutes sans représentant, ce qui empêchait
              d'émettre le moindre contrat de sous-traitance. */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Représentant légal</span>
              <input
                type="text"
                value={v.representativeName}
                onChange={(e) => set("representativeName", e.target.value)}
                className={styles.input}
                placeholder="M. Jean DUPONT"
                autoComplete="off"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Qualité du représentant</span>
              <input
                type="text"
                value={v.representativeTitle}
                onChange={(e) => set("representativeTitle", e.target.value)}
                className={styles.input}
                placeholder="Président, Gérant…"
                autoComplete="off"
              />
            </label>
          </div>

          {/* ── Représentation par une personne morale ──────────────────
              Une SAS peut avoir une société pour président, une SARL une
              société pour gérant. Laissé vide dans le cas courant. */}
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>
                Représentée par une société (facultatif)
              </span>
              <input
                type="text"
                value={v.representativeCompanyName}
                onChange={(e) => set("representativeCompanyName", e.target.value)}
                className={styles.input}
                placeholder="HOLDING EXEMPLE SAS"
                autoComplete="off"
              />
              <span className={styles.subtitle}>
                À remplir seulement si la présidence ou la gérance est exercée par
                une société. Le contrat écrira alors « représentée par la société
                …, elle-même représentée par … ».
              </span>
            </label>
          </div>
          {/* `.subtitle` : petit texte atténué, déjà défini dans la feuille
              réutilisée. Pas de classe inventée — `styles.hint` n'existe pas et
              aurait rendu un paragraphe sans style. */}
          <p className={styles.subtitle}>
            Obligatoires pour émettre un contrat de sous-traitance : le bloc
            « ENTRE LES SOUSSIGNÉS » identifie la partie qui s&apos;engage. Laissés
            vides, les devis et factures continuent de fonctionner normalement.
          </p>

          {/* ── Coordonnées bancaires : RETIRÉES du formulaire ───────────
              Décision du 2026-11-05. Les devis annoncent « RIB en pièce
              jointe » : les coordonnées bancaires circulent par ce document,
              pas par la fiche société.

              ⚠️ LES COLONNES `iban` ET `bic` NE SONT PAS SUPPRIMÉES, et
              `buildPayload` ne les écrit plus du tout. Deux sociétés (CGK
              Énergie et CGK Services) ont un IBAN réel enregistré qui
              s'imprime sur leurs factures : écrire une chaîne vide à chaque
              modification l'aurait effacé. En ne touchant pas aux colonnes,
              ces valeurs survivent intactes.

              Les PDF n'affichent la ligne bancaire que si l'IBAN est
              renseigné — sans quoi les cinq sociétés sans IBAN auraient
              imprimé « Coordonnées bancaires — IBAN · BIC » sans plus
              personne pour le corriger depuis l'interface. */}

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
