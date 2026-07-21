-- Add "Déménagement" as a 6th complete sector (client request, 2026-07-21).
-- Same shape as the Débarras migration (20260708000001). Business defaults:
-- acompte 30 %, TVA 20 %, fourchette 300–5 000 €, hue #ec4899 (rose, distinct
-- from the five existing sector hues). The TS `Sector` union, the
-- --sector-demenagement token and every Record<Sector, …> map are updated in
-- the same change.

insert into activities
  (slug, label, short, color, emoji, default_quote_min, default_quote_max, acompte_pct, vat_rate)
values
  ('demenagement', 'Déménagement', 'Démén.', '#ec4899', '🚚', 300, 5000, 30, 20)
on conflict (slug) do nothing;

-- Catalogue prestations Déménagement (seeded once; skipped if any already exist).
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate)
select a.id, x.label, x.unit::prestation_unit, x.price, x.vat
from activities a
join (values
  ('Déménagement studio / T2 (forfait)', 'forfait', 600, 20),
  ('Déménagement T3 / T4 (forfait)',     'forfait', 1200, 20),
  ('Emballage et fourniture cartons',    'forfait', 250, 20),
  ('Location monte-meubles',             'forfait', 350, 20),
  ('Main d''œuvre déménageur',           'h',        45, 20)
) as x(label, unit, price, vat) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id);

-- Default issuing entity → CGK Services (a services activity), respecting the
-- one-default-per-activity partial unique index. On a FRESH database this
-- matches nothing (legal_entities is seeded later); seed.sql maps it there.
insert into legal_entity_activities (legal_entity_id, activity_id, is_default)
select e.id, a.id, true
from legal_entities e, activities a
where e.legal_name = 'CGK Services' and a.slug = 'demenagement'
  and not exists (
    select 1 from legal_entity_activities la
    where la.activity_id = a.id and la.is_default = true
  )
on conflict (legal_entity_id, activity_id) do nothing;
