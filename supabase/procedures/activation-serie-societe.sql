-- ============================================================================
-- PROCÉDURE — ACTIVER la série de factures d'une société (D26)
--
-- ⚠️ À N'EXÉCUTER QU'APRÈS la validation EXPLICITE et écrite du client et de
-- son expert-comptable : date de bascule, code, traitement de l'année en
-- cours. Instruction du 2026-11-09 : « aucune activation de nouvelle série
-- sans validation explicite ».
--
-- Pourquoi une procédure SQL et pas un bouton : `activer_serie_societe()`
-- n'est exécutable par AUCUN rôle applicatif — ni session, ni service-role.
-- L'activation est donc un ACTE délibéré de l'opérateur, jamais l'effet d'un
-- clic, d'une date atteinte ou d'un déploiement.
--
-- Ce qui ne change pas : aucune facture déjà émise n'est renumérotée. La
-- série dédiée ne s'applique qu'aux émissions POSTÉRIEURES à sa date d'effet.
-- ============================================================================

begin;

-- 1. La série PRÉPARÉE (code + date d'effet), telle qu'elle est en base.
select id, legal_name, country, code_numerotation, numerotation_depuis, serie_activee_le
  from legal_entities
 where id = '00000000-0000-0000-0000-000000000000';  -- ← l'identifiant de la société

-- 2. L'activation. Remplacez les trois valeurs ; la fonction refuse une
--    justification de moins de 20 caractères.
select activer_serie_societe(
  '00000000-0000-0000-0000-000000000000',             -- ← société
  'Nom du validateur',                                -- ← qui a validé
  'Validation écrite du JJ/MM/AAAA, réf. … — bascule au 1er janvier AAAA'  -- ← justification
);

-- 3. Contrôle : activée, et rien d'autre n'a bougé.
select legal_name, code_numerotation, numerotation_depuis, serie_activee_le, serie_activee_par, serie_activation_justification
  from legal_entities where id = '00000000-0000-0000-0000-000000000000';

-- ⚠️ Relisez le contrôle. Puis, et seulement alors, remplacez par COMMIT.
rollback;
