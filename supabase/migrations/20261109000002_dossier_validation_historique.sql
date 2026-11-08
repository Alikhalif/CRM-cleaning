-- ============================================================================
-- Validation des interventions, historisée (2026-11-09)
--
-- ⚠️ PRÉPARÉE, NON APPLIQUÉE. Recette d'abord ; production sur autorisation.
--
-- Décision du client : « La planificatrice autorisée ou le Super Admin doit
-- pouvoir valider l'intervention. Chaque validation doit être historisée. »
--
--   1. `dossiers.validated_at / validated_by` : l'état courant, lisible d'un
--      coup d'œil ;
--   2. `dossier_validations` : l'HISTORIQUE, append-only — chaque validation
--      et chaque annulation de validation, avec son auteur et, pour une
--      annulation, son motif obligatoire ;
--   3. une garde de transition : on ne valide qu'une intervention TERMINÉE
--      (`finalise`), et on ne la dé-valide qu'en revenant à `finalise`.
--
-- Additif : aucune colonne existante n'est modifiée.
-- ============================================================================

alter table dossiers
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by uuid references users (id) on delete set null;

create table if not exists dossier_validations (
  id          uuid primary key default gen_random_uuid(),
  dossier_id  uuid not null references dossiers (id) on delete restrict,
  action      text not null check (action in ('validation', 'annulation')),
  motif       text,
  user_id     uuid references users (id) on delete set null,
  created_at  timestamptz not null default now(),
  -- Une annulation sans motif n'est pas une procédure, c'est un effacement.
  constraint dossier_validations_motif_annulation
    check (action <> 'annulation' or coalesce(btrim(motif), '') <> '')
);

create index if not exists idx_dossier_validations_dossier
  on dossier_validations (dossier_id, created_at desc);

-- ── RLS : back-office seulement, et AUCUNE politique update/delete ─────────
alter table dossier_validations enable row level security;

do $rls$
begin
  if not exists (select 1 from pg_policies where tablename = 'dossier_validations' and policyname = 'dossier_validations_select') then
    create policy dossier_validations_select on dossier_validations
      for select to authenticated
      using (is_admin() or is_planificateur());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dossier_validations' and policyname = 'dossier_validations_insert') then
    -- On n'écrit qu'en son propre nom : l'auteur d'une validation ne se prête pas.
    create policy dossier_validations_insert on dossier_validations
      for insert to authenticated
      with check ((is_admin() or is_planificateur()) and user_id = auth.uid());
  end if;
end;
$rls$;

-- Append-only y compris pour le service-role, qui contourne la RLS mais pas
-- les triggers : l'historique ne se réécrit pas.
create or replace function interdire_reecriture_validation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'dossier_validations est un historique : ni modification, ni suppression.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_dossier_validations_append_only on dossier_validations;
create trigger trg_dossier_validations_append_only
  before update or delete on dossier_validations
  for each row execute function interdire_reecriture_validation();

-- ── Garde de transition sur `dossiers.status` ───────────────────────────────
create or replace function garder_transition_validation()
returns trigger
language plpgsql
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  -- Entrer dans `valide` : seulement depuis une intervention terminée.
  if new.status = 'valide' and old.status <> 'finalise' then
    raise exception 'Seule une intervention terminée (finalise) peut être validée — état actuel : %.', old.status
      using errcode = 'P0001';
  end if;
  -- Sortir de `valide` : vers `finalise` (annulation motivée) ou `solde`.
  if old.status = 'valide' and new.status not in ('finalise', 'solde') then
    raise exception 'Une intervention validée ne revient qu''à « terminée » (annulation motivée) ou passe à « soldée ».'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dossiers_transition_validation on dossiers;
create trigger trg_dossiers_transition_validation
  before update of status on dossiers
  for each row execute function garder_transition_validation();
