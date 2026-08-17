-- Emails société « devispro@ » (client 2026-08-07).
-- 1) OPTIMIVV NETTOYAGE : email société = devispro@optimivv-nettoyage.com.
update legal_entities
  set contact_email = 'devispro@optimivv-nettoyage.com', updated_at = now()
where legal_name = 'OPTIMIVV NETTOYAGE';

-- 2) Nouvelle société émettrice « Déménagement Pro Services » (à compléter :
--    forme juridique, SIRET, TVA, adresse). Créée avec nom + email + TVA 20 %.
insert into legal_entities (legal_name, legal_form, siret, vat_number, address, contact_email, default_vat_rate, is_vat_exempt)
select 'Déménagement Pro Services', 'SAS', 'À renseigner', null,
  '{"line1":"À renseigner","postal_code":"","city":"","country":"France"}'::jsonb,
  'devispro@demenagementproservices.com', 20, false
where not exists (select 1 from legal_entities where legal_name = 'Déménagement Pro Services');

-- Idempotence : si elle existe déjà, on s'assure au moins de l'email.
update legal_entities
  set contact_email = 'devispro@demenagementproservices.com', updated_at = now()
where legal_name = 'Déménagement Pro Services';
