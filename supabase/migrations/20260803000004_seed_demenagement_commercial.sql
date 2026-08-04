-- Bibliothèque « Commercial Déménagement → Client » (client 2026-08-03).
-- Rubriques dans l'ordre : Découverte (email + SMS), Devis, Suivi commercial,
-- Transmission (interne → planificatrice). Audience = demenagement.
-- Idempotent par nom.

insert into message_templates (channel, category, name, subject, body, audiences, recipient, sort_order)
select v.channel, v.category, v.name, v.subject, v.body, v.audiences::text[], v.recipient, v.sort_order
from (values
  -- ── Découverte ─────────────────────────────────────────────────────────
  ('email', 'decouverte', 'Déménagement — Découverte : informations devis',
   'Informations pour votre devis de déménagement',
   E'Bonjour,\n\nAfin d''établir votre devis de déménagement, pourriez-vous nous communiquer les informations suivantes :\n\n- L''adresse complète de départ ;\n- L''adresse complète d''arrivée ;\n- Le volume estimé à déménager (en m³), si vous le connaissez ;\n- Quelques photos ou une vidéo de l''ensemble des biens à déménager.\n\nSi vous ne connaissez pas le volume, aucun problème. Les photos ou la vidéo nous permettront de l''estimer avec précision.\n\nVous pouvez répondre directement à ce mail en joignant les éléments demandés.\n\nDès réception de ces informations, nous établirons votre devis dans les meilleurs délais.\n\nNous restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Déménagement\nVotre nouveau départ commence ici !',
   '{demenagement}', 'client', 1),

  ('sms', 'decouverte', 'Déménagement — Découverte (SMS après appel)', null,
   E'Bonjour,\n\nSuite à notre échange téléphonique, afin d''établir votre devis de déménagement, merci de nous transmettre par e-mail à devis@optimivv-nettoyage.com :\n- Les adresses complètes de départ et d''arrivée ;\n- L''étage de départ et d''arrivée (avec ou sans ascenseur) ;\n- Quelques photos ou une vidéo de l''ensemble des biens à déménager ;\n- Si vous le connaissez, le volume estimé (en m³).\n\nSi vous ne connaissez pas le volume, aucun problème, nous l''estimerons à partir des photos ou de la vidéo.\n\nMerci également de préciser dans votre e-mail vos nom, prénom et coordonnées.\n\nÀ réception de ces éléments, nous établirons votre devis dans les meilleurs délais.\n\nCordialement,\nL''équipe Optimivv Déménagement',
   '{demenagement}', 'client', 1),

  ('email', 'decouverte', 'Déménagement — Découverte : infos complémentaires',
   'Informations complémentaires pour votre devis de déménagement',
   E'Bonjour,\n\nAfin de finaliser votre devis de déménagement, pourriez-vous également nous communiquer les informations suivantes :\n\nConditions d''accès :\n- Le logement de départ est-il situé en maison ou en appartement ?\n- Le logement d''arrivée est-il situé en maison ou en appartement ?\n- À quel étage se situent les logements ?\n- Un ascenseur est-il disponible ?\n- Le stationnement est-il possible à proximité des deux adresses ?\n- Existe-t-il des contraintes particulières d''accès (portage important, cour intérieure, zone piétonne, hauteur limitée, etc.) ?\n\nMobilier et objets particuliers :\n- Y a-t-il des objets lourds ou volumineux à déménager (piano, coffre-fort, billard, électroménager américain, etc.) ?\n- Souhaitez-vous que certains meubles soient démontés puis remontés ?\n- Y a-t-il des objets fragiles nécessitant une attention particulière ?\n\nPrestations complémentaires :\n- Souhaitez-vous une prestation d''emballage et/ou de déballage ?\n- Avez-vous besoin de cartons ou de matériel de protection ?\n- Avez-vous également besoin d''une prestation de débarras ou de nettoyage ?\n\nCes informations nous permettront d''établir un devis précis et parfaitement adapté à votre projet.\n\nNous vous remercions par avance pour votre retour et restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Déménagement\nVotre nouveau départ commence ici !',
   '{demenagement}', 'client', 2),

  -- ── Devis ──────────────────────────────────────────────────────────────
  ('email', 'devis', 'Déménagement — Devis + demande d''acompte',
   'Votre devis de déménagement',
   E'Bonjour,\n\nSuite à nos échanges, veuillez trouver ci-joint votre devis de déménagement.\n\nCe devis a été établi sur la base des informations et des éléments que vous nous avez communiqués.\n\nNous vous invitons à en prendre connaissance attentivement. Si vous souhaitez des précisions sur une prestation, une option ou un montant, notre équipe se tient à votre entière disposition pour répondre à vos questions et vous apporter toutes les explications nécessaires.\n\nAfin de valider définitivement votre réservation, nous vous remercions de bien vouloir nous retourner le devis signé.\n\nConformément aux modalités convenues, votre dossier sera définitivement validé à réception du devis signé ainsi que du règlement prévu (acompte ou prépaiement).\n\nDès réception de ces éléments, notre planificatrice prendra contact avec vous afin d''organiser votre déménagement et de vous communiquer la date ainsi que le créneau d''intervention.\n\nSi certains éléments de votre projet évoluent (volume, adresses, accès, prestations complémentaires, etc.), nous pourrons mettre à jour votre devis afin qu''il corresponde parfaitement à votre besoin.\n\nNous restons à votre disposition et vous remercions de la confiance que vous accordez à Optimivv Déménagement.\n\nBien professionnellement,\nL''équipe Optimivv Déménagement\nVotre nouveau départ commence ici !',
   '{demenagement}', 'client', 1),

  ('email', 'devis', 'Déménagement — Modification / mise à jour du devis',
   'Mise à jour de votre devis de déménagement',
   E'Bonjour,\n\nSuite à nos derniers échanges et aux informations complémentaires que vous nous avez communiquées, nous vous adressons en pièce jointe une version mise à jour de votre devis de déménagement.\n\nCette nouvelle version remplace et annule la précédente.\n\nNous vous invitons à en prendre connaissance. Si vous souhaitez une nouvelle modification ou des précisions sur son contenu, notre équipe reste à votre entière disposition.\n\nDans l''attente de votre retour, nous vous remercions de la confiance que vous accordez à Optimivv Déménagement.\n\nBien professionnellement,\nL''équipe Optimivv Déménagement\nVotre nouveau départ commence ici !',
   '{demenagement}', 'client', 2),

  ('email', 'devis', 'Déménagement — Confirmation de réception de l''acompte',
   'Confirmation de réception de votre acompte',
   E'Bonjour,\n\nNous vous confirmons avoir bien reçu votre acompte.\n\nNous vous remercions pour votre confiance.\n\nVotre dossier est désormais validé et transmis à notre service planification, qui prendra prochainement contact avec vous afin d''organiser votre déménagement et de vous communiquer la date ainsi que le créneau de votre intervention.\n\nSi vous avez la moindre question d''ici là, notre équipe reste à votre entière disposition.\n\nBien professionnellement,\nL''équipe Optimivv Déménagement\nVotre nouveau départ commence ici !',
   '{demenagement}', 'client', 3),

  -- ── Suivi commercial ───────────────────────────────────────────────────
  ('email', 'suivi_commercial', 'Déménagement — Relance J+2',
   'Votre devis de déménagement',
   E'Bonjour,\n\nJe me permets de revenir vers vous concernant le devis de déménagement que nous vous avons transmis il y a quelques jours.\n\nAvez-vous eu l''occasion d''en prendre connaissance ?\n\nSi vous avez des questions ou souhaitez des précisions sur une prestation, je reste à votre entière disposition pour y répondre.\n\nSi votre projet est validé, il vous suffit de nous retourner le devis signé accompagné du règlement convenu afin que nous puissions transmettre votre dossier à notre planificatrice et organiser votre intervention.\n\nDans l''attente de votre retour, je vous remercie de votre confiance.\n\nBien professionnellement,\nL''équipe Optimivv Déménagement\nVotre nouveau départ commence ici !',
   '{demenagement}', 'client', 1),

  ('email', 'suivi_commercial', 'Déménagement — Relance J+7',
   'Votre devis de déménagement',
   E'Bonjour,\n\nNous revenons vers vous concernant le devis de déménagement que nous vous avons adressé.\n\nNous souhaitions savoir si vous aviez pu l''étudier et si vous aviez pris une décision concernant votre projet.\n\nSi vous souhaitez des précisions, une modification du devis ou échanger sur votre déménagement, nous restons entièrement à votre disposition.\n\nSi vous souhaitez confirmer votre réservation, il vous suffit de nous retourner le devis signé accompagné du règlement convenu afin que nous puissions planifier votre intervention.\n\nDans l''attente de votre retour, nous vous remercions pour votre confiance.\n\nBien professionnellement,\nL''équipe Optimivv Déménagement\nVotre nouveau départ commence ici !',
   '{demenagement}', 'client', 2),

  ('email', 'suivi_commercial', 'Déménagement — Dernière relance',
   'Votre devis de déménagement',
   E'Bonjour,\n\nSauf erreur de notre part, nous sommes toujours dans l''attente de votre retour concernant le devis de déménagement que nous vous avons transmis.\n\nAvant de clôturer votre dossier, nous souhaitions savoir si votre projet est toujours d''actualité.\n\nSi vous souhaitez maintenir votre demande, nous vous invitons à nous en informer afin que nous puissions vérifier nos disponibilités et poursuivre la planification de votre déménagement.\n\nÀ défaut de retour de votre part, votre dossier sera classé, mais nous resterons bien entendu à votre disposition si vous souhaitez reprendre votre projet ultérieurement.\n\nNous vous remercions pour le temps accordé à notre étude et restons à votre disposition.\n\nBien professionnellement,\nL''équipe Optimivv Déménagement\nVotre nouveau départ commence ici !',
   '{demenagement}', 'client', 3),

  -- ── Transmission (interne → planificatrice) ────────────────────────────
  ('email', 'transmission', 'Déménagement — Transmission du dossier à la planificatrice',
   'Transmission de dossier — {client.nom_complet}',
   E'Bonjour,\n\nJe te transmets le dossier suivant pour planification.\n\nClient : {client.nom_complet}\nType de prestation : Déménagement\n\nLe client a validé son devis et les éléments nécessaires à la planification ont été recueillis.\n\nLe dossier comprend notamment :\n- Le devis signé ;\n- Le règlement convenu (acompte ou prépaiement) ;\n- Les adresses de départ et d''arrivée ;\n- Les photos et/ou vidéos ;\n- Les informations relatives au volume estimé ;\n- Les conditions d''accès ;\n- Les prestations complémentaires convenues.\n\nMerci de prendre en charge la planification de cette intervention et de contacter le client afin de fixer la date et le créneau.\n\nBien professionnellement,\nLe service commercial\nOptimivv Déménagement',
   '{demenagement}', 'interne', 1),

  ('email', 'transmission', 'Déménagement — Dossier incomplet',
   'Dossier {client.nom_complet} — éléments manquants',
   E'Bonjour,\n\nJe te transmets le dossier suivant.\n\nClient : {client.nom_complet}\nType de prestation : Déménagement\n\nLe dossier ne peut pas encore être planifié, certains éléments étant en attente.\n\nÉléments manquants :\n- {Élément 1}\n- {Élément 2}\n- {Élément 3}\n\nLes éléments déjà disponibles ont été ajoutés au dossier (photos, vidéos, devis, échanges, etc.).\n\nJe poursuis le suivi avec le client afin d''obtenir les informations manquantes et je te transmettrai le dossier complet dès réception.\n\nBien professionnellement,\nLe service commercial\nOptimivv Déménagement',
   '{demenagement}', 'interne', 2),

  ('email', 'transmission', 'Déménagement — Dossier complet',
   'Dossier {client.nom_complet} — complet et prêt à planifier',
   E'Bonjour,\n\nJe te confirme que le dossier ci-dessous est désormais complet et prêt à être planifié.\n\nClient : {client.nom_complet}\nType de prestation : Déménagement\n\nL''ensemble des éléments nécessaires a été recueilli et vérifié, notamment :\n- Devis signé ;\n- Règlement reçu conformément aux modalités convenues ;\n- Adresses de départ et d''arrivée ;\n- Photos et/ou vidéos ;\n- Volume estimé ;\n- Conditions d''accès ;\n- Prestations complémentaires validées ;\n- Coordonnées du client.\n\nTu peux désormais prendre en charge la planification de cette intervention et contacter le client afin de convenir de la date et du créneau.\n\nBien professionnellement,\nLe service commercial\nOptimivv Déménagement',
   '{demenagement}', 'interne', 3)
) as v(channel, category, name, subject, body, audiences, recipient, sort_order)
where not exists (select 1 from message_templates mt where mt.name = v.name);
