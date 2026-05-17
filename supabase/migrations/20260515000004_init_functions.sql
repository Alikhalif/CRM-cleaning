-- ── Functions + triggers ──────────────────────────────────────────────
-- Three pieces of plumbing:
--   1. set_updated_at() — generic touch-trigger
--   2. next_doc_num()   — gapless per-type-per-year sequence (CDC §5)
--   3. apply set_updated_at to every business table
-- ─────────────────────────────────────────────────────────────────────

-- 1. set_updated_at — generic before-update trigger function.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2. next_doc_num — atomic increment with prefix per CDC convention.
-- Note on "no gaps" (CDC §5): the doc_counters row is updated under row-level
-- locking via the INSERT ... ON CONFLICT path. A rollback of the surrounding
-- transaction WILL leak the allocated number, creating a gap. The CDC's
-- legal requirement therefore needs the document insert and the counter
-- bump in the SAME committed transaction — which this function provides
-- when called inline within a single INSERT. Don't allocate in a draft.
create or replace function next_doc_num(p_type document_type, p_year integer)
returns text
language plpgsql
as $$
declare
  v_n integer;
  v_prefix text;
begin
  insert into doc_counters (doc_type, year, next_value)
  values (p_type, p_year, 2)
  on conflict (doc_type, year)
    do update set next_value = doc_counters.next_value + 1
  returning next_value - 1 into v_n;

  v_prefix := case p_type
    when 'devis'   then 'DEV'
    when 'acompte' then 'FA'
    when 'finale'  then 'FAC'
  end;

  return v_prefix || '-' || p_year::text || '-' || lpad(v_n::text, 4, '0');
end;
$$;

-- 3. set_updated_at triggers on every table that has an updated_at column.
create trigger trg_activities_set_updated_at
  before update on activities
  for each row execute function set_updated_at();

create trigger trg_legal_entities_set_updated_at
  before update on legal_entities
  for each row execute function set_updated_at();

create trigger trg_prestations_set_updated_at
  before update on prestations
  for each row execute function set_updated_at();

create trigger trg_users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

create trigger trg_leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

create trigger trg_clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

create trigger trg_documents_set_updated_at
  before update on documents
  for each row execute function set_updated_at();

create trigger trg_technicians_set_updated_at
  before update on technicians
  for each row execute function set_updated_at();

create trigger trg_dossiers_set_updated_at
  before update on dossiers
  for each row execute function set_updated_at();

create trigger trg_document_templates_set_updated_at
  before update on document_templates
  for each row execute function set_updated_at();
