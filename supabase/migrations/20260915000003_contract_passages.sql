-- ============================================================================
-- MODULE « DOCUMENTS & CONTRATS » — Lot 3 (passages contractuels).
-- Additif : calendrier des passages d'un contrat récurrent (§10). Chaque passage
-- peut être rattaché à un dossier (= intervention existante) sans le modifier.
-- ============================================================================

create table if not exists contract_passages (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references contracts (id) on delete cascade,
  index        integer not null,                     -- n° du passage (1..N)
  status       text not null default 'a_planifier',  -- a_planifier | planifie | realise | annule
  target_label text,                                 -- libellé indicatif (ex. « Passage 1 »)
  planned_at   timestamptz,
  realized_at  timestamptz,
  dossier_id   uuid references dossiers (id) on delete set null,  -- lien planification
  cert_document_id uuid references client_documents (id) on delete set null, -- certificat éventuel
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (contract_id, index)
);

create index if not exists idx_contract_passages_contract on contract_passages (contract_id, index);
create index if not exists idx_contract_passages_status on contract_passages (status);
create index if not exists idx_contract_passages_dossier on contract_passages (dossier_id);

alter table contract_passages enable row level security;
do $rls$
begin
  if not exists (select 1 from pg_policies where tablename='contract_passages' and policyname='passages_select') then
    create policy passages_select on contract_passages for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='contract_passages' and policyname='passages_write') then
    create policy passages_write on contract_passages for all to authenticated
      using (true) with check (true);
  end if;
end;
$rls$;
