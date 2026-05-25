-- ════════════════════════════════════════════════════════════════════════
-- Premium tiers, refusal capture, and surface metric.
-- Three small additions that unlock the next batch of UX:
--   1. documents.refusal_reason — captured on Marquer refusé to surface
--      WHY a quote was rejected so a re-quote can adjust price/scope.
--   2. leads.surface_m2 — routing input ("envoyer aux commerciaux premium
--      si surface > 80m²") + analytics later.
--   3. users.is_premium / clients.is_premium — premium tier flags used by
--      the routing rules (lead → premium commercial when matching criteria).
-- ════════════════════════════════════════════════════════════════════════

-- 1. Refusal reason on documents (devis only — invoices use payment_reference)
alter table documents
  add column refusal_reason text;

-- 2. Surface estimate on leads
alter table leads
  add column surface_m2 numeric(8, 2);

alter table leads
  add constraint leads_surface_m2_check check (surface_m2 is null or surface_m2 > 0);

-- 3. Premium flags
alter table users
  add column is_premium boolean not null default false;

alter table clients
  add column is_premium boolean not null default false;

-- Indexes for routing/filtering — small partial indexes keep the cost low.
create index leads_surface_idx on leads(surface_m2) where surface_m2 is not null;
create index users_premium_idx on users(is_premium) where is_premium;
create index clients_premium_idx on clients(is_premium) where is_premium;
