-- ============================================================================
-- Numérotation des FACTURES OPTIMIVV (même template que le devis, format
-- « FAC-AAAA-00001 »). Séquence gapless dédiée, séparée du compteur devis.
-- L'archive réutilise la table devis_optimivv (le type est déjà dans `data`).
-- Idempotent.
-- ============================================================================

create table if not exists facture_optimivv_counters (
  year       integer primary key,
  next_value integer not null default 1
);

create or replace function next_facture_optimivv_num(p_year integer)
returns text
language plpgsql
as $fn$
declare
  v_n integer;
begin
  insert into facture_optimivv_counters (year, next_value)
  values (p_year, 2)
  on conflict (year)
    do update set next_value = facture_optimivv_counters.next_value + 1
  returning next_value - 1 into v_n;

  return 'FAC-' || p_year::text || '-' || lpad(v_n::text, 5, '0');
end;
$fn$;

alter function next_facture_optimivv_num(integer)
  security definer
  set search_path = public, pg_temp;

revoke all on function next_facture_optimivv_num(integer) from public;
grant execute on function next_facture_optimivv_num(integer) to authenticated, service_role;

-- Trace du type sur l'archive (facultatif — déjà présent dans data->>'docType').
alter table devis_optimivv
  add column if not exists doc_type text not null default 'devis';
