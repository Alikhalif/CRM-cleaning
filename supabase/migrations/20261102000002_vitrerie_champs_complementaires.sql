-- Vitrerie — paramètres des champs demandés le 2026-11-02.
--
-- CE QUI EST AJOUTÉ, ET CE QUI NE L'EST PAS
--
-- Le cahier du 2026-11-02 réclame six informations de plus dans la découverte :
-- portes-fenêtres, grandes surfaces vitrées, nettoyage des rails, nettoyage
-- des coulisses, et trois niveaux d'accessibilité supplémentaires (escabeau,
-- échelle, accès particulier).
--
-- ⚠️ AUCUN TARIF N'A ÉTÉ COMMUNIQUÉ POUR CES SIX ÉLÉMENTS. On ne trouve ni
-- poids, ni coefficient, ni majoration dans le cahier du 2026-10-21 — qui
-- donnait pourtant les vingt-deux autres valeurs une par une. Ils sont donc
-- créés à une valeur NEUTRE :
--
--   • poids à 0        → l'élément est compté dans la découverte mais
--                        n'entre pas dans les unités pondérées ;
--   • coefficient à 1  → l'accès ne majore rien.
--
-- Conséquence voulue : aucune estimation existante ne bouge d'un centime, et
-- aucun prix n'est inventé. En contrepartie, `lib/pricing/vitrerie.ts` NOMME
-- ces éléments dès qu'ils sont saisis sans barème et met le dossier en
-- validation tarifaire — l'information n'est jamais perdue en silence.
--
-- Dès que le client communique les valeurs, le Super Admin les saisit dans
-- Grilles tarifaires › Vitrerie, sans redéploiement, et le calcul les prend
-- en compte immédiatement.
--
-- Les vingt-deux paramètres existants ne sont jamais réécrits : seules les
-- clés ABSENTES sont concaténées. Un coefficient déjà ajusté reste intact.
--
-- ── Note sur la première version de cette migration ───────────────────
-- Elle a échoué à l'exécution sur « column g.id does not exist ». La clé
-- primaire de `pricing_grids` est `activity_id` — la table n'a pas de colonne
-- `id`, une grille étant par construction unique par activité. La version
-- ci-dessous est en outre ENSEMBLISTE plutôt qu'en boucle PL/pgSQL : moins de
-- variables, rien à déclarer, et la condition d'idempotence se lit d'un coup.

with nouveaux(ligne, ord) as (
  -- `with ordinality` conserve l'ordre déclaré : les paramètres s'affichent
  -- dans l'éditeur de grille tels qu'ils sont écrits ici, pas au hasard.
  select *
  from jsonb_array_elements('[
    {"key": "vit_poids_porte_fenetre",  "label": "Poids — porte-fenêtre (0 = tarif à définir)", "coef": 0},
    {"key": "vit_poids_grande_surface", "label": "Poids — grande surface vitrée, par m² (0 = tarif à définir)", "coef": 0},
    {"key": "vit_option_rails",         "label": "Rails — unités par ouvrant (0 = tarif à définir)", "coef": 0},
    {"key": "vit_option_coulisses",     "label": "Coulisses — unités par ouvrant (0 = tarif à définir)", "coef": 0},
    {"key": "vit_acces_escabeau",       "label": "Accès — escabeau nécessaire (1 = aucun effet, à définir)", "coef": 1.0},
    {"key": "vit_acces_echelle",        "label": "Accès — échelle nécessaire (1 = aucun effet, à définir)", "coef": 1.0},
    {"key": "vit_acces_particulier",    "label": "Accès — difficile ou particulier (1 = aucun effet, à définir)", "coef": 1.0}
  ]'::jsonb) with ordinality
),
ajouts as (
  select
    g.activity_id,
    jsonb_agg(n.ligne order by n.ord) as lignes
  from pricing_grids g
  join activities a on a.id = g.activity_id
  cross join nouveaux n
  -- Famille nettoyage uniquement : la vitrerie n'a pas de sens pour un
  -- déménagement ou un transport.
  where a.slug in ('nettoyage', 'nettoyage_difficile', 'diogene', 'urgence')
    -- Une grille sans section vitrerie n'est pas concernée : c'est la
    -- migration 20261021000003 qui la crée, et elle a sa propre garde.
    and jsonb_typeof(g.grid -> 'vitrerie') = 'array'
    -- Ne jamais écraser : une clé déjà présente est ignorée.
    and not exists (
      select 1
      from jsonb_array_elements(g.grid -> 'vitrerie') x
      where x ->> 'key' = n.ligne ->> 'key'
    )
  group by g.activity_id
)
-- Aucune grille n'apparaît dans `ajouts` si toutes ses clés existent déjà :
-- rejouer cette migration ne produit alors aucune écriture.
update pricing_grids g
set grid = g.grid || jsonb_build_object(
      'vitrerie', (g.grid -> 'vitrerie') || a.lignes
    )
from ajouts a
where a.activity_id = g.activity_id;
