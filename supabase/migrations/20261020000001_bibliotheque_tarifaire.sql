-- Bibliothèque tarifaire (cahier des charges client du 2026-10-20).
--
-- Trois colonnes nouvelles, puis les tarifs eux-mêmes.
--
-- `mode_calcul` : chaque grille porte sa méthode de calcul. Ce nom évite
-- `mode`, qui entre en collision avec l'agrégat SQL mode() de PostgreSQL :
-- quand la colonne manque, PostgREST résout l'identifiant vers la fonction
-- et renvoie « WITHIN GROUP is required », impossible à diagnostiquer. Les grilles déjà
-- configurées restent en « fourchette » (modèle d'origine, min/max par ligne)
-- et ne sont pas réinterprétées. Seules les grilles alimentées ci-dessous
-- passent en « bibliotheque » : prix unitaire × quantité, coefficients,
-- options, forfait plancher, puis majoration commerciale et fourchette.
--
-- Les montants sont ceux du cahier des charges, en euros HT, SANS aucune
-- augmentation préalable : la majoration commerciale de 25 % est appliquée
-- par le moteur, une seule fois, et reste modifiable par le Super Admin.
--
-- Les grilles restent en BROUILLON : aucun commercial ne voit ces tarifs tant
-- que le Super Admin n'a pas publié.

alter table pricing_grids
  add column if not exists mode_calcul text not null default 'fourchette',
  add column if not exists majoration_pct numeric(5,2) not null default 25,
  add column if not exists fourchette_pct numeric(5,2) not null default 10;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pricing_grids_mode_calcul_check'
  ) then
    alter table pricing_grids
      add constraint pricing_grids_mode_calcul_check
      check (mode_calcul in ('fourchette', 'bibliotheque'));
  end if;
end $$;

comment on column pricing_grids.mode_calcul is
  'fourchette = min/max par ligne (modèle d''origine) ; bibliotheque = prix unitaire x quantité, coefficients, forfait plancher, majoration commerciale.';
comment on column pricing_grids.majoration_pct is
  'Majoration commerciale appliquée UNE SEULE FOIS au prix de marché ajusté. 25 % par défaut.';
comment on column pricing_grids.fourchette_pct is
  'Demi-largeur de la fourchette annoncée, en % du prix recommandé. 10 % par défaut.';

-- Sauvegarde de l'état actuel de chaque grille concernée.
insert into pricing_grid_history (activity_id, version, status, grid, note)
select pg.activity_id, pg.version, pg.status, pg.grid,
       'Sauvegarde automatique avant installation de la bibliothèque tarifaire (2026-10-20)'
from pricing_grids pg
join activities a on a.id = pg.activity_id
where a.slug in ('nettoyage', 'nettoyage_difficile', 'debarras', 'demenagement', 'diogene')
  and pg.grid is not null and pg.grid <> '{}'::jsonb;

-- nettoyage — 55 lignes
update pricing_grids pg
set grid = '{"base": [{"key": "type_classique", "label": "Nettoyage classique", "prixUnitaire": 8.5, "unite": "m2"}, {"key": "type_approfondi", "label": "Nettoyage approfondi", "prixUnitaire": 11.5, "unite": "m2"}, {"key": "type_fin_bail", "label": "Fin de bail standard", "prixUnitaire": 10, "unite": "m2"}, {"key": "type_fin_bail_approfondi", "label": "Fin de bail approfondi", "prixUnitaire": 13, "unite": "m2"}, {"key": "type_avant_emmenagement", "label": "Avant emménagement", "prixUnitaire": 10, "unite": "m2"}, {"key": "type_avant_vente", "label": "Avant vente immobilière", "prixUnitaire": 10, "unite": "m2"}, {"key": "type_apres_demenagement", "label": "Après déménagement", "prixUnitaire": 11, "unite": "m2"}, {"key": "type_fin_chantier_leger", "label": "Fin de chantier léger", "prixUnitaire": 10, "unite": "m2"}, {"key": "type_fin_chantier", "label": "Fin de chantier standard", "prixUnitaire": 13, "unite": "m2"}, {"key": "type_fin_chantier_difficile", "label": "Fin de chantier difficile", "prixUnitaire": 18, "unite": "m2"}, {"key": "type_apres_renovation", "label": "Après rénovation lourde", "prixUnitaire": 20, "unite": "m2"}, {"key": "type_remise_etat", "label": "Remise en état approfondie", "prixUnitaire": 14, "unite": "m2"}, {"key": "type_tres_sale", "label": "Logement très sale", "prixUnitaire": 19, "unite": "m2"}, {"key": "type_insalubre", "label": "Logement insalubre", "prixUnitaire": 27, "unite": "m2"}, {"key": "type_apres_squat", "label": "Après squat", "prixUnitaire": 25, "unite": "m2"}, {"key": "type_apres_sinistre", "label": "Après sinistre (= après rénovation lourde)", "prixUnitaire": 20, "unite": "m2"}, {"key": "type_autre", "label": "Autre — à chiffrer par le Super Admin", "custom": true}], "minimums": [{"key": "type_classique", "label": "Minimum nettoyage classique", "forfaitMin": 450}, {"key": "type_approfondi", "label": "Minimum nettoyage approfondi", "forfaitMin": 660}, {"key": "type_fin_bail", "label": "Minimum fin de bail", "forfaitMin": 540}, {"key": "type_fin_bail_approfondi", "label": "Minimum fin de bail approfondi", "forfaitMin": 540}, {"key": "type_fin_chantier", "label": "Minimum fin de chantier", "forfaitMin": 750}, {"key": "type_fin_chantier_leger", "label": "Minimum fin de chantier léger", "forfaitMin": 750}, {"key": "type_fin_chantier_difficile", "label": "Minimum fin de chantier difficile", "forfaitMin": 750}, {"key": "type_remise_etat", "label": "Minimum remise en état", "forfaitMin": 840}, {"key": "type_insalubre", "label": "Minimum nettoyage insalubre", "forfaitMin": 1350}, {"key": "type_tres_sale", "label": "Minimum logement très sale", "forfaitMin": 1350}, {"key": "type_apres_squat", "label": "Minimum après squat", "forfaitMin": 1350}], "coefficients": [{"key": "etat_propre", "label": "Propre", "coef": 1.0, "source": "salete"}, {"key": "etat_leger", "label": "Peu sale", "coef": 1.1, "source": "salete"}, {"key": "etat_moyen", "label": "Moyennement sale", "coef": 1.2, "source": "salete"}, {"key": "etat_important", "label": "Sale", "coef": 1.35, "source": "salete"}, {"key": "etat_tres_important", "label": "Très sale", "coef": 1.6, "source": "salete"}, {"key": "etat_extreme", "label": "Extrêmement sale", "coef": 2.0, "source": "salete"}], "postes": [{"key": "opt_four", "label": "Nettoyage du four", "min": 35, "max": 35}, {"key": "opt_frigo", "label": "Nettoyage du réfrigérateur", "min": 30, "max": 30}, {"key": "opt_congelateur", "label": "Nettoyage du congélateur", "min": 35, "max": 35}, {"key": "opt_hotte", "label": "Nettoyage de hotte domestique", "min": 35, "max": 35}, {"key": "opt_degraissage_cuisine", "label": "Dégraissage renforcé de cuisine", "min": 90, "max": 90}, {"key": "opt_detartrage_sdb", "label": "Détartrage approfondi de salle de bain", "min": 60, "max": 60}, {"key": "opt_wc_encrasses", "label": "Nettoyage WC fortement encrassés", "min": 40, "max": 40}, {"key": "cuisine_interieur", "label": "Nettoyage intérieur des placards", "min": 50, "max": 50}, {"key": "opt_vitrerie_m2", "label": "Vitrerie complémentaire", "prixUnitaire": 7, "unite": "m2", "source": "surface"}, {"key": "opt_volets", "label": "Nettoyage de volets", "prixUnitaire": 12, "unite": "u"}, {"key": "opt_balcon", "label": "Nettoyage de balcon", "prixUnitaire": 8, "unite": "m2", "source": "exterieur"}, {"key": "ext_etat_leger", "label": "Terrasse standard", "prixUnitaire": 7, "unite": "m2", "source": "exterieur"}, {"key": "ext_etat_moyen", "label": "Terrasse standard", "prixUnitaire": 7, "unite": "m2", "source": "exterieur"}, {"key": "ext_etat_encrasse", "label": "Terrasse très encrassée", "prixUnitaire": 11, "unite": "m2", "source": "exterieur"}, {"key": "opt_sols_mecanise", "label": "Nettoyage mécanisé des sols", "prixUnitaire": 6, "unite": "m2", "source": "surface"}, {"key": "opt_decapage_sols", "label": "Décapage des sols", "prixUnitaire": 8, "unite": "m2", "source": "surface"}, {"key": "sol_moquette", "label": "Nettoyage de moquette", "prixUnitaire": 7, "unite": "m2", "source": "surface"}], "complements": [{"key": "desinfection", "label": "Désinfection complémentaire", "prixUnitaire": 6, "unite": "m2", "source": "desinfection"}, {"key": "desodorisation", "label": "Désodorisation simple", "min": 150, "max": 150}, {"key": "decontamination", "label": "Décontamination — à chiffrer selon protocole", "custom": true}], "majorations": [{"key": "urgent_48h", "label": "Intervention urgente", "minPct": 20, "maxPct": 20}]}'::jsonb,
    mode_calcul = 'bibliotheque',
    majoration_pct = 25,
    fourchette_pct = 10,
    rounding = 10,
    -- Retour en brouillon à dessein : les tarifs changent de modèle ET de
    -- montants. Aucun commercial ne doit voir un nouveau prix sans que le
    -- Super Admin l'ait relu et publié.
    status = 'brouillon',
    updated_at = now()
from activities a
where a.id = pg.activity_id and a.slug = 'nettoyage';

-- nettoyage_difficile — 55 lignes
update pricing_grids pg
set grid = '{"base": [{"key": "type_classique", "label": "Nettoyage classique", "prixUnitaire": 8.5, "unite": "m2"}, {"key": "type_approfondi", "label": "Nettoyage approfondi", "prixUnitaire": 11.5, "unite": "m2"}, {"key": "type_fin_bail", "label": "Fin de bail standard", "prixUnitaire": 10, "unite": "m2"}, {"key": "type_fin_bail_approfondi", "label": "Fin de bail approfondi", "prixUnitaire": 13, "unite": "m2"}, {"key": "type_avant_emmenagement", "label": "Avant emménagement", "prixUnitaire": 10, "unite": "m2"}, {"key": "type_avant_vente", "label": "Avant vente immobilière", "prixUnitaire": 10, "unite": "m2"}, {"key": "type_apres_demenagement", "label": "Après déménagement", "prixUnitaire": 11, "unite": "m2"}, {"key": "type_fin_chantier_leger", "label": "Fin de chantier léger", "prixUnitaire": 10, "unite": "m2"}, {"key": "type_fin_chantier", "label": "Fin de chantier standard", "prixUnitaire": 13, "unite": "m2"}, {"key": "type_fin_chantier_difficile", "label": "Fin de chantier difficile", "prixUnitaire": 18, "unite": "m2"}, {"key": "type_apres_renovation", "label": "Après rénovation lourde", "prixUnitaire": 20, "unite": "m2"}, {"key": "type_remise_etat", "label": "Remise en état approfondie", "prixUnitaire": 14, "unite": "m2"}, {"key": "type_tres_sale", "label": "Logement très sale", "prixUnitaire": 19, "unite": "m2"}, {"key": "type_insalubre", "label": "Logement insalubre", "prixUnitaire": 27, "unite": "m2"}, {"key": "type_apres_squat", "label": "Après squat", "prixUnitaire": 25, "unite": "m2"}, {"key": "type_apres_sinistre", "label": "Après sinistre (= après rénovation lourde)", "prixUnitaire": 20, "unite": "m2"}, {"key": "type_autre", "label": "Autre — à chiffrer par le Super Admin", "custom": true}], "minimums": [{"key": "type_classique", "label": "Minimum nettoyage classique", "forfaitMin": 450}, {"key": "type_approfondi", "label": "Minimum nettoyage approfondi", "forfaitMin": 660}, {"key": "type_fin_bail", "label": "Minimum fin de bail", "forfaitMin": 540}, {"key": "type_fin_bail_approfondi", "label": "Minimum fin de bail approfondi", "forfaitMin": 540}, {"key": "type_fin_chantier", "label": "Minimum fin de chantier", "forfaitMin": 750}, {"key": "type_fin_chantier_leger", "label": "Minimum fin de chantier léger", "forfaitMin": 750}, {"key": "type_fin_chantier_difficile", "label": "Minimum fin de chantier difficile", "forfaitMin": 750}, {"key": "type_remise_etat", "label": "Minimum remise en état", "forfaitMin": 840}, {"key": "type_insalubre", "label": "Minimum nettoyage insalubre", "forfaitMin": 1350}, {"key": "type_tres_sale", "label": "Minimum logement très sale", "forfaitMin": 1350}, {"key": "type_apres_squat", "label": "Minimum après squat", "forfaitMin": 1350}], "coefficients": [{"key": "etat_propre", "label": "Propre", "coef": 1.0, "source": "salete"}, {"key": "etat_leger", "label": "Peu sale", "coef": 1.1, "source": "salete"}, {"key": "etat_moyen", "label": "Moyennement sale", "coef": 1.2, "source": "salete"}, {"key": "etat_important", "label": "Sale", "coef": 1.35, "source": "salete"}, {"key": "etat_tres_important", "label": "Très sale", "coef": 1.6, "source": "salete"}, {"key": "etat_extreme", "label": "Extrêmement sale", "coef": 2.0, "source": "salete"}], "postes": [{"key": "opt_four", "label": "Nettoyage du four", "min": 35, "max": 35}, {"key": "opt_frigo", "label": "Nettoyage du réfrigérateur", "min": 30, "max": 30}, {"key": "opt_congelateur", "label": "Nettoyage du congélateur", "min": 35, "max": 35}, {"key": "opt_hotte", "label": "Nettoyage de hotte domestique", "min": 35, "max": 35}, {"key": "opt_degraissage_cuisine", "label": "Dégraissage renforcé de cuisine", "min": 90, "max": 90}, {"key": "opt_detartrage_sdb", "label": "Détartrage approfondi de salle de bain", "min": 60, "max": 60}, {"key": "opt_wc_encrasses", "label": "Nettoyage WC fortement encrassés", "min": 40, "max": 40}, {"key": "cuisine_interieur", "label": "Nettoyage intérieur des placards", "min": 50, "max": 50}, {"key": "opt_vitrerie_m2", "label": "Vitrerie complémentaire", "prixUnitaire": 7, "unite": "m2", "source": "surface"}, {"key": "opt_volets", "label": "Nettoyage de volets", "prixUnitaire": 12, "unite": "u"}, {"key": "opt_balcon", "label": "Nettoyage de balcon", "prixUnitaire": 8, "unite": "m2", "source": "exterieur"}, {"key": "ext_etat_leger", "label": "Terrasse standard", "prixUnitaire": 7, "unite": "m2", "source": "exterieur"}, {"key": "ext_etat_moyen", "label": "Terrasse standard", "prixUnitaire": 7, "unite": "m2", "source": "exterieur"}, {"key": "ext_etat_encrasse", "label": "Terrasse très encrassée", "prixUnitaire": 11, "unite": "m2", "source": "exterieur"}, {"key": "opt_sols_mecanise", "label": "Nettoyage mécanisé des sols", "prixUnitaire": 6, "unite": "m2", "source": "surface"}, {"key": "opt_decapage_sols", "label": "Décapage des sols", "prixUnitaire": 8, "unite": "m2", "source": "surface"}, {"key": "sol_moquette", "label": "Nettoyage de moquette", "prixUnitaire": 7, "unite": "m2", "source": "surface"}], "complements": [{"key": "desinfection", "label": "Désinfection complémentaire", "prixUnitaire": 6, "unite": "m2", "source": "desinfection"}, {"key": "desodorisation", "label": "Désodorisation simple", "min": 150, "max": 150}, {"key": "decontamination", "label": "Décontamination — à chiffrer selon protocole", "custom": true}], "majorations": [{"key": "urgent_48h", "label": "Intervention urgente", "minPct": 20, "maxPct": 20}]}'::jsonb,
    mode_calcul = 'bibliotheque',
    majoration_pct = 25,
    fourchette_pct = 10,
    rounding = 10,
    -- Retour en brouillon à dessein : les tarifs changent de modèle ET de
    -- montants. Aucun commercial ne doit voir un nouveau prix sans que le
    -- Super Admin l'ait relu et publié.
    status = 'brouillon',
    updated_at = now()
from activities a
where a.id = pg.activity_id and a.slug = 'nettoyage_difficile';

-- debarras — 26 lignes
update pricing_grids pg
set grid = '{"base": [{"key": "deb_leger", "label": "Débarras léger", "prixUnitaire": 30, "unite": "m3", "source": "volume"}, {"key": "deb_classique", "label": "Débarras classique", "prixUnitaire": 40, "unite": "m3", "source": "volume"}, {"key": "deb_encombre", "label": "Débarras encombré", "prixUnitaire": 50, "unite": "m3", "source": "volume"}, {"key": "deb_tres_encombre", "label": "Débarras très encombré", "prixUnitaire": 65, "unite": "m3", "source": "volume"}, {"key": "deb_difficile", "label": "Débarras difficile", "prixUnitaire": 75, "unite": "m3", "source": "volume"}, {"key": "deb_insalubre", "label": "Débarras insalubre", "prixUnitaire": 90, "unite": "m3", "source": "volume"}, {"key": "deb_diogene_extreme", "label": "Débarras Diogène extrême", "prixUnitaire": 110, "unite": "m3", "source": "volume"}], "minimums": [{"key": "min_petit_enlevement", "label": "Petit enlèvement", "forfaitMin": 450}, {"key": "typeBien_cave", "label": "Débarras de cave", "forfaitMin": 600}, {"key": "typeBien_garage", "label": "Débarras de garage", "forfaitMin": 750}, {"key": "typeBien_appartement", "label": "Débarras d''appartement", "forfaitMin": 1050}, {"key": "typeBien_maison", "label": "Débarras de maison", "forfaitMin": 1500}], "ratios": [{"key": "enc_faible", "label": "Encombrement faible", "ratio": 0.15}, {"key": "enc_modere", "label": "Encombrement modéré", "ratio": 0.3}, {"key": "enc_important", "label": "Encombrement important", "ratio": 0.5}, {"key": "enc_tres_important", "label": "Encombrement très important", "ratio": 0.75}, {"key": "enc_extreme", "label": "Encombrement extrême", "ratio": 1.0}], "coefficients": [], "postes": [], "complements": [], "majorations": [{"key": "etage_1", "label": "1er étage sans ascenseur", "minPct": 6, "maxPct": 6}, {"key": "etage_2", "label": "2e étage sans ascenseur", "minPct": 12, "maxPct": 12}, {"key": "etage_3", "label": "3e étage sans ascenseur", "minPct": 18, "maxPct": 18}, {"key": "etage_4plus", "label": "4e étage et plus sans ascenseur", "minPct": 24, "maxPct": 24}, {"key": "stationnement_difficile", "label": "Stationnement éloigné", "minPct": 10, "maxPct": 10}, {"key": "acces_camion", "label": "Accès camion difficile", "minPct": 10, "maxPct": 10}, {"key": "escalier_etroit", "label": "Escalier étroit", "minPct": 10, "maxPct": 10}, {"key": "tri_complexe", "label": "Tri complexe", "minPct": 15, "maxPct": 15}, {"key": "urgent_48h", "label": "Intervention urgente", "minPct": 20, "maxPct": 20}]}'::jsonb,
    mode_calcul = 'bibliotheque',
    majoration_pct = 25,
    fourchette_pct = 10,
    rounding = 10,
    -- Retour en brouillon à dessein : les tarifs changent de modèle ET de
    -- montants. Aucun commercial ne doit voir un nouveau prix sans que le
    -- Super Admin l'ait relu et publié.
    status = 'brouillon',
    updated_at = now()
from activities a
where a.id = pg.activity_id and a.slug = 'debarras';

-- demenagement — 20 lignes
update pricing_grids pg
set grid = '{"base": [], "minimums": [], "coefficients": [], "ratios": [], "matrice_m3": [{"key": "dist_court_economique", "label": "Moins de 100 km — économique", "prixUnitaire": 35, "unite": "m3", "source": "volume", "from": 0, "to": 100}, {"key": "dist_court_standard", "label": "Moins de 100 km — standard", "prixUnitaire": 40, "unite": "m3", "source": "volume", "from": 0, "to": 100}, {"key": "dist_court_confort", "label": "Moins de 100 km — confort", "prixUnitaire": 65, "unite": "m3", "source": "volume", "from": 0, "to": 100}, {"key": "dist_moyen_economique", "label": "100 à 500 km — économique", "prixUnitaire": 60, "unite": "m3", "source": "volume", "from": 100, "to": 500}, {"key": "dist_moyen_standard", "label": "100 à 500 km — standard", "prixUnitaire": 95, "unite": "m3", "source": "volume", "from": 100, "to": 500}, {"key": "dist_moyen_confort", "label": "100 à 500 km — confort", "prixUnitaire": 130, "unite": "m3", "source": "volume", "from": 100, "to": 500}, {"key": "dist_long_economique", "label": "Plus de 500 km — économique", "prixUnitaire": 110, "unite": "m3", "source": "volume", "from": 500, "to": null}, {"key": "dist_long_standard", "label": "Plus de 500 km — standard", "prixUnitaire": 140, "unite": "m3", "source": "volume", "from": 500, "to": null}, {"key": "dist_long_confort", "label": "Plus de 500 km — confort", "prixUnitaire": 160, "unite": "m3", "source": "volume", "from": 500, "to": null}], "kilometrique": [{"key": "km_reference", "label": "Tarif kilométrique (contrôle de cohérence)", "prixUnitaire": 2.0, "unite": "km", "source": "distance"}], "postes": [{"key": "etage_sans_ascenseur", "label": "Étage sans ascenseur", "prixUnitaire": 75, "unite": "u", "source": "etages"}, {"key": "monte_meubles", "label": "Monte-meuble", "min": 250, "max": 250}, {"key": "demontage_h", "label": "Démontage de mobilier", "prixUnitaire": 60, "unite": "h"}, {"key": "remontage_h", "label": "Remontage de mobilier", "prixUnitaire": 60, "unite": "h"}, {"key": "piano_droit", "label": "Piano droit", "min": 250, "max": 250}], "complements": [], "majorations": [{"key": "portage_long", "label": "Portage long", "minPct": 10, "maxPct": 10}, {"key": "acces_difficile", "label": "Accès difficile", "minPct": 10, "maxPct": 10}, {"key": "haute_saison", "label": "Haute saison", "minPct": 20, "maxPct": 20}, {"key": "urgent_48h", "label": "Intervention urgente", "minPct": 20, "maxPct": 20}, {"key": "week_end", "label": "Week-end", "minPct": 15, "maxPct": 15}]}'::jsonb,
    mode_calcul = 'bibliotheque',
    majoration_pct = 25,
    fourchette_pct = 10,
    rounding = 10,
    -- Retour en brouillon à dessein : les tarifs changent de modèle ET de
    -- montants. Aucun commercial ne doit voir un nouveau prix sans que le
    -- Super Admin l'ait relu et publié.
    status = 'brouillon',
    updated_at = now()
from activities a
where a.id = pg.activity_id and a.slug = 'demenagement';

-- diogene — 31 lignes
update pricing_grids pg
set grid = '{"base": [{"key": "dio_enc_faible", "label": "Niveau 1 — modéré", "prixUnitaire": 14, "unite": "m2"}, {"key": "dio_enc_moyen", "label": "Niveau 2 — important", "prixUnitaire": 22, "unite": "m2"}, {"key": "dio_enc_important", "label": "Niveau 3 — insalubrité sévère", "prixUnitaire": 32, "unite": "m2"}, {"key": "dio_enc_extreme", "label": "Niveau 4 — insalubrité extrême", "prixUnitaire": 47, "unite": "m2"}], "minimums": [], "coefficients": [{"key": "etat_propre", "label": "Propre", "coef": 1.0, "source": "salete"}, {"key": "etat_leger", "label": "Peu sale", "coef": 1.1, "source": "salete"}, {"key": "etat_moyen", "label": "Moyennement sale", "coef": 1.2, "source": "salete"}, {"key": "etat_important", "label": "Sale", "coef": 1.35, "source": "salete"}, {"key": "etat_tres_important", "label": "Très sale", "coef": 1.6, "source": "salete"}, {"key": "etat_extreme", "label": "Extrêmement sale", "coef": 2.0, "source": "salete"}], "ratios": [{"key": "enc_faible", "label": "Encombrement faible", "ratio": 0.15}, {"key": "enc_modere", "label": "Encombrement modéré", "ratio": 0.3}, {"key": "enc_important", "label": "Encombrement important", "ratio": 0.5}, {"key": "enc_tres_important", "label": "Encombrement très important", "ratio": 0.75}, {"key": "enc_extreme", "label": "Encombrement extrême", "ratio": 1.0}], "postes": [{"key": "dio_vol_<5", "label": "Débarras Diogène — moins de 5 m³", "prixUnitaire": 110, "unite": "m3", "source": "volume"}, {"key": "dio_vol_5-10", "label": "Débarras Diogène — 5 à 10 m³", "prixUnitaire": 110, "unite": "m3", "source": "volume"}, {"key": "dio_vol_10-20", "label": "Débarras Diogène — 10 à 20 m³", "prixUnitaire": 110, "unite": "m3", "source": "volume"}, {"key": "dio_vol_20-40", "label": "Débarras Diogène — 20 à 40 m³", "prixUnitaire": 110, "unite": "m3", "source": "volume"}, {"key": "dio_vol_>40", "label": "Débarras Diogène — plus de 40 m³", "prixUnitaire": 110, "unite": "m3", "source": "volume"}, {"key": "dio_vol_a_evaluer", "label": "Volume à évaluer — visite nécessaire", "custom": true}], "complements": [{"key": "desinfection", "label": "Désinfection (référence basse, 6 €/m²)", "prixUnitaire": 6, "unite": "m2", "source": "desinfection"}, {"key": "dio_odeurs_moderees", "label": "Désodorisation légère", "min": 150, "max": 150}, {"key": "dio_odeurs_fortes", "label": "Désodorisation moyenne", "min": 250, "max": 250}, {"key": "dio_odeurs_extremes", "label": "Désodorisation importante", "min": 400, "max": 400}, {"key": "decontamination", "label": "Décontamination — sur étude (protocole, déchets)", "custom": true}, {"key": "traitement_nuisibles", "label": "Traitement des nuisibles — sur étude", "custom": true}], "majorations": [{"key": "dio_acces_difficile", "label": "Accès intérieur difficile", "minPct": 10, "maxPct": 10}, {"key": "dio_pieces_inaccessibles", "label": "Pièces inaccessibles", "minPct": 15, "maxPct": 15}, {"key": "dio_nuisibles", "label": "Présence de nuisibles", "minPct": 15, "maxPct": 15}, {"key": "urgent_48h", "label": "Intervention urgente", "minPct": 20, "maxPct": 20}]}'::jsonb,
    mode_calcul = 'bibliotheque',
    majoration_pct = 25,
    fourchette_pct = 10,
    rounding = 10,
    -- Retour en brouillon à dessein : les tarifs changent de modèle ET de
    -- montants. Aucun commercial ne doit voir un nouveau prix sans que le
    -- Super Admin l'ait relu et publié.
    status = 'brouillon',
    updated_at = now()
from activities a
where a.id = pg.activity_id and a.slug = 'diogene';
