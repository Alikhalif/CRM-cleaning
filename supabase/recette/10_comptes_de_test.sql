-- ============================================================================
-- SIX COMPTES DE TEST — droits et profils — RECETTE UNIQUEMENT
--
-- ⚠️ Pas une migration (hors de `supabase/migrations/`). Se joue À LA MAIN dans
-- l'éditeur SQL du projet de RECETTE, APRÈS l'inscription des six comptes
-- dans l'application (étape 8 du dossier de recette).
--
-- Ordre d'inscription : `admin.recette@example.invalid` EN PREMIER — le
-- premier inscrit reçoit automatiquement `admin`
-- (20260517000001_auth_user_setup.sql), et tout inscrit reçoit `commercial`.
-- Ce script RÉGULARISE ensuite chaque compte : il retire les rôles en trop et
-- pose ceux du tableau L6 (docs/LOT-C-AUDIT-ET-PROPOSITION.md).
--
-- Adresses en `@example.invalid` (RFC 2606) : aucune personne réelle. Les mots
-- de passe ne sont ni ici ni nulle part dans le dépôt.
--
-- Pays : les cinq sont répartis pour que la recette les couvre tous —
-- FR+CH, LU+BE, CA — sans qu'un seul commercial les porte tous.
-- ============================================================================

-- ── Verrou : ce script refuse de tourner hors de la recette ──────────────
do $verrou$
begin
  if to_regclass('public.cgk_environnement') is null
     or not exists (select 1 from public.cgk_environnement where nom = 'recette') then
    raise exception 'REFUS : marqueur de recette absent. Cette base n''est pas la recette — rien n''a été modifié.';
  end if;
end;
$verrou$;

-- ── Le tableau L6, en données ────────────────────────────────────────────
-- Table de SESSION, pas `on commit drop` : en autocommit (éditeur SQL), cette
-- dernière disparaîtrait dès l'instruction qui la crée.
drop table if exists _comptes;
create temp table _comptes (email text primary key, roles text[], profils text[], pays text[]);
insert into _comptes values
  ('admin.recette@example.invalid',           array['admin'],         array[]::text[],                   array['FR','CH','LU','BE','CA']),
  ('commercial.nettoyage@example.invalid',    array['commercial'],    array['appel_entrant'],            array['FR','CH']),
  ('commercial.demenagement@example.invalid', array['commercial'],    array['debarras_demenagement'],    array['LU','BE']),
  ('planif.recette@example.invalid',          array['planification'], array[]::text[],                   array['FR','CH','LU','BE','CA']),
  ('superviseur.recette@example.invalid',     array['superviseur'],   array[]::text[],                   array[]::text[]),
  ('commercial.attente@example.invalid',      array['commercial'],    array['en_attente'],               array['CA']);

-- Comptes attendus mais non inscrits : on le dit, on ne les fabrique pas.
do $manquants$
declare m text;
begin
  select string_agg(c.email, ', ') into m
    from _comptes c left join public.users u on lower(u.email) = c.email
   where u.id is null;
  if m is not null then
    raise exception 'Comptes non encore inscrits : %. Inscrivez-les dans l''application, puis relancez.', m;
  end if;
end;
$manquants$;

-- ── Rôles : exactement ceux du tableau, ni plus ni moins ─────────────────
delete from public.user_roles ur
 using public.users u, _comptes c, public.roles r
 where ur.user_id = u.id and lower(u.email) = c.email
   and r.id = ur.role_id and not (r.slug::text = any (c.roles));

insert into public.user_roles (user_id, role_id)
select u.id, r.id
  from _comptes c
  join public.users u on lower(u.email) = c.email
  join public.roles r on r.slug::text = any (c.roles)
on conflict (user_id, role_id) do nothing;

-- ── Profils commerciaux et pays couverts ─────────────────────────────────
update public.users u
   set commercial_profiles = c.profils,
       countries           = c.pays
  from _comptes c
 where lower(u.email) = c.email;

-- ── Vérification : à relire avant de commencer la recette ────────────────
select u.email,
       array_agg(r.slug::text order by r.slug::text) as roles,
       u.commercial_profiles                          as profils,
       u.countries                                    as pays
  from _comptes c
  join public.users u on lower(u.email) = c.email
  left join public.user_roles ur on ur.user_id = u.id
  left join public.roles r on r.id = ur.role_id
 group by u.email, u.commercial_profiles, u.countries
 order by u.email;
