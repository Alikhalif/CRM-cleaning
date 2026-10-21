-- Activité TRANSPORT (demande client du 2026-10-21).
--
-- Le transport déplace des OBJETS désignés, là où le déménagement vide un
-- logement entier et où le débarras évacue. Il manquait au CRM : la
-- découverte n'en proposait que deux sur les trois attendues.
--
-- Même forme que la migration Déménagement (20260721000001). Par défaut :
-- acompte 30 %, TVA 20 %, teinte #84cc16 (vert lime, distincte des huit
-- autres). Le type TS `Sector`, le token --sector-transport et chaque
-- Record<Sector, …> sont mis à jour dans le même changement.
--
-- `default_quote_min` / `default_quote_max` restent NULL : le client n'a pas
-- communiqué de fourchette pour cette activité et on n'en invente pas.

insert into activities
  (slug, label, short, color, emoji, acompte_pct, vat_rate)
values
  ('transport', 'Transport', 'Transp.', '#84cc16', '📦', 30, 20)
on conflict (slug) do nothing;

-- Entité émettrice par défaut → CGK Services, en respectant l'index unique
-- partiel « un seul défaut par activité ». Sur une base VIERGE cela ne
-- correspond à rien (legal_entities est semé plus tard) ; seed.sql s'en charge.
insert into legal_entity_activities (legal_entity_id, activity_id, is_default)
select e.id, a.id, true
from legal_entities e, activities a
where e.legal_name = 'CGK Services' and a.slug = 'transport'
  and not exists (
    select 1 from legal_entity_activities la
    where la.activity_id = a.id and la.is_default = true
  )
on conflict (legal_entity_id, activity_id) do nothing;

-- ── Grille tarifaire Transport ───────────────────────────────────────
--
-- STRUCTURE SEULE. Tous les montants sont à 0 : le cahier des charges du
-- client ne fournit aucun tarif de transport, et en inventer un ferait
-- annoncer de faux prix aux clients. La grille reste en BROUILLON — tant
-- qu'elle n'est pas renseignée et publiée par le Super Admin, la découverte
-- affiche « aucun barème ne s'applique » plutôt qu'un chiffre.
--
-- Les clés des lignes sont exactement celles qu'envoie TransportFields :
--   • base          → tr_<type d'objet>, choisi par le commercial
--   • minimums      → tr_forfait_min, toujours appliqué
--   • coefficients  → fragile / lourd / volumineux (multiplicateurs)
--   • complements   → manutention, démontage, remontage, protection,
--                     stationnement difficile
--   • kilometrique  → quatre tranches de distance (le transport facture le
--                     trajet à part, n'ayant pas de matrice volume × distance)
--   • floors        → étages sans ascenseur, enlèvement + livraison cumulés
--   • majorations   → urgence, week-end, haute saison (en %)

insert into pricing_grids
  (activity_id, status, mode_calcul, grid, majoration_pct, fourchette_pct)
select a.id, 'brouillon', 'bibliotheque', '{"base": [{"key": "tr_mobilier", "label": "Mobilier", "prixUnitaire": 0, "unite": "m3", "source": "volume"}, {"key": "tr_electromenager", "label": "Électroménager", "prixUnitaire": 0, "unite": "m3", "source": "volume"}, {"key": "tr_piano", "label": "Piano", "prixUnitaire": 0, "unite": "m3", "source": "volume"}, {"key": "tr_coffre_fort", "label": "Coffre-fort", "prixUnitaire": 0, "unite": "m3", "source": "volume"}, {"key": "tr_oeuvre_art", "label": "Œuvre d''art", "prixUnitaire": 0, "unite": "m3", "source": "volume"}, {"key": "tr_materiel_pro", "label": "Matériel professionnel", "prixUnitaire": 0, "unite": "m3", "source": "volume"}, {"key": "tr_marchandise", "label": "Marchandise / palette", "prixUnitaire": 0, "unite": "m3", "source": "volume"}, {"key": "tr_materiaux", "label": "Matériaux de chantier", "prixUnitaire": 0, "unite": "m3", "source": "volume"}, {"key": "tr_vehicule", "label": "Véhicule / deux-roues", "prixUnitaire": 0, "unite": "m3", "source": "volume"}, {"key": "tr_colis", "label": "Cartons / colis", "prixUnitaire": 0, "unite": "m3", "source": "volume"}, {"key": "tr_autre", "label": "Autre", "prixUnitaire": 0, "unite": "m3", "source": "volume"}], "minimums": [{"key": "tr_forfait_min", "label": "Forfait minimum transport", "forfaitMin": 0}], "coefficients": [{"key": "fragile", "label": "Objet fragile", "coef": 1}, {"key": "lourd", "label": "Objet lourd", "coef": 1}, {"key": "volumineux", "label": "Objet volumineux", "coef": 1}], "ratios": [], "matrice_m3": [], "kilometrique": [{"key": "tr_km_local", "label": "Jusqu''à 50 km", "prixUnitaire": 0, "unite": "km", "source": "distance", "from": 0, "to": 50}, {"key": "tr_km_regional", "label": "50 à 150 km", "prixUnitaire": 0, "unite": "km", "source": "distance", "from": 50, "to": 150}, {"key": "tr_km_national", "label": "150 à 400 km", "prixUnitaire": 0, "unite": "km", "source": "distance", "from": 150, "to": 400}, {"key": "tr_km_longue", "label": "Plus de 400 km", "prixUnitaire": 0, "unite": "km", "source": "distance", "from": 400, "to": null}], "postes": [], "complements": [{"key": "manutention", "label": "Manutention particulière", "min": 0, "max": 0}, {"key": "demontage", "label": "Démontage", "min": 0, "max": 0}, {"key": "remontage", "label": "Remontage", "min": 0, "max": 0}, {"key": "protection", "label": "Protection / emballage", "min": 0, "max": 0}, {"key": "sans_stationnement", "label": "Stationnement difficile", "min": 0, "max": 0}], "floors": [{"key": "tr_etages", "label": "Étage sans ascenseur", "prixUnitaire": 0, "unite": "u", "source": "etages", "from": 1, "to": null}], "majorations": [{"key": "urgent_48h", "label": "Intervention urgente", "minPct": 0, "maxPct": 0}, {"key": "week_end", "label": "Week-end", "minPct": 0, "maxPct": 0}, {"key": "haute_saison", "label": "Haute saison", "minPct": 0, "maxPct": 0}]}'::jsonb, 25, 10
from activities a
where a.slug = 'transport'
on conflict (activity_id) do nothing;
