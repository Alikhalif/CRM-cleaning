-- Société émettrice OPTIMIVV NETTOYAGE — infos officielles (client 2026-08-07).
-- Complète le placeholder « Optimiv » (ou met à jour si déjà renommé). La forme
-- juridique n'a pas été fournie : conservée telle quelle (SAS par défaut) —
-- ajustable dans Paramètres → Sociétés.
update legal_entities set
  legal_name = 'OPTIMIVV NETTOYAGE',
  siret = '92808342700023',
  vat_number = 'FR26928083427',
  address = '{"line1":"2 RUE ALFRED BRUNEAU","postal_code":"75016","city":"PARIS","country":"France"}'::jsonb,
  contact_email = 'devis@optimivv-nettoyage.com',
  contact_phone = '0756888275',
  default_vat_rate = 20,
  is_vat_exempt = false,
  updated_at = now()
where legal_name in ('Optimiv', 'OPTIMIVV NETTOYAGE');

-- Base fraîche : créer la société si elle n'existe pas du tout.
insert into legal_entities (legal_name, legal_form, siret, vat_number, address, contact_email, contact_phone, default_vat_rate, is_vat_exempt)
select 'OPTIMIVV NETTOYAGE', 'SAS', '92808342700023', 'FR26928083427',
  '{"line1":"2 RUE ALFRED BRUNEAU","postal_code":"75016","city":"PARIS","country":"France"}'::jsonb,
  'devis@optimivv-nettoyage.com', '0756888275', 20, false
where not exists (select 1 from legal_entities where legal_name = 'OPTIMIVV NETTOYAGE');
