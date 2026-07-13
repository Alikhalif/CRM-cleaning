-- "Commercial extrême" routing tier (client call 2026-07-11). Mirrors the
-- existing is_premium pool: users flagged is_extreme form the pool that a
-- routing rule with action assign_to_extreme dispatches extreme-flagged
-- demands to (round-robin by open-lead count). The matching lead flag
-- (leads.is_extreme) was added in migration 20260713000001.

alter table users
  add column if not exists is_extreme boolean not null default false;
