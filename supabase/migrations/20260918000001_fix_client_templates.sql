-- Recette 2026-09-18 · Correctif A05 (P1, client-facing)
--
-- La migration 20260801000004_templates_verbatim.sql avait écrasé deux
-- templates CLIENT de planification par du texte brut contenant des
-- littéraux « [Date] », « [Heure] » et une salutation vide « Bonjour , ».
-- renderTemplate() n'interpole que les jetons {token} ; ces crochets partaient
-- donc tels quels dans l'email reçu par le client.
--
-- On restaure la version variabilisée d'origine (20260801000003), qui utilise
-- {client.prenom} + {intervention.date}/{intervention.heure} (confirmation) et
-- {intervention.creneau} (proposition). Ces variables sont désormais peuplées
-- côté fiche lead depuis le dossier planifié (correctif A13, même lot).
--
-- Additif et idempotent : UPDATE ciblé par `name`, aucune donnée supprimée.

update message_templates set body = E'Bonjour {client.prenom},\n\nNous vous confirmons notre intervention conformément au devis signé.\n\nDate d''intervention : {intervention.date}\nHeure d''intervention : {intervention.heure}\n\nNotre équipe se présentera à l''adresse convenue afin de réaliser la prestation prévue.\n\nNous vous remercions de veiller à ce que les accès nécessaires soient disponibles le jour de l''intervention.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail confirmation d''intervention';

update message_templates set body = E'Bonjour {client.prenom},\n\nSuite à la signature de votre devis, nous vous proposons les créneaux suivants pour la réalisation de votre prestation :\n\nCréneau 1 : {intervention.creneau}\nCréneau 2 :\nCréneau 3 :\n\nMerci de nous indiquer le créneau qui vous convient le mieux.\n\nDès réception de votre choix, nous vous adresserons une confirmation définitive de l''intervention.\n\nNous restons à votre disposition pour toute question.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan'
  where name = 'Mail proposition de créneaux';
