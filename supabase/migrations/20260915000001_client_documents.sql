-- ============================================================================
-- MODULE « DOCUMENTS & CONTRATS » — Lot 1 (fondations).
-- Additif : registre documentaire central par client + tags d'activités.
-- N'altère aucune table/fonction existante. Le certificat hotte (cert_hotte)
-- et les devis/factures restent inchangés ; ils sont simplement LUS et fusionnés
-- dans la vue documentaire côté application.
-- ============================================================================

-- ── 1. Tags d'activités/contrats sur la fiche client (cases à cocher §2) ─────
-- Vocabulaire libre (validé côté app) : hotte, restaurant, desinsectisation,
-- deratisation, punaises, cafards, guepes_frelons, autres_nuisibles,
-- contrat_recurrent, ponctuel. Un client peut cumuler plusieurs tags.
alter table clients add column if not exists activity_tags text[] not null default '{}';

-- ── 2. Registre documentaire (contrats, certificats, rapports, PJ…) ─────────
create table if not exists client_documents (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients (id) on delete cascade,
  contract_id  uuid,                       -- FK ajoutée au Lot 2 (contrats)
  dossier_id   uuid references dossiers (id) on delete set null,
  lead_id      uuid references leads (id) on delete set null,
  kind         text not null,              -- contrat | certificat | rapport | attestation | piece_jointe | autre
  category     text,                       -- hotte | desinsectisation | deratisation | nuisibles | nettoyage | autre
  title        text not null,
  ref          text,                       -- n° éventuel (contrat/certificat)
  storage_path text,                       -- objet dans le bucket privé (null si doc « externe »)
  file_name    text,
  mime_type    text,
  size_bytes   bigint,
  signed       boolean not null default false,
  signed_at    timestamptz,
  status       text,                       -- optionnel (actif/expire/…) — surtout pour les contrats
  source       text,                       -- 'upload' | 'certificat_hotte' | 'devis' | 'genere' …
  created_by   uuid references users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  deleted_by   uuid references users (id) on delete set null
);

create index if not exists idx_client_documents_client on client_documents (client_id, created_at desc);
create index if not exists idx_client_documents_kind on client_documents (kind);
create index if not exists idx_client_documents_dossier on client_documents (dossier_id);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
-- Lecture : tout utilisateur authentifié (comme cert_hotte). Écriture : auteur,
-- admin ou planificateur. L'upload de l'objet passe par le service-role ; la
-- ligne est insérée avec le client de session (created_by = auth.uid()).
alter table client_documents enable row level security;
do $rls$
begin
  if not exists (select 1 from pg_policies where tablename='client_documents' and policyname='client_docs_select') then
    create policy client_docs_select on client_documents for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='client_documents' and policyname='client_docs_insert') then
    create policy client_docs_insert on client_documents for insert to authenticated
      with check (created_by = auth.uid() or is_admin() or is_planificateur());
  end if;
  if not exists (select 1 from pg_policies where tablename='client_documents' and policyname='client_docs_update') then
    create policy client_docs_update on client_documents for update to authenticated
      using (created_by = auth.uid() or is_admin() or is_planificateur());
  end if;
  if not exists (select 1 from pg_policies where tablename='client_documents' and policyname='client_docs_delete') then
    create policy client_docs_delete on client_documents for delete to authenticated
      using (created_by = auth.uid() or is_admin() or is_planificateur());
  end if;
end;
$rls$;

-- ── 4. Bucket privé dédié aux PDF du module ─────────────────────────────────
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;
