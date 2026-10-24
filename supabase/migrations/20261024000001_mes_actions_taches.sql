-- Tâches manuelles du module « Mes actions » (cahier du 2026-10-24).
--
-- POURQUOI UNE NOUVELLE TABLE PLUTÔT QUE `commercial_actions`
--
-- `commercial_actions` est alimentée par le moteur de relances, qui se
-- reconstruit à partir du journal d'audit, et elle est lue par le Suivi
-- commercial. Deux de ses contraintes rendent la saisie manuelle impossible
-- sans la modifier :
--
--   • `lead_id` est NOT NULL — or le cahier (§15) demande des tâches SANS
--     client : « préparer un rendez-vous », « vérifier un document ».
--   • un index unique n'autorise QU'UNE action active par (lead, type) —
--     c'est ce qui garantit l'idempotence du moteur. Deux rappels manuels
--     sur le même dossier seraient refusés.
--
-- Relâcher ces deux contraintes toucherait une structure partagée avec le
-- Suivi commercial et le moteur, ce que le périmètre interdit. Cette table
-- est donc strictement additive : rien d'existant n'est lu ni modifié, et
-- aucun autre module ne la connaît.
--
-- Il n'y a pas pour autant de doublon : une tâche manuelle n'a jamais de
-- contrepartie dans `commercial_actions`. Chaque tâche vit dans un seul
-- enregistrement ; « Mes actions » réunit les deux sources à l'affichage.

create table if not exists commercial_tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references users (id) on delete cascade,
  -- Facultatif : une tâche d'organisation ne concerne aucun dossier (§15).
  -- `set null` plutôt que `cascade` : supprimer un dossier ne doit pas
  -- effacer la trace du travail accompli.
  lead_id     uuid references leads (id) on delete set null,

  type        text not null,
  title       text not null,
  description text,
  priority    text not null default 'normale'
                check (priority in ('normale', 'importante', 'urgente')),

  due_at      timestamptz not null,
  -- false = tâche « dans la journée », sans heure précise. Elle ne devient
  -- en retard qu'à la FIN de son jour d'échéance (§6), jamais dès le matin.
  has_time    boolean not null default false,

  status      text not null default 'a_faire'
                check (status in ('a_faire', 'terminee')),
  report_count integer not null default 0,
  closed_at   timestamptz,
  closed_by   uuid references users (id) on delete set null,
  result      text,

  created_at  timestamptz not null default now(),
  created_by  uuid references users (id) on delete set null
);

comment on table commercial_tasks is
  'Tâches saisies à la main dans « Mes actions ». Complète commercial_actions (moteur de relances) sans la remplacer ni la dupliquer.';
comment on column commercial_tasks.has_time is
  'false = échéance à la journée : la tâche n''est en retard qu''après la fin du jour, pas dès le matin.';

create index if not exists idx_comm_tasks_owner_open
  on commercial_tasks (owner_id, due_at) where status <> 'terminee';
create index if not exists idx_comm_tasks_owner_done
  on commercial_tasks (owner_id, closed_at desc) where status = 'terminee';
create index if not exists idx_comm_tasks_lead on commercial_tasks (lead_id);

-- ── Journal : créations, reports, clôtures ────────────────────────────
-- Le cahier (§10) exige que les reports soient historisés et qu'une tâche
-- terminée ne disparaisse jamais.
create table if not exists commercial_task_events (
  id        bigint generated always as identity primary key,
  task_id   uuid not null references commercial_tasks (id) on delete cascade,
  at        timestamptz not null default now(),
  kind      text not null check (kind in ('created', 'reported', 'closed', 'reopened')),
  by_user   uuid references users (id) on delete set null,
  detail    jsonb not null default '{}'::jsonb
);
create index if not exists idx_comm_task_events_task on commercial_task_events (task_id, at desc);

-- ── RLS ───────────────────────────────────────────────────────────────
-- Même règle que commercial_actions : le commercial voit SES tâches, le
-- manager voit tout. Les écritures passent par des server actions qui
-- vérifient déjà la session et l'appartenance ; la RLS reste la garde de
-- fond, celle qui tient même si le code se trompe.
alter table commercial_tasks enable row level security;
alter table commercial_task_events enable row level security;

do $rls$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'commercial_tasks' and policyname = 'comm_tasks_select'
  ) then
    create policy comm_tasks_select on commercial_tasks for select to authenticated
      using (owner_id = auth.uid() or is_admin() or is_planificateur());
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'commercial_task_events' and policyname = 'comm_task_events_select'
  ) then
    create policy comm_task_events_select on commercial_task_events for select to authenticated
      using (
        is_admin() or is_planificateur()
        or exists (select 1 from commercial_tasks t where t.id = task_id and t.owner_id = auth.uid())
      );
  end if;
end;
$rls$;
