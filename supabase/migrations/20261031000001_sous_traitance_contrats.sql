-- Contrats de sous-traitance, avenants, rapports et incidents (2026-10-31).
--
-- AJOUT STRICTEMENT ADDITIF. Aucune table existante n'est modifiée.
--
-- POURQUOI DE NOUVELLES TABLES PLUTÔT QUE `contracts`
--
-- `contracts` est la table des contrats CLIENTS : sa colonne `client_id` est
-- NOT NULL et référence `clients`. Un contrat de sous-traitance lie OPTIMIVV
-- à un PRESTATAIRE, pour une intervention — il n'a pas de client_id à y
-- mettre. Rendre cette colonne facultative toucherait le module Documents &
-- contrats clients, hors périmètre.
--
-- L'identité du prestataire reste `technicians` + `subcontractor_profiles` :
-- rien n'est dupliqué. Les interventions restent lues dans `dossiers`, les
-- prestations vendues dans les devis. Ce module n'écrit que ses propres
-- tables.
--
-- RLS : réservé au back-office (admin + planificatrice), comme le reste du
-- module sous-traitance. Les commerciaux n'y ont aucun accès — ils ne doivent
-- pas voir les prix d'achat.

-- ── 1. Contrat de sous-traitance (cadre ou mission) ───────────────────
create table if not exists subcontract_contracts (
  id             uuid primary key default gen_random_uuid(),
  ref            text unique,

  -- 'cadre'   : obligations permanentes, signées une fois (§20)
  -- 'mission' : une intervention précise, référence le cadre applicable
  portee         text not null default 'mission' check (portee in ('cadre', 'mission')),
  parent_id      uuid references subcontract_contracts (id) on delete set null,

  technician_id  uuid not null references technicians (id) on delete restrict,
  -- Null pour un contrat-cadre : il ne porte sur aucune intervention.
  dossier_id     uuid references dossiers (id) on delete set null,
  lead_id        uuid references leads (id) on delete set null,

  -- Un des quatre modèles de lib/sous-traitance/clauses.ts.
  modele         text not null check (modele in (
                   'nettoyage_approfondi', 'nettoyage_debarras',
                   'nettoyage_complements', 'demenagement_transport')),
  -- Version du jeu de modèles utilisée. FIGÉE : modifier un modèle ne doit
  -- jamais changer un contrat déjà signé (§29).
  modele_version text not null default '1.0',

  -- Instantané complet du document au moment de l'émission : articles,
  -- variables résolues, prestations, montants. C'est lui qui fait foi, pas
  -- un recalcul ultérieur.
  contenu        jsonb not null default '{}'::jsonb,

  statut         text not null default 'brouillon' check (statut in (
                   'brouillon', 'a_completer', 'en_attente_validation',
                   'pret_a_envoyer', 'envoye', 'consulte', 'en_attente_signature',
                   'signe', 'refuse', 'expire', 'annule', 'remplace_par_avenant',
                   'archive')),

  mode_prix      text not null default 'detaille' check (mode_prix in ('forfait', 'detaille')),
  total_ht       numeric(12,2),
  taux_tva       numeric(5,2),
  total_ttc      numeric(12,2),

  date_debut     date,
  date_fin       date,
  pdf_path       text,
  signed_pdf_path text,

  envoye_a       text,
  envoye_le      timestamptz,
  envoye_par     uuid references users (id) on delete set null,
  consulte_le    timestamptz,
  signe_le       timestamptz,
  -- Éléments de preuve de la signature (jeton haché, horodatage, empreinte
  -- du document). Un simple booléen « signé » ne prouverait rien (§22).
  signature_preuve jsonb,

  notes          text,
  created_by     uuid references users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

comment on table subcontract_contracts is
  'Contrats de sous-traitance (cadre et mission). Distinct de `contracts`, qui porte les contrats clients.';
comment on column subcontract_contracts.contenu is
  'Instantané du document émis : articles, variables, prestations, montants. Fait foi même si un modèle évolue ensuite.';

create index if not exists idx_stc_tech on subcontract_contracts (technician_id, created_at desc);
create index if not exists idx_stc_dossier on subcontract_contracts (dossier_id);
create index if not exists idx_stc_statut on subcontract_contracts (statut) where deleted_at is null;
-- Un seul contrat-cadre ACTIF par prestataire.
create unique index if not exists uq_stc_cadre_actif
  on subcontract_contracts (technician_id)
  where portee = 'cadre' and deleted_at is null and statut in ('signe', 'envoye', 'en_attente_signature');

-- ── 2. Lignes de prestations du contrat ──────────────────────────────
-- Les prix sont ceux convenus avec le SOUS-TRAITANT. Aucun prix client n'est
-- stocké ici, et aucune vue ne rapproche les deux (§17).
create table if not exists subcontract_lines (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references subcontract_contracts (id) on delete cascade,
  -- Code de la bibliothèque, ou null pour une ligne reprise du devis sans
  -- correspondance : elle reste visible et marquée `a_verifier` (§16).
  code          text,
  label         text not null,
  descriptif    text,
  quantite      numeric(12,2),
  unite         text,
  prix_unitaire_ht numeric(12,2),
  montant_ht    numeric(12,2),
  fournitures_incluses boolean not null default true,
  materiel_inclus boolean not null default true,
  a_verifier    boolean not null default false,
  -- 'prestation' | 'frais' : les frais annexes (déplacement, péages…) sont
  -- distingués pour pouvoir les présenter à part sur le contrat.
  genre         text not null default 'prestation' check (genre in ('prestation', 'frais')),
  observations  text,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_stl_contract on subcontract_lines (contract_id, position);

-- ── 3. Avenants ──────────────────────────────────────────────────────
-- Le contrat initial n'est JAMAIS modifié : l'avenant s'y ajoute (§24).
create table if not exists subcontract_amendments (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique,
  contract_id   uuid not null references subcontract_contracts (id) on delete cascade,
  -- Version du contrat de référence, pour que l'avenant reste lisible même
  -- si les modèles évoluent.
  modele_version text not null default '1.0',
  objet         text not null,
  descriptif    text,
  contenu       jsonb not null default '{}'::jsonb,
  total_ht      numeric(12,2),
  taux_tva      numeric(5,2),
  total_ttc     numeric(12,2),
  -- Double validation exigée par le §7 : OPTIMIVV, et le client quand la
  -- prestation sort de son engagement initial.
  valide_optimivv_le   timestamptz,
  valide_optimivv_par  uuid references users (id) on delete set null,
  accord_client_ref    text,
  accord_client_le     timestamptz,
  statut        text not null default 'brouillon' check (statut in (
                  'brouillon', 'en_attente_validation', 'pret_a_envoyer', 'envoye',
                  'en_attente_signature', 'signe', 'refuse', 'annule', 'archive')),
  pdf_path      text,
  signed_pdf_path text,
  signe_le      timestamptz,
  signature_preuve jsonb,
  created_by    uuid references users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists idx_sta_contract on subcontract_amendments (contract_id, created_at desc);

-- ── 4. Ordres de mission ─────────────────────────────────────────────
create table if not exists subcontract_missions (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique,
  contract_id   uuid not null references subcontract_contracts (id) on delete cascade,
  dossier_id    uuid references dossiers (id) on delete set null,
  -- Variables résolues au moment de l'émission : adresse de chantier, accès,
  -- étages, volumes, consignes, exigences de sécurité.
  contenu       jsonb not null default '{}'::jsonb,
  date_prevue   date,
  heure_debut   time,
  heure_fin     time,
  pdf_path      text,
  created_by    uuid references users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_stm_contract on subcontract_missions (contract_id, created_at desc);

-- ── 5. Rapports d'intervention ───────────────────────────────────────
-- Le rapport distingue le PRÉREMPLI du DÉCLARÉ : une prestation prévue n'est
-- jamais réputée réalisée (§25).
create table if not exists subcontract_reports (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique,
  contract_id   uuid not null references subcontract_contracts (id) on delete cascade,
  dossier_id    uuid references dossiers (id) on delete set null,
  -- Repris du contrat : client, chantier, prestations contractuelles.
  prerempli     jsonb not null default '{}'::jsonb,
  -- Déclaré après intervention : horaires réels, prestations réalisées ou
  -- non, difficultés, incidents, réserves, observations.
  declare       jsonb not null default '{}'::jsonb,
  heure_arrivee timestamptz,
  heure_depart  timestamptz,
  statut        text not null default 'attendu' check (statut in (
                  'attendu', 'brouillon', 'remis', 'valide', 'refuse')),
  remis_le      timestamptz,
  remis_par     uuid references users (id) on delete set null,
  valide_le     timestamptz,
  valide_par    uuid references users (id) on delete set null,
  pdf_path      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_str_contract on subcontract_reports (contract_id, created_at desc);
create index if not exists idx_str_statut on subcontract_reports (statut);

-- Photographies du rapport, avant et après (§25).
create table if not exists subcontract_report_photos (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references subcontract_reports (id) on delete cascade,
  moment        text not null check (moment in ('avant', 'apres', 'incident')),
  storage_path  text not null,
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  legende       text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_strp_report on subcontract_report_photos (report_id, moment);

-- ── 6. Non-conformités et reprises ───────────────────────────────────
create table if not exists subcontract_incidents (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique,
  contract_id   uuid not null references subcontract_contracts (id) on delete cascade,
  technician_id uuid not null references technicians (id) on delete restrict,
  dossier_id    uuid references dossiers (id) on delete set null,
  nature        text not null check (nature in (
                  'prestation_incomplete', 'prestation_non_conforme', 'degradation',
                  'retard', 'absence', 'incident_securite', 'rapport_manquant',
                  'photos_manquantes', 'autre')),
  description   text not null,
  constate_le   timestamptz not null default now(),
  constate_par  uuid references users (id) on delete set null,
  reprise_demandee boolean not null default false,
  reprise_delai date,
  reponse_sous_traitant text,
  reponse_le    timestamptz,
  resultat      text,
  statut        text not null default 'ouvert' check (statut in (
                  'ouvert', 'reprise_demandee', 'reprise_en_cours', 'resolu', 'clos_sans_suite')),
  clos_le       timestamptz,
  clos_par      uuid references users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_sti_contract on subcontract_incidents (contract_id, constate_le desc);
create index if not exists idx_sti_tech on subcontract_incidents (technician_id, constate_le desc);
create index if not exists idx_sti_ouverts on subcontract_incidents (statut) where statut <> 'resolu' and statut <> 'clos_sans_suite';

-- ── 7. Journal des changements de statut ─────────────────────────────
-- Chaque transition est horodatée et attribuée (§23, §33).
create table if not exists subcontract_events (
  id            bigint generated always as identity primary key,
  contract_id   uuid references subcontract_contracts (id) on delete cascade,
  amendment_id  uuid references subcontract_amendments (id) on delete cascade,
  report_id     uuid references subcontract_reports (id) on delete cascade,
  incident_id   uuid references subcontract_incidents (id) on delete cascade,
  at            timestamptz not null default now(),
  kind          text not null,
  by_user       uuid references users (id) on delete set null,
  detail        jsonb not null default '{}'::jsonb
);
create index if not exists idx_ste_contract on subcontract_events (contract_id, at desc);

-- ── 8. Numérotation ──────────────────────────────────────────────────
-- Séquences par type et par année, comme les documents clients. Sans trou :
-- un contrat de sous-traitance est une pièce justificative.
create table if not exists subcontract_sequences (
  kind   text not null,
  year   integer not null,
  last   integer not null default 0,
  primary key (kind, year)
);

create or replace function allocate_subcontract_ref(p_kind text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_next integer;
begin
  -- Verrou de ligne : deux planificatrices qui émettent au même instant ne
  -- doivent pas obtenir le même numéro.
  insert into subcontract_sequences (kind, year, last)
  values (p_kind, v_year, 1)
  on conflict (kind, year) do update set last = subcontract_sequences.last + 1
  returning last into v_next;

  return p_prefix || '-' || v_year || '-' || lpad(v_next::text, 4, '0');
end;
$$;

-- ── 9. RLS ───────────────────────────────────────────────────────────
-- Back-office uniquement : admin + planificatrice. Les écritures passent par
-- des server actions qui vérifient déjà le rôle ; la RLS reste la garde de
-- fond, celle qui tient si le code se trompe.
alter table subcontract_contracts enable row level security;
alter table subcontract_lines enable row level security;
alter table subcontract_amendments enable row level security;
alter table subcontract_missions enable row level security;
alter table subcontract_reports enable row level security;
alter table subcontract_report_photos enable row level security;
alter table subcontract_incidents enable row level security;
alter table subcontract_events enable row level security;
alter table subcontract_sequences enable row level security;

do $rls$
declare
  t text;
begin
  foreach t in array array[
    'subcontract_contracts', 'subcontract_lines', 'subcontract_amendments',
    'subcontract_missions', 'subcontract_reports', 'subcontract_report_photos',
    'subcontract_incidents', 'subcontract_events', 'subcontract_sequences'
  ] loop
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = t || '_backoffice'
    ) then
      execute format(
        'create policy %I on %I for select to authenticated using (is_admin() or is_planificateur())',
        t || '_backoffice', t
      );
    end if;
  end loop;
end;
$rls$;
