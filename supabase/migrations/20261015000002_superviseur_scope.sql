-- Rôle « Superviseur commercial » + son périmètre (demande client 2026-10-15).
--
-- Le rôle rejoint la table `roles` existante : on ne crée PAS un système de
-- permissions parallèle, c'est une consigne explicite. user_roles continue de
-- porter l'affectation, comme pour admin / commercial / planification.
--
-- Le PÉRIMÈTRE (pays, activités, commerciaux) vit à part : c'est une donnée
-- propre au superviseur, pas une propriété du rôle — deux superviseurs
-- partagent le rôle et n'ont pas le même périmètre.
--
-- La valeur d'ENUM est ajoutée par la migration précédente : Postgres interdit
-- de l'utiliser dans la transaction qui la crée.

insert into roles (slug, label)
select 'superviseur', 'Superviseur commercial'
where not exists (select 1 from roles where slug = 'superviseur');

create table if not exists supervisor_scopes (
  user_id uuid primary key references users(id) on delete cascade,

  -- Listes VIDES = aucune restriction sur cet axe. Un superviseur dont les
  -- trois listes sont vides voit tout : c'est le réglage par défaut, et c'est
  -- au Super Admin de le restreindre.
  countries text[] not null default '{}',
  activity_ids uuid[] not null default '{}',
  owner_ids uuid[] not null default '{}',

  -- Deux niveaux, exigés par le client :
  --   false → consultation seule (performances et alertes) ;
  --   true  → peut en plus ouvrir les dossiers de son périmètre.
  -- Dans les deux cas il ne modifie JAMAIS ses propres droits ni la
  -- configuration du CRM : cela reste réservé au Super Admin.
  can_intervene boolean not null default false,

  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

alter table supervisor_scopes enable row level security;

-- Un superviseur lit SON périmètre (le serveur en a besoin pour filtrer).
create policy "supervisor_scopes lisible par le titulaire ou admin"
  on supervisor_scopes for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- Seul le Super Admin attribue un périmètre. Un superviseur ne peut pas
-- élargir le sien : c'est la garantie demandée.
create policy "supervisor_scopes modifiable par admin"
  on supervisor_scopes for all to authenticated
  using (is_admin()) with check (is_admin());

comment on table supervisor_scopes is
  'Périmètre d''un superviseur commercial : pays, activités, commerciaux. Listes vides = pas de restriction sur cet axe. Appliqué CÔTÉ SERVEUR dans lib/supervision-server.ts.';
