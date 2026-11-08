-- ════════════════════════════════════════════════════════════════════
--  M1 — Historique des versions d'un devis
--
--  ⚠️ PRÉPARÉE, NON APPLIQUÉE. Autorisation du client du 2026-11-08 :
--  « Tu peux également préparer les fichiers nécessaires à M1. Mais AUCUNE
--  MIGRATION NE DOIT ÊTRE APPLIQUÉE POUR LE MOMENT. »
--
--  À appliquer sur la RECETTE d'abord, jamais sur la production en premier.
--  Son dossier complet — impacts, risques, plan de retour arrière — est dans
--  docs/MIGRATION-M1-HISTORIQUE-DEVIS.md.
--
--  Le §17 du référentiel de rédaction exige « un historique des versions ».
--  Il n'existe aujourd'hui que dans l'éditeur : fermer l'onglet avant
--  d'enregistrer perd les versions intermédiaires, et une fois enregistré, le
--  texte précédent est écrasé. Le code du Lot E est déjà branché aux quatre
--  origines ; sans cette table, il n'enregistre rien et le panneau le dit.
--
--  ADDITIVE ET SEULEMENT ADDITIVE : une table nouvelle, aucune colonne
--  ajoutée ni modifiée ailleurs, aucune donnée existante touchée, aucun index
--  supprimé, aucune politique existante altérée. Vérifié le 2026-11-08 :
--  ses deux dépendances — `documents(id)` et `users(id)` — existent, et les
--  fonctions `is_admin()` / `is_planificateur()` de sa RLS sont celles de
--  20260515000005_init_rls.sql.
--
--  ⚠️ LES DEVIS DÉJÀ ÉMIS N'AURONT PAS D'HISTORIQUE. Fabriquer une version
--  `emission` rétroactive depuis le `notes` actuel affirmerait que ce texte
--  est celui qui a été envoyé, ce que personne ne peut vérifier.
--  L'historique commence le jour de la migration, et l'interface doit le dire.
-- ════════════════════════════════════════════════════════════════════

create table if not exists document_versions (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,

  -- Numéro de version PAR DOCUMENT, à partir de 1. Attribué côté serveur
  -- sous verrou, jamais par le client : deux onglets ouverts sur le même
  -- devis ne doivent pas écrire la version 3 deux fois.
  version     integer not null check (version >= 1),

  -- Le contenu, tel qu'il était. Deux champs seulement, parce que ce sont les
  -- deux que l'éditeur manipule : le libellé qui porte le titre, et les notes
  -- qui portent les trois blocs.
  --
  -- ⚠️ AUCUN MONTANT ici, et c'est volontaire. Les lignes du devis ont leur
  -- propre table (`document_lines`) et leur propre histoire ; recopier un
  -- total dans un historique de texte créerait une seconde vérité sur le
  -- prix, qui finirait par contredire la première.
  designation text,
  notes       text,

  -- D'où vient cette version. C'est le champ qui porte la valeur de preuve :
  -- distinguer ce que le moteur a rédigé de ce qu'un humain a réécrit.
  --
  -- `text` + `check` et NON un enum Postgres : élargir un `check` est un
  -- `alter table` immédiat, ajouter une valeur à un enum est une migration de
  -- plus. Le dépôt réserve les enums aux états métier stables.
  origine     text not null
              check (origine in ('moteur', 'assiste', 'manuel', 'emission')),

  -- Règles de rédaction appliquées, quand `origine = 'assiste'`.
  -- Vide pour les autres origines.
  regles      text[] not null default '{}',

  note        text,
  cree_le     timestamptz not null default now(),
  cree_par    uuid references users(id),

  -- Une seule ligne par (document, version). C'est la contrainte qui rend
  -- l'attribution du numéro sûre : une course perdue lève une violation
  -- d'unicité (23505) au lieu d'écrire une version en double.
  unique (document_id, version)
);

-- Lecture de l'historique d'un devis : du plus récent au plus ancien, c'est le
-- seul ordre dans lequel on consulte un historique.
create index if not exists document_versions_doc_idx
  on document_versions (document_id, version desc);

-- Retrouver la version d'émission d'un devis sans parcourir tout l'historique.
create index if not exists document_versions_emission_idx
  on document_versions (document_id)
  where origine = 'emission';

-- ── APPEND-ONLY, AU NIVEAU DE LA BASE ──────────────────────────────
--
-- Un historique modifiable n'est pas un historique. La règle est posée en
-- base, et non dans le code applicatif, parce que c'est la seule façon
-- qu'elle survive à un futur `supabase db push` écrit par quelqu'un d'autre.
--
-- `audit_logs` suit la même discipline dans ce dépôt.
create or replace function document_versions_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'document_versions est append-only : une version ne se modifie ni ne se supprime (document_id=%, version=%)',
    old.document_id, old.version;
end;
$$;

drop trigger if exists document_versions_no_update on document_versions;
create trigger document_versions_no_update
  before update or delete on document_versions
  for each row execute function document_versions_append_only();

-- ── RLS ────────────────────────────────────────────────────────────
--
-- Calquée EXACTEMENT sur la politique de `documents`
-- (20260515000005_init_rls.sql) : admin, planificateur, ou propriétaire du
-- lead rattaché. Pas une politique « inspirée de » — la même, parce qu'un
-- historique plus permissif que le document qu'il décrit serait une fuite :
-- le texte d'un devis d'un autre commercial est exactement ce que la tenancy
-- `mine` protège.
--
-- ⚠️ RISQUE CONNU, consigné au registre : cette politique est DUPLIQUÉE, pas
-- dérivée. Si celle de `documents` évolue, les deux divergent. Une suite de
-- contrôles doit vérifier qu'elles accordent les mêmes accès.
alter table document_versions enable row level security;

create policy "document_versions visible comme le devis"
  on document_versions for select
  to authenticated
  using (
    exists (
      select 1 from documents d
      where d.id = document_versions.document_id
        and d.deleted_at is null
        and (
          is_admin()
          or is_planificateur()
          or (
            d.lead_id is not null
            and exists (
              select 1 from leads l
              where l.id = d.lead_id and l.owner_id = auth.uid()
            )
          )
        )
    )
  );

-- INSERT seulement. Pas de `for all` : le trigger refuserait de toute façon un
-- UPDATE, mais une politique qui l'autorise donnerait à lire le contraire de
-- ce qui se passe.
create policy "document_versions écrivable comme le devis"
  on document_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from documents d
      where d.id = document_versions.document_id
        and d.deleted_at is null
        and (
          is_admin()
          or is_planificateur()
          or (
            d.lead_id is not null
            and exists (
              select 1 from leads l
              where l.id = d.lead_id and l.owner_id = auth.uid()
            )
          )
        )
    )
  );

comment on table document_versions is
  'Historique append-only du TEXTE d''un devis (§17). Aucun montant : les '
  'lignes et les totaux ont leur propre histoire. `origine` distingue ce que '
  'le moteur a rédigé de ce qu''un humain a réécrit.';
