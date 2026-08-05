-- Réorganisation de la bibliothèque « Intervenants (sous-traitants) » selon le
-- cycle réel d'une mission (client 2026-08-05) :
--   Consultation → Affectation → Avant intervention → Pendant intervention →
--   Fin d'intervention → Clôture de mission.
-- Toutes les opérations sont idempotentes (renommages no-op si déjà appliqués,
-- insertions gardées par « where not exists », suppression sans effet si absente).
-- Les corps de message sont en dollar-quoting ($B$…$B$) : pas d'échappement.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) DOUBLON — les photos/vidéos ne sont transmises qu'à l'étape Consultation.
--    Supprime tout « Envoi des photos et vidéos du chantier » rangé en Avant
--    intervention (doublon de la consultation).
-- ─────────────────────────────────────────────────────────────────────────
delete from message_templates
where recipient = 'intervenant'
  and category = 'avant_intervention'
  and (name ilike '%photo%' or name ilike '%vidéo%' or name ilike '%video%');

-- ─────────────────────────────────────────────────────────────────────────
-- 2) CONSULTATION — alignement du libellé du 1er modèle.
-- ─────────────────────────────────────────────────────────────────────────
update message_templates
  set name = 'Intervenant — Envoi des photos et vidéos pour chiffrage'
where name = 'Intervenant — Envoi photos/vidéos pour chiffrage';

-- ─────────────────────────────────────────────────────────────────────────
-- 3) AFFECTATION — ré-ordonner + Ordre de mission (consignes obligatoires).
--    Ordre voulu : Ordre de mission (1), Nouvelle intervention (2),
--    Modification (3), Annulation (4), Remplacement (5).
-- ─────────────────────────────────────────────────────────────────────────
update message_templates set sort_order = 3 where name = 'Intervenant — Modification de mission';
update message_templates set sort_order = 4 where name = 'Intervenant — Annulation de mission';
update message_templates set sort_order = 5 where name = 'Intervenant — Remplacement d''un intervenant';

-- Ordre de mission : corps complet AVEC la rubrique « Consignes obligatoires »
-- intégrée automatiquement dans chaque ordre de mission.
update message_templates
  set sort_order = 1,
      subject = 'Ordre de mission — {client.nom_complet}',
      body = $B$Bonjour,

Nous vous confirmons votre affectation pour l'intervention suivante :

Client : {client.nom_complet}
Type de prestation : {lead.secteur}

Adresse d'intervention :
{client.adresse}

Date : {intervention.date}
Heure de rendez-vous : {intervention.heure}

Consignes particulières :
{Consignes d'accès, stationnement, digicode, précautions particulières, etc.}

CONSIGNES OBLIGATOIRES :
- À votre arrivée, effectuez une découverte complète du chantier avant de commencer la prestation.
- Prenez des photos de l'état initial des lieux avant toute intervention.
- Réalisez la prestation conformément aux consignes reçues.
- Prenez des photos de fin de chantier une fois la prestation terminée.
- Il est strictement interdit de quitter le chantier tant que les photos de fin d'intervention n'ont pas été transmises conformément à la procédure.
- Avant de quitter le chantier, vous devez prévenir la planificatrice. Seule celle-ci valide que le dossier est complet et vous autorise à clôturer votre intervention.
- En cas d'imprévu, de difficulté, de travaux supplémentaires ou d'anomalie, contactez immédiatement la planificatrice avant toute décision.

Merci de nous confirmer par retour de mail la bonne prise en charge de cette mission.

Nous vous souhaitons une excellente intervention.

Bien professionnellement,
La planificatrice
Optimivv Nettoyage$B$
where name = 'Intervenant — Ordre de mission';

-- ─────────────────────────────────────────────────────────────────────────
-- 4) FIN D'INTERVENTION — renommages + ré-ordonnancement.
--    Ordre voulu : Confirmation de fin (1), Photos de fin (2),
--    Compte rendu (3), Validation du chantier (4), Incident/réserve (5).
-- ─────────────────────────────────────────────────────────────────────────
update message_templates set name = 'Intervenant — Demande des photos de fin de chantier', sort_order = 2
  where name = 'Intervenant — Demande de photos de fin';
update message_templates set name = 'Intervenant — Demande du compte rendu d''intervention', sort_order = 3
  where name = 'Intervenant — Demande du compte rendu';
update message_templates set name = 'Intervenant — Validation du chantier', sort_order = 4
  where name = 'Intervenant — Validation de l''intervention';
update message_templates set name = 'Intervenant — Signalement d''un incident ou d''une réserve', sort_order = 5
  where name = 'Intervenant — Signalement d''un incident ou réserve';

-- ─────────────────────────────────────────────────────────────────────────
-- 5) CLÔTURE DE MISSION — « Clôture de la mission » devient « Mission clôturée ».
-- ─────────────────────────────────────────────────────────────────────────
update message_templates set name = 'Intervenant — Mission clôturée', sort_order = 4
  where name = 'Intervenant — Clôture de la mission';

-- ─────────────────────────────────────────────────────────────────────────
-- 6) NOUVEAUX MODÈLES (insérés seulement s'ils n'existent pas déjà).
-- ─────────────────────────────────────────────────────────────────────────
insert into message_templates (channel, category, name, subject, body, audiences, recipient, sort_order)
select v.channel, v.category, v.name, v.subject, v.body, v.audiences::text[], v.recipient, v.sort_order
from (values
  -- Affectation ─ Nouvelle intervention (2)
  ('email', 'affectation', 'Intervenant — Nouvelle intervention',
   'Nouvelle intervention à planifier',
   $B$Bonjour,

Une nouvelle intervention vous est confiée. En voici les principaux éléments :

Client : {client.nom_complet}
Type de prestation : {lead.secteur}
Adresse d'intervention : {client.adresse}
Date envisagée : {intervention.date}
Heure : {intervention.heure}

L'ordre de mission détaillé, comprenant l'ensemble des consignes à respecter, vous sera transmis séparément.

Merci de nous confirmer votre disponibilité pour cette intervention par retour de mail.

En cas d'indisponibilité, merci de nous en informer dans les meilleurs délais afin que nous puissions nous organiser.

Bien professionnellement,
La planificatrice
Optimivv Nettoyage$B$,
   '{planification}', 'intervenant', 2),

  -- Pendant l'intervention ─ Demande de photos en cours (5)
  ('email', 'pendant_intervention', 'Intervenant — Demande de photos en cours d''intervention',
   'Photos en cours d''intervention',
   $B$Bonjour,

Dans le cadre du suivi de l'intervention en cours, nous vous remercions de bien vouloir nous transmettre quelques photos de l'avancement des travaux.

Ces photos nous permettent :
- de suivre le bon déroulement de la prestation ;
- d'informer le client si nécessaire ;
- de conserver un dossier complet.

Si vous constatez un imprévu, une difficulté ou un besoin de travaux supplémentaires, merci de nous le signaler immédiatement et de ne prendre aucun engagement auprès du client sans l'accord préalable de la planificatrice.

Nous vous remercions pour votre retour.

Bien professionnellement,
La planificatrice
Optimivv Nettoyage$B$,
   '{planification}', 'intervenant', 5),

  -- Fin d'intervention ─ Confirmation de fin (1)
  ('email', 'fin_intervention', 'Intervenant — Confirmation de fin d''intervention',
   'Confirmation de fin d''intervention',
   $B$Bonjour,

Nous vous remercions de bien vouloir nous confirmer la fin de votre intervention.

Merci de nous préciser :
- L'heure de fin de la prestation ;
- Que l'ensemble des prestations prévues a bien été réalisé ;
- Les éventuelles réserves ou anomalies constatées.

Rappel important : il est strictement interdit de quitter le chantier tant que les photos de fin d'intervention n'ont pas été transmises et que la planificatrice n'a pas validé que le dossier est complet.

Dès réception de votre confirmation et des photos de fin de chantier, nous procéderons à la validation de l'intervention.

Bien professionnellement,
La planificatrice
Optimivv Nettoyage$B$,
   '{planification}', 'intervenant', 1),

  -- Clôture de mission ─ Facture du sous-traitant (1)
  ('email', 'cloture', 'Intervenant — Facture du sous-traitant',
   'Transmission de votre facture',
   $B$Bonjour,

Votre intervention étant désormais validée, nous vous remercions de bien vouloir nous transmettre votre facture correspondant à cette prestation.

Merci d'y faire figurer :
- La référence du dossier / de l'intervention ;
- La date de réalisation ;
- Le détail des prestations réalisées ;
- Le montant convenu (et, le cas échéant, la plus-value validée) ;
- Vos coordonnées bancaires (IBAN / BIC).

Dès réception, nous procéderons à la vérification puis au traitement de votre règlement dans les délais convenus.

Bien professionnellement,
La planificatrice
Optimivv Nettoyage$B$,
   '{planification}', 'intervenant', 1),

  -- Clôture de mission ─ Confirmation de réception de la facture (2)
  ('email', 'cloture', 'Intervenant — Confirmation de réception de la facture',
   'Réception de votre facture',
   $B$Bonjour,

Nous vous confirmons la bonne réception de votre facture relative à l'intervention réalisée.

Celle-ci est en cours de traitement par notre service. Le règlement sera effectué conformément aux conditions convenues.

Nous reviendrons vers vous en cas d'élément manquant ou de précision nécessaire.

Nous vous remercions pour votre collaboration.

Bien professionnellement,
La planificatrice
Optimivv Nettoyage$B$,
   '{planification}', 'intervenant', 2),

  -- Clôture de mission ─ Validation du règlement (3)
  ('email', 'cloture', 'Intervenant — Validation du règlement',
   'Règlement de votre facture',
   $B$Bonjour,

Nous vous informons que le règlement de votre facture a été validé et sera effectué selon les modalités convenues.

Montant réglé : {Montant réglé}

Nous vous remercions pour la qualité de votre travail et votre professionnalisme tout au long de cette mission.

Nous ne manquerons pas de vous solliciter pour de prochaines interventions.

Bien professionnellement,
La planificatrice
Optimivv Nettoyage$B$,
   '{planification}', 'intervenant', 3)
) as v(channel, category, name, subject, body, audiences, recipient, sort_order)
where not exists (select 1 from message_templates mt where mt.name = v.name);
