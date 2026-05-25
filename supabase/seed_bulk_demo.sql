-- ════════════════════════════════════════════════════════════════════════
-- Bulk demo data — 25 additional leads with realistic French data spread
-- across the pipeline, plus the matching devis / acomptes / finales /
-- dossiers / technicians / call notes / intervention delays.
--
-- Idempotent re-run: deletes prior rows from this script (anything whose
-- short_id begins with "L-2") before inserting fresh. Original CDC seed
-- (L-1xxx) is untouched.
--
-- Run in Supabase Studio → SQL editor (service role bypasses RLS, so the
-- inserts work regardless of the user's role).
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ── Resolve references once ──────────────────────────────────────────
  v_yohann          uuid := (select id from users where email = 'khalifkh35@gmail.com' limit 1);
  v_ali             uuid := (select id from users where email = 'themotivation1999@gmail.com' limit 1);
  v_renovation      uuid := (select id from activities where slug = 'renovation');
  v_nettoyage       uuid := (select id from activities where slug = 'nettoyage');
  v_urgence         uuid := (select id from activities where slug = 'urgence');
  v_enr             uuid := (select id from activities where slug = 'enr');
  v_src_google      uuid := (select id from lead_sources where slug = 'google_ads');
  v_src_meta        uuid := (select id from lead_sources where slug = 'meta_ads');
  v_src_site        uuid := (select id from lead_sources where slug = 'site_web');
  v_src_phone       uuid := (select id from lead_sources where slug = 'telephone');
  v_src_reco        uuid := (select id from lead_sources where slug = 'recommandation');
  v_entity_default  uuid := (select id from legal_entities order by created_at asc limit 1);
  v_tech_aicha      uuid := (select id from technicians where name = 'Aïcha Lefort' limit 1);
  v_tech_vincent    uuid := (select id from technicians where name = 'Vincent Caron' limit 1);
  v_tech_any        uuid;
  v_pt_30j          uuid := (select id from payment_terms where slug = '30j');
  v_pt_45j          uuid := (select id from payment_terms where slug = '45j');
  v_pt_comptant     uuid := (select id from payment_terms where slug = 'comptant');

  -- Loop state
  v_lead_id   uuid;
  v_devis_num text;
  v_acompte_num text;
  v_finale_num text;
  v_doc_id    uuid;
begin
  -- Resolve fallback owner if our two real users aren't there (e.g., fresh DB)
  if v_yohann is null then v_yohann := (select id from users order by created_at limit 1); end if;
  if v_ali is null then v_ali := v_yohann; end if;
  if v_tech_any is null then v_tech_any := coalesce(v_tech_aicha, v_tech_vincent, (select id from technicians limit 1)); end if;

  -- ── Idempotency: wipe previous run ───────────────────────────────────
  delete from document_lines where document_id in (
    select d.id from documents d join leads l on l.id = d.lead_id where l.short_id like 'L-2%'
  );
  delete from documents where lead_id in (select id from leads where short_id like 'L-2%');
  delete from dossiers   where lead_id in (select id from leads where short_id like 'L-2%');
  delete from leads      where short_id like 'L-2%';

  -- ── 25 new leads ─────────────────────────────────────────────────────
  -- Mix: 8 envoye/ouvert (active devis), 6 signe (pending intervention),
  -- 5 encaisse (closed, paid), 3 lead (just received), 3 perdu (closed lost).

  -- ── LEAD STATUS ──────────────────────────────────────────────────────
  -- L-2001..L-2003 — fresh leads (status: lead)
  insert into leads (short_id, is_company, client_first_name, client_last_name, client_email, client_phone,
    client_address, estimated_amount, owner_id, activity_id, source_id,
    status, received_at, last_action_label, last_action_at)
  values
    ('L-2001', false, 'Antoine',  'Mercier',    'a.mercier@laposte.net',   '+33 6 71 02 34 12',
      '{"line1":"42 rue du Faubourg","postal_code":"75011","city":"Paris"}'::jsonb,
      18500, v_yohann, v_renovation, v_src_google,
      'lead', now() - interval '2 hours', 'Lead reçu', now() - interval '2 hours'),
    ('L-2002', true,  null,        null,         'contact@boulangerie-leblanc.fr', '+33 4 78 21 09 33',
      '{"line1":"7 place du Marché","postal_code":"69005","city":"Lyon"}'::jsonb,
      640, v_ali, v_urgence, v_src_phone,
      'lead', now() - interval '5 hours', 'Lead reçu', now() - interval '5 hours'),
    ('L-2003', false, 'Sophie',   'Berger',     's.berger@orange.fr',      '+33 6 14 87 92 04',
      '{"line1":"5 allée des Cèdres","postal_code":"33700","city":"Mérignac"}'::jsonb,
      14200, v_yohann, v_enr, v_src_meta,
      'lead', now() - interval '1 day', 'Lead reçu', now() - interval '1 day');

  -- Update L-2002 with company name
  update leads set client_company = 'Boulangerie Leblanc' where short_id = 'L-2002';

  -- L-2010..L-2017 — devis envoyé / ouvert (active selling)
  insert into leads (short_id, is_company, client_first_name, client_last_name, client_company, client_email, client_phone,
    client_address, estimated_amount, owner_id, activity_id, source_id,
    status, sub_envoi, received_at, last_action_label, last_action_at, notes)
  values
    ('L-2010', false, 'Léa',       'Tessier',  null, 'lea.tessier@gmail.com',     '+33 6 22 19 04 56',
      '{"line1":"18 quai de Vendeuvre","postal_code":"14000","city":"Caen"}'::jsonb,
      8200, v_yohann, v_nettoyage, v_src_google,
      'envoye', 'auto', now() - interval '3 days', 'Devis DEV-2026-X envoyé', now() - interval '2 days',
      'Cliente intéressée par un entretien mensuel. Devis envoyé par séquence automatisée.'),
    ('L-2011', true,  null, null, 'Restaurant Le Bistroquet', 'gerant@bistroquet.fr', '+33 5 56 33 14 09',
      '{"line1":"3 rue Sainte-Catherine","postal_code":"33000","city":"Bordeaux"}'::jsonb,
      4500, v_ali, v_nettoyage, v_src_phone,
      'envoye', 'mano', now() - interval '4 days', 'Devis envoyé après échange tél', now() - interval '3 days',
      'Devis envoyé hier après le rdv téléphonique. Le gérant veut comparer avec une autre entreprise.'),
    ('L-2012', false, 'Jean-Marc', 'Renaud',  null, 'jm.renaud@free.fr',          '+33 6 04 56 71 28',
      '{"line1":"11 rue des Lilas","postal_code":"54000","city":"Nancy"}'::jsonb,
      26000, v_yohann, v_enr, v_src_google,
      'envoye', 'auto', now() - interval '5 days', 'Séquence n8n en cours', now() - interval '2 days',
      'Installation panneaux PV 6kW + onduleur. Toit sud orientation ideale. Relance auto J+3.'),
    ('L-2013', true,  null, null, 'SCI Le Cailloux',         'contact@sci-lecailloux.fr', '+33 4 91 18 22 65',
      '{"line1":"82 boulevard Michelet","postal_code":"13008","city":"Marseille"}'::jsonb,
      48000, v_ali, v_renovation, v_src_reco,
      'ouvert', 'mano', now() - interval '7 days', 'Devis ouvert (4 min)', now() - interval '1 day',
      'Rénovation complète appartement de fonction. Le gérant a ouvert le devis 4 fois.'),
    ('L-2014', false, 'Camille',  'Berthier', null, 'c.berthier@gmail.com',       '+33 6 92 34 19 87',
      '{"line1":"24 rue Émile Zola","postal_code":"59000","city":"Lille"}'::jsonb,
      980, v_yohann, v_urgence, v_src_site,
      'envoye', 'mano', now() - interval '6 hours', 'Devis envoyé suite intervention', now() - interval '4 hours',
      'Fuite réparée hier soir, devis envoyé pour confirmation administrative.'),
    ('L-2015', true,  null, null, 'Atelier Lumière SARL', 'compta@atelier-lumiere.fr', '+33 1 47 65 22 09',
      '{"line1":"15 rue de Charonne","postal_code":"75011","city":"Paris"}'::jsonb,
      3200, v_ali, v_nettoyage, v_src_meta,
      'envoye', 'auto', now() - interval '8 days', 'Relance J+7 envoyée', now() - interval '1 day',
      'Pas de retour client. Stop séquence J+14 si silence persistant.'),
    ('L-2016', false, 'Maxime',   'Lambert',  null, 'maxime.lambert@yahoo.fr',    '+33 6 87 04 56 12',
      '{"line1":"3 avenue de la Gare","postal_code":"35000","city":"Rennes"}'::jsonb,
      11200, v_yohann, v_renovation, v_src_google,
      'ouvert', 'auto', now() - interval '10 days', 'Devis ouvert 2x', now() - interval '2 days',
      'Lead engagé — a ouvert le devis 2 fois sur 3 jours. Relance vendredi matin.'),
    ('L-2017', true,  null, null, 'École Saint-Vincent', 'direction@ec-stvincent.fr', '+33 3 89 25 14 02',
      '{"line1":"6 rue de Mulhouse","postal_code":"68100","city":"Mulhouse"}'::jsonb,
      6800, v_ali, v_nettoyage, v_src_phone,
      'envoye', 'mano', now() - interval '4 days', 'Devis envoyé par email', now() - interval '3 days',
      'Direction veut un nettoyage post-travaux avant rentrée. Validation conseil municipal en attente.');

  -- L-2020..L-2025 — signe (signed, pending intervention / acompte payment)
  insert into leads (short_id, is_company, client_first_name, client_last_name, client_company, client_email, client_phone,
    client_address, estimated_amount, owner_id, activity_id, source_id,
    status, sub_envoi, sub_signature, received_at, last_action_label, last_action_at, notes,
    intervention_delay, intervention_delay_notes)
  values
    ('L-2020', false, 'Christophe', 'Vidal', null, 'c.vidal@orange.fr',           '+33 6 12 87 34 92',
      '{"line1":"21 rue du Stade","postal_code":"31000","city":"Toulouse"}'::jsonb,
      14800, v_yohann, v_renovation, v_src_google,
      'signe', 'mano', 'avec', now() - interval '14 days', 'Devis signé', now() - interval '8 hours',
      'Signature obtenue après 2 rdv physiques. Acompte 30% à encaisser. Famille dispo le mercredi.',
      'sous_72h', 'Présence obligatoire d''un parent durant les travaux. Code accès parking : 4823.'),
    ('L-2021', true,  null, null, 'Restaurant La Belle Époque', 'gerance@belle-epoque.fr', '+33 4 67 22 18 04',
      '{"line1":"14 place de la Comédie","postal_code":"34000","city":"Montpellier"}'::jsonb,
      9200, v_ali, v_nettoyage, v_src_reco,
      'signe', 'mano', 'avec', now() - interval '18 days', 'Devis signé', now() - interval '2 days',
      'Contrat trimestriel signé. Intervention de remise en état avant réouverture du 1er juin.',
      '15_jours', 'Disponible uniquement le lundi de 9h à 12h (jour de fermeture).'),
    ('L-2022', false, 'Patricia',  'Lecomte', null, 'patricia.lecomte@laposte.net', '+33 6 78 23 09 14',
      '{"line1":"5 rue des Acacias","postal_code":"21000","city":"Dijon"}'::jsonb,
      19500, v_yohann, v_enr, v_src_meta,
      'signe', 'auto', 'avec', now() - interval '21 days', 'Devis signé', now() - interval '5 days',
      'Installation 8 panneaux PV + batterie 5kWh. Câblage à prévoir depuis garage.',
      '1_mois', 'Délai de raccordement Enedis estimé 3-4 semaines. Démarrage chantier dès accord.'),
    ('L-2023', true,  null, null, 'Cabinet d''Avocats Dupont', 'contact@avocats-dupont.fr', '+33 1 42 65 19 22',
      '{"line1":"38 rue de Rivoli","postal_code":"75004","city":"Paris"}'::jsonb,
      2400, v_ali, v_nettoyage, v_src_site,
      'signe', 'auto', 'sans', now() - interval '12 days', 'Devis signé sans acompte', now() - interval '3 days',
      'Cabinet juridique, contrat mensuel d''entretien. Pas d''acompte demandé.',
      '1_semaine', 'Accès uniquement après 18h. Code interphone : 27B.'),
    ('L-2024', false, 'Olivier',   'Martin',  null, 'o.martin@gmail.com',          '+33 6 23 87 14 56',
      '{"line1":"17 chemin des Vignes","postal_code":"83000","city":"Toulon"}'::jsonb,
      32000, v_yohann, v_renovation, v_src_google,
      'signe', 'mano', 'avec', now() - interval '25 days', 'Devis signé', now() - interval '1 day',
      'Rénovation cuisine + salle de bain. Acompte 40% encaissé hier — démarrage J+15.',
      '15_jours', 'Famille en vacances du 15 au 30. Démarrage chantier prévu après leur retour.'),
    ('L-2025', true,  null, null, 'Hôtel des Voyageurs', 'reception@hotel-voyageurs.fr', '+33 3 88 14 22 09',
      '{"line1":"24 rue du Faubourg","postal_code":"67000","city":"Strasbourg"}'::jsonb,
      18500, v_ali, v_nettoyage, v_src_phone,
      'signe', 'mano', 'avec', now() - interval '30 days', 'Devis signé', now() - interval '6 days',
      'Contrat trimestriel chambres + parties communes. Intervention de nuit imposée par client.',
      'sous_72h', 'Intervention uniquement entre 23h et 5h (chambres occupées la journée). Accès par entrée de service.');

  -- L-2030..L-2034 — encaissé (paid, closed)
  insert into leads (short_id, is_company, client_first_name, client_last_name, client_company, client_email, client_phone,
    client_address, estimated_amount, owner_id, activity_id, source_id,
    status, sub_envoi, sub_signature, received_at, last_action_label, last_action_at, notes,
    intervention_delay, intervention_delay_notes)
  values
    ('L-2030', true, null, null, 'Boucherie Charcuterie Renaud', 'contact@boucherie-renaud.fr', '+33 2 41 87 22 14',
      '{"line1":"8 place du Ralliement","postal_code":"49000","city":"Angers"}'::jsonb,
      7600, v_yohann, v_nettoyage, v_src_phone,
      'encaisse', 'mano', 'avec', now() - interval '60 days', 'Solde encaissé', now() - interval '10 days',
      'Contrat clôturé. Client satisfait, devis additionnel possible Q3 pour vitrines.',
      'sous_72h', 'Délai tenu, intervention sous 48h après signature.'),
    ('L-2031', false, 'François', 'Bonnet', null, 'francois.bonnet@free.fr', '+33 6 91 04 56 87',
      '{"line1":"33 rue de la République","postal_code":"42000","city":"Saint-Étienne"}'::jsonb,
      24500, v_ali, v_renovation, v_src_google,
      'encaisse', 'auto', 'avec', now() - interval '75 days', 'Facture finale réglée', now() - interval '5 days',
      'Rénovation appartement T3 — délais et budget tenus. Excellent retour client.',
      '1_semaine', 'Intervention conforme planning. Famille présente pendant les travaux.'),
    ('L-2032', true, null, null, 'SCI Bellevue', 'contact@sci-bellevue.fr', '+33 4 50 33 17 28',
      '{"line1":"5 avenue du Mont-Blanc","postal_code":"74000","city":"Annecy"}'::jsonb,
      45000, v_yohann, v_enr, v_src_reco,
      'encaisse', 'auto', 'avec', now() - interval '90 days', 'Solde encaissé', now() - interval '15 days',
      'Installation PV résidence collective. Mise en service Enedis OK.',
      '1_mois', 'Raccordement Enedis effectué en 4 semaines comme estimé.'),
    ('L-2033', false, 'Nathalie', 'Roux', null, 'n.roux@orange.fr', '+33 6 45 87 22 09',
      '{"line1":"19 rue Émile Combes","postal_code":"33800","city":"Bordeaux"}'::jsonb,
      890, v_ali, v_urgence, v_src_phone,
      'encaisse', 'mano', 'sans', now() - interval '45 days', 'Encaissé sur place', now() - interval '40 days',
      'Dépannage plomberie urgence soirée. Paiement immédiat par carte.',
      'sous_72h', 'Intervention 1h après l''appel.'),
    ('L-2034', true, null, null, 'Café-Brasserie Le Voltaire', 'gerant@cafe-voltaire.fr', '+33 4 72 25 18 41',
      '{"line1":"42 cours Lafayette","postal_code":"69003","city":"Lyon"}'::jsonb,
      5400, v_yohann, v_nettoyage, v_src_site,
      'encaisse', 'mano', 'avec', now() - interval '50 days', 'Solde encaissé', now() - interval '20 days',
      'Contrat mensuel — démarrage en avril. Client renouvellera en septembre.',
      '1_semaine', 'Intervention chaque mardi matin avant ouverture (5h-7h).');

  -- L-2040..L-2042 — perdu (lost)
  insert into leads (short_id, is_company, client_first_name, client_last_name, client_company, client_email, client_phone,
    client_address, estimated_amount, owner_id, activity_id, source_id,
    status, sub_envoi, received_at, last_action_label, last_action_at, notes, lost_reason)
  values
    ('L-2040', false, 'Pierre', 'Garnier', null, 'p.garnier@gmail.com', '+33 6 14 28 09 67',
      '{"line1":"11 rue Pasteur","postal_code":"38000","city":"Grenoble"}'::jsonb,
      0, v_yohann, v_renovation, v_src_meta,
      'perdu', 'auto', now() - interval '40 days', 'Marqué perdu', now() - interval '20 days',
      'Devis 25% plus cher que la concurrence. Client a choisi un artisan local.',
      'Concurrence — devis 25% moins cher chez Artisan local'),
    ('L-2041', true, null, null, 'Auto-École Phénix', 'gerant@autoecole-phenix.fr', '+33 5 61 23 14 09',
      '{"line1":"7 place Wilson","postal_code":"31000","city":"Toulouse"}'::jsonb,
      0, v_ali, v_nettoyage, v_src_phone,
      'perdu', 'mano', now() - interval '55 days', 'Marqué perdu — pas de budget', now() - interval '30 days',
      'Projet reporté à 2027. Reprendre contact en janvier.',
      'Pas de budget — projet reporté à 2027'),
    ('L-2042', false, 'Hélène', 'Dupuis', null, 'helene.dupuis@orange.fr', '+33 6 87 22 09 14',
      '{"line1":"3 rue des Hortensias","postal_code":"06000","city":"Nice"}'::jsonb,
      0, v_yohann, v_enr, v_src_google,
      'perdu', 'auto', now() - interval '70 days', 'Marqué perdu — pas réactif', now() - interval '40 days',
      'Aucune réponse après 4 relances séquence + 2 appels. Marqué perdu.',
      'Pas réactif — aucun retour après séquence + appels');

  -- ── Documents (devis + acompte + finale) ─────────────────────────────
  -- Insert a devis for every non-lead-status lead, plus acompte/finale for
  -- signed and encaissé ones. Using a procedural loop is simpler than a
  -- huge VALUES list when we need next_doc_num() per row.

  for v_lead_id, v_devis_num in
    select id, null
    from leads
    where short_id like 'L-2%'
      and status not in ('lead')
    order by short_id
  loop
    -- Devis (always)
    select next_doc_num('devis', 2026) into v_devis_num;
    insert into documents (type, num, status, lead_id, client_id, entity_id, activity_id,
      issued_at, valid_until, payment_term_id,
      total_ht, total_vat, total_ttc, acompte_pct, acompte_amount, solde_du,
      created_at, updated_at)
    select 'devis'::document_type, v_devis_num,
      case l.status
        when 'envoye' then 'envoye'::document_status
        when 'ouvert' then 'ouvert'::document_status
        when 'signe' then 'signe'::document_status
        when 'encaisse' then 'signe'::document_status
        when 'perdu' then 'refuse'::document_status
        else 'brouillon'::document_status
      end,
      l.id, null, v_entity_default, l.activity_id,
      l.received_at + interval '6 hours',
      l.received_at + interval '36 hours',
      case l.activity_id when v_renovation then v_pt_45j when v_urgence then v_pt_comptant else v_pt_30j end,
      coalesce(l.estimated_amount, 1000) * 0.83,                          -- total_ht (~ pre-VAT for TVA 20%)
      coalesce(l.estimated_amount, 1000) * 0.17,                          -- total_vat
      coalesce(l.estimated_amount, 1000),                                 -- total_ttc
      case l.sub_signature when 'avec' then 30 else null end,
      case l.sub_signature when 'avec' then coalesce(l.estimated_amount, 1000) * 0.30 else null end,
      case l.sub_signature when 'avec' then coalesce(l.estimated_amount, 1000) * 0.70 else coalesce(l.estimated_amount, 1000) end,
      l.received_at + interval '6 hours',
      now()
    from leads l where l.id = v_lead_id
    returning id into v_doc_id;

    -- Skip lines (Comptabilité doesn't read them; DocumentView synthesises).

    -- ── For signed + encaissé with `avec` acompte, also insert the acompte ──
    if exists (
      select 1 from leads l where l.id = v_lead_id
        and l.status in ('signe', 'encaisse')
        and l.sub_signature = 'avec'
    ) then
      select next_doc_num('acompte', 2026) into v_acompte_num;
      insert into documents (type, num, status, lead_id, entity_id, activity_id,
        issued_at, payment_term_id, total_ht, total_vat, total_ttc,
        paid_at, created_at, updated_at)
      select 'acompte'::document_type, v_acompte_num,
        case l.status when 'encaisse' then 'paye'::document_status else 'envoye'::document_status end,
        l.id, v_entity_default, l.activity_id,
        l.received_at + interval '7 days',
        v_pt_comptant,
        coalesce(l.estimated_amount, 1000) * 0.30 * 0.83,
        coalesce(l.estimated_amount, 1000) * 0.30 * 0.17,
        coalesce(l.estimated_amount, 1000) * 0.30,
        case l.status when 'encaisse' then l.received_at + interval '10 days' else null end,
        l.received_at + interval '7 days', now()
      from leads l where l.id = v_lead_id;
    end if;

    -- ── For encaissé, also a paid facture finale ─────────────────────────
    if exists (
      select 1 from leads l where l.id = v_lead_id and l.status = 'encaisse'
    ) then
      select next_doc_num('finale', 2026) into v_finale_num;
      insert into documents (type, num, status, lead_id, entity_id, activity_id,
        issued_at, payment_term_id, total_ht, total_vat, total_ttc,
        acompte_deduit, solde_du, paid_at, created_at, updated_at)
      select 'finale'::document_type, v_finale_num, 'paye'::document_status,
        l.id, v_entity_default, l.activity_id,
        l.received_at + interval '30 days',
        v_pt_30j,
        coalesce(l.estimated_amount, 1000) * 0.83,
        coalesce(l.estimated_amount, 1000) * 0.17,
        coalesce(l.estimated_amount, 1000),
        case l.sub_signature when 'avec' then coalesce(l.estimated_amount, 1000) * 0.30 else null end,
        case l.sub_signature when 'avec' then coalesce(l.estimated_amount, 1000) * 0.70 else coalesce(l.estimated_amount, 1000) end,
        l.received_at + interval '40 days',
        l.received_at + interval '30 days', now()
      from leads l where l.id = v_lead_id;
    end if;
  end loop;

  -- ── Dossiers for signed + encaissé leads (with technician assignment) ─
  insert into dossiers (lead_id, status, payment_status, technician_id, planned_at, duration_hours, notes, created_at, updated_at)
  select
    l.id,
    case l.status
      when 'signe' then case when random() < 0.5 then 'planifie'::dossier_status else 'a_planifier'::dossier_status end
      when 'encaisse' then case when random() < 0.7 then 'solde'::dossier_status else 'finalise'::dossier_status end
    end,
    case l.status
      when 'signe' then case when l.sub_signature = 'avec' then 'acompte_paye'::payment_status else 'en_attente'::payment_status end
      when 'encaisse' then 'solde'::payment_status
    end,
    -- Pick a technician matching the sector if possible — Aïcha for nettoyage/urgence, Vincent for renovation/enr.
    case
      when l.activity_id in (v_nettoyage, v_urgence) then v_tech_aicha
      else v_tech_vincent
    end,
    case
      when l.status = 'signe' and random() < 0.5 then now() + interval '5 days'
      when l.status = 'encaisse' then l.received_at + interval '21 days'
      else null
    end,
    case l.activity_id
      when v_renovation then 24.0
      when v_enr then 16.0
      when v_nettoyage then 4.0
      when v_urgence then 2.0
    end,
    l.notes,
    l.received_at + interval '14 days', now()
  from leads l
  where l.short_id like 'L-2%'
    and l.status in ('signe', 'encaisse');

  raise notice 'Bulk demo data inserted: 25 leads (L-2001..L-2042), associated documents, and dossiers.';
end $$;
