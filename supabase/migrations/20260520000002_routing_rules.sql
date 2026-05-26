-- ════════════════════════════════════════════════════════════════════════
-- Lead routing rules — assignment automation engine.
--
-- An ordered list of (conditions, action) pairs. When a lead is created
-- programmatically (WF1 inbound webhook, or manual createLead with
-- autoRoute=true), the engine iterates rules by priority ASC and applies
-- the first one whose conditions all match.
--
-- Condition keys (all optional, ALL must match for the rule to fire):
--   surface_m2_gte:    number   — lead.surface_m2 ≥ X
--   surface_m2_lt:     number   — lead.surface_m2 < X
--   sector:            text     — exact sector slug (urgence/nettoyage/enr/renovation)
--   source:            text     — exact source slug
--   client_is_premium: boolean  — the linked client is flagged premium
--   amount_gte:        number   — lead.estimated_amount ≥ X
--
-- Action keys (one of these must be set):
--   assign_to_user_id: uuid     — specific commercial
--   assign_to_premium: boolean  — pick from the premium commercial pool
--                                 (round-robin by current load — fewest open leads first)
--
-- Both columns are jsonb to keep the schema evolution-friendly — adding a
-- new condition or action key tomorrow doesn't need a migration.
-- ════════════════════════════════════════════════════════════════════════

create table routing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  priority integer not null default 100,
  conditions jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id)
);

-- Active rules sorted by priority — covers the main engine query.
create index routing_rules_active_priority_idx
  on routing_rules(priority, created_at)
  where is_active;

-- ── RLS ─────────────────────────────────────────────────────────────
alter table routing_rules enable row level security;

-- Read: any authenticated user can see the rules (planificateurs may want
-- to understand how new leads got routed when reviewing their own queue).
create policy "routing_rules readable to authenticated"
  on routing_rules for select to authenticated using (true);

-- Write: admin only.
create policy "routing_rules writable by admin"
  on routing_rules for all to authenticated
  using (is_admin())
  with check (is_admin());

-- Touch-updated_at trigger so we see when each rule was last edited.
create trigger trg_routing_rules_set_updated_at
  before update on routing_rules
  for each row execute function set_updated_at();
