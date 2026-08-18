-- Bibliothèque de devis Déménagement — 4. OPTIONS (client 2026-08-07).
-- Options à ajouter aux devis, séparées des modèles → préfixées « Option — ».
-- Prix à chiffrer (0 €), unité forfait, TVA 20 %. Idempotent par libellé.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, is_active)
select a.id, v.label, 'forfait'::prestation_unit, 0, 20, true
from activities a
join (values
  ('Option — Emballage complet'),
  ('Option — Emballage partiel'),
  ('Option — Fourniture de cartons et de consommables'),
  ('Option — Déballage des cartons'),
  ('Option — Démontage du mobilier'),
  ('Option — Remontage du mobilier'),
  ('Option — Protection renforcée des objets fragiles'),
  ('Option — Utilisation d''un monte-meubles'),
  ('Option — Portage longue distance'),
  ('Option — Main-d''œuvre supplémentaire'),
  ('Option — Réservation d''un emplacement de stationnement'),
  ('Option — Intervention le week-end ou un jour férié'),
  ('Option — Évacuation des cartons et matériaux d''emballage')
) as v(label) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
