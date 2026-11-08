-- ============================================================================
-- INVENTAIRE DES SÉRIES DE FACTURES — LECTURE SEULE (D26, D27 — 2026-11-09)
--
-- Sert la décision de l'expert-comptable : combien de factures dans chaque
-- série, par société et par année, et y a-t-il des TROUS ?
--
-- ⚠️ Rien ici n'écrit : la transaction est déclarée `read only` — PostgreSQL
-- refuserait toute écriture, même par erreur. Sur la RECETTE, librement ; sur
-- la PRODUCTION, uniquement avec l'autorisation explicite du client.
--
-- Pas une migration : ce dossier n'est lu par aucun `supabase db push`.
-- ============================================================================

begin transaction read only;

-- 1. Série du CRM (`documents`, compteur `doc_counters` COMMUN aux sociétés) :
--    par société, type et année — et le nombre de numéros MANQUANTS entre le
--    plus petit et le plus grand de chaque société (ce que D26 décrit).
with f as (
  select d.type, le.legal_name as societe, le.country as pays,
         split_part(d.num, '-', 2)::int as annee,
         nullif(regexp_replace(split_part(d.num, '-', 3), '\D', '', 'g'), '')::int as rang,
         d.status
    from documents d
    join legal_entities le on le.id = d.entity_id
   where d.type in ('acompte', 'finale')
     and d.num ~ '^(FA|FAC)-\d{4}-\d+$'          -- série historique seulement
)
select type, societe, pays, annee,
       count(*)                                   as factures,
       min(rang)                                  as premier,
       max(rang)                                  as dernier,
       (max(rang) - min(rang) + 1) - count(*)     as numeros_absents_pour_cette_societe,
       count(*) filter (where status = 'brouillon') as brouillons_deja_numerotes
  from f
 group by type, societe, pays, annee
 order by annee, type, societe;

-- 2. Série OPTIMIVV (`devis_optimivv`, compteur `facture_optimivv_counters`,
--    clé = l'ANNÉE seule). La société n'y est pas une colonne : elle se lit
--    dans le SIRET imprimé (`data → prestataire → siret`), sinon c'est
--    l'identité par défaut codée dans `lib/devis/types.ts`.
with o as (
  select coalesce(nullif(data->'prestataire'->>'siret', ''), '(identité par défaut)') as siret,
         split_part(numero, '-', 2)::int as annee,
         nullif(regexp_replace(split_part(numero, '-', 3), '\D', '', 'g'), '')::int as rang
    from devis_optimivv
   where doc_type = 'facture'
)
select siret, annee, count(*) as factures, min(rang) as premier, max(rang) as dernier,
       (max(rang) - min(rang) + 1) - count(*) as numeros_absents_pour_ce_siret
  from o group by siret, annee order by annee, siret;

-- 3. Trous de la série OPTIMIVV ENTIÈRE (toutes sociétés) : un numéro alloué
--    puis jamais archivé (téléchargement interrompu, envoi échoué) laisse un
--    trou — chaque appel à `allocateNumero` consommait un numéro (D30).
with o as (
  select split_part(numero, '-', 2)::int as annee,
         split_part(numero, '-', 3)::int as rang
    from devis_optimivv where doc_type = 'facture' and numero ~ '^FAC-\d{4}-\d{5}$'
), c as (
  select year as annee, next_value - 1 as alloues from facture_optimivv_counters
)
select c.annee, c.alloues as numeros_alloues,
       count(o.rang)       as factures_archivees,
       c.alloues - count(o.rang) as numeros_alloues_sans_facture
  from c left join o on o.annee = c.annee
 group by c.annee, c.alloues order by c.annee;

-- 4. Sociétés présentes dans les DEUX séries la même année (le cas D27).
select le.legal_name as societe, split_part(d.num, '-', 2)::int as annee
  from documents d join legal_entities le on le.id = d.entity_id
 where d.type = 'finale' and d.num ~ '^FAC-\d{4}-\d{4}$'
intersect
select le.legal_name, split_part(o.numero, '-', 2)::int
  from devis_optimivv o
  join legal_entities le on regexp_replace(le.siret, '\s', '', 'g') = regexp_replace(o.data->'prestataire'->>'siret', '\s', '', 'g')
 where o.doc_type = 'facture'
order by 2, 1;

rollback;   -- rien à annuler : transaction en lecture seule, fermée proprement.
