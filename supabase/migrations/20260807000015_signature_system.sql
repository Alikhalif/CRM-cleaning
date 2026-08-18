-- ============================================================================
-- Système de signature électronique propriétaire — Phase 0 (socle).
-- Intégration NON intrusive : se greffe sur `documents` (devis) et réutilise
-- markDocumentSigned() (cascade statut→dossier→FA acompte, déjà idempotente),
-- audit_logs, notifications, le pattern bucket privé + URLs signées.
-- v1 : un seul signataire (le client), authentification par lien sécurisé,
-- expiration 30 jours, lien sur le domaine du CRM (/sign/{token}).
-- ============================================================================

-- Statuts d'une demande de signature (cf. §2 du cahier des charges).
do $$ begin
  create type signature_status as enum (
    'brouillon','pret','envoye','distribue','consulte',
    'en_attente_signature','signe','refuse','expire','annule','erreur'
  );
exception when duplicate_object then null; end $$;

-- ── Demande de signature — une par devis (mono-signataire en v1) ──────────
create table if not exists signature_requests (
  id uuid primary key default gen_random_uuid(),
  ref text unique,                                    -- SIG-2026-XXXX (lisible)
  document_id uuid not null references documents(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  company_id uuid references legal_entities(id) on delete set null,

  -- Destinataire (folded : v1 mono-signataire ; multi → table dédiée plus tard).
  recipient_name text,
  recipient_email text not null,
  recipient_phone text,

  -- Token : SEUL le hash SHA-256 est stocké — le token brut n'est jamais en base.
  token_hash text not null unique,

  status signature_status not null default 'brouillon',

  -- Intégrité documentaire (§7).
  original_sha256 text,            -- empreinte du PDF envoyé au client
  signed_sha256 text,              -- empreinte du PDF signé final
  original_pdf_path text,          -- copie figée de l'original (bucket privé)
  signed_pdf_path text,            -- PDF signé (bucket privé)
  certificate_pdf_path text,       -- certificat de preuve (bucket privé)

  -- Signature (§5) : tracé ou typographique.
  signature_type text check (signature_type in ('drawn','typed')),
  signer_typed_name text,
  signature_image_path text,       -- image du tracé (bucket privé), optionnel

  -- Consentement explicite (§5 étape 3).
  consent_text text,
  consent_accepted_at timestamptz,

  -- Preuve technique capturée CÔTÉ SERVEUR uniquement (§6/§22).
  signer_ip text,
  signer_user_agent text,

  -- Chronologie (§2).
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  signed_at timestamptz,
  completed_at timestamptz,
  refused_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists signature_requests_document_idx on signature_requests(document_id);
create index if not exists signature_requests_lead_idx on signature_requests(lead_id);
create index if not exists signature_requests_status_idx on signature_requests(status);
create index if not exists signature_requests_token_idx on signature_requests(token_hash);

-- ── Piste d'audit APPEND-ONLY spécifique signature (§6) ───────────────────
create table if not exists signature_events (
  id uuid primary key default gen_random_uuid(),
  signature_request_id uuid not null references signature_requests(id) on delete cascade,
  event_type text not null,        -- SIGNATURE_REQUEST_CREATED, EMAIL_SENT, DOCUMENT_SIGNED…
  occurred_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  browser text,
  os text,
  device_type text,
  session_id text,
  document_sha256 text,
  actor text,                      -- 'client' | 'system' | '<user_id>'
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists signature_events_request_idx on signature_events(signature_request_id, occurred_at);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table signature_requests enable row level security;
alter table signature_events   enable row level security;

-- Lecture : admin / planificateur / commercial propriétaire du lead.
drop policy if exists "signature_requests readable" on signature_requests;
create policy "signature_requests readable" on signature_requests for select to authenticated
  using (
    is_admin() or is_planificateur()
    or exists (select 1 from leads l where l.id = signature_requests.lead_id and l.owner_id = auth.uid())
  );

-- Création par le commercial (fiche devis) : propriétaire / admin / planificateur.
drop policy if exists "signature_requests insertable" on signature_requests;
create policy "signature_requests insertable" on signature_requests for insert to authenticated
  with check (
    is_admin() or is_planificateur()
    or exists (select 1 from leads l where l.id = signature_requests.lead_id and l.owner_id = auth.uid())
  );

-- Mises à jour internes (annulation, etc.) : mêmes droits. Le PARCOURS PUBLIC
-- (consultation, signature) écrit via service-role — bypass RLS + validation
-- par token applicatif. Pas de policy DELETE (auditabilité).
drop policy if exists "signature_requests updatable" on signature_requests;
create policy "signature_requests updatable" on signature_requests for update to authenticated
  using (
    is_admin() or is_planificateur()
    or exists (select 1 from leads l where l.id = signature_requests.lead_id and l.owner_id = auth.uid())
  )
  with check (
    is_admin() or is_planificateur()
    or exists (select 1 from leads l where l.id = signature_requests.lead_id and l.owner_id = auth.uid())
  );

-- Événements : lecture admin / planificateur / propriétaire. Append-only :
-- aucune policy INSERT/UPDATE/DELETE — toutes les écritures passent par le
-- service-role (parcours public + helpers server-only).
drop policy if exists "signature_events readable" on signature_events;
create policy "signature_events readable" on signature_events for select to authenticated
  using (
    is_admin() or is_planificateur()
    or exists (
      select 1 from signature_requests sr
      join leads l on l.id = sr.lead_id
      where sr.id = signature_events.signature_request_id and l.owner_id = auth.uid()
    )
  );

-- ── Bucket privé pour les PDF de signature (original figé, signé, certificat) ─
insert into storage.buckets (id, name, public)
values ('signed-documents', 'signed-documents', false)
on conflict (id) do nothing;
