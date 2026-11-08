-- ============================================================================
-- MARQUEUR D'ENVIRONNEMENT — RECETTE UNIQUEMENT
--
-- ⚠️ Ce fichier n'est PAS une migration et ne doit JAMAIS en devenir une : il
-- vit hors de `supabase/migrations/`, si bien qu'aucun `supabase db push` ne
-- l'emporte. Il se joue À LA MAIN, une fois, dans l'éditeur SQL du projet de
-- RECETTE, après avoir lu l'adresse du projet en haut de l'écran.
--
-- À quoi il sert : tout script qui ÉCRIT dans une base (tests de concurrence,
-- comptes de test, données fictives) commence par lire ce marqueur et
-- s'arrête s'il est absent. La production ne l'a pas et ne l'aura jamais : un
-- script lancé par erreur contre elle refuse d'agir, même si son fichier
-- d'environnement se trompe.
-- ============================================================================

create table if not exists public.cgk_environnement (
  nom        text primary key check (nom = 'recette'),
  pose_le    timestamptz not null default now(),
  pose_par   text not null default current_user
);

-- RLS sans politique : aucune session applicative ne lit ni n'écrit le
-- marqueur. Seuls le service-role et l'éditeur SQL le voient.
alter table public.cgk_environnement enable row level security;

insert into public.cgk_environnement (nom) values ('recette')
on conflict (nom) do nothing;

-- Vérification visuelle : doit afficher une ligne « recette ».
select nom, pose_le, pose_par from public.cgk_environnement;
