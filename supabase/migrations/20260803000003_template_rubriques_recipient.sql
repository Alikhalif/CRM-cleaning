-- Extension de la bibliothèque de templates (client 2026-08-03) :
--   1. Nouvelles RUBRIQUES (= catégories du menu déroulant), parcours métier.
--   2. DESTINATAIRE (client / intervenant / interne) — l'intervenant = le
--      sous-traitant ; interne = transmission au service planification.
--   3. sort_order : ordre strict des templates dans une rubrique.

-- 1. Élargir la contrainte de catégorie aux nouvelles rubriques.
alter table message_templates drop constraint if exists message_templates_category_check;
alter table message_templates add constraint message_templates_category_check
  check (category in (
    -- existantes
    'devis','facture','info','photos','confirmation','planification','relance','administratif','autre',
    -- nouvelles rubriques (parcours métier)
    'decouverte','suivi_commercial','transmission','preparation','paiement','cloture',
    'consultation','affectation','avant_intervention','pendant_intervention','fin_intervention'
  ));

-- 2. Destinataire du template.
alter table message_templates add column if not exists recipient text not null default 'client'
  check (recipient in ('client','intervenant','interne'));

-- 3. Ordre d'affichage dans la rubrique.
alter table message_templates add column if not exists sort_order integer not null default 0;
