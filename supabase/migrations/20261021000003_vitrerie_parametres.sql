-- Paramètres VITRERIE dans les grilles de nettoyage (cahier du 2026-10-21).
--
-- Ajout STRICTEMENT additif : une nouvelle clé « vitrerie » dans le JSON de
-- la grille. Aucune ligne existante n'est lue, modifiée ni supprimée — les
-- prix au m², les coefficients et les majorations déjà configurés sortent de
-- cette migration tels qu'ils y sont entrés.
--
-- Les valeurs sont celles du cahier des charges (§4, §5, §6, §8, §10), pas
-- des estimations : poids des vitrages, coefficients de faces, d'encadrement
-- et d'accès, et les six paliers de majoration. Le Super Admin les retrouve
-- dans la section « Vitrerie » de l'éditeur de grille et peut toutes les
-- modifier sans redéploiement.
--
-- Le supplément vitrerie est un POURCENTAGE appliqué APRÈS le barème de
-- nettoyage (lib/pricing/vitrerie.ts) : il n'entre donc dans aucun
-- sous-total existant et ne peut pas déplacer un prix déjà calculé.
--
-- `vit_minimum` reste à 0 : aucun montant plancher n'a été communiqué.

update pricing_grids g
set grid = g.grid || jsonb_build_object('vitrerie', '[{"key": "vit_poids_fenetre", "label": "Poids — fenêtre classique", "coef": 1}, {"key": "vit_poids_baie", "label": "Poids — baie vitrée", "coef": 2.5}, {"key": "vit_poids_velux", "label": "Poids — Velux / fenêtre de toit", "coef": 2}, {"key": "vit_poids_veranda", "label": "Poids — véranda (par m² vitré)", "coef": 0.5}, {"key": "vit_poids_autre", "label": "Poids — autre surface vitrée", "coef": 1}, {"key": "vit_faces_interieur", "label": "Faces — intérieur uniquement", "coef": 1.0}, {"key": "vit_faces_exterieur", "label": "Faces — extérieur uniquement", "coef": 1.1}, {"key": "vit_faces_deux", "label": "Faces — intérieur + extérieur", "coef": 1.8}, {"key": "vit_cadre_pvc", "label": "Encadrement — PVC", "coef": 1.0}, {"key": "vit_cadre_bois", "label": "Encadrement — bois", "coef": 1.1}, {"key": "vit_cadre_alu", "label": "Encadrement — aluminium", "coef": 1.0}, {"key": "vit_cadre_mixte", "label": "Encadrement — mixte", "coef": 1.05}, {"key": "vit_cadre_nr", "label": "Encadrement — non renseigné", "coef": 1.0}, {"key": "vit_acces_classique", "label": "Accès — classique", "coef": 1.0}, {"key": "vit_acces_difficile", "label": "Accès — difficile / en hauteur", "coef": 1.15}, {"key": "vit_palier_1", "label": "Niveau 1 — très faible vitrerie", "from": 1, "to": 2, "minPct": 3, "maxPct": 7}, {"key": "vit_palier_2", "label": "Niveau 2 — faible vitrerie", "from": 2, "to": 5, "minPct": 8, "maxPct": 12}, {"key": "vit_palier_3", "label": "Niveau 3 — vitrerie moyenne", "from": 5, "to": 10, "minPct": 13, "maxPct": 20}, {"key": "vit_palier_4", "label": "Niveau 4 — vitrerie importante", "from": 10, "to": 20, "minPct": 20, "maxPct": 30}, {"key": "vit_palier_5", "label": "Niveau 5 — très grande vitrerie", "from": 20, "to": 30, "minPct": 30, "maxPct": 35}, {"key": "vit_palier_6", "label": "Niveau 6 — vitrerie exceptionnelle", "from": 30, "to": 50, "minPct": 35, "maxPct": 40}, {"key": "vit_minimum", "label": "Supplément vitrerie minimum (€)", "forfaitMin": 0}]'::jsonb)
from activities a
where a.id = g.activity_id
  -- Famille nettoyage uniquement : la vitrerie n'a pas de sens pour un
  -- déménagement ou un transport.
  and a.slug in ('nettoyage', 'nettoyage_difficile', 'diogene', 'urgence')
  -- Idempotent, et surtout : ne JAMAIS écraser des réglages déjà saisis.
  and (g.grid -> 'vitrerie') is null;
