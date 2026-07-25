-- Country dimension (CDC évolutions §6/§9/§10, 2026-07-25). The CRM operates on
-- four countries: France, Suisse, Luxembourg, Belgique.
--   leads.country        — the lead's country (auto-detected from the phone
--                          indicatif for now; landing-page priority comes in Lot 1)
--   users.countries      — the countries a commercial / planificateur covers;
--                          routing only assigns a lead to someone covering its country

alter table leads
  add column if not exists country text check (country in ('FR', 'CH', 'LU', 'BE'));

alter table users
  add column if not exists countries text[] not null default '{}';

create index if not exists idx_leads_country on leads (country);
