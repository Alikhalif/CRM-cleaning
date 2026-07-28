-- Landing-page type axis (évolutions rôles/routage Lot B, 2026-07-28).
-- Chaque LP a désormais un Type (Générale / Famille) EN PLUS de sa catégorie
-- (= activity_id / secteur). Le routage combine les deux :
--   • Générale (nettoyage)  → profil "appel entrant"
--   • Famille (nettoyage)    → profils "appel entrant" OU "nettoyage" (Divers)
-- Nullable : une LP sans type est traitée comme "famille" par le routage.

alter table landing_pages
  add column if not exists lp_type text check (lp_type in ('generale', 'famille'));
