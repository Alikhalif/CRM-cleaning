-- ── CGK CRM — Enums ──────────────────────────────────────────────────
-- Versioned ENUM types matching the CDC §5.4 specification (with the
-- planificatrice dossier model overriding the CDC's intervention enum,
-- per the product-owner spec captured in CLAUDE.md / SPEC.md notes).
--
-- ENUM ALTERATIONS ARE PAINFUL IN POSTGRES — adding a value mid-flight is
-- fine but renaming or removing one requires a new migration that recreates
-- the type. Keep this list reviewed before editing.
-- ─────────────────────────────────────────────────────────────────────

-- 6-stage lead pipeline (CDC §5.4 — overrides the n8n doc's shorter set).
create type lead_status as enum (
  'lead',
  'envoye',
  'ouvert',
  'signe',
  'encaisse',
  'perdu'
);

create type sub_envoi as enum ('mano', 'auto');
create type sub_signature as enum ('sans', 'avec');

-- Document family + status. CDC §5.4 keeps devis and facture status separate;
-- here we union them into one enum to share the documents table cleanly. The
-- valid (type, status) combinations are enforced application-side and by a
-- check constraint on the documents table.
create type document_type as enum ('devis', 'acompte', 'finale');
create type document_status as enum (
  'brouillon',
  'envoye',
  'ouvert',
  'signe',
  'refuse',
  'expire',
  'paye',
  'retard'
);

-- Dossier (intervention) workflow — uses the product-owner spec, not the
-- CDC §5.4 "planifie|realise|a_facturer|annule" wording.
create type dossier_status as enum (
  'a_planifier',
  'planifie',
  'finalise',
  'solde'
);

create type payment_status as enum (
  'acompte_non_paye',
  'acompte_paye',
  'partiel',
  'en_attente',
  'solde',
  'impaye'
);

create type dossier_flag as enum (
  'a_rappeler',
  'attente_retour',
  'litige',
  'bloque'
);

-- Roles + access. CDC §3.
create type role_slug as enum (
  'admin',
  'commercial',
  'planification',
  'assistant'
);

-- Clients.
create type client_type as enum ('pro', 'particulier');
create type client_origin as enum ('lead', 'direct');

-- Legal entities (entités juridiques).
create type legal_form as enum (
  'SAS',
  'SARL',
  'EURL',
  'SASU',
  'EI',
  'SCI'
);

-- Prestation unit. ASCII-safe slugs; the UI maps these to display labels.
create type prestation_unit as enum (
  'unite',
  'forfait',
  'h',
  'm2',
  'mois'
);

-- Payment terms (slugs; the days/label map lives in the payment_terms table).
create type payment_term_slug as enum (
  'comptant',
  'jours_30',
  'jours_45',
  'jours_60'
);

-- Lead source slug.
create type lead_source_slug as enum (
  'google_ads',
  'meta_ads',
  'site_web',
  'telephone',
  'recommandation'
);
