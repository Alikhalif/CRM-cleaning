-- Add "Nettoyage difficile" as a sector (évolutions rôles/routage Lot B,
-- 2026-07-28). Nettoyage lourd / conditions difficiles — routé vers le profil
-- Performant. Même forme que les autres secteurs. Défauts métier : acompte
-- 20 %, TVA 20 %, fourchette 500–3 000 €, hue #6366f1 (indigo, distinct).

insert into activities
  (slug, label, short, color, emoji, default_quote_min, default_quote_max, acompte_pct, vat_rate)
values
  ('nettoyage_difficile', 'Nettoyage difficile', 'Net. diff.', '#6366f1', '🧽', 500, 3000, 20, 20)
on conflict (slug) do nothing;

-- Catalogue prestations (seeded once; skipped if any already exist).
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate)
select a.id, x.label, x.unit::prestation_unit, x.price, x.vat
from activities a
join (values
  ('Nettoyage difficile / conditions lourdes (forfait)', 'forfait', 900, 20),
  ('Décapage / traitement en profondeur',                'm2',       28, 20),
  ('Main d''œuvre spécialisée',                          'h',        50, 20)
) as x(label, unit, price, vat) on true
where a.slug = 'nettoyage_difficile'
  and not exists (select 1 from prestations p where p.activity_id = a.id);

-- Société émettrice par défaut : hérite de celle du secteur "nettoyage".
insert into legal_entity_activities (legal_entity_id, activity_id, is_default)
select la.legal_entity_id, a2.id, true
from legal_entity_activities la
join activities a1 on a1.id = la.activity_id and a1.slug = 'nettoyage' and la.is_default = true
join activities a2 on a2.slug = 'nettoyage_difficile'
where not exists (
  select 1 from legal_entity_activities x
  where x.activity_id = a2.id and x.is_default = true
)
on conflict (legal_entity_id, activity_id) do nothing;
