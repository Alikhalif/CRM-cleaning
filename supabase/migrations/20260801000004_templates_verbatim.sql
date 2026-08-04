-- Restore the EXACT source wording for the seeded library (client: « use the
-- same 100 % »). Overwrites the paraphrased bodies from 003 with the verbatim
-- text — no CRM variables injected into the content, source quirks preserved
-- (e.g. the "nettoyage" devis mail that mentions "débarras", the "David"
-- signatures, the "[Date]"/"[Heure]" placeholders). Matched by name; idempotent.

-- ── Emails · Devis ─────────────────────────────────────────────────────────
update message_templates set body = E'Bonjour\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de débarras demandée.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.\n\nDès réception du devis signé ainsi que du règlement du devis nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail devis — virement (Nettoyage)';

update message_templates set body = E'Bonjour\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de débarras demandée.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.\n\nDès réception du devis signé ainsi que du règlement du devis nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail devis — virement (Débarras)';

update message_templates set body = E'Bonjour\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de nettoyage demandée.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement de l''acompte de 50 % du montant de la prestation.\n\nDès réception du devis signé ainsi que du règlement de l''acompte de 50 %, nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail devis — virement avec acompte (Nettoyage)';

update message_templates set body = E'Bonjour\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de débarras demandée.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement de l''acompte de 50 % du montant de la prestation.\n\nDès réception du devis signé ainsi que du règlement de l''acompte de 50 %, nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail devis — virement avec acompte (Débarras)';

update message_templates set body = E'Bonjour\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint, comme convenu, le devis relatif à la prestation du nettoyage.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.\n\nAfin de permettre une planification rapide de cette intervention demandée, nous vous remercions d''effectuer un virement instantané dès réception du présent mail.\n\nDès réception du devis signé ainsi que du règlement de nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire prévu.\n\nÀ titre exceptionnel, compte tenu du caractère urgent de votre demande, nous sommes en mesure de vous proposer une intervention le ….\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail devis urgent — 100 % prépaiement (Nettoyage)';

update message_templates set body = E'Bonjour\n\nSuite à notre échange téléphonique, veuillez trouver ci-joint, comme convenu, le devis relatif à la prestation du débarras.\n\nVous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.\n\nAfin de permettre une planification rapide de cette intervention demandée en urgence, nous vous remercions d''effectuer un virement instantané dès réception du présent mail.\n\nDès réception du devis signé ainsi que du règlement de nous vous confirmerons par retour d''email la date d''intervention ainsi que le créneau horaire prévu.\n\nÀ titre exceptionnel, compte tenu du caractère urgent de votre demande, nous sommes en mesure de vous proposer une intervention le ….'
  where name = 'Mail devis urgent — 100 % prépaiement (Débarras)';

-- ── Emails · Demandes d''informations ──────────────────────────────────────
update message_templates set body = E'Bonjour,\n\nAfin de pouvoir établir votre devis, pourriez-vous me communiquer les informations suivantes :\n\n-Le logement est-il meublé ou non meublé ?\n\n-Quel est le type de revêtement de sol (carrelage, parquet, moquette, PVC, etc.) ?\n\n-Y a-t-il des espaces extérieurs à nettoyer (terrasse, balcon, jardin, cour, etc.) ?\n\n-Au nom de qui souhaitez-vous que le devis soit établi ?\n\n-Pouvez-vous également me confirmer l''adresse exacte d''intervention à faire figurer sur le devis ?\n\nDès réception de ces éléments, je pourrai vous transmettre votre devis dans les meilleurs délais.\n\nDans l''attente de votre retour.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail demande d''informations (Nettoyage)';

update message_templates set body = E'Afin de pouvoir établir votre devis de débarras, pourriez-vous me communiquer les informations suivantes :\n\nLe logement est-il meublé ou vide ?\n\nSouhaitez-vous un débarras complet ou uniquement de certaines pièces ou de certains éléments ?\nY a-t-il des objets particulièrement volumineux ou lourds à évacuer (piano, coffre-fort, électroménager, etc.) ?\nLe logement est-il situé en maison ou en appartement ? Si appartement, à quel étage et avec ou sans ascenseur ?\nLes accès permettent-ils le stationnement d''un camion à proximité ?\nY a-t-il une cave, un grenier, un garage ou des dépendances à débarrasser ?\nSouhaitez-vous conserver certains meubles ou objets sur place ?\nAu nom de qui souhaitez-vous que le devis soit établi ?\nPouvez-vous également me confirmer l''adresse exacte d''intervention à faire figurer sur le devis ?\n\nDès réception de ces éléments, je pourrai vous transmettre votre devis dans les meilleurs délais.\n\nDans l''attente de votre retour.\n\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail demande d''informations (Débarras)';

-- ── Emails · Planification ─────────────────────────────────────────────────
update message_templates set body = E'Bonjour ,\n\nNous vous confirmons notre intervention conformément au devis signé.\n\nDate d''intervention : [Date]\nHeure d''intervention : [Heure]\n\nNotre équipe se présentera à l''adresse convenue afin de réaliser la prestation prévue.\n\nNous vous remercions de veiller à ce que les accès nécessaires soient disponibles le jour de l''intervention.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail confirmation d''intervention';

update message_templates set body = E'Bonjour,\n\nSuite à la signature de votre devis, nous vous proposons les créneaux suivants pour la réalisation de votre prestation :\n\nCréneau 1 : [Date] à [Heure]\nCréneau 2 : [Date] à [Heure]\nCréneau 3 : [Date] à [Heure]\n\nMerci de nous indiquer le créneau qui vous convient le mieux.\n\nDès réception de votre choix, nous vous adresserons une confirmation définitive de l''intervention.\n\nNous restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail proposition de créneaux';

-- ── Emails · Factures ──────────────────────────────────────────────────────
update message_templates set body = E'Bonjour,\n\nVeuillez trouver en pièce jointe votre facture relative à la prestation réalisée.\n\nNous vous remercions pour la confiance que vous nous avez accordée et restons à votre disposition pour toute question.\n\nNous vous souhaitons une excellente journée.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail facture finale';

update message_templates set body = E'Bonjour,\n\nVeuillez trouver en pièce jointe votre facture d''acompte.\n\nNous vous remercions pour votre confiance et restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail facture d''acompte';

-- ── SMS · Relances ─────────────────────────────────────────────────────────
update message_templates set body = E'Bonjour Madame,\n\nJe reviens vers vous concernant le devis transmis.\n\nAvez-vous pu prendre une décision ?\n\nCela me permettra d''organiser mon planning en amont et d''éviter une organisation de dernière minute.\n\nMerci par avance pour votre retour\n\nBien cordialement'
  where name = 'SMS relance — décision devis';

update message_templates set body = E'Bonjour Mme\n\nVous m''avez formulé une demande pour un nettoyage.\n\nJe suis bien disponible.\n\nMerci de me recontacter afin que je puisse prendre vos informations et planifier avec vous un rendez-vous.\n\nCordialement\n\nDavid'
  where name = 'SMS relance — NRP (non joignable)';

-- ── SMS · Photos ───────────────────────────────────────────────────────────
update message_templates set body = E'dans la continuité de notre échange téléphonique vous trouverez ci joint mon email :\n\ndevis@optimivv-nettoyage.com\n\nMerci de m''envoyer par email les photos concernant les surfaces et éléments à nettoyer et préciser dans votre e-mail votre nom, prénom, adresse pour l''établissement du devis.\n\nCordialement\n\nDavid'
  where name = 'SMS demande de photos (Nettoyage)';

update message_templates set body = E'dans la continuité de notre échange téléphonique vous trouverez ci joint mon email :\n\ndevis@optimivv-nettoyage.com\n\nMerci de m''envoyer par email les photos concernant les surfaces et éléments à évacuer et préciser dans votre e-mail vos nom, prénom, adresse et pour l''établissement du devis.\n\nCordialement\n\nDavid'
  where name = 'SMS demande de photos (Débarras)';

-- ── SMS · Confirmations ────────────────────────────────────────────────────
update message_templates set body = E'Bonjour Mme\n\nSuite à notre entretien téléphonique je vous ai comme convenu transmis le devis concernant votre nettoyage\n\nPouvez-vous me confirmer la bonne réception du devis s''il vous plaît ?\n\nJe reste bien entendu à votre disposition pour toute question ou validation de votre part.\n\nCordialement'
  where name = 'SMS confirmation devis envoyé (Nettoyage)';

update message_templates set body = E'Bonjour Mme\n\nSuite à notre entretien téléphonique je vous ai comme convenu transmis le devis concernant votre débarras\n\nPouvez-vous me confirmer la bonne réception du devis s''il vous plaît ?\n\nJe reste bien entendu à votre disposition pour toute question ou validation de votre part.\n\nCordialement'
  where name = 'SMS confirmation devis envoyé (Débarras)';
