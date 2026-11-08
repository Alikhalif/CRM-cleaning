-- ════════════════════════════════════════════════════════════════════
--  Couche de compatibilité Supabase, pour un PostgreSQL ordinaire
--
--  Elle existe pour UNE SEULE raison : rejouer les 177 migrations du CRM
--  depuis une base vide, et savoir laquelle échoue — AVANT de créer la
--  moindre ressource cloud.
--
--  ⚠️ CE N'EST PAS SUPABASE, ET ÇA NE PRÉTEND PAS L'ÊTRE.
--
--  Ce que cette couche permet de vérifier :
--    · que les 177 migrations s'appliquent dans l'ordre, sur une base vide ;
--    · que leur DDL est valide (tables, index, contraintes, fonctions) ;
--    · que les politiques RLS se CRÉENT sans erreur de syntaxe.
--
--  Ce qu'elle ne permet PAS de vérifier :
--    · que les politiques RLS PROTÈGENT ce qu'elles doivent protéger —
--      `auth.uid()` rend ici une valeur fixe, il n'y a pas de session ;
--    · l'authentification, le stockage de fichiers, le temps réel, PostgREST ;
--    · le comportement de Postgres 17.6.1, puisqu'on est en 15 localement.
--
--  Un échec constaté ici est donc un signal à VÉRIFIER, pas une conclusion.
--  Et un succès ici ne dispense pas du rejeu sur la recette.
--
--  Les objets créés ci-dessous ont été établis par MESURE sur les 177
--  fichiers, pas par supposition :
--    auth.uid()       14 fichiers      storage.buckets   6 fichiers
--    auth.users        2 fichiers      role authenticated 35 fichiers
--    auth.role()       1 fichier       role anon          2 fichiers
--    pgcrypto          1 fichier       role service_role  1 fichier
--    supabase_realtime 3 fichiers (déjà gardés par `if exists`)
-- ════════════════════════════════════════════════════════════════════

-- ── 1. L'extension ─────────────────────────────────────────────────
-- `gen_random_uuid()` est dans le cœur depuis Postgres 13, mais une
-- migration déclare explicitement pgcrypto : on la satisfait.
create extension if not exists "pgcrypto";

-- ── 2. Les rôles ───────────────────────────────────────────────────
-- 35 migrations écrivent `to authenticated`. Sans ces rôles, chaque
-- `create policy` échoue — et on croirait à un défaut de la migration.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- ── 3. Le schéma `auth` ────────────────────────────────────────────
create schema if not exists auth;

-- Table minimale : deux migrations la référencent (le pont vers
-- `public.users`). Les colonnes sont celles réellement lues.
create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- ⚠️ `auth.uid()` rend ici une valeur FIXE, et c'est la limite centrale de
-- cette couche : les politiques RLS se créent, mais ne discriminent rien.
-- Hors de question de prétendre tester la tenancy avec ça.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select '00000000-0000-4000-8000-000000000000'::uuid $$;

create or replace function auth.role()
returns text
language sql
stable
as $$ select 'authenticated'::text $$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$ select '{}'::jsonb $$;

-- ── 4. Le schéma `storage` ─────────────────────────────────────────
-- Six migrations créent des buckets, et n'emploient que trois colonnes :
-- (id, name, public). On ne reproduit pas la table complète de Supabase :
-- une table plus riche ne prouverait rien de plus et masquerait une
-- migration qui s'appuierait sur une colonne absente en vrai.
create schema if not exists storage;

create table if not exists storage.buckets (
  id         text primary key,
  name       text not null,
  public     boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── 5. La publication temps réel ───────────────────────────────────
-- Trois migrations y ajoutent des tables, DÉJÀ protégées par
-- `if exists (select 1 from pg_publication …)`. Sans la publication, elles
-- passeraient sans rien faire — et on ne saurait pas si leur `add table`
-- est correct. On la crée donc, pour que ce chemin soit réellement exercé.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- ── 6. Droits ──────────────────────────────────────────────────────
grant usage on schema auth, storage, public to anon, authenticated, service_role;

-- ── Témoin ─────────────────────────────────────────────────────────
-- Une table témoin, pour que le lanceur puisse vérifier que cette couche a
-- bien été appliquée avant de compter un échec de migration.
create table if not exists public._preflight_compat (
  applique_le timestamptz not null default now(),
  note        text not null default 'couche de compatibilite Supabase pour le pre-vol des migrations'
);
insert into public._preflight_compat default values;
