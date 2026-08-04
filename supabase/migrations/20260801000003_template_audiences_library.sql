-- Template library + role scoping (spec 2026-08-02).
--   1. `audiences text[]` on message_templates — who sees each template. Empty
--      = global. Slugs map profils/roles via userTemplateAudiences() (TS).
--   2. Richer category taxonomy (devis/facture/info/photos/confirmation/
--      planification/relance/administratif/autre) — remap the old set first.
--   3. Seed the full Optimivv library (emails + SMS), role-scoped, idempotent
--      by name.

-- ── 1. Audiences column ──────────────────────────────────────────────────
alter table message_templates add column if not exists audiences text[] not null default '{}';

-- ── 2. Category remap + widened CHECK ────────────────────────────────────
-- Drop the OLD constraint first — otherwise remapping to a new value (e.g.
-- 'photos') violates the pre-existing narrow CHECK before we can widen it.
alter table message_templates drop constraint if exists message_templates_category_check;

update message_templates set category = 'photos'  where category = 'decouverte';
update message_templates set category = 'facture' where category = 'apres_vente';

alter table message_templates add constraint message_templates_category_check
  check (category in ('devis','facture','info','photos','confirmation','planification','relance','administratif','autre'));

-- Relances existantes → réservées à l'émission d'appels.
update message_templates set audiences = '{emission}'
  where name in ('Relance devis (SMS)', 'Relance devis (email)') and audiences = '{}';

-- ── 3. Seed the library (idempotent per name) ────────────────────────────
insert into message_templates (channel, category, name, subject, body, audiences)
select v.channel, v.category, v.name, v.subject, v.body, v.audiences::text[]
from (values
  -- ── Emails · Devis ─────────────────────────────────────────────────────
  ('email', 'devis', 'Mail devis — virement (Nettoyage)',
   'Votre devis nettoyage — {societe.nom}',
   E'Bonjour {client.prenom},\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de nettoyage demandée.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.\n\nDès réception du devis signé ainsi que du règlement, nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{entrant,emission,divers}'),

  ('email', 'devis', 'Mail devis — virement (Débarras)',
   'Votre devis débarras — {societe.nom}',
   E'Bonjour {client.prenom},\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de débarras demandée.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.\n\nDès réception du devis signé ainsi que du règlement, nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{entrant,emission,debarras}'),

  ('email', 'devis', 'Mail devis — virement avec acompte (Nettoyage)',
   'Votre devis nettoyage — {societe.nom}',
   E'Bonjour {client.prenom},\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de nettoyage demandée.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement de l''acompte de 50 % du montant de la prestation ({montant.acompte}).\n\nDès réception du devis signé ainsi que du règlement de l''acompte, nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{entrant,emission,divers}'),

  ('email', 'devis', 'Mail devis — virement avec acompte (Débarras)',
   'Votre devis débarras — {societe.nom}',
   E'Bonjour {client.prenom},\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de débarras demandée.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement de l''acompte de 50 % du montant de la prestation ({montant.acompte}).\n\nDès réception du devis signé ainsi que du règlement de l''acompte, nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{entrant,emission,debarras}'),

  ('email', 'devis', 'Mail devis urgent — 100 % prépaiement (Nettoyage)',
   'Votre devis nettoyage (urgent) — {societe.nom}',
   E'Bonjour {client.prenom},\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint, comme convenu, le devis relatif à la prestation de nettoyage.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.\n\nAfin de permettre une planification rapide de cette intervention, nous vous remercions d''effectuer un virement instantané dès réception du présent mail.\n\nDès réception du devis signé ainsi que du règlement, nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire prévu.\n\nÀ titre exceptionnel, compte tenu du caractère urgent de votre demande, nous sommes en mesure de vous proposer une intervention le {intervention.date}.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{entrant,emission,divers}'),

  ('email', 'devis', 'Mail devis urgent — 100 % prépaiement (Débarras)',
   'Votre devis débarras (urgent) — {societe.nom}',
   E'Bonjour {client.prenom},\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint, comme convenu, le devis relatif à la prestation de débarras.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.\n\nAfin de permettre une planification rapide de cette intervention demandée en urgence, nous vous remercions d''effectuer un virement instantané dès réception du présent mail.\n\nDès réception du devis signé ainsi que du règlement, nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire prévu.\n\nÀ titre exceptionnel, compte tenu du caractère urgent de votre demande, nous sommes en mesure de vous proposer une intervention le {intervention.date}.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{entrant,emission,debarras}'),

  -- ── Emails · Demandes d''informations ──────────────────────────────────
  ('email', 'info', 'Mail demande d''informations (Nettoyage)',
   'Informations pour votre devis nettoyage',
   E'Bonjour {client.prenom},\n\nAfin de pouvoir établir votre devis, pourriez-vous me communiquer les informations suivantes :\n\n- Le logement est-il meublé ou non meublé ?\n- Quel est le type de revêtement de sol (carrelage, parquet, moquette, PVC, etc.) ?\n- Y a-t-il des espaces extérieurs à nettoyer (terrasse, balcon, jardin, cour, etc.) ?\n- Au nom de qui souhaitez-vous que le devis soit établi ?\n- Pouvez-vous également me confirmer l''adresse exacte d''intervention à faire figurer sur le devis ?\n\nDès réception de ces éléments, je pourrai vous transmettre votre devis dans les meilleurs délais.\n\nDans l''attente de votre retour.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{entrant,emission,divers}'),

  ('email', 'info', 'Mail demande d''informations (Débarras)',
   'Informations pour votre devis débarras',
   E'Bonjour {client.prenom},\n\nAfin de pouvoir établir votre devis de débarras, pourriez-vous me communiquer les informations suivantes :\n\n- Le logement est-il meublé ou vide ?\n- Souhaitez-vous un débarras complet ou uniquement de certaines pièces ou de certains éléments ?\n- Y a-t-il des objets particulièrement volumineux ou lourds à évacuer (piano, coffre-fort, électroménager, etc.) ?\n- Le logement est-il situé en maison ou en appartement ? Si appartement, à quel étage et avec ou sans ascenseur ?\n- Les accès permettent-ils le stationnement d''un camion à proximité ?\n- Y a-t-il une cave, un grenier, un garage ou des dépendances à débarrasser ?\n- Souhaitez-vous conserver certains meubles ou objets sur place ?\n- Au nom de qui souhaitez-vous que le devis soit établi ?\n- Pouvez-vous également me confirmer l''adresse exacte d''intervention à faire figurer sur le devis ?\n\nDès réception de ces éléments, je pourrai vous transmettre votre devis dans les meilleurs délais.\n\nDans l''attente de votre retour.\n\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{debarras}'),

  -- ── Emails · Planification (planificatrice) ────────────────────────────
  ('email', 'confirmation', 'Mail confirmation d''intervention',
   'Confirmation de votre intervention',
   E'Bonjour {client.prenom},\n\nNous vous confirmons notre intervention conformément au devis signé.\n\nDate d''intervention : {intervention.date}\nHeure d''intervention : {intervention.heure}\n\nNotre équipe se présentera à l''adresse convenue afin de réaliser la prestation prévue.\n\nNous vous remercions de veiller à ce que les accès nécessaires soient disponibles le jour de l''intervention.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}'),

  ('email', 'planification', 'Mail proposition de créneaux',
   'Proposition de créneaux d''intervention',
   E'Bonjour {client.prenom},\n\nSuite à la signature de votre devis, nous vous proposons les créneaux suivants pour la réalisation de votre prestation :\n\nCréneau 1 : {intervention.creneau}\nCréneau 2 :\nCréneau 3 :\n\nMerci de nous indiquer le créneau qui vous convient le mieux.\n\nDès réception de votre choix, nous vous adresserons une confirmation définitive de l''intervention.\n\nNous restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}'),

  -- ── Emails · Factures ──────────────────────────────────────────────────
  ('email', 'facture', 'Mail facture finale',
   'Votre facture — {societe.nom}',
   E'Bonjour {client.prenom},\n\nVeuillez trouver en pièce jointe votre facture relative à la prestation réalisée.\n\nNous vous remercions pour la confiance que vous nous avez accordée et restons à votre disposition pour toute question.\n\nNous vous souhaitons une excellente journée.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{entrant,emission,diogene,planification,comptabilite}'),

  ('email', 'facture', 'Mail facture d''acompte',
   'Votre facture d''acompte — {societe.nom}',
   E'Bonjour {client.prenom},\n\nVeuillez trouver en pièce jointe votre facture d''acompte.\n\nNous vous remercions pour votre confiance et restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{entrant,emission,diogene,planification,comptabilite}'),

  -- ── SMS · Relances (émission d''appels uniquement) ─────────────────────
  ('sms', 'relance', 'SMS relance — décision devis', null,
   E'Bonjour {client.prenom}, je reviens vers vous concernant le devis transmis. Avez-vous pu prendre une décision ? Cela me permettra d''organiser mon planning en amont. Merci par avance pour votre retour. — {commercial.nom}',
   '{emission}'),

  ('sms', 'relance', 'SMS relance — NRP (non joignable)', null,
   E'Bonjour {client.prenom}, vous m''avez formulé une demande pour une prestation. Je suis bien disponible : merci de me recontacter afin que je puisse prendre vos informations et planifier un rendez-vous. — {commercial.nom}',
   '{emission}'),

  -- ── SMS · Demandes de photos ───────────────────────────────────────────
  ('sms', 'photos', 'SMS demande de photos (Nettoyage)', null,
   E'Bonjour {client.prenom}, dans la continuité de notre échange, merci de m''envoyer par email (devis@optimivv-nettoyage.com) les photos des surfaces et éléments à nettoyer, en précisant vos nom, prénom et adresse pour l''établissement du devis. — {commercial.nom}',
   '{entrant,emission,divers}'),

  ('sms', 'photos', 'SMS demande de photos (Débarras)', null,
   E'Bonjour {client.prenom}, dans la continuité de notre échange, merci de m''envoyer par email (devis@optimivv-nettoyage.com) les photos des éléments à évacuer, en précisant vos nom, prénom et adresse pour l''établissement du devis. — {commercial.nom}',
   '{debarras}'),

  -- ── SMS · Confirmations ────────────────────────────────────────────────
  ('sms', 'confirmation', 'SMS confirmation devis envoyé (Nettoyage)', null,
   E'Bonjour {client.prenom}, suite à notre entretien je vous ai transmis le devis concernant votre nettoyage. Pouvez-vous me confirmer sa bonne réception ? Je reste à votre disposition pour toute question. — {commercial.nom}',
   '{entrant,emission,divers}'),

  ('sms', 'confirmation', 'SMS confirmation devis envoyé (Débarras)', null,
   E'Bonjour {client.prenom}, suite à notre entretien je vous ai transmis le devis concernant votre débarras. Pouvez-vous me confirmer sa bonne réception ? Je reste à votre disposition pour toute question. — {commercial.nom}',
   '{entrant,emission,debarras}')
) as v(channel, category, name, subject, body, audiences)
where not exists (
  select 1 from message_templates mt where mt.name = v.name
);
