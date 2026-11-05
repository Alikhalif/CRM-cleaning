-- Vérification de la migration 20261104000001 — LECTURE SEULE.
--
-- À coller dans Supabase SQL Editor (projet ggdafbqahvugmzixovik).
--
-- CE SCRIPT N'ÉCRIT RIEN. Aucun INSERT, UPDATE, DELETE, ALTER ni DROP. Il ne
-- fait que lire les catalogues système. Il peut être exécuté à tout moment,
-- sur la production, sans risque.
--
-- POURQUOI IL EXISTE : deux informations ne sont pas visibles par l'API REST
-- (PostgREST n'expose ni le schéma `supabase_migrations` ni les index) :
--
--   1. la migration est-elle ENREGISTRÉE dans l'historique ?
--   2. l'index `legal_entities_country_idx` existe-t-il ?
--
-- Le reste — présence des colonnes — a déjà été vérifié par l'API et est
-- confirmé : `representative_company_name`, `representative_name`,
-- `representative_title`, `country` et `siren` sont toutes présentes.

-- ═════════════════════════════════════════════════════════════════════
--  1. La migration est-elle enregistrée dans l'historique ?
-- ═════════════════════════════════════════════════════════════════════
--
-- ⚠️ Une colonne présente ne prouve PAS que la migration est enregistrée :
-- elle peut avoir été ajoutée à la main, ou par un `db push` dont
-- l'historique a divergé. Les deux questions sont distinctes.

select
  '1. historique des migrations' as controle,
  version,
  name,
  case
    when version = '20261104000001' then 'CETTE migration'
    else ''
  end as remarque
from supabase_migrations.schema_migrations
where version >= '20261031000000'
order by version desc;

-- Verdict attendu : une ligne `20261104000001`.
-- Si elle est ABSENTE alors que la colonne existe, le schéma est en avance
-- sur l'historique — voir le §4 ci-dessous avant toute action.


-- ═════════════════════════════════════════════════════════════════════
--  2. Les colonnes, avec leur type exact et leur nullabilité
-- ═════════════════════════════════════════════════════════════════════

select
  '2. colonnes' as controle,
  column_name,
  data_type,
  is_nullable,
  col_description(
    ('public.' || table_name)::regclass::oid,
    ordinal_position
  ) as commentaire
from information_schema.columns
where table_schema = 'public'
  and table_name = 'legal_entities'
  and column_name in (
    'representative_company_name',
    'representative_name',
    'representative_title',
    'country',
    'siren',
    'siret'
  )
order by column_name;

-- Verdict attendu : 6 lignes, toutes `is_nullable = YES` sauf `country` et
-- `siret` (NOT NULL depuis l'origine).
--
-- Le champ `commentaire` est l'indice le plus utile : la migration pose un
-- `comment on column`. S'il est présent, c'est la migration COMPLÈTE qui a
-- tourné, pas seulement un `alter table ... add column` manuel.


-- ═════════════════════════════════════════════════════════════════════
--  3. L'index legal_entities_country_idx
-- ═════════════════════════════════════════════════════════════════════

select
  '3. index' as controle,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'legal_entities'
order by indexname;

-- Verdict attendu : une ligne `legal_entities_country_idx`, avec
-- `WHERE (deleted_at IS NULL)` dans sa définition — c'est un index PARTIEL.
-- Son absence n'empêche rien de fonctionner : c'est un index de lecture, pas
-- une contrainte. Le CRM marche sans lui, simplement un peu moins vite sur le
-- filtrage des sociétés par pays.


-- ═════════════════════════════════════════════════════════════════════
--  4. Si le schéma est en avance sur l'historique
-- ═════════════════════════════════════════════════════════════════════
--
-- Cas de figure : la colonne existe (§2 la trouve) mais la migration n'est
-- pas enregistrée (§1 ne la trouve pas).
--
-- NE PAS marquer la migration comme appliquée sans avoir vérifié que son
-- contenu l'est RÉELLEMENT — sinon un prochain `db push` la sautera et
-- l'index comme les commentaires manqueront pour toujours.
--
-- La migration 20261104000001 ne fait que trois choses :
--   a) add column if not exists representative_company_name text
--   b) comment on column  (×3 : la nouvelle, country, siren)
--   c) create index if not exists legal_entities_country_idx
--
-- Les trois sont IDEMPOTENTES (`if not exists`). La réconciliation sûre est
-- donc de la REJOUER plutôt que de la déclarer appliquée : elle ne touchera
-- que ce qui manque, et n'altérera aucune donnée.
--
--   npx supabase db push        (depuis le poste lié, pas depuis le VPS)
--
-- Elle n'effectue AUCUN UPDATE : les sept sociétés ne sont pas modifiées.
--
-- Vérification après coup : relancer §1, §2 et §3 de ce script.


-- ═════════════════════════════════════════════════════════════════════
--  5. Contrôle de non-destruction — à relever AVANT et APRÈS
-- ═════════════════════════════════════════════════════════════════════
--
-- Si vous devez rejouer la migration, relevez ces chiffres avant, puis après.
-- Ils doivent être identiques : la migration n'écrit aucune donnée.

select
  '5. donnees' as controle,
  count(*)                                                  as societes,
  count(*) filter (where deleted_at is null)                 as actives,
  count(*) filter (where representative_name is not null)    as avec_representant,
  count(*) filter (where representative_company_name is not null) as via_societe,
  count(*) filter (where siren is not null)                  as avec_siren,
  count(distinct country)                                    as pays_distincts
from public.legal_entities;

-- Relevé du 2026-11-05, par l'API REST :
--   societes = 7 · avec_representant = 0 · via_societe = 0
--   avec_siren = 3 · pays_distincts = 1 (FR)
