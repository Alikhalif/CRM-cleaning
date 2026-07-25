-- Add "Diogène" as a sector (CDC évolutions, 2026-07-25) — extreme cleanup /
-- Diogenes-syndrome clearance. Same shape as the Débarras / Déménagement
-- migrations. Business defaults: acompte 30 %, TVA 20 %, fourchette
-- 1 000–15 000 €, hue #0d9488 (teal, distinct from the other sector hues).

insert into activities
  (slug, label, short, color, emoji, default_quote_min, default_quote_max, acompte_pct, vat_rate)
values
  ('diogene', 'Diogène', 'Diog.', '#0d9488', '🧹', 1000, 15000, 30, 20)
on conflict (slug) do nothing;

-- Catalogue prestations Diogène (seeded once; skipped if any already exist).
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate)
select a.id, x.label, x.unit::prestation_unit, x.price, x.vat
from activities a
join (values
  ('Nettoyage extrême / syndrome de Diogène (forfait)', 'forfait', 2500, 20),
  ('Désinfection / assainissement',                     'forfait', 1200, 20),
  ('Débarras et évacuation encombrants',                'm2',        35, 20),
  ('Main d''œuvre spécialisée',                         'h',         55, 20)
) as x(label, unit, price, vat) on true
where a.slug = 'diogene'
  and not exists (select 1 from prestations p where p.activity_id = a.id);

-- Default issuing entity → CGK Services (empty on a fresh DB; seed maps it).
insert into legal_entity_activities (legal_entity_id, activity_id, is_default)
select e.id, a.id, true
from legal_entities e, activities a
where e.legal_name = 'CGK Services' and a.slug = 'diogene'
  and not exists (
    select 1 from legal_entity_activities la
    where la.activity_id = a.id and la.is_default = true
  )
on conflict (legal_entity_id, activity_id) do nothing;
