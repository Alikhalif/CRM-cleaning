-- Société par commercial (évolutions rôles/routage, 2026-07-28, Lot A).
-- Each user can be attached to one issuing company (legal_entity). Used for
-- display now; the routing refonte (Lot B) will optionally scope a commercial
-- to leads of their own société. Nullable — a user without a company keeps the
-- current behaviour (no company filter).

alter table users
  add column if not exists entity_id uuid references legal_entities(id);

create index if not exists idx_users_entity on users (entity_id);
