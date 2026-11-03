-- Raccordement DocuSign : jetons OAuth par entité et par environnement.
--
-- STRICTEMENT ADDITIVE. Deux tables neuves, deux index, l'activation de la
-- RLS, les révocations de privilèges et une fonction de purge. AUCUN contact
-- avec une table, une colonne ou une politique existante : rien à perdre sur
-- les données de production.
--
-- Une première version ajoutait aussi des politiques RLS d'écriture sur
-- `docusign_envelopes`, `docusign_envelope_events` et `document_archive`.
-- Elles ont été RETIRÉES après vérification : toutes les écritures de ce
-- module passent par `supabaseServiceRole()`, qui contourne la RLS. Les
-- accorder élargissait la surface sans qu'aucun chemin de code en ait besoin.
--
-- ⚠️ MIGRATION PRÉPARÉE, NON EXÉCUTÉE. À appliquer par `npx supabase db push`
-- après relecture, puis régénérer les types.
--
-- POURQUOI DE NOUVELLES TABLES
--
-- `20261031000002` a prévu sur `legal_entities` les identifiants NON secrets
-- d'un compte DocuSign (`docusign_account_id`, `docusign_base_uri`,
-- `docusign_user_id`, `docusign_key_env`). Ces colonnes visaient le flux JWT
-- Grant : une clé privée RSA en variable d'environnement, aucun jeton à
-- conserver.
--
-- Le flux demandé est Authorization Code + PKCE. Il produit un couple
-- jeton d'accès / jeton de rafraîchissement, qu'il FAUT conserver, et dont la
-- durée de vie est limitée. D'où `docusign_connections`. Les colonnes
-- existantes ne sont ni modifiées ni supprimées : `docusign_account_id` et
-- `docusign_base_uri` restent la trace lisible du compte, et le JWT Grant
-- reste possible plus tard sans rien défaire.
--
-- ⚠️ LES JETONS SONT CHIFFRÉS À L'APPLICATION, par `lib/crypto/field-encryption.ts`
-- (AES-256-GCM, enveloppe `encv1:`). La RLS protège les LIGNES ; le
-- chiffrement protège contre une lecture directe de la base. Les deux sont
-- nécessaires : un jeton de rafraîchissement vaut un accès permanent au
-- compte DocuSign.

-- ══════════════════════════════════════════════════════════════════════
--  1. Connexions DocuSign, une par entité et par environnement
-- ══════════════════════════════════════════════════════════════════════
create table if not exists docusign_connections (
  id              uuid primary key default gen_random_uuid(),

  entity_id       uuid not null references legal_entities (id) on delete cascade,
  -- Séparation STRICTE Sandbox / Production : ce sont deux comptes, deux jeux
  -- de jetons, deux bases d'URL. Les mélanger enverrait un contrat réel
  -- depuis un compte de test, ou l'inverse.
  environment     text not null check (environment in ('demo', 'production')),

  -- Renvoyés par /oauth/userinfo. `base_uri` n'est JAMAIS codé en dur : la
  -- Production européenne a sa propre base, que seule l'API connaît.
  account_id      text not null,
  base_uri        text not null,
  docusign_user_id text,
  account_name    text,

  -- Jetons chiffrés (`encv1:…`). Jamais lus par le navigateur.
  access_token_enc  text not null,
  refresh_token_enc text,
  -- Expiration du jeton d'accès. Le rafraîchissement se déclenche en avance.
  expires_at      timestamptz not null,
  -- Expiration estimée du jeton de rafraîchissement. DocuSign le limite à
  -- 30 jours avec le scope `extended` : passé ce délai, une personne doit
  -- réautoriser l'application. C'est la limite structurelle de ce flux pour
  -- un envoi sans utilisateur présent — elle est affichée dans l'interface.
  refresh_expires_at timestamptz,
  scope           text,

  connected_by    uuid references users (id) on delete set null,
  connected_at    timestamptz not null default now(),
  -- Dernier échec de rafraîchissement ou d'appel, pour l'afficher sans
  -- fouiller les journaux. Jamais le contenu d'un jeton.
  last_error      text,
  last_error_at   timestamptz,
  revoked_at      timestamptz,
  updated_at      timestamptz not null default now()
);

-- Une seule connexion ACTIVE par entité et par environnement. Réautoriser
-- remplace la ligne au lieu d'en empiler une seconde.
create unique index if not exists uq_dsc_entity_env
  on docusign_connections (entity_id, environment)
  where revoked_at is null;

comment on table docusign_connections is
  'Jetons OAuth DocuSign par entité juridique et par environnement. Les jetons sont chiffrés à l''application (encv1:) ; ils ne doivent jamais atteindre le navigateur ni les journaux.';
comment on column docusign_connections.refresh_expires_at is
  'DocuSign limite le jeton de rafraîchissement à 30 jours (scope extended). Au-delà, une réautorisation humaine est nécessaire.';

-- ══════════════════════════════════════════════════════════════════════
--  2. États OAuth en cours (protection CSRF + PKCE)
-- ══════════════════════════════════════════════════════════════════════
-- Le `state` est à usage unique et de courte durée. Le `code_verifier` de
-- PKCE ne doit JAMAIS transiter par le navigateur : il reste ici, côté
-- serveur, le temps de l'aller-retour.
create table if not exists docusign_oauth_states (
  state          text primary key,
  entity_id      uuid not null references legal_entities (id) on delete cascade,
  environment    text not null check (environment in ('demo', 'production')),
  code_verifier  text not null,
  redirect_uri   text not null,
  created_by     uuid references users (id) on delete set null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  -- Marqué dès la première utilisation : un code d'autorisation rejoué ne
  -- doit pas pouvoir être échangé une seconde fois.
  used_at        timestamptz
);

create index if not exists idx_dsos_expire on docusign_oauth_states (expires_at)
  where used_at is null;

-- ══════════════════════════════════════════════════════════════════════
--  3. RLS
-- ══════════════════════════════════════════════════════════════════════
alter table docusign_connections enable row level security;
alter table docusign_oauth_states enable row level security;

-- AUCUNE politique de lecture pour les jetons, même pour le Super Admin : ces
-- lignes ne sont lues que par le serveur, via la clé de service. Une policy
-- `select` les rendrait atteignables avec la clé anon depuis un navigateur,
-- et un jeton de rafraîchissement n'a rien à faire dans un bundle.
--
-- L'interface n'a pas besoin du jeton : elle affiche l'ÉTAT de la connexion,
-- que le serveur lui transmet déjà réduit (connecté, expire le…).

-- ── Révocation des privilèges de table ────────────────────────────────
--
-- Supabase accorde par défaut à `anon` et `authenticated` des privilèges sur
-- les nouvelles tables de `public`. Aujourd'hui la RLS sans aucune politique
-- bloque déjà tout, donc l'effet est nul — mais si quelqu'un ajoutait un jour
-- une politique `select` par inadvertance sur `docusign_connections`, les
-- jetons deviendraient atteignables IMMÉDIATEMENT.
--
-- Retirer le privilège fait du manque de droit un SECOND verrou, indépendant
-- de la RLS. Pour un magasin de jetons, les deux valent mieux qu'un.
revoke all on public.docusign_connections  from anon, authenticated;
revoke all on public.docusign_oauth_states from anon, authenticated;

-- `service_role` conserve l'accès : c'est lui, et lui seul, qui lit et écrit
-- ces tables (`lib/docusign/oauth-server.ts`). Le droit est accordé
-- EXPLICITEMENT plutôt que laissé à l'héritage des privilèges par défaut, pour
-- que l'intention soit lisible dans la migration et qu'un changement de
-- configuration Supabase ne casse pas le raccordement en silence.
grant select, insert, update, delete on public.docusign_connections  to service_role;
grant select, insert, update, delete on public.docusign_oauth_states to service_role;

-- ══════════════════════════════════════════════════════════════════════
--  4. Purge des états OAuth périmés
-- ══════════════════════════════════════════════════════════════════════
-- Un `state` non consommé n'a plus aucune valeur passé son expiration, et
-- garder des `code_verifier` indéfiniment agrandit la surface d'attaque pour
-- rien.
--
-- Appelée par la passe DocuSign du cron `/api/presence/evaluate`, dans son
-- PROPRE try/catch : un échec de purge ne doit pas masquer le rejeu des
-- notifications ni le rattrapage des archivages, qui sont les deux
-- traitements critiques.
--
-- `security definer` parce que la table n'accorde aucun privilège à
-- `authenticated` : la fonction s'exécute avec les droits de son
-- propriétaire. Le filtre ne retient QUE les états dont l'expiration est
-- dépassée de plus d'une heure — un état encore valable n'est jamais touché,
-- et un état consommé reste consultable le temps d'un diagnostic.
create or replace function purge_docusign_oauth_states()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from docusign_oauth_states
  where expires_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── Droit d'exécution de la purge ─────────────────────────────────────
--
-- PostgreSQL accorde EXECUTE à PUBLIC sur toute fonction nouvellement créée,
-- et Supabase y ajoute `anon` et `authenticated`. Une fonction
-- `security definer` ainsi exposée serait appelable par n'importe quel
-- porteur de la clé anon, depuis un navigateur, via /rest/v1/rpc/.
--
-- L'effet resterait limité — elle ne supprime que des états OAuth déjà
-- expirés — mais c'est un droit dont personne n'a besoin : la purge est
-- appelée par le cron, sous la clé de service, et par rien d'autre.
-- On retire donc le droit hérité et on l'accorde explicitement.
revoke all on function public.purge_docusign_oauth_states()
  from public, anon, authenticated;
grant execute on function public.purge_docusign_oauth_states()
  to service_role;
