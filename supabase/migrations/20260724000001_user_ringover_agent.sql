-- Per-user Ringover agent id (2026-07-24). Click-to-call rings the calling
-- commercial's own Ringover device, identified by their Ringover agent/
-- extension id. Set from Paramètres → Utilisateurs. Until a user has one,
-- callLead falls back to the Supabase user id (works in fake mode).

alter table users
  add column if not exists ringover_agent_id text;
