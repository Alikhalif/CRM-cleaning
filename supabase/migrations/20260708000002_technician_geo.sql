-- Geo assignment for technicians (client request, call 2026-06-10): assign the
-- intervenant nearest the client, within a 100 km radius that widens if none is
-- found. Two complementary fields:
--   base_postal_code    — home/dépôt postal code → drives real km distance
--                         (haversine over département centroids, see lib/geo.ts)
--   service_departments — declared coverage (département codes) → in-zone filter
-- Distance is computed app-side; no external geocoding API.

alter table technicians
  add column if not exists base_postal_code text,
  add column if not exists service_departments text[] not null default '{}';

-- Seed the demo technicians with a base + coverage so the planify modal has
-- something to sort by out of the box.
update technicians set base_postal_code = '75001', service_departments = array['75','92','93','94','77','78','91','95']
  where name = 'Khaled Brahim';
update technicians set base_postal_code = '69001', service_departments = array['69','38','01','42']
  where name = 'Vincent Caron';
update technicians set base_postal_code = '13001', service_departments = array['13','83','84','04']
  where name = 'Aïcha Lefort';
update technicians set base_postal_code = '33000', service_departments = array['33','40','47','24']
  where name = 'Bastien Roy';
