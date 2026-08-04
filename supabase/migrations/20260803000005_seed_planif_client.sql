-- Bibliothèque « Planificatrice -> Client » (client 2026-08-03).
-- Rubriques : Planification, Préparation de l'intervention, Paiement, Clôture.
-- Audience = planification. Idempotent par nom.

-- 1) Recategoriser/ordonner les modèles existants dans les bonnes rubriques.
update message_templates set category = 'planification', recipient = 'client', sort_order = 1
  where name = 'Mail proposition de créneaux';
update message_templates set category = 'planification', recipient = 'client', sort_order = 2
  where name = 'Mail confirmation d''intervention';
update message_templates set category = 'paiement', recipient = 'client', sort_order = 2
  where name = 'Mail facture d''acompte';
update message_templates set category = 'paiement', recipient = 'client', sort_order = 3
  where name = 'Mail facture finale';

-- 2) Nouveaux modèles.
insert into message_templates (channel, category, name, subject, body, audiences, recipient, sort_order)
select v.channel, v.category, v.name, v.subject, v.body, v.audiences::text[], v.recipient, v.sort_order
from (values
  -- ── Planification (suite : 1-2 déjà existants) ─────────────────────────
  ('email', 'planification', 'Planif — Modification du créneau',
   'Modification de votre créneau d''intervention',
   E'Bonjour,\n\nNous vous informons qu''une modification a été apportée au créneau de votre intervention.\n\nNouvelle date : {intervention.date}\nNouvel horaire : {intervention.heure}\n\nL''ensemble des autres informations relatives à votre intervention demeure inchangé.\n\nNous vous remercions de bien vouloir nous confirmer par retour de mail que ce nouveau créneau vous convient.\n\nNous restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 3),

  ('email', 'planification', 'Planif — Report d''intervention',
   'Report de votre intervention',
   E'Bonjour,\n\nPour des raisons d''organisation, nous sommes contraints de reporter votre intervention initialement prévue.\n\nNous vous présentons nos excuses pour ce contretemps.\n\nNous vous proposerons dans les plus brefs délais un ou plusieurs nouveaux créneaux afin de reprogrammer votre prestation dans les meilleures conditions.\n\nNotre équipe reste à votre disposition pour toute question et met tout en œuvre pour intervenir dans les meilleurs délais.\n\nNous vous remercions de votre compréhension.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 4),

  ('email', 'planification', 'Planif — Annulation d''intervention',
   'Annulation de votre intervention',
   E'Bonjour,\n\nNous vous confirmons l''annulation de votre intervention.\n\nSi cette annulation est à votre demande, nous vous remercions de nous l''avoir signalée.\n\nSi vous souhaitez reprogrammer votre prestation à une date ultérieure, nous vous invitons à nous contacter. Nous conviendrons ensemble d''un nouveau créneau selon nos disponibilités.\n\nNous restons à votre entière disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 5),

  ('email', 'planification', 'Planif — Rappel avant intervention',
   'Rappel — votre intervention approche',
   E'Bonjour,\n\nNous vous rappelons que votre intervention est programmée :\n\n📅 Date : {intervention.date}\n🕒 Heure : {intervention.heure}\n\nAfin de permettre le bon déroulement de la prestation, nous vous remercions de veiller à ce que les accès soient libres et accessibles à notre équipe à son arrivée.\n\nSi vous constatez un changement de situation ou si vous rencontrez une difficulté, merci de nous en informer dès que possible.\n\nNous vous remercions pour votre confiance et restons à votre disposition.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 6),

  ('email', 'planification', 'Planif — Équipe en route',
   'Notre équipe est en route',
   E'Bonjour,\n\nNous vous informons que notre équipe est actuellement en route vers votre adresse afin de réaliser la prestation prévue.\n\nNous vous remercions de veiller à ce que les accès soient disponibles à son arrivée.\n\nEn cas de difficulté ou d''imprévu, n''hésitez pas à nous contacter.\n\nNous vous remercions pour votre confiance et vous souhaitons une excellente journée.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 7),

  -- ── Préparation de l'intervention ──────────────────────────────────────
  ('email', 'preparation', 'Planif — Demande des conditions d''accès',
   'Conditions d''accès pour votre intervention',
   E'Bonjour,\n\nAfin de préparer votre intervention dans les meilleures conditions, pourriez-vous nous communiquer les informations suivantes :\n\n- Le logement est-il situé en maison ou en appartement ?\n- À quel étage se situe le logement ?\n- Un ascenseur est-il disponible et utilisable ?\n- Un code d''accès, un badge ou un digicode est-il nécessaire ?\n- Un stationnement est-il possible à proximité de l''adresse d''intervention ?\n- Existe-t-il des contraintes particulières d''accès (cour intérieure, portail, hauteur limitée, zone piétonne, etc.) ?\n- Une présence sur place est-elle prévue lors de notre intervention ?\n\nCes informations nous permettront d''organiser notre intervention et de prévoir les moyens adaptés.\n\nNous vous remercions par avance pour votre retour.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 1),

  ('email', 'preparation', 'Planif — Demande de photos/vidéos complémentaires',
   'Photos ou vidéos complémentaires',
   E'Bonjour,\n\nAfin de finaliser la préparation de votre intervention, nous aurions besoin de quelques photos ou vidéos complémentaires.\n\nCes éléments nous permettront de confirmer les moyens humains, le matériel à prévoir et l''organisation de notre intervention.\n\nVous pouvez nous les transmettre en répondant directement à ce mail.\n\nNous vous remercions également de préciser, si nécessaire, tout élément qui ne serait pas visible sur les photos ou vidéos (accès, contraintes particulières, mobilier spécifique, objets fragiles, etc.).\n\nDès réception de ces éléments, nous finaliserons la planification de votre intervention.\n\nNous vous remercions par avance pour votre retour.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 2),

  ('email', 'preparation', 'Planif — Demande de documents complémentaires',
   'Documents complémentaires nécessaires',
   E'Bonjour,\n\nAfin de finaliser votre dossier et de préparer votre intervention dans les meilleures conditions, nous vous remercions de bien vouloir nous transmettre les documents suivants :\n\n- {Document 1}\n- {Document 2}\n- {Document 3}\n\nVous pouvez répondre directement à ce mail en joignant les documents demandés.\n\nDès réception de ces éléments, nous poursuivrons la planification de votre intervention.\n\nSi vous avez la moindre question concernant les documents à fournir, notre équipe reste à votre disposition.\n\nNous vous remercions par avance pour votre retour.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 3),

  ('email', 'preparation', 'Planif — Confirmation de réception des documents',
   'Bonne réception de vos documents',
   E'Bonjour,\n\nNous vous confirmons avoir bien reçu les documents que vous nous avez transmis.\n\nNous vous remercions pour votre réactivité.\n\nVotre dossier est désormais mis à jour et nous poursuivons la préparation de votre intervention.\n\nSi des informations ou documents complémentaires s''avéraient nécessaires, nous ne manquerions pas de revenir vers vous.\n\nNous restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 4),

  ('email', 'preparation', 'Planif — Confirmation de l''autorisation d''intervention',
   'Confirmation de votre autorisation d''intervention',
   E'Bonjour,\n\nNous vous remercions pour votre confirmation écrite.\n\nNous prenons acte de votre autorisation de réaliser l''intervention conformément à votre demande.\n\nLe cas échéant, nous prenons également note de votre confirmation que les constatations des autorités compétentes ont bien été effectuées avant notre intervention.\n\nVotre dossier est désormais complet et notre équipe interviendra selon les modalités convenues.\n\nNous vous remercions pour votre confiance et restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 5),

  -- ── Paiement (2-3 = factures existantes recategorisées) ────────────────
  ('email', 'paiement', 'Planif — Envoi du RIB',
   'Notre RIB pour le règlement',
   E'Bonjour,\n\nVeuillez trouver en pièce jointe notre relevé d''identité bancaire (RIB) pour le règlement de votre prestation.\n\nNous vous remercions de bien vouloir effectuer le virement selon les modalités convenues.\n\nDès réception de votre règlement, nous poursuivrons le traitement de votre dossier et, le cas échéant, la confirmation de votre intervention.\n\nSi vous avez la moindre question concernant le règlement, notre équipe reste à votre disposition.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 1),

  ('email', 'paiement', 'Planif — Relance de paiement',
   'Règlement de votre prestation',
   E'Bonjour,\n\nSauf erreur de notre part, nous sommes toujours dans l''attente du règlement convenu concernant votre prestation.\n\nNous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais afin de permettre la poursuite de votre dossier et, le cas échéant, la confirmation ou le maintien de votre intervention.\n\nSi votre règlement a déjà été effectué, nous vous remercions de ne pas tenir compte du présent message.\n\nPour toute question relative à votre règlement, notre équipe reste à votre entière disposition.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 4),

  ('email', 'paiement', 'Planif — Confirmation de réception du paiement',
   'Confirmation de réception de votre règlement',
   E'Bonjour,\n\nNous vous confirmons avoir bien reçu votre règlement.\n\nNous vous remercions pour votre réactivité et la confiance que vous nous accordez.\n\nVotre dossier est désormais à jour. Le cas échéant, notre planificatrice poursuivra l''organisation de votre intervention conformément aux modalités convenues.\n\nNous restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 5),

  ('email', 'paiement', 'Planif — Facture acquittée',
   'Votre facture acquittée',
   E'Bonjour,\n\nVeuillez trouver en pièce jointe votre facture acquittée, attestant du règlement intégral de votre prestation.\n\nNous vous remercions sincèrement pour la confiance que vous nous avez accordée.\n\nNous espérons avoir répondu à vos attentes et restons à votre disposition pour toute future demande.\n\nNous vous souhaitons une excellente journée.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 6),

  -- ── Clôture ────────────────────────────────────────────────────────────
  ('email', 'cloture', 'Planif — Demande d''avis client',
   'Votre avis nous intéresse',
   E'Bonjour,\n\nNous espérons que notre intervention vous a apporté entière satisfaction.\n\nVotre retour d''expérience est précieux et nous permet d''améliorer continuellement la qualité de nos prestations.\n\nSi vous avez quelques instants, nous vous serions reconnaissants de bien vouloir nous faire part de votre avis sur votre expérience avec Optimivv Nettoyage.\n\nNous vous remercions sincèrement pour votre confiance et espérons avoir le plaisir de vous accompagner à nouveau pour de futurs besoins.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   '{planification}', 'client', 1)
) as v(channel, category, name, subject, body, audiences, recipient, sort_order)
where not exists (select 1 from message_templates mt where mt.name = v.name);
