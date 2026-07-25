-- Landing-page registry (CDC évolutions §6, 2026-07-25). Each landing page is
-- configured once in the CRM with a country + société + secteur (+ optional
-- source). The LP form sends only a token; WF1 resolves it and the lead
-- inherits pays/société/secteur from the LP (highest priority in the country
-- detection order). Decouples the form HTML from the routing configuration.

create table if not exists landing_pages (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                 -- sent by the LP form (field `lp`)
  name text not null,                         -- e.g. "Nettoyage Suisse"
  country text check (country in ('FR', 'CH', 'LU', 'BE')),
  entity_id uuid references legal_entities(id),
  activity_id uuid references activities(id),
  source_id uuid references lead_sources(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table landing_pages enable row level security;

-- Readable by any authenticated user; writable by admins only. The WF1 webhook
-- reads via the service-role client (bypasses RLS).
create policy "landing_pages readable to authenticated"
  on landing_pages for select to authenticated using (true);
create policy "landing_pages writable by admin"
  on landing_pages for all to authenticated using (is_admin()) with check (is_admin());

-- Lead ↔ société + landing page of origin (CDC §4, §12).
alter table leads
  add column if not exists entity_id uuid references legal_entities(id),
  add column if not exists landing_page_id uuid references landing_pages(id);

create index if not exists idx_leads_entity on leads (entity_id);
