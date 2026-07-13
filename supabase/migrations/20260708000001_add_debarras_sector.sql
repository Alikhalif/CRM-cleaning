-- Add "Débarras" as a 5th complete sector (client request, call 2026-06-10).
-- Mirrors the seed shape in supabase/seed.sql. Business defaults: acompte 30 %,
-- TVA 20 %, fourchette 150–3 000 €, hue #8b5cf6 (violet, distinct from the four
-- existing sector hues). The TS `Sector` union, the --sector-debarras token, and
-- the Record<Sector, …> maps are updated in the same change.

insert into activities
  (slug, label, short, color, emoji, default_quote_min, default_quote_max, acompte_pct, vat_rate)
values
  ('debarras', 'Débarras', 'Déb.', '#8b5cf6', '🗑️', 150, 3000, 30, 20)
on conflict (slug) do nothing;

-- Catalogue prestations Débarras (seeded once; skipped if any already exist).
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate)
select a.id, x.label, x.unit::prestation_unit, x.price, x.vat
from activities a
join (values
  ('Débarras appartement (forfait)', 'forfait', 450, 20),
  ('Débarras cave / garage',         'forfait', 250, 20),
  ('Enlèvement encombrants',         'm2',       25, 20),
  ('Main d''œuvre débarras',         'h',        45, 20)
) as x(label, unit, price, vat) on true
where a.slug = 'debarras'
  and not exists (select 1 from prestations p where p.activity_id = a.id);

-- Default issuing entity for Débarras → CGK Services (a services activity),
-- respecting the one-default-per-activity partial unique index.
insert into legal_entity_activities (legal_entity_id, activity_id, is_default)
select e.id, a.id, true
from legal_entities e, activities a
where e.legal_name = 'CGK Services' and a.slug = 'debarras'
  and not exists (
    select 1 from legal_entity_activities la
    where la.activity_id = a.id and la.is_default = true
  )
on conflict (legal_entity_id, activity_id) do nothing;
