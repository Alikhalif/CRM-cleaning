-- ── CGK CRM — Tables ──────────────────────────────────────────────────
-- Naming follows CDC §5.2 verbatim (client_first_name, client_email, …).
-- The simplified TypeScript types in lib/leads.ts will be reconciled when
-- each screen is migrated off mocks onto Supabase reads.
-- ─────────────────────────────────────────────────────────────────────

-- pgcrypto for gen_random_uuid() (Supabase enables this by default in the
-- "extensions" schema; this no-op covers self-hosted setups too).
create extension if not exists "pgcrypto";

-- ── Reference tables ─────────────────────────────────────────────────

create table activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  short text not null,
  color text not null,
  emoji text,
  default_quote_min numeric(10,2),
  default_quote_max numeric(10,2),
  acompte_pct numeric(5,2) not null check (acompte_pct >= 0 and acompte_pct <= 100),
  vat_rate numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  slug lead_source_slug not null unique,
  label text not null,
  icon text,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table payment_terms (
  id uuid primary key default gen_random_uuid(),
  slug payment_term_slug not null unique,
  label text not null,
  days integer not null check (days >= 0)
);

create table legal_entities (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  legal_form legal_form not null,
  siret text not null,
  ape_code text,
  vat_number text,
  address jsonb not null,
  contact_email text,
  contact_phone text,
  website text,
  -- CDC §8.5: encrypt application-side. Stored here as text for now; the
  -- column will be wrapped in pgsodium/Vault encryption once auth is wired.
  iban text,
  bic text,
  default_vat_rate numeric(5,2),
  is_vat_exempt boolean not null default false,
  logo_url text,
  color text,
  legal_mentions text,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which entity is the default issuer for a given activity.
-- A partial unique index ensures one default per activity (CDC §4.12.2).
create table legal_entity_activities (
  legal_entity_id uuid not null references legal_entities(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  is_default boolean not null default false,
  primary key (legal_entity_id, activity_id)
);
create unique index legal_entity_activities_one_default_per_activity
  on legal_entity_activities (activity_id)
  where is_default = true;

-- Catalogue prestations (CDC §4.10).
create table prestations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id),
  label text not null,
  unit prestation_unit not null,
  unit_price_ht numeric(10,2) not null check (unit_price_ht >= 0),
  vat_rate numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Auth profiles ─────────────────────────────────────────────────────
-- Supabase manages auth.users. We mirror profile data in `users` so that
-- foreign keys + RLS policies stay readable. Trigger on auth.users.id is
-- added later when auth is wired.

create table users (
  id uuid primary key,                   -- = auth.users.id once auth is on
  email text not null unique,
  first_name text,
  last_name text,
  phone text,
  team text,
  color text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  slug role_slug not null unique,
  label text not null,
  description text,
  icon text
);

create table user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references users(id),
  primary key (user_id, role_id)
);

create table user_activities (
  user_id uuid not null references users(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

-- Granular per-user permissions (e.g. immobTravaux, CDC §3.5).
create table user_permissions (
  user_id uuid not null references users(id) on delete cascade,
  permission_key text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references users(id),
  primary key (user_id, permission_key)
);

-- ── Business core ─────────────────────────────────────────────────────

-- Per-year per-type document counters for sequential, gapless numbering.
-- The CDC §5 calls out the French legal requirement. next_doc_num() lives
-- in the functions migration.
create table doc_counters (
  doc_type document_type not null,
  year integer not null,
  next_value integer not null default 1,
  primary key (doc_type, year)
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  short_id text not null unique,         -- e.g. L-1058
  external_id text unique,               -- n8n WF1 idempotency key
  received_at timestamptz not null default now(),
  source_id uuid references lead_sources(id),
  activity_id uuid references activities(id),
  owner_id uuid references users(id),
  entity_id uuid references legal_entities(id),
  -- Identity (CDC §5.2: separate first/last and is_company)
  is_company boolean not null default false,
  client_first_name text,
  client_last_name text,
  client_company text,
  client_email text,
  client_phone text,
  client_address jsonb,
  -- Marketing tracking
  gclid text,
  utm_source text,
  utm_campaign text,
  utm_term text,
  utm_medium text,
  utm_content text,
  -- Status + sub-statuses
  status lead_status not null default 'lead',
  sub_envoi sub_envoi,
  sub_signature sub_signature,
  -- Commercial info
  estimated_amount numeric(10,2),
  is_urgent boolean not null default false,
  last_action_label text,
  last_action_at timestamptz,
  next_followup_at timestamptz,
  -- Confidential annotation (CDC §3.5, §8.5) — encrypted application-side
  -- once auth is wired.
  immob_travaux_annotation text,
  annotation_segment text,
  -- Lost path
  lost_reason text,
  -- Soft delete
  deleted_at timestamptz,
  deleted_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  type client_type not null,
  -- Identity (raison sociale or "first last")
  name text not null,
  contact_name text,
  email text,
  phone text,
  address jsonb,
  siret text,                            -- required when type = 'pro' (enforced app-side)
  vat_intra text,
  source client_origin not null,
  source_lead_id uuid references leads(id),
  sectors uuid[] not null default '{}',  -- denormalised list of activity ids
  note text,
  deleted_at timestamptz,
  deleted_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  type document_type not null,
  num text not null unique,              -- DEV-2026-0001 / FA-/FAC-
  status document_status not null default 'brouillon',
  lead_id uuid references leads(id),
  client_id uuid references clients(id),
  entity_id uuid not null references legal_entities(id),
  activity_id uuid references activities(id),
  issued_at timestamptz not null default now(),
  valid_until timestamptz,               -- devis
  due_at timestamptz,                    -- factures
  payment_term_id uuid references payment_terms(id),
  total_ht numeric(12,2) not null default 0,
  total_vat numeric(12,2) not null default 0,
  total_ttc numeric(12,2) not null default 0,
  acompte_pct numeric(5,2),
  acompte_amount numeric(12,2),
  acompte_deduit numeric(12,2),          -- finale only
  solde_du numeric(12,2),
  related_devis_id uuid references documents(id),
  signature_request_id text,
  signed_at timestamptz,
  pdf_url text,
  sent_to_email text,
  paid_at timestamptz,
  payment_reference text,
  notes text,
  created_by uuid references users(id),
  deleted_at timestamptz,
  deleted_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Enforce status validity per type.
  constraint documents_status_per_type check (
    (type = 'devis'   and status in ('brouillon','envoye','ouvert','signe','refuse','expire'))
    or
    (type in ('acompte','finale') and status in ('brouillon','envoye','paye','retard'))
  )
);

create table document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  prestation_id uuid references prestations(id),
  label text not null,
  quantity numeric(10,3) not null check (quantity > 0),
  unit text not null,
  unit_price_ht numeric(10,2) not null check (unit_price_ht >= 0),
  vat_rate numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),
  discount_pct numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  total_ht numeric(12,2) not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Operations (planificatrice) ──────────────────────────────────────

create table technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  color text,
  skills text[] not null default '{}',
  sectors uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dossiers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  quote_document_id uuid references documents(id),
  status dossier_status not null default 'a_planifier',
  payment_status payment_status not null default 'en_attente',
  planner_id uuid references users(id),
  technician_id uuid references technicians(id),
  planned_at timestamptz,
  duration_hours numeric(5,2),
  address jsonb,
  realized_at timestamptz,
  cancellation_reason text,
  notes text,
  flags dossier_flag[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Audit log + document templates ──────────────────────────────────

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table document_templates (
  id uuid primary key default gen_random_uuid(),
  type document_type not null,
  entity_id uuid not null references legal_entities(id) on delete cascade,
  activity_ids uuid[] not null default '{}',
  name text not null,
  file_url text,
  content_html text,
  variables jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
