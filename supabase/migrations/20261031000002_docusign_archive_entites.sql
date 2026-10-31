-- DocuSign, dépôt documentaire central et multi-entités (2026-10-31).
--
-- ADDITIF. Les seules modifications d'une table existante sont des AJOUTS de
-- colonnes à `legal_entities` : aucune colonne n'est renommée ni supprimée,
-- aucune valeur existante n'est touchée.
--
-- LA RÈGLE STRUCTURANTE (§3) : « un document ne doit être stocké qu'une seule
-- fois ». Aujourd'hui chaque bibliothèque porte son propre `storage_path` —
-- un contrat signé y serait recopié trois ou quatre fois, et une correction
-- n'en atteindrait qu'une. D'où `document_archive` : UNE ligne par fichier
-- physique, qui porte tous les rattachements du §5. Chaque bibliothèque
-- interroge cette table par sa propre clé. Aucune bibliothèque parallèle,
-- aucun doublon, et toutes montrent forcément la même version.

-- ══════════════════════════════════════════════════════════════════════
--  1. Multi-entités : compléter `legal_entities` (§4)
-- ══════════════════════════════════════════════════════════════════════
-- La table existe déjà et porte raison sociale, forme, SIRET, TVA, adresse,
-- IBAN, logo. Il manquait le nom commercial, le SIREN, le pays, le
-- représentant légal et sa fonction, l'activation, et le compte DocuSign.
alter table legal_entities
  add column if not exists trade_name            text,
  add column if not exists siren                 text,
  add column if not exists country               text not null default 'FR',
  add column if not exists representative_name   text,
  add column if not exists representative_title  text,
  add column if not exists is_active             boolean not null default true,
  -- Compte DocuSign propre à l'entité. Les SECRETS (clé privée RSA, secret
  -- client) restent en variables d'environnement : une clé privée n'a rien à
  -- faire en base, même chiffrée, car toute lecture de table l'exposerait.
  -- Ici on ne garde que les identifiants non secrets.
  add column if not exists docusign_account_id   text,
  add column if not exists docusign_base_uri     text,
  add column if not exists docusign_user_id      text,
  -- Nom de la variable d'environnement qui porte la clé privée de CETTE
  -- entité, quand elles utilisent des comptes distincts.
  add column if not exists docusign_key_env      text;

comment on column legal_entities.siren is
  'SIREN (9 chiffres). Distinct du SIRET, qui comporte en plus le NIC de l''établissement.';
comment on column legal_entities.docusign_key_env is
  'Nom de la variable d''environnement portant la clé privée RSA de cette entité. Jamais la clé elle-même.';

-- Le SIREN se déduit du SIRET pour les entités déjà saisies : ce sont ses
-- neuf premiers chiffres. On ne touche que les lignes où il est absent.
update legal_entities
set siren = left(regexp_replace(siret, '[^0-9]', '', 'g'), 9)
where siren is null
  and siret is not null
  and length(regexp_replace(siret, '[^0-9]', '', 'g')) >= 9;

-- ══════════════════════════════════════════════════════════════════════
--  2. Dépôt documentaire central
-- ══════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('document-archive', 'document-archive', false)
on conflict (id) do nothing;

create table if not exists document_archive (
  id               uuid primary key default gen_random_uuid(),
  ref              text unique,

  -- ── Les rattachements du §5 ────────────────────────────────────────
  -- `entity_id` est NOT NULL : c'est lui qui assure l'isolation entre
  -- sociétés. Un document sans entité juridique serait inclassable, et le
  -- §4 interdit de l'envoyer.
  entity_id        uuid not null references legal_entities (id) on delete restrict,
  subcontractor_id uuid references technicians (id) on delete set null,
  client_id        uuid references clients (id) on delete set null,
  intervention_id  uuid references dossiers (id) on delete set null,
  -- Contrat de sous-traitance de référence, quand il existe.
  contract_id      uuid references subcontract_contracts (id) on delete set null,

  document_type    text not null check (document_type in (
                     'contrat_cadre', 'contrat_sous_traitance', 'ordre_mission',
                     'avenant', 'rapport_intervention', 'certificat_signature',
                     'facture_sous_traitant', 'piece_administrative', 'autre')),

  title            text not null,

  -- ── Stockage UNIQUE ────────────────────────────────────────────────
  storage_bucket   text not null default 'document-archive',
  storage_path     text not null,
  file_name        text,
  mime_type        text,
  size_bytes       bigint,
  -- Empreinte du fichier : permet de prouver qu'il n'a pas changé.
  sha256           text,

  -- ── Signature ──────────────────────────────────────────────────────
  signature_status text not null default 'en_preparation' check (signature_status in (
                     'en_preparation', 'en_attente_envoi', 'envoye_signature',
                     'en_attente_signature', 'partiellement_signe',
                     'signe_toutes_parties', 'refuse', 'annule', 'expire',
                     'erreur_synchronisation', 'sans_signature')),
  docusign_envelope_id text,
  completed_at     timestamptz,
  -- Signataires et horodatages, tels que DocuSign les rapporte.
  signataires      jsonb not null default '[]'::jsonb,

  -- ── Instantané juridique (§11, point de vigilance) ─────────────────
  -- Les informations de l'entité AU MOMENT de l'envoi. Si la société change
  -- d'adresse ou de représentant ensuite, les contrats historiques ne
  -- doivent pas changer avec elle.
  entity_snapshot  jsonb not null default '{}'::jsonb,

  -- ── Immuabilité (§7) ───────────────────────────────────────────────
  -- `is_final` : document signé ou définitif. Il n'est jamais remplacé en
  -- silence ; une nouvelle version est une NOUVELLE ligne qui pointe sur
  -- l'ancienne par `supersedes_id`.
  is_final         boolean not null default false,
  supersedes_id    uuid references document_archive (id) on delete set null,
  version          integer not null default 1,

  -- Politique de conservation, paramétrable par type (§7).
  retention_until  date,

  source           text,
  created_by       uuid references users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

comment on table document_archive is
  'Dépôt documentaire central : une ligne par fichier physique. Les bibliothèques (sous-traitant, intervention, client, entité) l''interrogent par leur clé — aucun document n''est stocké deux fois.';
comment on column document_archive.entity_snapshot is
  'Informations juridiques de l''entité au moment de l''envoi. Figées : une modification ultérieure de la société ne doit pas altérer un contrat historique.';

-- Un même fichier ne peut pas être référencé deux fois.
create unique index if not exists uq_docarch_path
  on document_archive (storage_bucket, storage_path) where deleted_at is null;
-- Une enveloppe DocuSign ne produit qu'un document final par type.
create unique index if not exists uq_docarch_envelope
  on document_archive (docusign_envelope_id, document_type)
  where docusign_envelope_id is not null and deleted_at is null;

-- Index par bibliothèque : chacune lit la même table, par sa propre clé.
create index if not exists idx_docarch_entity on document_archive (entity_id, created_at desc) where deleted_at is null;
create index if not exists idx_docarch_subco on document_archive (subcontractor_id, document_type, created_at desc) where deleted_at is null;
create index if not exists idx_docarch_client on document_archive (client_id, created_at desc) where deleted_at is null;
create index if not exists idx_docarch_interv on document_archive (intervention_id, created_at desc) where deleted_at is null;
create index if not exists idx_docarch_statut on document_archive (signature_status) where deleted_at is null;

-- ══════════════════════════════════════════════════════════════════════
--  3. Enveloppes DocuSign
-- ══════════════════════════════════════════════════════════════════════
create table if not exists docusign_envelopes (
  id               uuid primary key default gen_random_uuid(),
  envelope_id      text unique not null,
  -- Entité émettrice : détermine le compte DocuSign utilisé et l'isolation.
  entity_id        uuid not null references legal_entities (id) on delete restrict,
  contract_id      uuid references subcontract_contracts (id) on delete set null,
  amendment_id     uuid references subcontract_amendments (id) on delete set null,
  mission_id       uuid references subcontract_missions (id) on delete set null,
  document_type    text not null,

  statut           text not null default 'en_attente_envoi' check (statut in (
                     'en_preparation', 'en_attente_envoi', 'envoye_signature',
                     'en_attente_signature', 'partiellement_signe',
                     'signe_toutes_parties', 'refuse', 'annule', 'expire',
                     'erreur_synchronisation')),
  signataires      jsonb not null default '[]'::jsonb,
  envoye_le        timestamptz,
  envoye_par       uuid references users (id) on delete set null,
  completed_at     timestamptz,
  -- Dernière synchronisation réussie avec DocuSign, quelle qu'en soit la voie
  -- (webhook ou rattrapage).
  synchronise_le   timestamptz,
  -- Compteur de tentatives d'archivage ; sert au rattrapage et à l'alerte.
  archivage_essais integer not null default 0,
  archivage_erreur text,
  archive_le       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_dse_entity on docusign_envelopes (entity_id, created_at desc);
create index if not exists idx_dse_statut on docusign_envelopes (statut);
-- Les enveloppes signées mais pas encore archivées : c'est la file que le
-- rattrapage doit vider, et le tableau de suivi des non-synchronisés (§8).
create index if not exists idx_dse_a_archiver on docusign_envelopes (completed_at)
  where statut = 'signe_toutes_parties' and archive_le is null;

-- Journal des transitions : chaque changement horodaté (§2).
create table if not exists docusign_envelope_events (
  id           bigint generated always as identity primary key,
  envelope_id  text not null,
  at           timestamptz not null default now(),
  statut       text not null,
  -- 'webhook' | 'rattrapage' | 'manuel' : d'où vient l'information.
  origine      text not null default 'webhook',
  detail       jsonb not null default '{}'::jsonb
);
create index if not exists idx_dsee_env on docusign_envelope_events (envelope_id, at desc);

-- ══════════════════════════════════════════════════════════════════════
--  4. File des notifications reçues
-- ══════════════════════════════════════════════════════════════════════
-- Les webhooks DocuSign Connect arrivent ici AVANT tout traitement. Si le
-- téléchargement ou l'archivage échoue, l'événement reste en file et sera
-- rejoué : DocuSign confirme une signature, mais l'archivage n'est considéré
-- comme terminé que lorsqu'il a réellement eu lieu (§8).
create table if not exists docusign_webhook_queue (
  id            uuid primary key default gen_random_uuid(),
  -- Clé d'idempotence : une même notification rejouée ne crée qu'une ligne.
  event_key     text unique not null,
  envelope_id   text not null,
  statut_recu   text,
  payload       jsonb not null default '{}'::jsonb,
  recu_le       timestamptz not null default now(),
  etat          text not null default 'en_attente' check (etat in (
                  'en_attente', 'en_cours', 'traite', 'echec')),
  essais        integer not null default 0,
  derniere_erreur text,
  prochain_essai_le timestamptz,
  traite_le     timestamptz
);
create index if not exists idx_dswq_a_traiter on docusign_webhook_queue (prochain_essai_le)
  where etat in ('en_attente', 'echec');
create index if not exists idx_dswq_env on docusign_webhook_queue (envelope_id, recu_le desc);

-- ══════════════════════════════════════════════════════════════════════
--  5. Politique de conservation, paramétrable (§7)
-- ══════════════════════════════════════════════════════════════════════
create table if not exists document_retention_rules (
  document_type text primary key,
  annees        integer not null,
  motif         text,
  updated_at    timestamptz not null default now()
);

-- Durées de départ, modifiables par le Super Admin. Elles correspondent aux
-- obligations usuelles de conservation ; à faire confirmer par le conseil de
-- l'entreprise avant de s'y fier.
insert into document_retention_rules (document_type, annees, motif) values
  ('contrat_cadre',          10, 'Contrat — prescription et preuve'),
  ('contrat_sous_traitance', 10, 'Contrat — prescription et preuve'),
  ('ordre_mission',          10, 'Pièce d''exécution rattachée au contrat'),
  ('avenant',                10, 'Modification contractuelle'),
  ('rapport_intervention',    5, 'Preuve d''exécution'),
  ('certificat_signature',   10, 'Preuve de consentement, suit le contrat'),
  ('facture_sous_traitant',  10, 'Pièce comptable'),
  ('piece_administrative',    5, 'Vigilance et conformité'),
  ('autre',                   5, null)
on conflict (document_type) do nothing;

-- ══════════════════════════════════════════════════════════════════════
--  6. Journal des accès (§7, §9)
-- ══════════════════════════════════════════════════════════════════════
-- Qui a consulté ou exporté quel document. Distinct de `audit_logs`, qui
-- trace les événements métier : ici on trace la CONSULTATION, ce qui est
-- exactement ce qu'un contrôle demande.
create table if not exists document_access_log (
  id          bigint generated always as identity primary key,
  document_id uuid not null references document_archive (id) on delete cascade,
  user_id     uuid references users (id) on delete set null,
  action      text not null check (action in ('consultation', 'telechargement', 'export')),
  at          timestamptz not null default now(),
  detail      jsonb not null default '{}'::jsonb
);
create index if not exists idx_dal_doc on document_access_log (document_id, at desc);
create index if not exists idx_dal_user on document_access_log (user_id, at desc);

-- ══════════════════════════════════════════════════════════════════════
--  7. Immuabilité d'un document final
-- ══════════════════════════════════════════════════════════════════════
-- Un document signé ne doit jamais être remplacé en silence (§7). Le
-- déclencheur refuse de déplacer son fichier, d'en changer l'empreinte ou de
-- revenir en arrière sur son statut. Une nouvelle version passe par une
-- nouvelle ligne.
create or replace function document_archive_protege_final()
returns trigger
language plpgsql
as $$
begin
  if old.is_final then
    if new.storage_path is distinct from old.storage_path
       or new.storage_bucket is distinct from old.storage_bucket
       or (old.sha256 is not null and new.sha256 is distinct from old.sha256)
    then
      raise exception
        'Document final % : son fichier ne peut pas être remplacé. Créez une nouvelle version (supersedes_id).',
        old.ref;
    end if;
    if old.signature_status = 'signe_toutes_parties'
       and new.signature_status <> old.signature_status
       and new.signature_status <> 'signe_toutes_parties'
    then
      raise exception
        'Document % : un document signé par toutes les parties ne peut pas revenir à « % ».',
        old.ref, new.signature_status;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_docarch_protege on document_archive;
create trigger trg_docarch_protege
  before update on document_archive
  for each row execute function document_archive_protege_final();

-- ══════════════════════════════════════════════════════════════════════
--  8. Numérotation
-- ══════════════════════════════════════════════════════════════════════
create or replace function allocate_document_archive_ref(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_year   integer := extract(year from now())::integer;
  v_next   integer;
begin
  v_prefix := case p_type
    when 'contrat_cadre'          then 'CAD'
    when 'contrat_sous_traitance' then 'CST'
    when 'ordre_mission'          then 'ODM'
    when 'avenant'                then 'AVE'
    when 'rapport_intervention'   then 'RPT'
    when 'certificat_signature'   then 'CER'
    when 'facture_sous_traitant'  then 'FST'
    else 'DOC'
  end;

  insert into subcontract_sequences (kind, year, last)
  values ('arch_' || p_type, v_year, 1)
  on conflict (kind, year) do update set last = subcontract_sequences.last + 1
  returning last into v_next;

  return v_prefix || '-' || v_year || '-' || lpad(v_next::text, 4, '0');
end;
$$;

-- ══════════════════════════════════════════════════════════════════════
--  9. RLS — isolation entre entités juridiques (§9)
-- ══════════════════════════════════════════════════════════════════════
alter table document_archive enable row level security;
alter table docusign_envelopes enable row level security;
alter table docusign_envelope_events enable row level security;
alter table docusign_webhook_queue enable row level security;
alter table document_retention_rules enable row level security;
alter table document_access_log enable row level security;

do $rls$
begin
  -- Le back-office lit le dépôt. Le périmètre par entité est appliqué en
  -- plus, côté application, à partir des entités autorisées de
  -- l'utilisateur : la RLS garantit déjà qu'un commercial n'y accède pas.
  if not exists (select 1 from pg_policies where tablename = 'document_archive' and policyname = 'docarch_backoffice') then
    create policy docarch_backoffice on document_archive for select to authenticated
      using (is_admin() or is_planificateur());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'docusign_envelopes' and policyname = 'dse_backoffice') then
    create policy dse_backoffice on docusign_envelopes for select to authenticated
      using (is_admin() or is_planificateur());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'docusign_envelope_events' and policyname = 'dsee_backoffice') then
    create policy dsee_backoffice on docusign_envelope_events for select to authenticated
      using (is_admin() or is_planificateur());
  end if;

  -- File des webhooks et journal d'accès : Super Admin seul. Ce sont des
  -- organes de supervision, pas des données de travail.
  if not exists (select 1 from pg_policies where tablename = 'docusign_webhook_queue' and policyname = 'dswq_admin') then
    create policy dswq_admin on docusign_webhook_queue for select to authenticated using (is_admin());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'document_access_log' and policyname = 'dal_admin') then
    create policy dal_admin on document_access_log for select to authenticated using (is_admin());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'document_retention_rules' and policyname = 'drr_read') then
    create policy drr_read on document_retention_rules for select to authenticated
      using (is_admin() or is_planificateur());
  end if;
end;
$rls$;
