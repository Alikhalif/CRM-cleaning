-- Add Canada (CA) to the allowed country values.
-- leads.country and landing_pages.country carry inline CHECK constraints that
-- whitelist FR/CH/LU/BE (migrations 000002 and 000003). Drop them robustly by
-- inspecting pg_constraint (the inline names are auto-generated) and re-add the
-- widened whitelist. users.countries is a free text[] — no constraint to touch.

do $$
declare c record;
begin
  for c in
    select conname, conrelid::regclass::text as tbl
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.leads'::regclass, 'public.landing_pages'::regclass)
      and pg_get_constraintdef(oid) ilike '%country%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table leads
  add constraint leads_country_check
  check (country in ('FR', 'CH', 'LU', 'BE', 'CA'));

alter table landing_pages
  add constraint landing_pages_country_check
  check (country in ('FR', 'CH', 'LU', 'BE', 'CA'));
