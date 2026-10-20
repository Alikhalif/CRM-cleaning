-- Correctifs issus de l'audit tarifaire du 2026-10-20.
--
-- A-08 — Sources de quantité manquantes sur deux lignes au prix unitaire.
--
-- « Volets : 12 € l'unité » et « Vitrerie : 7 €/m² » ne déclaraient pas SUR
-- QUOI porte leur quantité. Le moteur retombait alors sur la quantité
-- principale : douze euros par volet devenaient douze euros du mètre carré de
-- logement, soit 1 200 € pour 100 m². Le moteur refuse désormais ce repli pour
-- les unités « u » et « h » ; ces deux lignes reçoivent ici leur source réelle,
-- alimentée par les champs ajoutés à la découverte.
--
-- A-07 — Traçabilité du tarif recommandé.
--
-- Le prix recommandé était recalculé à chaque ouverture du dossier : modifier
-- une grille changeait donc, rétroactivement et sans trace, ce qu'affichait un
-- dossier ancien. On fige désormais la recommandation au moment où le
-- commercial enregistre sa découverte, avec la version de grille utilisée.
-- Le prix ANNONCÉ au client reste, comme avant, dans announced_price.

-- ── A-08 ───────────────────────────────────────────────────────────────
update pricing_grids pg
set grid = jsonb_set(
      pg.grid,
      '{postes}',
      (
        select jsonb_agg(
          case
            when l->>'key' = 'opt_volets'      then l || '{"source":"unites"}'::jsonb
            when l->>'key' = 'opt_vitrerie_m2' then l || '{"source":"vitrerie"}'::jsonb
            else l
          end
        )
        from jsonb_array_elements(pg.grid->'postes') l
      )
    ),
    updated_at = now()
from activities a
where a.id = pg.activity_id
  and a.slug in ('nettoyage', 'nettoyage_difficile')
  and pg.grid ? 'postes';

-- ── A-07 ───────────────────────────────────────────────────────────────
alter table leads
  -- Recommandation figée à l'enregistrement de la découverte.
  add column if not exists price_recommended numeric(12,2),
  add column if not exists price_recommended_min numeric(12,2),
  add column if not exists price_recommended_max numeric(12,2),
  -- Version de la grille qui a produit ce montant : sans elle, impossible
  -- d'expliquer a posteriori un écart avec le barème courant.
  add column if not exists pricing_grid_version integer,
  add column if not exists price_recommended_at timestamptz;

comment on column leads.price_recommended is
  'Prix recommandé par le moteur AU MOMENT de l''enregistrement de la découverte. Figé : une modification ultérieure du barème ne le réécrit pas. Le prix réellement annoncé au client reste dans announced_price.';
comment on column leads.pricing_grid_version is
  'Version de la grille tarifaire utilisée pour price_recommended.';
