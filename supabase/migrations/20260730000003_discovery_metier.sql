-- Découverte métier Débarras / Déménagement (2026-07-30). La fiche découverte
-- s'adapte au secteur : les champs communs (surface, délai, fourchette de prix,
-- réaction, contexte, acompte) restent des colonnes ; les champs TECHNIQUES
-- propres à chaque métier (type de bien, volume, accès, adresses, distance,
-- étages, monte-meubles, objets spécifiques…) vont dans un JSONB flexible.

alter table leads
  add column if not exists discovery_details jsonb not null default '{}'::jsonb;
