-- ============================================================================
-- MODULE « ACTIONS & RELANCES COMMERCIALES » — couche complémentaire.
-- Observe le pipeline EXISTANT (audit_logs + état des leads) et matérialise des
-- ACTIONS À MENER personnelles au commercial (découverte / devis / relance),
-- avec auto-clôture, report, priorité et historique. N'altère AUCUNE table
-- métier. Écritures via service-role (moteur) ; lecture RLS (le commercial voit
-- SES actions, le manager/admin voit tout).
-- ============================================================================

-- ── 1. Règles / délais paramétrables (sans code) ────────────────────────────
create table if not exists commercial_action_rules (
  key        text primary key,
  label      text not null,
  enabled    boolean not null default true,
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into commercial_action_rules (key, label, config) values
  ('decouverte', 'Découverte à compléter après un appel', jsonb_build_object('after_minutes', 10)),
  ('devis',      'Devis à envoyer après la découverte',     jsonb_build_object('after_hours', 24)),
  ('relance',    'Relancer un devis envoyé non closé',      jsonb_build_object('first_after_days', 2, 'every_days', 3)),
  -- « en retard » = échéance dépassée (dérivé de due_at) ; « urgent » = dépassée depuis + urgent_after_hours.
  ('priority',   'Seuil d''escalade « urgent »',            jsonb_build_object('urgent_after_hours', 48))
on conflict (key) do nothing;

-- ── 2. Actions à mener ──────────────────────────────────────────────────────
create table if not exists commercial_actions (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads (id) on delete cascade,
  owner_id      uuid references users (id) on delete set null, -- commercial concerné
  type          text not null,          -- decouverte | devis | relance
  title         text not null,
  reason        text,
  status        text not null default 'a_faire', -- a_faire | reportee | terminee
  created_at    timestamptz not null default now(),
  due_at        timestamptz not null default now(),
  snoozed_until timestamptz,
  report_count  integer not null default 0,
  closed_at     timestamptz,
  closed_reason text,                    -- auto | manuel
  result        text,
  origin_event  text                     -- action audit qui a déclenché
);

create index if not exists idx_comm_actions_owner_open on commercial_actions (owner_id, status) where status <> 'terminee';
create index if not exists idx_comm_actions_lead on commercial_actions (lead_id);
create index if not exists idx_comm_actions_created on commercial_actions (created_at desc);
-- Une seule action ACTIVE par (lead, type) → jamais de doublon.
create unique index if not exists uq_comm_actions_active
  on commercial_actions (lead_id, type)
  where status <> 'terminee';

-- ── 3. Journal (historique — jamais supprimé) ───────────────────────────────
create table if not exists commercial_action_events (
  id         bigint generated always as identity primary key,
  action_id  uuid not null references commercial_actions (id) on delete cascade,
  at         timestamptz not null default now(),
  kind       text not null,   -- created | closed | reported | escalated
  by_user    uuid references users (id) on delete set null,
  detail     jsonb not null default '{}'::jsonb
);
create index if not exists idx_comm_action_events_action on commercial_action_events (action_id, at);

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
-- commercial_actions : le commercial voit/agit sur SES actions ; le manager
-- (admin/planificateur) voit tout. Écritures via service-role côté serveur
-- (moteur + server actions qui vérifient déjà l'appartenance/le rôle).
alter table commercial_actions enable row level security;
do $rls$
begin
  if not exists (select 1 from pg_policies where tablename='commercial_actions' and policyname='comm_actions_select') then
    create policy comm_actions_select on commercial_actions for select to authenticated
      using (owner_id = auth.uid() or is_admin() or is_planificateur());
  end if;
end;
$rls$;

-- Config + journal : lecture admin (le manager paramètre / audite).
alter table commercial_action_rules enable row level security;
alter table commercial_action_events enable row level security;
do $rls2$
begin
  if not exists (select 1 from pg_policies where tablename='commercial_action_rules' and policyname='comm_rules_read') then
    create policy comm_rules_read on commercial_action_rules for select to authenticated using (is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='commercial_action_events' and policyname='comm_events_read') then
    -- le commercial peut lire le journal de SES actions ; manager/admin tout.
    create policy comm_events_read on commercial_action_events for select to authenticated
      using (
        is_admin() or is_planificateur()
        or exists (select 1 from commercial_actions a where a.id = action_id and a.owner_id = auth.uid())
      );
  end if;
end;
$rls2$;

-- ── 5. Realtime : badge « Ma journée » + notif live ─────────────────────────
do $rt$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table commercial_actions; exception when duplicate_object then null; end;
  end if;
end;
$rt$;
