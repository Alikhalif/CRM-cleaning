-- Date et créneau SOUHAITÉS par le client (demande client 2026-10-14).
--
-- Le champ `delai_souhaite` existant reste : il capte une intention vague
-- (« sous 48 h », « ce mois-ci ») que le client donne spontanément au
-- téléphone. Ces nouvelles colonnes captent l'inverse : une date précise au
-- calendrier et une tranche horaire. Les deux coexistent, on ne remplace rien.
--
-- ⚠️ Ce sont des SOUHAITS, pas une intervention confirmée. La planification
-- garde seule la main sur la date réelle (table dossiers). Les noms de colonnes
-- disent « wanted » pour qu'aucune lecture ne puisse les confondre avec un
-- créneau validé.
--
-- Transverses à tous les métiers → colonnes dédiées plutôt que discovery_details
-- (JSONB propre à chaque secteur) : la planificatrice doit pouvoir filtrer et
-- trier dessus.

alter table leads
  add column if not exists wanted_date date,
  add column if not exists wanted_slot text
    check (wanted_slot in ('matin', 'apres_midi', 'journee', 'heure_precise', 'personnalise', 'flexible')),
  -- Renseignées uniquement pour 'heure_precise' (début seul) et
  -- 'personnalise' (début + fin).
  add column if not exists wanted_time_start time,
  add column if not exists wanted_time_end time,
  -- Date précise du « délai personnalisé » de la carte POST-SIGNATURE
  -- (intervention_delay = 'personnalise'). À ne pas confondre avec wanted_date,
  -- qui est le souhait recueilli en découverte, avant la signature : l'un est
  -- une intention commerciale, l'autre un engagement pris après vente.
  add column if not exists intervention_delay_date date;

-- La planificatrice trie sa file sur la date souhaitée : index partiel, seules
-- les lignes renseignées comptent.
create index if not exists leads_wanted_date_idx
  on leads (wanted_date)
  where wanted_date is not null;

comment on column leads.wanted_date is
  'Date d''intervention SOUHAITÉE par le client (découverte). N''est pas une date confirmée — voir dossiers pour la planification réelle.';
comment on column leads.intervention_delay_date is
  'Date précise quand intervention_delay = ''personnalise'' (carte post-signature). Distincte de wanted_date (souhait de découverte).';
comment on column leads.wanted_slot is
  'Créneau souhaité : matin | apres_midi | journee | heure_precise | personnalise | flexible.';
