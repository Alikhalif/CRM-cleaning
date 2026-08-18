-- Durcissement sécurité — lot sûr (2026-08-07).
-- Toutes ces tables sont internes : RLS activée SANS policy → accès uniquement
-- via le service-role (contexte login / webhooks, sans session).

-- 1) Anti-brute-force du login : compteur de tentatives + verrouillage temporisé.
create table if not exists auth_throttle (
  throttle_key text primary key,           -- ex. 'login:email@exemple.fr'
  attempts integer not null default 0,
  first_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table auth_throttle enable row level security;

-- 2) Idempotence des webhooks : déduplication d'événements (rejeu → no-op).
create table if not exists webhook_events (
  source text not null,                    -- 'ringover' | 'brevo' | 'leads'
  event_key text not null,
  received_at timestamptz not null default now(),
  primary key (source, event_key)
);
alter table webhook_events enable row level security;
create index if not exists webhook_events_received_idx on webhook_events(received_at);
