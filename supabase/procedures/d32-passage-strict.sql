-- ============================================================================
-- PROCÉDURE — passer une planificatrice EXISTANTE au cloisonnement STRICT (D32)
--
-- Instruction du client du 2026-11-09 : « Pour les utilisateurs existants,
-- prépare une migration contrôlée des autorisations. Ne bloque aucun compte
-- existant sans inventaire préalable et validation. »
--
-- La migration 20261109000008 a posé `perimetre_herite = true` sur chaque
-- planificatrice existante : son accès d'avant D32 est CONSERVÉ. Cette
-- procédure le lève, compte par compte, APRÈS :
--   1. l'inventaire ci-dessous, relu ;
--   2. le réglage de ses pays et de ses entités (Paramètres › Utilisateurs) ;
--   3. la validation explicite du client.
--
-- ⚠️ Pas une migration. Éditeur SQL, recette d'abord. Se termine par ROLLBACK.
-- ============================================================================

-- ═══ ÉTAPE 1 — INVENTAIRE, LECTURE SEULE ═════════════════════════════════
begin transaction read only;

-- 1a. Les planificatrices, leur mode et leur réglage.
select u.email, u.perimetre_herite as mode_herite, u.countries as pays,
       cardinality(u.entites_autorisees) as nb_entites
  from users u
 where exists (select 1 from user_roles ur join roles r on r.id = ur.role_id
                where ur.user_id = u.id and r.slug = 'planification')
 order by u.email;

-- 1b. Ce que CHACUNE verrait en mode strict, avec son réglage ACTUEL —
--     « perdus » = visibles aujourd'hui, invisibles demain.
select u.email,
       (select count(*) from leads l where l.deleted_at is null) as leads_aujourdhui,
       (select count(*) from leads l where l.deleted_at is null
          and l.country = any (u.countries) and l.entity_id = any (u.entites_autorisees)) as leads_en_strict,
       (select count(*) from dossiers x join leads l on l.id = x.lead_id
          where l.country = any (u.countries) and l.entity_id = any (u.entites_autorisees)) as dossiers_en_strict,
       (select count(*) from dossiers) as dossiers_aujourdhui
  from users u
 where exists (select 1 from user_roles ur join roles r on r.id = ur.role_id
                where ur.user_id = u.id and r.slug = 'planification')
 order by u.email;

-- 1c. Les données SANS périmètre déterminable : en strict, PERSONNE (hors
--     admin) ne les voit. À rattacher AVANT de passer qui que ce soit.
select 'leads sans pays'            as constat, count(*) from leads     where deleted_at is null and country is null
union all
select 'leads sans entité',                     count(*) from leads     where deleted_at is null and entity_id is null
union all
select 'clients directs sans pays ni entité',   count(*) from clients   where deleted_at is null and source_lead_id is null and (pays is null or entite_id is null)
union all
select 'dossiers dont le lead est sans pays ou sans entité',
       count(*) from dossiers x join leads l on l.id = x.lead_id where l.country is null or l.entity_id is null;

commit;  -- lecture seule : rien n'a été écrit.

-- ═══ ÉTAPE 2 — PASSAGE AU STRICT D'UN COMPTE NOMMÉ ═══════════════════════
begin;

update users
   set perimetre_herite = false
 where email = 'planificatrice@exemple.fr'          -- ← UN compte, nommément
   and perimetre_herite = true
   and cardinality(countries) > 0                   -- refus : sans pays, elle ne verrait rien
   and cardinality(entites_autorisees) > 0;         -- refus : sans entité, elle ne verrait rien

-- Contrôle : exactement UNE ligne modifiée attendue. Zéro = l'une des trois
-- conditions manque (relire l'étape 1). Plus d'une = adresse ambiguë : ROLLBACK.
select email, perimetre_herite, countries, cardinality(entites_autorisees) as nb_entites
  from users where email = 'planificatrice@exemple.fr';

-- ⚠️ Relisez. Puis, et seulement alors, remplacez par COMMIT.
rollback;
