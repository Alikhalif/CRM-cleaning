-- Commercial profiles / pools (CDC évolutions §7, 2026-07-25). A commercial can
-- hold several profiles; the routing engine (Lot 2 B) picks the right pool from
-- the lead's secteur + urgence + surface, then a commercial in that pool who
-- covers the lead's country (users.countries, added in 20260725000002).
--   Profils : appel_entrant, nettoyage, debarras_demenagement, diogene,
--             performant, en_attente

alter table users
  add column if not exists commercial_profiles text[] not null default '{}';
