-- ============================================================================
-- D27 — PRÉPARATION d'une future transition des factures OPTIMIVV
--
-- Instruction du client du 2026-11-09 : « conserve les séries existantes et
-- prépare uniquement les opérations nécessaires à une future transition
-- comptable. Aucune activation de nouvelle série sans validation explicite. »
--
-- ⚠️ Pas une migration : aucun `db push` ne la joue. Elle ne s'exécute qu'au
-- Temps 3 du plan (docs/D27-PLAN-TRANSITION-OPTIMIVV.md), APRÈS les décisions
-- du client et de son expert-comptable. Se termine par ROLLBACK.
--
-- ── CE QU'ELLE NE FAIT PAS ───────────────────────────────────────────────
--   · elle ne modifie AUCUN numéro, AUCUN PDF, AUCUN compteur ;
--   · elle n'active AUCUNE série (D26 : procédure dédiée) ;
--   · elle ne rattache PAS l'historique à une société : elle MONTRE le
--     rattachement proposé (par SIRET), pour qu'il soit validé avant d'être
--     écrit — ou laissé vide.
-- ============================================================================

begin;

-- 1. Préparer : la société deviendra une COLONNE pour les factures FUTURES.
--    Nullable : l'historique garde sa société dans le SIRET imprimé.
alter table devis_optimivv
  add column if not exists entity_id uuid references legal_entities (id) on delete restrict;

-- 2. Montrer — sans rien écrire — le rattachement proposé de l'historique.
select o.doc_type,
       coalesce(nullif(o.data->'prestataire'->>'siret', ''), '(identité par défaut)') as siret_imprime,
       le.legal_name                                                                  as societe_proposee,
       count(*)                                                                       as documents
  from devis_optimivv o
  left join legal_entities le
    on regexp_replace(le.siret, '\s', '', 'g') = regexp_replace(coalesce(o.data->'prestataire'->>'siret', ''), '\s', '', 'g')
 group by 1, 2, 3
 order by 1, 4 desc;

-- 3. Les compteurs restent tels quels : on les MONTRE, on ne les touche pas.
select 'facture_optimivv_counters' as compteur, year, next_value - 1 as dernier_alloue from facture_optimivv_counters
union all
select 'devis_optimivv_counters', year, next_value - 1 from devis_optimivv_counters
order by 1, 2;

-- ⚠️ Rien de ceci n'est à valider avant les décisions Q1 à Q3 du plan D27.
rollback;
