-- Discovery ("Découverte") phase + extreme-demand flag on leads
-- (client call 2026-07-11). Découverte is modelled as lead attributes, not a
-- new pipeline column: a commercial records an announced price and an outcome
-- (ok → ready for devis, refus → lead perdu, ok_plus → photos requested), then
-- transforms to a devis. `is_extreme` feeds the "commercial extrême" routing
-- tier for extreme/urgent demands.

alter table leads
  add column if not exists announced_price   numeric(10,2),
  add column if not exists discovery_outcome  text
    check (discovery_outcome in ('ok', 'refus', 'ok_plus')),
  add column if not exists discovery_done_at  timestamptz,
  add column if not exists photos_requested_at timestamptz,
  add column if not exists is_extreme         boolean not null default false;

-- Fast retrieval of the "phase découverte" queue = active leads whose
-- discovery hasn't been done yet (owner-scoped list + KPI).
create index if not exists idx_leads_discovery_pending
  on leads (owner_id)
  where discovery_done_at is null and status <> 'perdu';
