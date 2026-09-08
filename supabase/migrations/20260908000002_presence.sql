-- ============================================================================
-- MODULE « PRÉSENCE & ACTIONS » — surcouche de contrôle SUPER ADMIN.
-- Totalement additif : aucune table métier n'est modifiée. Toutes les tables
-- ci-dessous sont en lecture RÉSERVÉE ADMIN (is_admin()) ; toutes les écritures
-- passent par le service-role côté serveur (endpoints/évaluateur qui vérifient
-- déjà la session/rôle), donc aucune politique d'écriture pour l'utilisateur.
-- ============================================================================

-- Helper local : politique de lecture admin-only, idempotente.
-- (on inline le create policy dans des blocs do $$ pour la ré-exécutabilité)

-- ── 1. PRÉSENCE ─────────────────────────────────────────────────────────────

-- Snapshot « live » : une ligne par utilisateur (upsert par le heartbeat).
create table if not exists user_presence (
  user_id         uuid primary key references users (id) on delete cascade,
  status          text not null default 'offline', -- active | inactive | offline
  last_seen_at    timestamptz,   -- dernier battement (session ouverte)
  last_active_at  timestamptz,   -- dernier battement AVEC interaction réelle
  current_page    text,
  session_id      uuid,
  updated_at      timestamptz not null default now()
);

-- Sessions : une ligne par période de connexion continue.
create table if not exists user_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended_at      timestamptz,
  ended_reason  text,          -- logout | timeout | beacon
  user_agent    text,
  active_seconds integer not null default 0
);
create index if not exists idx_user_sessions_user on user_sessions (user_id, started_at desc);
create index if not exists idx_user_sessions_open on user_sessions (user_id) where ended_at is null;

-- Battements bruts (append-only) : base de la timeline + calcul du temps actif.
-- Volumétrie maîtrisée (≈ 1 ligne / 45 s / user) → index + purge après N jours.
create table if not exists presence_pings (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references users (id) on delete cascade,
  ts       timestamptz not null default now(),
  active   boolean not null default false,
  page     text
);
create index if not exists idx_presence_pings_user_ts on presence_pings (user_id, ts desc);

-- Agrégat journalier : lecture rapide des jours passés + rétention longue.
create table if not exists activity_daily_summary (
  user_id         uuid not null references users (id) on delete cascade,
  day             date not null,
  first_seen_at   timestamptz,
  last_seen_at    timestamptz,
  session_seconds integer not null default 0,
  active_seconds  integer not null default 0,
  sessions_count  integer not null default 0,
  action_counts   jsonb not null default '{}'::jsonb, -- { "lead.status.change": 12, ... }
  updated_at      timestamptz not null default now(),
  primary key (user_id, day)
);

-- ── 2. CONFIGURATION (paramétrable sans toucher au code) ────────────────────

create table if not exists presence_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seuils de présence par défaut (modifiables par le Super Admin).
insert into presence_config (key, value) values
  ('thresholds', jsonb_build_object(
     'heartbeat_seconds', 45,
     'active_window_seconds', 60,
     'inactive_after_minutes', 5,
     'offline_after_minutes', 15
  ))
on conflict (key) do nothing;

-- ── 3. HORAIRES ATTENDUS (minimal — sert uniquement à « censé présent ») ─────

create table if not exists work_schedules (
  user_id    uuid not null references users (id) on delete cascade,
  weekday    smallint not null,  -- 0 = dimanche … 6 = samedi
  start_time time,
  end_time   time,
  primary key (user_id, weekday)
);

create table if not exists work_absences (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  day     date not null,
  reason  text
);
create index if not exists idx_work_absences_user_day on work_absences (user_id, day);

-- ── 4. MOTEUR D'ALERTES ─────────────────────────────────────────────────────

-- Règles : ÉVÉNEMENT + CONDITION + DÉLAI + ACTION ATTENDUE → alerte si non faite.
create table if not exists alert_rules (
  key         text primary key,   -- lead_untreated | user_absent | inactivity | overdue_action ...
  label       text not null,
  enabled     boolean not null default true,
  config      jsonb not null default '{}'::jsonb, -- seuils/sévérités/paramètres
  updated_at  timestamptz not null default now()
);

-- Instances d'alerte. Idempotence : (rule_key, user_id, entity_id, jour) unique
-- tant qu'ouverte → l'évaluateur ré-upsert sans doublonner.
create table if not exists alerts (
  id             uuid primary key default gen_random_uuid(),
  rule_key       text not null,
  severity       text not null default 'warn',  -- watch | warn | high | critical
  user_id        uuid references users (id) on delete set null,
  entity_type    text,   -- lead | dossier | user | null
  entity_id      uuid,
  title          text not null,
  context        jsonb not null default '{}'::jsonb,
  status         text not null default 'open',   -- open | resolved
  created_at     timestamptz not null default now(),
  escalated_at   timestamptz,
  resolved_at    timestamptz,
  resolved_action text,
  delay_seconds  integer
);
create index if not exists idx_alerts_open on alerts (status, severity, created_at desc) where status = 'open';
create index if not exists idx_alerts_user on alerts (user_id, created_at desc);
create index if not exists idx_alerts_entity on alerts (entity_type, entity_id);
-- Une seule alerte ouverte par (règle, entité, utilisateur).
create unique index if not exists uq_alerts_open_dedupe
  on alerts (rule_key, coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'open';

-- Règles par défaut (seuils modifiables par le Super Admin).
insert into alert_rules (key, label, config) values
  ('lead_untreated', 'Lead entrant non traité', jsonb_build_object(
     'watch_minutes', 5, 'warn_minutes', 10, 'critical_minutes', 20)),
  ('user_absent', 'Commercial attendu non connecté', jsonb_build_object(
     'grace_minutes', 5)),
  ('inactivity', 'Inactivité prolongée', jsonb_build_object(
     'minutes', 20)),
  ('devis_not_sent', 'Devis créé non envoyé', jsonb_build_object(
     'hours', 24)),
  ('dossier_stuck', 'Dossier bloqué trop longtemps', jsonb_build_object(
     'days', 7))
on conflict (key) do nothing;

-- ── 5. RLS : LECTURE RÉSERVÉE AU SUPER ADMIN (is_admin()) ───────────────────
-- Aucune politique d'écriture : toutes les écritures passent par le service-role
-- (endpoints authentifiés + évaluateur), qui contourne la RLS.

do $rls$
declare
  t text;
begin
  foreach t in array array[
    'user_presence','user_sessions','presence_pings','activity_daily_summary',
    'presence_config','work_schedules','work_absences','alert_rules','alerts'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = t || '_admin_read'
    ) then
      execute format(
        'create policy %I on %I for select to authenticated using (is_admin())',
        t || '_admin_read', t);
    end if;
  end loop;
end;
$rls$;

-- ── 6. REALTIME : pousser les alertes au dashboard admin (pas de polling UI) ─
do $rt$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table alerts;
    exception when duplicate_object then null;
    end;
  end if;
end;
$rt$;
