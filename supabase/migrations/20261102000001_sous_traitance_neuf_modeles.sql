-- Les NEUF modèles de contrat de sous-traitance (2026-11-02).
--
-- POURQUOI CETTE MIGRATION
--
-- `20261031000001_sous_traitance_contrats.sql` a créé la table avec une
-- contrainte n'acceptant QUE QUATRE modèles :
--
--   check (modele in ('nettoyage_approfondi', 'nettoyage_debarras',
--                     'nettoyage_complements', 'demenagement_transport'))
--
-- Le client a ensuite fourni sept contrats juridiques validés, et sa liste de
-- référence en compte neuf. Tant que cette contrainte reste en place, un
-- contrat de désinfection, de nettoyage insalubre ou de débarras insalubre est
-- REJETÉ PAR POSTGRES à l'insertion. C'était le verrou qui rendait les
-- contrats inutilisables même une fois l'interface écrite.
--
-- AUCUNE DONNÉE N'EST TOUCHÉE : la table est vide (aucun contrat n'a jamais pu
-- être émis), et l'opération ne fait que remplacer une contrainte de contrôle.
--
-- Les deux clés `nettoyage_complements` et `demenagement_transport` sont
-- CONSERVÉES : elles ne figurent pas dans la liste des neuf, mais le moteur de
-- routage les renvoie encore pour les familles « compléments d'activité » et
-- « transport ». Les garder évite qu'un brouillon échoue à l'insertion ; le
-- code interdit par ailleurs leur émission, faute de texte validé.

alter table subcontract_contracts
  drop constraint if exists subcontract_contracts_modele_check;

alter table subcontract_contracts
  add constraint subcontract_contracts_modele_check
  check (modele in (
    -- ── Les neuf modèles de la liste client ──────────────────────────
    'nettoyage_approfondi',          -- 1 · Nettoyage classique
    'nettoyage_debarras',            -- 2 · Nettoyage et débarras
    'debarras_seul',                 -- 3 · Débarras uniquement
    'desinfection_decontamination',  -- 4 · Désinfection et décontamination
    'nettoyage_insalubre',           -- 5 · Nettoyage insalubre
    'debarras_insalubre',            -- 6 · Débarras insalubre
    'insalubre_complet',             -- 7 · Nettoyage et débarras insalubres
    'nettoyage_lessivage',           -- 8 · Nettoyage approfondi AVEC lessivage
    'nettoyage_sans_lessivage',      -- 9 · Nettoyage approfondi SANS lessivage
    -- ── Replis internes du routage, hors liste des neuf ──────────────
    'nettoyage_complements',
    'demenagement_transport'
  ));

comment on column subcontract_contracts.modele is
  'Clé du modèle dans lib/sous-traitance/clauses.ts. Les neuf premiers correspondent à la liste client ; les deux derniers sont des replis de routage sans texte validé, non émissibles.';

-- ══════════════════════════════════════════════════════════════════════
--  Entité juridique émettrice — exigence « multientreprise »
-- ══════════════════════════════════════════════════════════════════════
-- Le contrat doit porter l'entité qui le signe, pas une société codée en dur.
-- Sans cette colonne, rien ne rattache un contrat signé à son émetteur, et la
-- bibliothèque par entité réclamée au §10 du cahier des charges serait
-- impossible à construire.
alter table subcontract_contracts
  add column if not exists entity_id uuid references legal_entities (id) on delete restrict;

comment on column subcontract_contracts.entity_id is
  'Entité juridique donneuse d''ordre. Obligatoire à l''émission ; sa sélection est faite par la planificatrice.';

create index if not exists idx_stc_entity on subcontract_contracts (entity_id);

-- ══════════════════════════════════════════════════════════════════════
--  RLS : les politiques d'ÉCRITURE, qui manquaient
-- ══════════════════════════════════════════════════════════════════════
-- `20261031000001` a activé la RLS sur les neuf tables du module et n'a créé
-- que des politiques `for select`. Conséquence : avec la clé de session, tout
-- INSERT et tout UPDATE étaient refusés par Postgres. La planificatrice
-- n'aurait donc pas pu enregistrer un seul contrat, même l'interface écrite —
-- et l'échec aurait été muet, la RLS ne renvoyant pas d'erreur explicite mais
-- zéro ligne affectée.
--
-- Le périmètre reste identique à la lecture : admin + planificatrice. Le
-- commercial n'écrit pas davantage qu'il ne lit, parce qu'il ne doit jamais
-- connaître un prix d'achat.

do $rls$
declare
  t text;
begin
  foreach t in array array[
    'subcontract_contracts', 'subcontract_lines', 'subcontract_amendments',
    'subcontract_missions', 'subcontract_reports', 'subcontract_report_photos',
    'subcontract_incidents', 'subcontract_events'
  ] loop
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = t || '_backoffice_insert'
    ) then
      execute format(
        'create policy %I on %I for insert to authenticated with check (is_admin() or is_planificateur())',
        t || '_backoffice_insert', t
      );
    end if;

    if not exists (
      select 1 from pg_policies where tablename = t and policyname = t || '_backoffice_update'
    ) then
      execute format(
        'create policy %I on %I for update to authenticated using (is_admin() or is_planificateur()) with check (is_admin() or is_planificateur())',
        t || '_backoffice_update', t
      );
    end if;
  end loop;
end;
$rls$;

-- Suppression : réservée à l'administrateur, et seulement sur un brouillon.
-- Un contrat envoyé ou signé ne se supprime pas — il s'annule, en gardant sa
-- trace (§29 : un document signé n'est jamais écrasé).
do $rls$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'subcontract_contracts' and policyname = 'subcontract_contracts_admin_delete'
  ) then
    create policy subcontract_contracts_admin_delete
      on subcontract_contracts for delete to authenticated
      using (is_admin() and statut = 'brouillon');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'subcontract_lines' and policyname = 'subcontract_lines_backoffice_delete'
  ) then
    -- Les lignes d'un brouillon se remplacent à chaque enregistrement du
    -- chiffrage : la planificatrice doit pouvoir les effacer.
    create policy subcontract_lines_backoffice_delete
      on subcontract_lines for delete to authenticated
      using (is_admin() or is_planificateur());
  end if;
end;
$rls$;

-- `subcontract_sequences` reste en lecture seule pour tout le monde :
-- l'allocation passe exclusivement par `allocate_subcontract_ref()`, qui est
-- SECURITY DEFINER. Y autoriser l'écriture directe permettrait de rejouer un
-- numéro, et la numérotation sans trou est une obligation comptable.
