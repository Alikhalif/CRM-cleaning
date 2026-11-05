-- Sociétés émettrices : représentation par une personne morale.
--
-- CONTEXTE (consigne client du 2026-11-04, §10). Le CRM opère dans cinq pays
-- — France, Suisse, Belgique, Luxembourg, Canada.
--
-- CE QUI EXISTAIT DÉJÀ, vérifié en production le 2026-11-04 : les colonnes
-- `country`, `siren`, `representative_name` et `representative_title` sont
-- présentes. Le problème n'était donc PAS le schéma mais l'application :
--
--   • aucun écran n'exposait `country` ni `siren` — toutes les sociétés
--     étaient de fait traitées comme françaises ;
--   • la validation du formulaire exigeait un SIRET de 14 chiffres pour
--     TOUTES les sociétés, ce qui rendait impossible l'enregistrement d'une
--     entité suisse, belge, luxembourgeoise ou canadienne.
--
-- Ces deux points sont corrigés côté code, sans migration.
--
-- CE QUE CETTE MIGRATION AJOUTE : une seule colonne.
--
--   `representative_company_name` — une société peut être représentée par une
--   AUTRE SOCIÉTÉ : une SAS dont la présidence est exercée par une personne
--   morale, une SARL dont la gérance l'est, une holding. La formule juridique
--   devient « la société X, représentée par la société Y, elle-même
--   représentée par M. Z, en sa qualité de … ». Sans cette colonne, le bloc
--   « ENTRE LES SOUSSIGNÉS » du contrat écrivait une contrevérité.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--
--   • Elle ne renseigne AUCUN représentant légal. Ces valeurs sortent des
--     statuts des sociétés : elles sont à saisir par l'administrateur, et
--     ne doivent pas être devinées.
--   • Elle ne touche ni `siret`, ni `siren`, ni `country`, ni aucune clause
--     contractuelle.
--
-- Réversible : une colonne nullable ajoutée, rien de supprimé ni renommé.

alter table public.legal_entities
  add column if not exists representative_company_name text;

comment on column public.legal_entities.representative_company_name is
  'Dénomination de la SOCIÉTÉ qui représente cette entité, quand la '
  'représentation légale est exercée par une personne morale (présidence ou '
  'gérance exercée par une société, holding). Null = la société est '
  'représentée directement par une personne physique. Quand elle est '
  'renseignée, `representative_name` et `representative_title` décrivent la '
  'personne physique qui représente CETTE société représentante, et le '
  'contrat écrit « représentée par la société X, elle-même représentée par '
  'M. Y, en sa qualité de Z ».';

-- Documentation des colonnes existantes, pour que le prochain lecteur sache
-- qu'elles servent les cinq pays et non la France seule.
comment on column public.legal_entities.country is
  'Pays d''établissement : FR | CH | LU | BE | CA. Détermine le libellé de '
  'l''identifiant légal attendu et les mentions portées sur les documents.';

comment on column public.legal_entities.siren is
  'Identifiant légal NATIONAL, quel que soit le pays : SIREN (France, '
  '9 chiffres — l''entité juridique, là où le SIRET désigne un '
  'établissement), IDE/CHE (Suisse), numéro BCE (Belgique), RCS (Luxembourg), '
  'NEQ ou numéro d''entreprise (Canada). C''est cette valeur que porte le '
  'contrat de sous-traitance.';

-- La planificatrice filtre les sociétés émettrices par pays au moment de
-- choisir celle qui émet un contrat.
create index if not exists legal_entities_country_idx
  on public.legal_entities (country)
  where deleted_at is null;
