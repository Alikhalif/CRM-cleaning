-- ── Seed data ─────────────────────────────────────────────────────────
-- Loaded automatically by `supabase db reset` after migrations.
-- Mirrors lib/leads-mock.ts so the UI sees the same scaffold data once
-- screens are wired through Supabase. Service-role bypasses RLS at seed
-- time, so policies don't block these inserts.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Activities (sectors — CDC §4.12.3) ────────────────────────────
insert into activities (slug, label, short, color, emoji, default_quote_min, default_quote_max, acompte_pct, vat_rate)
values
  ('urgence',    'Dépannage urgence',     'Urg.',  '#ef4444', '🚨',   200,  800,   0, 20),
  ('nettoyage',  'Nettoyage',             'Nett.', '#0ea5e9', '🧽',   500, 3000,  20, 20),
  ('enr',        'Énergies renouvelables', 'ENR',  '#14c890', '☀️',  8000, 25000, 30, 10),
  ('renovation', 'Rénovation bâtiment',   'Réno.', '#f59e0b', '🏗️', 15000, 80000, 40, 10);

-- ── 2. Lead sources ──────────────────────────────────────────────────
insert into lead_sources (slug, label, icon, color) values
  ('google_ads',     'Google Ads',     'google',     '#4285F4'),
  ('meta_ads',       'Meta Ads',       'meta',       '#1877F2'),
  ('site_web',       'Site web',       'globe',      '#5b4bcc'),
  ('telephone',      'Téléphone',      'phone',      '#14c890'),
  ('recommandation', 'Recommandation', 'star',       '#f59e0b');

-- ── 3. Payment terms ─────────────────────────────────────────────────
insert into payment_terms (slug, label, days) values
  ('comptant', 'Comptant à réception',     0),
  ('jours_30', '30 jours fin de mois',    30),
  ('jours_45', '45 jours fin de mois',    45),
  ('jours_60', '60 jours',                60);

-- ── 4. Roles ─────────────────────────────────────────────────────────
insert into roles (slug, label, description, icon) values
  ('admin',          'Super Admin',   'Accès illimité',                            'shield'),
  ('commercial',     'Commercial',    'Cloisonné à ses propres leads',             'users'),
  ('planification',  'Planificateur', 'Planning, comptabilité, intervenants',      'calendar'),
  ('assistant',      'Assistant',     'À activer en phase 2',                      'inbox');

-- ── 5. Legal entities (entités juridiques) ──────────────────────────
insert into legal_entities (
  legal_name, legal_form, siret, ape_code, vat_number,
  address, contact_email, contact_phone, iban, bic, default_vat_rate,
  legal_mentions, color
) values
  ('CGK Services', 'SAS', '894 217 530 00021', '8121Z', 'FR42894217530',
    jsonb_build_object('line1', '14 rue Pasteur', 'postal_code', '33000', 'city', 'Bordeaux'),
    'contact@cgk-services.fr', '+33 5 56 00 00 00',
    'FR76 1234 5678 9012 3456 7890 123', 'BDFEFRPP', 20,
    'SAS au capital de 50 000 €. Assurance décennale MMA n° 1234567. RGE QualiPropre n° E-2024-00891.',
    '#5b4bcc'),
  ('CGK Énergie', 'SARL', '917 305 412 00018', '4321A', 'FR58917305412',
    jsonb_build_object('line1', '27 avenue Carnot', 'postal_code', '33200', 'city', 'Bordeaux'),
    'energie@cgk-services.fr', '+33 5 56 00 00 02',
    'FR76 9876 5432 1098 7654 3210 987', 'BDFEFRPP', 10,
    'SARL au capital de 80 000 €. RGE QualiPV n° E-2024-04421. Assurance décennale Allianz n° 9087625.',
    '#14c890');

-- Entity ↔ activity defaults: Services → nettoyage + urgence + débarras;
-- Énergie → enr + rénovation.
-- NOTE: `debarras` is created by migration 20260708000001, which runs BEFORE
-- this seed on a fresh database — at that point legal_entities is still empty,
-- so the migration's own mapping insert finds nothing. Mapping it here is what
-- gives Débarras a default issuing company on a clean install.
insert into legal_entity_activities (legal_entity_id, activity_id, is_default)
select e.id, a.id, true
from legal_entities e
cross join activities a
where (e.legal_name = 'CGK Services' and a.slug in ('nettoyage', 'urgence', 'debarras'))
   or (e.legal_name = 'CGK Énergie'  and a.slug in ('enr', 'renovation'))
on conflict (legal_entity_id, activity_id) do nothing;

-- ── 6. Prestations catalogue (CDC §4.10 extract) ─────────────────────
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate)
select a.id, x.label, x.unit::prestation_unit, x.price, x.vat
from activities a
join (values
  ('enr',        'Panneau photovoltaïque 400 Wc', 'unite',    280, 10),
  ('enr',        'Onduleur hybride 5 kW',         'unite',   1450, 10),
  ('enr',        'Pose et raccordement (forfait)', 'forfait', 1800, 10),
  ('renovation', 'Isolation murs ITE',            'm2',        95, 10),
  ('renovation', 'Réfection toiture',             'm2',       145, 10),
  ('renovation', 'Pose conduit cheminée',         'forfait', 1200, 10),
  ('urgence',    'Intervention dépannage',        'forfait',  180, 20),
  ('urgence',    'Heure technicien',              'h',         75, 20),
  ('nettoyage',  'Entretien bureaux (mensuel)',   'mois',     480, 20),
  ('nettoyage',  'Nettoyage vitrerie',            'm2',         8, 20)
) as x(sector_slug, label, unit, price, vat) on a.slug = x.sector_slug;

-- ── 7. Technicians (intervenants) ────────────────────────────────────
-- base_postal_code + service_departments drive the distance ranking in the
-- planify modal (lib/geo.ts). They MUST be set here: migration 20260708000002
-- adds the columns and tries to backfill these same values, but it runs before
-- this seed on a fresh database, when technicians is still empty.
insert into technicians (name, initials, color, sectors, base_postal_code, service_departments)
select t.name, t.initials, t.color,
       array(select id from activities where slug = any(t.sector_slugs)),
       t.base_pc, t.departments
from (values
  ('Khaled Brahim',  'KB', '#ef4444', array['urgence', 'enr'],        '75001', array['75','92','93','94','77','78','91','95']),
  ('Vincent Caron',  'VC', '#f59e0b', array['renovation', 'enr'],     '69001', array['69','38','01','42']),
  ('Aïcha Lefort',   'AL', '#0ea5e9', array['nettoyage'],             '13001', array['13','83','84','04']),
  ('Bastien Roy',    'BR', '#14c890', array['urgence', 'nettoyage'],  '33000', array['33','40','47','24'])
) as t(name, initials, color, sector_slugs, base_pc, departments);

-- ── 8. Leads (16 rows from lib/leads-mock.ts) ────────────────────────
-- short_id is the natural key; FKs resolve via subqueries.
insert into leads (
  short_id, received_at, source_id, activity_id, entity_id,
  is_company, client_first_name, client_last_name, client_company,
  client_email, client_phone, client_address,
  status, sub_envoi, sub_signature,
  estimated_amount, is_urgent,
  last_action_label, last_action_at, next_followup_at,
  immob_travaux_annotation, lost_reason
) values
-- ── Lead entrant ──
('L-1058', now() - interval '0.5 hour',
  (select id from lead_sources where slug = 'google_ads'),
  (select id from activities    where slug = 'urgence'),
  (select id from legal_entities where legal_name = 'CGK Services'),
  false, 'Léa', 'Dubois', null,
  'lea.dubois@example.com', '+33 6 14 22 18 03',
  jsonb_build_object('line1', '12 rue Oberkampf', 'postal_code', '75011', 'city', 'Paris 11e'),
  'lead', null, null,
  480, true,
  'Lead reçu', now() - interval '0.5 hour', now() + interval '2 hours',
  null, null),
('L-1057', now() - interval '2 hour',
  (select id from lead_sources where slug = 'meta_ads'),
  (select id from activities    where slug = 'nettoyage'),
  (select id from legal_entities where legal_name = 'CGK Services'),
  true, null, null, 'Atelier Vidal SARL',
  'contact@atelier-vidal.fr', '+33 4 78 31 09 22',
  jsonb_build_object('line1', '47 cours Lafayette', 'postal_code', '69003', 'city', 'Lyon 3e'),
  'lead', null, null,
  1850, false,
  'Lead reçu', now() - interval '2 hour', null,
  null, null),
('L-1056', now() - interval '5 hour',
  (select id from lead_sources where slug = 'site_web'),
  (select id from activities    where slug = 'enr'),
  (select id from legal_entities where legal_name = 'CGK Énergie'),
  false, 'Hervé', 'Marchand', null,
  'h.marchand@orange.fr', '+33 6 88 41 02 17',
  jsonb_build_object('line1', '9 chemin des Vignes', 'postal_code', '17100', 'city', 'Saintes'),
  'lead', null, null,
  14200, false,
  'Lead reçu', now() - interval '5 hour', null,
  'Propriétaire occupant, RDV possible 6/05 entre 14h-17h.', null),
('L-1055', now() - interval '9 hour',
  (select id from lead_sources where slug = 'recommandation'),
  (select id from activities    where slug = 'renovation'),
  (select id from legal_entities where legal_name = 'CGK Énergie'),
  true, null, null, 'Cabinet Rousseau',
  'rousseau@cabinet-rousseau.com', '+33 5 56 79 12 04',
  jsonb_build_object('line1', '82 rue Sainte-Catherine', 'postal_code', '33000', 'city', 'Bordeaux'),
  'lead', null, null,
  38500, false,
  'Lead reçu', now() - interval '9 hour', null,
  'Recommandé par M. Lefranc (L-0998), opération immobilière en cours.', null),
-- ── Devis envoyé ──
('L-1051', now() - interval '20 hour',
  (select id from lead_sources where slug = 'google_ads'),
  (select id from activities    where slug = 'nettoyage'),
  (select id from legal_entities where legal_name = 'CGK Services'),
  false, 'Marie', 'Lefèvre', null,
  'marie.lefevre@gmail.com', '+33 6 22 38 71 09',
  jsonb_build_object('line1', '3 allée des Tilleuls', 'postal_code', '44000', 'city', 'Nantes'),
  'envoye', 'mano', null,
  920, false, 'Devis envoyé', now() - interval '2 hour', null, null, null),
('L-1050', now() - interval '36 hour',
  (select id from lead_sources where slug = 'meta_ads'),
  (select id from activities    where slug = 'nettoyage'),
  (select id from legal_entities where legal_name = 'CGK Services'),
  true, null, null, 'Boulangerie Cazeneuve',
  'cazeneuve.contact@gmail.com', '+33 5 61 23 88 17',
  jsonb_build_object('line1', '18 place du Capitole', 'postal_code', '31000', 'city', 'Toulouse'),
  'envoye', 'auto', null,
  2400, false, 'Email J+0 envoyé', now() - interval '8 hour', now() + interval '64 hours', null, null),
('L-1049', now() - interval '48 hour',
  (select id from lead_sources where slug = 'google_ads'),
  (select id from activities    where slug = 'enr'),
  (select id from legal_entities where legal_name = 'CGK Énergie'),
  false, 'Pascal', 'Vidal', null,
  'p.vidal17@laposte.net', '+33 6 71 90 14 28',
  jsonb_build_object('line1', '27 quai Valin', 'postal_code', '17000', 'city', 'La Rochelle'),
  'envoye', null, null,
  19800, false, 'Devis envoyé', now() - interval '10 hour', null, null, null),
-- ── Devis ouvert ──
('L-1042', now() - interval '72 hour',
  (select id from lead_sources where slug = 'site_web'),
  (select id from activities    where slug = 'renovation'),
  (select id from legal_entities where legal_name = 'CGK Énergie'),
  false, 'Camille', 'Roux', null,
  'camille.roux@outlook.com', '+33 6 18 04 32 91',
  jsonb_build_object('line1', '55 avenue Berthelot', 'postal_code', '69007', 'city', 'Lyon 7e'),
  'ouvert', 'auto', null,
  27500, false, 'Lien ouvert', now() - interval '4 hour', now() + interval '96 hours', null, null),
('L-1041', now() - interval '60 hour',
  (select id from lead_sources where slug = 'telephone'),
  (select id from activities    where slug = 'urgence'),
  (select id from legal_entities where legal_name = 'CGK Services'),
  true, null, null, 'Garage Tessier',
  'garage.tessier@orange.fr', '+33 5 56 45 88 19',
  jsonb_build_object('line1', '12 avenue Pasteur', 'postal_code', '33600', 'city', 'Pessac'),
  'ouvert', 'mano', null,
  720, false, 'Lien ouvert', now() - interval '1.5 hour', null, null, null),
-- ── Signé ──
('L-1035', now() - interval '120 hour',
  (select id from lead_sources where slug = 'google_ads'),
  (select id from activities    where slug = 'enr'),
  (select id from legal_entities where legal_name = 'CGK Énergie'),
  false, 'Florence', 'Garnier', null,
  'f.garnier@free.fr', '+33 6 90 33 71 02',
  jsonb_build_object('line1', '14 rue de la République', 'postal_code', '79000', 'city', 'Niort'),
  'signe', 'mano', 'avec',
  22300, false, 'Devis signé', now() - interval '18 hour', null, null, null),
('L-1033', now() - interval '96 hour',
  (select id from lead_sources where slug = 'recommandation'),
  (select id from activities    where slug = 'nettoyage'),
  (select id from legal_entities where legal_name = 'CGK Services'),
  true, null, null, 'Café Margot',
  'cafe.margot@gmail.com', '+33 1 42 64 18 09',
  jsonb_build_object('line1', '61 rue des Abbesses', 'postal_code', '75018', 'city', 'Paris 18e'),
  'signe', 'mano', 'sans',
  1180, false, 'Devis signé', now() - interval '22 hour', null, null, null),
('L-1031', now() - interval '140 hour',
  (select id from lead_sources where slug = 'site_web'),
  (select id from activities    where slug = 'renovation'),
  (select id from legal_entities where legal_name = 'CGK Énergie'),
  true, null, null, 'Domaine de Beaulieu',
  'intendance@domaine-beaulieu.fr', '+33 5 45 82 11 47',
  jsonb_build_object('line1', 'Route de Châteaubernard', 'postal_code', '16100', 'city', 'Cognac'),
  'signe', 'auto', null,
  64500, false, 'Devis signé', now() - interval '30 hour', null,
  'Bâtiment classé monument historique, devis avec contraintes.', null),
-- ── Encaissé ──
('L-1024', now() - interval '220 hour',
  (select id from lead_sources where slug = 'meta_ads'),
  (select id from activities    where slug = 'enr'),
  (select id from legal_entities where legal_name = 'CGK Énergie'),
  false, 'Mathieu', 'Perret', null,
  'mathieu.perret@gmail.com', '+33 6 47 28 09 13',
  jsonb_build_object('line1', '8 boulevard Berthelot', 'postal_code', '16000', 'city', 'Angoulême'),
  'encaisse', 'mano', 'avec',
  17900, false, 'Encaissement final', now() - interval '48 hour', null, null, null),
('L-1019', now() - interval '310 hour',
  (select id from lead_sources where slug = 'recommandation'),
  (select id from activities    where slug = 'renovation'),
  (select id from legal_entities where legal_name = 'CGK Énergie'),
  true, null, null, 'SCI Le Beffroi',
  'gestion@sci-lebeffroi.fr', '+33 3 20 51 84 22',
  jsonb_build_object('line1', '44 rue de Béthune', 'postal_code', '59000', 'city', 'Lille'),
  'encaisse', 'mano', 'avec',
  41200, false, 'Encaissement final', now() - interval '72 hour', null, null, null),
-- ── Perdu ──
('L-1015', now() - interval '360 hour',
  (select id from lead_sources where slug = 'google_ads'),
  (select id from activities    where slug = 'urgence'),
  (select id from legal_entities where legal_name = 'CGK Services'),
  false, 'Olivier', 'Maréchal', null,
  'o.marechal@hotmail.fr', '+33 6 33 91 47 02',
  jsonb_build_object('line1', '21 rue Jean Jaurès', 'postal_code', '29200', 'city', 'Brest'),
  'perdu', 'auto', null,
  320, false, 'Aucune réponse après J+14', now() - interval '72 hour', null, null,
  'Aucune réponse après les 4 emails de relance.'),
('L-1009', now() - interval '420 hour',
  (select id from lead_sources where slug = 'meta_ads'),
  (select id from activities    where slug = 'nettoyage'),
  (select id from legal_entities where legal_name = 'CGK Services'),
  true, null, null, 'Studio Fontaine',
  'studio.fontaine@gmail.com', '+33 2 99 36 14 88',
  jsonb_build_object('line1', '9 rue Hoche', 'postal_code', '35000', 'city', 'Rennes'),
  'perdu', 'mano', null,
  1450, false, 'Concurrent retenu', now() - interval '96 hour', null, null,
  'Concurrent retenu pour raisons de prix.');

-- ── 9. Clients (5 derived from signé/encaissé leads + 4 direct) ──────
insert into clients (type, name, contact_name, email, phone, address, siret, vat_intra, source, source_lead_id, sectors, note)
-- Lead-origin clients (one per signe/encaisse lead).
select
  case when l.is_company then 'pro'::client_type else 'particulier'::client_type end,
  coalesce(l.client_company, trim(coalesce(l.client_first_name, '') || ' ' || coalesce(l.client_last_name, ''))),
  case when l.is_company then null
       else trim(coalesce(l.client_first_name, '') || ' ' || coalesce(l.client_last_name, ''))
  end,
  l.client_email,
  l.client_phone,
  l.client_address,
  null, null,  -- siret/vat carried from lead context if needed
  'lead'::client_origin,
  l.id,
  array[l.activity_id],
  'Issu du lead ' || l.short_id
from leads l
where l.status in ('signe', 'encaisse');

-- Direct clients.
insert into clients (type, name, contact_name, email, phone, address, siret, vat_intra, source, sectors, note)
values
  ('pro', 'Hôtel Le Patio', 'Aurélie Mansard',
    'direction@hotel-le-patio.fr', '+33 5 56 47 09 22',
    jsonb_build_object('line1', '9 cours du Maréchal-Foch', 'postal_code', '33000', 'city', 'Bordeaux'),
    '543 219 087 00031', 'FR12543219087', 'direct',
    array(select id from activities where slug = 'nettoyage'),
    'Contrat trimestriel d''entretien des chambres. Signé hors plateforme en avril 2026.'),
  ('particulier', 'Pierre Vasseur', null,
    'p.vasseur@laposte.net', '+33 6 71 02 84 19',
    jsonb_build_object('line1', '5 rue des Bouvreuils', 'postal_code', '44000', 'city', 'Nantes'),
    null, null, 'direct',
    array(select id from activities where slug = 'urgence'),
    'Client récurrent depuis 2024, intervient sur tout le grand Nantes.'),
  ('pro', 'Mairie de Saint-Cloud', 'Régine Pelletier',
    'r.pelletier@saintcloud.fr', '+33 1 47 71 88 12',
    jsonb_build_object('line1', '13 place Charles-de-Gaulle', 'postal_code', '92210', 'city', 'Saint-Cloud'),
    '219 200 759 00018', 'FR47219200759', 'direct',
    array(select id from activities where slug in ('nettoyage', 'renovation')),
    'Marché public renouvelé annuellement.'),
  ('particulier', 'Lucie Marquand', null,
    'lucie.marquand@gmail.com', '+33 6 23 90 41 02',
    jsonb_build_object('line1', '21 chemin du Petit Bois', 'postal_code', '78600', 'city', 'Maisons-Laffitte'),
    null, null, 'direct',
    array(select id from activities where slug = 'nettoyage'),
    'Contact bouche-à-oreille via L-1009.');

-- ── 10. Documents ────────────────────────────────────────────────────
-- Note: we skip total_ht/total_vat here — those come from sum(document_lines)
-- via an application-level recompute on update. For seed purposes, only the
-- total_ttc is meaningful.
insert into documents (
  num, type, status, lead_id, entity_id, activity_id,
  issued_at, total_ttc, acompte_pct, acompte_amount, signed_at, paid_at
)
select
  d.num, d.type::document_type, d.status::document_status,
  l.id, l.entity_id, l.activity_id,
  now() - (d.issued_h || ' hour')::interval,
  t.total_ttc, d.acompte_pct, d.acompte_amount,
  case when d.signed_h is null then null else now() - (d.signed_h || ' hour')::interval end,
  case when d.paid_h is null then null else now() - (d.paid_h || ' hour')::interval end
from leads l
join (values
  ('DEV-2026-0042', 'devis',   'envoye', 'L-1051',   2, null,   null, null, null),
  ('DEV-2026-0041', 'devis',   'envoye', 'L-1050',   8, null,   null, null, null),
  ('DEV-2026-0040', 'devis',   'envoye', 'L-1049',  10, 30,    5940, null, null),
  ('DEV-2026-0036', 'devis',   'ouvert', 'L-1042',  40, 40,   11000, null, null),
  ('DEV-2026-0035', 'devis',   'ouvert', 'L-1041',  36, null,   null, null, null),
  ('DEV-2026-0029', 'devis',   'signe',  'L-1035',  72, 30,    6690,   18, null),
  ('FA-2026-0011',  'acompte', 'envoye', 'L-1035',  18, null,   null, null, null),
  ('DEV-2026-0028', 'devis',   'signe',  'L-1033',  48, null,   null,   22, null),
  ('DEV-2026-0026', 'devis',   'signe',  'L-1031',  80, null,   null,   30, null),
  ('DEV-2026-0019', 'devis',   'signe',  'L-1024', 180, 30,    5370,  150, null),
  ('FA-2026-0006',  'acompte', 'paye',   'L-1024', 150, null,   null, null, 140),
  ('FAC-2026-0014', 'finale',  'paye',   'L-1024',  60, null,   null, null,  48),
  ('DEV-2026-0014', 'devis',   'signe',  'L-1019', 280, 40,   16480,  240, null),
  ('FA-2026-0004',  'acompte', 'paye',   'L-1019', 240, null,   null, null, 225),
  ('FAC-2026-0009', 'finale',  'paye',   'L-1019',  85, null,   null, null,  72)
) as d(num, type, status, short_id, issued_h, acompte_pct, acompte_amount, signed_h, paid_h)
  on l.short_id = d.short_id
cross join lateral (
  select case d.num
    when 'DEV-2026-0042' then 920    when 'DEV-2026-0041' then 2400
    when 'DEV-2026-0040' then 19800  when 'DEV-2026-0036' then 27500
    when 'DEV-2026-0035' then 720    when 'DEV-2026-0029' then 22300
    when 'FA-2026-0011'  then 6690   when 'DEV-2026-0028' then 1180
    when 'DEV-2026-0026' then 64500  when 'DEV-2026-0019' then 17900
    when 'FA-2026-0006'  then 5370   when 'FAC-2026-0014' then 12530
    when 'DEV-2026-0014' then 41200  when 'FA-2026-0004'  then 16480
    when 'FAC-2026-0009' then 24720
  end as total_ttc
) t;

-- Wire the counters to the highest year+num for each type so future inserts continue cleanly.
insert into doc_counters (doc_type, year, next_value)
select type, 2026, max(seq) + 1
from (
  select type, (regexp_replace(num, '^.+-2026-', ''))::int as seq
  from documents
  where num like '%-2026-%'
) s
group by type;

-- ── 11. Dossiers (5 — one per signe/encaisse lead) ───────────────────
insert into dossiers (lead_id, status, payment_status, technician_id, planned_at, duration_hours, flags, notes, created_at, updated_at)
-- Florence Garnier — à planifier, acompte impayé
select l.id, 'a_planifier'::dossier_status, 'acompte_non_paye'::payment_status,
      null, null, null, '{}'::dossier_flag[],
      'Devis signé · acompte 30% à encaisser avant planification chantier.',
      now() - interval '18 hour', now() - interval '2 hour'
from leads l where l.short_id = 'L-1035'
union all
-- Café Margot — planifié, en attente paiement
select l.id, 'planifie', 'en_attente',
       (select id from technicians where name = 'Aïcha Lefort'),
       now() + interval '36 hours', 2, '{}',
       null,
       now() - interval '22 hour', now() - interval '4 hour'
from leads l where l.short_id = 'L-1033'
union all
-- Domaine de Beaulieu — bloqué
select l.id, 'a_planifier', 'en_attente',
       null, null, null, array['bloque'::dossier_flag],
       'Bâtiment classé monument historique · attente ABF.',
       now() - interval '30 hour', now() - interval '10 hour'
from leads l where l.short_id = 'L-1031'
union all
-- Mathieu Perret — finalisé, partiel, à rappeler
select l.id, 'finalise', 'partiel',
       (select id from technicians where name = 'Vincent Caron'),
       now() - interval '48 hour', 6, array['a_rappeler'::dossier_flag],
       'Intervention OK · solde final à relancer.',
       now() - interval '150 hour', now() - interval '8 hour'
from leads l where l.short_id = 'L-1024'
union all
-- SCI Le Beffroi — soldé
select l.id, 'solde', 'solde',
       (select id from technicians where name = 'Vincent Caron'),
       now() - interval '72 hour', 12, '{}',
       null,
       now() - interval '240 hour', now() - interval '72 hour'
from leads l where l.short_id = 'L-1019';
