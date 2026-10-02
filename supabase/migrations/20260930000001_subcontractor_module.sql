-- ============================================================================
-- MODULE « SOUS-TRAITANTS » (dossier & bibliothèque) — 2026-09-30
-- AJOUT ISOLÉ. N'altère AUCUNE table/fonction existante.
--
-- L'identité du sous-traitant reste la table `technicians` (intervenants) — on
-- ne la duplique pas. Ce module ajoute uniquement ce qui manque :
--   1. subcontractor_profiles  : identité administrative étendue (1:1 technicien)
--   2. subcontractor_documents : bibliothèque permanente + conformité (Kbis,
--      assurance décennale, CNI dirigeant, contrat de sous-traitance…), versionnée
--   3. subcontractor_invoices  : factures que le SOUS-TRAITANT nous adresse
-- Les interventions restent lues depuis `dossiers` (aucune modification).
--
-- RLS : réservé au back-office (admin + planificatrice). Les commerciaux n'ont
-- AUCUN accès à ce module. Le bucket est privé (URLs signées côté application).
-- ============================================================================

-- ── Bucket privé dédié aux PDF/images du module ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('subcontractor-documents', 'subcontractor-documents', false)
on conflict (id) do nothing;

-- ── 1. Identité administrative étendue (1:1 avec technicians) ───────────────
create table if not exists subcontractor_profiles (
  technician_id  uuid primary key references technicians (id) on delete cascade,
  raison_sociale text,
  nom_commercial text,
  dirigeant      text,
  siret          text,
  siren          text,
  adresse        text,
  cp_ville       text,
  phone          text,
  notes          text,
  created_by     uuid references users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── 2. Bibliothèque documentaire permanente + conformité ────────────────────
-- Historique par versions : plusieurs lignes possibles par (technicien, type) ;
-- `is_current` marque la version active. On ne supprime jamais automatiquement
-- une ancienne version quand une nouvelle est ajoutée.
create table if not exists subcontractor_documents (
  id              uuid primary key default gen_random_uuid(),
  technician_id   uuid not null references technicians (id) on delete cascade,
  doc_type        text not null
                  check (doc_type in ('kbis','assurance_decennale','cni_dirigeant',
                                      'contrat_sous_traitance','autre')),
  title           text not null,
  storage_path    text,               -- objet dans le bucket privé (null si « externe »)
  file_name       text,
  mime_type       text,
  size_bytes      bigint,
  issued_date     date,               -- date du document
  start_date      date,               -- décennale : début de validité
  end_date        date,               -- décennale : fin de validité (base des alertes)
  insurer         text,               -- décennale : compagnie d'assurance
  contract_number text,               -- n° de police / de contrat
  activities      text,               -- décennale : activités garanties (libre)
  version         integer not null default 1,
  is_current      boolean not null default true,
  status          text,               -- optionnel : signe / non_signe / valide …
  notes           text,
  uploaded_by     uuid references users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists idx_subco_docs_tech on subcontractor_documents (technician_id, doc_type, created_at desc);
create index if not exists idx_subco_docs_current on subcontractor_documents (technician_id, doc_type) where is_current and deleted_at is null;

-- ── 3. Factures du sous-traitant (il NOUS facture) ──────────────────────────
create table if not exists subcontractor_invoices (
  id            uuid primary key default gen_random_uuid(),
  technician_id uuid not null references technicians (id) on delete cascade,
  dossier_id    uuid references dossiers (id) on delete set null, -- intervention rattachée
  numero        text,
  invoice_date  date,
  received_at   date,
  amount_ht     numeric(12,2),
  vat_amount    numeric(12,2),
  amount_ttc    numeric(12,2),
  status        text not null default 'recue'
                check (status in ('recue','a_regler','reglee','litige')),
  paid_at       date,
  storage_path  text,
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  notes         text,
  created_by    uuid references users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists idx_subco_inv_tech on subcontractor_invoices (technician_id, received_at desc);
create index if not exists idx_subco_inv_dossier on subcontractor_invoices (dossier_id);

-- ── 4. RLS — back-office uniquement (admin + planificatrice) ────────────────
alter table subcontractor_profiles  enable row level security;
alter table subcontractor_documents enable row level security;
alter table subcontractor_invoices  enable row level security;

do $rls$
declare t text;
begin
  foreach t in array array['subcontractor_profiles','subcontractor_documents','subcontractor_invoices']
  loop
    if not exists (select 1 from pg_policies where tablename=t and policyname=t||'_select') then
      execute format('create policy %I on %I for select to authenticated using (is_admin() or is_planificateur())', t||'_select', t);
    end if;
    if not exists (select 1 from pg_policies where tablename=t and policyname=t||'_write') then
      execute format('create policy %I on %I for all to authenticated using (is_admin() or is_planificateur()) with check (is_admin() or is_planificateur())', t||'_write', t);
    end if;
  end loop;
end;
$rls$;
