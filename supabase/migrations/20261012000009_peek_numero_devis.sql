-- Affichage du numéro dans l'APERÇU du devis, sans consommer la séquence
-- (demande client 2026-10-12).
--
-- L'aperçu se régénère à chaque frappe : allouer un numéro à ce moment-là
-- brûlerait des dizaines de numéros par devis et trouerait la séquence, ce que
-- la numérotation sans trou interdit. On expose donc une lecture SEULE du
-- compteur, qui rend le prochain numéro à attribuer sans l'incrémenter.
--
-- Le format est désormais défini à UN SEUL endroit, format_devis_optimivv_num,
-- utilisé par l'allocation comme par la lecture : impossible que l'aperçu et le
-- document émis divergent de format.

-- ── Format partagé ──────────────────────────────────────────────────────
create or replace function format_devis_optimivv_num(p_year integer, p_n integer)
returns text
language sql
immutable
as $fn$
  select p_year::text || '-56-' || p_n::text;
$fn$;

create or replace function format_facture_optimivv_num(p_year integer, p_n integer)
returns text
language sql
immutable
as $fn$
  select 'FAC-' || p_year::text || '-' || lpad(p_n::text, 5, '0');
$fn$;

-- ── Allocation : inchangée dans son comportement, elle délègue le format ──
create or replace function next_devis_optimivv_num(p_year integer)
returns text
language plpgsql
as $fn$
declare
  v_n integer;
begin
  insert into devis_optimivv_counters (year, next_value)
  values (p_year, 2)
  on conflict (year)
    do update set next_value = devis_optimivv_counters.next_value + 1
  returning next_value - 1 into v_n;

  return format_devis_optimivv_num(p_year, v_n);
end;
$fn$;

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

  return format_facture_optimivv_num(p_year, v_n);
end;
$fn$;

-- ── Lecture seule : le prochain numéro, sans incrémenter ────────────────
create or replace function peek_devis_optimivv_num(p_year integer)
returns text
language sql
stable
as $fn$
  select format_devis_optimivv_num(
    p_year,
    coalesce((select next_value from devis_optimivv_counters where year = p_year), 1)
  );
$fn$;

create or replace function peek_facture_optimivv_num(p_year integer)
returns text
language sql
stable
as $fn$
  select format_facture_optimivv_num(
    p_year,
    coalesce((select next_value from facture_optimivv_counters where year = p_year), 1)
  );
$fn$;

alter function next_devis_optimivv_num(integer)    security definer set search_path = public, pg_temp;
alter function next_facture_optimivv_num(integer)  security definer set search_path = public, pg_temp;
alter function peek_devis_optimivv_num(integer)    security definer set search_path = public, pg_temp;
alter function peek_facture_optimivv_num(integer)  security definer set search_path = public, pg_temp;

revoke all on function next_devis_optimivv_num(integer)   from public;
revoke all on function next_facture_optimivv_num(integer) from public;
revoke all on function peek_devis_optimivv_num(integer)   from public;
revoke all on function peek_facture_optimivv_num(integer) from public;

grant execute on function next_devis_optimivv_num(integer)   to authenticated, service_role;
grant execute on function next_facture_optimivv_num(integer) to authenticated, service_role;
grant execute on function peek_devis_optimivv_num(integer)   to authenticated, service_role;
grant execute on function peek_facture_optimivv_num(integer) to authenticated, service_role;
