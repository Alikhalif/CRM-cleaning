-- Fiche Découverte enrichie (CRM-assistant, 2026-07-30, Lot 1). Additif : on
-- garde surface_m2 / announced_price / discovery_outcome existants et on ajoute
-- les champs standardisés remplis par TOUS les commerciaux pendant la
-- découverte. Ces données suivent le dossier jusqu'à la planification.

alter table leads
  add column if not exists delai_souhaite text
    check (delai_souhaite in ('aujourdhui', '24h', '48h', 'semaine', '15j', 'ce_mois', 'plus_tard')),
  add column if not exists price_range text,                    -- ex. "500-700"
  add column if not exists reaction_prix text
    check (reaction_prix in ('ok', 'hesitant', 'pas_ok')),
  add column if not exists statut_client text
    check (statut_client in ('proprietaire', 'locataire', 'agence', 'syndic', 'professionnel')),
  add column if not exists etat_salete text
    check (etat_salete in ('leger', 'moyen', 'important', 'tres_important', 'extreme')),
  add column if not exists contexte_intervention text,
  add column if not exists acompte_negocie int
    check (acompte_negocie is null or (acompte_negocie between 0 and 100));
