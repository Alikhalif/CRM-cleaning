-- Bibliothèque « Planificatrice -> Intervenant » (sous-traitant) — client
-- 2026-08-03. Rubriques : Consultation, Affectation, Avant intervention,
-- Suivi d'intervention, Fin d'intervention, Clôture. Audience = planification,
-- recipient = intervenant. Idempotent par nom.
insert into message_templates (channel, category, name, subject, body, audiences, recipient, sort_order)
select v.channel, v.category, v.name, v.subject, v.body, v.audiences::text[], v.recipient, v.sort_order
from (values
  -- ── Consultation ───────────────────────────────────────────────────────
  ('email', 'consultation', 'Intervenant — Envoi photos/vidéos pour chiffrage',
   'Demande de chiffrage — sous-traitance',
   E'Bonjour,\n\nDans le cadre d''une future intervention, nous vous remercions de bien vouloir consulter les photos et/ou vidéos jointes afin d''établir votre proposition de sous-traitance.\n\nMerci de nous communiquer :\n- Votre tarif pour la réalisation de cette prestation ;\n- Vos disponibilités ;\n- Les moyens humains prévus (nombre d''intervenants) ;\n- Le matériel spécifique éventuellement nécessaire ;\n- Toute observation ou réserve que vous jugeriez utile.\n\nÀ réception de votre retour, nous étudierons votre proposition et reviendrons vers vous dans les meilleurs délais.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 1),

  ('email', 'consultation', 'Intervenant — Relance de chiffrage',
   'Relance — demande de chiffrage',
   E'Bonjour,\n\nJe me permets de revenir vers vous concernant notre demande de chiffrage transmise précédemment.\n\nAuriez-vous eu l''occasion de consulter les photos et/ou vidéos de l''intervention ?\n\nSi votre entreprise est en mesure de réaliser cette prestation, nous vous remercions de bien vouloir nous communiquer :\n- Votre tarif de sous-traitance ;\n- Vos disponibilités ;\n- Les éventuelles observations ou réserves.\n\nVotre retour nous permettra d''organiser rapidement la planification de cette intervention.\n\nDans l''attente de votre réponse.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 2),

  ('email', 'consultation', 'Intervenant — Validation du chiffrage',
   'Votre proposition a été retenue',
   E'Bonjour,\n\nNous vous remercions pour votre retour concernant notre demande de chiffrage.\n\nNous vous confirmons que votre proposition a été retenue pour cette intervention.\n\nNotre planificatrice reviendra prochainement vers vous afin de vous communiquer la date, l''horaire ainsi que l''ensemble des informations nécessaires au bon déroulement de la mission.\n\nNous vous remercions pour votre disponibilité et restons à votre disposition si nécessaire.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 3),

  ('email', 'consultation', 'Intervenant — Refus de la proposition',
   'Suite à votre proposition',
   E'Bonjour,\n\nNous vous remercions d''avoir pris le temps d''étudier notre demande et de nous avoir transmis votre proposition.\n\nAprès étude de votre offre, nous n''avons pas retenu votre proposition pour cette intervention.\n\nNous vous remercions pour votre réactivité et ne manquerons pas de revenir vers vous pour de prochaines demandes correspondant à votre secteur d''intervention.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 4),

  ('email', 'consultation', 'Intervenant — Confirmation d''attribution du chantier',
   'Attribution de l''intervention',
   E'Bonjour,\n\nNous vous confirmons l''attribution de cette intervention à votre entreprise.\n\nNotre planificatrice vous adressera prochainement l''ordre de mission comprenant l''ensemble des informations nécessaires à la réalisation de la prestation, notamment :\n- Les coordonnées du client ;\n- L''adresse d''intervention ;\n- La date et l''horaire retenus ;\n- Les consignes particulières éventuelles.\n\nNous vous remercions pour votre disponibilité et votre confiance.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 5),

  -- ── Affectation ────────────────────────────────────────────────────────
  ('email', 'affectation', 'Intervenant — Ordre de mission',
   'Ordre de mission — {client.nom_complet}',
   E'Bonjour,\n\nNous vous confirmons votre affectation pour l''intervention suivante :\n\nClient : {client.nom_complet}\nType de prestation : {lead.secteur}\n\nAdresse d''intervention :\n{client.adresse}\n\nDate : {intervention.date}\nHeure de rendez-vous : {intervention.heure}\n\nContact sur place : {Nom - Téléphone}\n\nConsignes particulières :\n{Consignes d''accès, stationnement, digicode, badges, précautions particulières, etc.}\n\nMerci de nous confirmer par retour de mail la bonne prise en charge de cette mission.\n\nEn cas de difficulté ou d''imprévu, merci de contacter immédiatement la planificatrice afin que nous puissions vous assister.\n\nNous vous souhaitons une excellente intervention.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 1),

  ('email', 'affectation', 'Intervenant — Modification de mission',
   'Modification de votre mission',
   E'Bonjour,\n\nNous vous informons qu''une modification a été apportée à votre intervention.\n\nClient : {client.nom_complet}\n\nÉléments modifiés :\n- Date : {intervention.date}\n- Heure : {intervention.heure}\n- Adresse : {client.adresse}\n- Consignes : {Nouvelles consignes, si applicable}\n\nLes autres informations relatives à cette intervention demeurent inchangées.\n\nNous vous remercions de bien vouloir nous confirmer la bonne prise en compte de ces modifications par retour de mail.\n\nEn cas de difficulté ou d''indisponibilité, merci de nous en informer dans les meilleurs délais.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 2),

  ('email', 'affectation', 'Intervenant — Annulation de mission',
   'Annulation de mission',
   E'Bonjour,\n\nNous vous informons que l''intervention ci-dessous est annulée :\n\nClient : {client.nom_complet}\nAdresse : {client.adresse}\nDate prévue : {intervention.date}\nHeure prévue : {intervention.heure}\n\nNous vous remercions de bien vouloir prendre en compte cette annulation et de nous confirmer sa bonne réception par retour de mail.\n\nNous ne manquerons pas de revenir vers vous pour une prochaine intervention.\n\nNous vous remercions pour votre compréhension.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 3),

  ('email', 'affectation', 'Intervenant — Remplacement d''un intervenant',
   'Affectation en remplacement',
   E'Bonjour,\n\nDans le cadre de l''organisation de notre planning, nous vous confirmons votre affectation en remplacement sur l''intervention suivante :\n\nClient : {client.nom_complet}\nType de prestation : {lead.secteur}\nAdresse : {client.adresse}\nDate : {intervention.date}\nHeure : {intervention.heure}\n\nLes photos, vidéos et informations relatives au chantier vous ont déjà été communiquées lors de la phase de consultation. Si vous souhaitez des précisions complémentaires, n''hésitez pas à nous contacter.\n\nMerci de nous confirmer votre disponibilité et la bonne prise en charge de cette intervention par retour de mail.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 4),

  -- ── Avant intervention ─────────────────────────────────────────────────
  ('email', 'avant_intervention', 'Intervenant — Consignes particulières',
   'Consignes particulières pour votre intervention',
   E'Bonjour,\n\nDans le cadre de votre prochaine intervention, nous vous remercions de prendre connaissance des consignes particulières ci-dessous :\n\nClient : {client.nom_complet}\nAdresse : {client.adresse}\nDate de l''intervention : {intervention.date}\n\nConsignes particulières :\n- {Consigne 1}\n- {Consigne 2}\n- {Consigne 3}\n\nMerci de respecter ces consignes tout au long de l''intervention.\n\nSi vous constatez une différence entre les éléments communiqués et la réalité sur place, ou si un imprévu survient, merci de contacter immédiatement la planificatrice avant toute décision.\n\nNous vous remercions de bien vouloir nous confirmer la bonne prise en compte de ces consignes.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 1),

  ('email', 'avant_intervention', 'Intervenant — Adresse et coordonnées du client',
   'Coordonnées et adresse d''intervention',
   E'Bonjour,\n\nVeuillez trouver ci-dessous les informations relatives à votre prochaine intervention.\n\nClient : {client.nom_complet}\n\nAdresse d''intervention :\n{client.adresse}\n\nContact sur place :\n{Nom du contact}\n{Téléphone}\n\nType de prestation : {lead.secteur}\n\nSi vous rencontrez une difficulté pour accéder au site, merci de contacter immédiatement la planificatrice avant de quitter les lieux.\n\nNous vous remercions de respecter les horaires convenus et de nous informer sans délai de tout imprévu.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 2),

  ('email', 'avant_intervention', 'Intervenant — Horaires et point de rendez-vous',
   'Horaires et point de rendez-vous',
   E'Bonjour,\n\nNous vous confirmons les modalités de rendez-vous pour votre prochaine intervention.\n\nDate : {intervention.date}\nHeure de rendez-vous : {intervention.heure}\n\nLieu de rendez-vous :\n{client.adresse}\n\nPersonne à contacter sur place :\n{Nom} - {Téléphone}\n\nMerci de vous présenter à l''heure convenue afin de garantir le bon déroulement de l''intervention.\n\nEn cas de retard, d''empêchement ou de difficulté pour rejoindre le lieu d''intervention, merci d''en informer immédiatement la planificatrice.\n\nNous vous remercions pour votre ponctualité et vous souhaitons une excellente intervention.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 3),

  ('email', 'avant_intervention', 'Intervenant — Matériel spécifique à prévoir',
   'Matériel à prévoir',
   E'Bonjour,\n\nDans le cadre de votre prochaine intervention, nous vous remercions de prévoir le matériel nécessaire à la bonne réalisation de la prestation.\n\nClient : {client.nom_complet}\nAdresse : {client.adresse}\nDate : {intervention.date}\n\nMatériel spécifique à prévoir :\n- {Matériel 1}\n- {Matériel 2}\n- {Matériel 3}\n\nSi vous constatez qu''un matériel complémentaire est nécessaire avant l''intervention, merci d''en informer la planificatrice dans les meilleurs délais afin que les dispositions nécessaires puissent être prises.\n\nNous vous remercions de nous confirmer que vous disposerez de l''ensemble du matériel requis le jour de l''intervention.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 4),

  ('email', 'avant_intervention', 'Intervenant — Validation de la prise en charge',
   'Confirmation de prise en charge',
   E'Bonjour,\n\nAfin de finaliser notre organisation, nous vous remercions de bien vouloir nous confirmer la prise en charge de l''intervention suivante :\n\nClient : {client.nom_complet}\nType de prestation : {lead.secteur}\nDate : {intervention.date}\nHeure : {intervention.heure}\nAdresse : {client.adresse}\n\nPar retour de mail, merci de nous confirmer :\n- Votre disponibilité pour cette intervention ;\n- La bonne prise en compte des informations communiquées ;\n- Que vous disposerez du matériel et des effectifs nécessaires.\n\nVotre confirmation nous permettra de valider définitivement le planning.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 5),

  -- ── Suivi d'intervention (pendant) ─────────────────────────────────────
  ('email', 'pendant_intervention', 'Intervenant — Demande d''avancement',
   'Point d''avancement de l''intervention',
   E'Bonjour,\n\nDans le cadre du suivi de votre intervention, nous vous remercions de bien vouloir nous communiquer un point d''avancement.\n\nMerci de nous préciser :\n- L''heure de début de l''intervention ;\n- L''état d''avancement des travaux ;\n- Les éventuelles difficultés rencontrées ;\n- Si le planning initial est respecté ;\n- Si vous anticipez un besoin particulier ou un temps d''intervention supplémentaire.\n\nEn cas d''imprévu ou de prestation complémentaire demandée par le client, merci de ne prendre aucun engagement sans l''accord préalable de la planificatrice.\n\nNous vous remercions pour votre retour.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 1),

  ('email', 'pendant_intervention', 'Intervenant — Signalement d''un imprévu',
   'Imprévu signalé',
   E'Bonjour,\n\nNous avons été informés qu''un imprévu est survenu lors de votre intervention.\n\nAfin de pouvoir informer le client et prendre une décision rapidement, merci de nous communiquer les éléments suivants :\n- La nature de l''imprévu ;\n- Les conséquences sur le déroulement de la prestation ;\n- Des photos ou vidéos si nécessaire ;\n- Les solutions que vous préconisez ;\n- L''éventuel impact sur la durée ou le coût de l''intervention.\n\nMerci de ne réaliser aucune prestation supplémentaire ni de prendre d''engagement auprès du client sans validation préalable de la planificatrice.\n\nDans l''attente de votre retour.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 2),

  ('email', 'pendant_intervention', 'Intervenant — Autorisation de travaux supplémentaires',
   'Autorisation de travaux supplémentaires',
   E'Bonjour,\n\nÀ la suite des éléments que vous nous avez communiqués concernant l''intervention en cours, nous vous confirmons notre accord pour la réalisation des travaux supplémentaires suivants :\n\nPrestations autorisées :\n{Description des travaux supplémentaires}\n\nMerci de réaliser uniquement les prestations mentionnées ci-dessus.\n\nSi d''autres besoins apparaissent au cours de l''intervention, merci de contacter à nouveau la planificatrice avant toute exécution ou tout engagement auprès du client.\n\nÀ l''issue de votre intervention, nous vous remercions de nous transmettre les photos de fin de chantier ainsi que votre compte rendu.\n\nNous vous remercions pour votre réactivité.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 3),

  ('email', 'pendant_intervention', 'Intervenant — Validation d''une plus-value',
   'Validation de plus-value',
   E'Bonjour,\n\nNous vous confirmons que la plus-value proposée dans le cadre de l''intervention en cours a été validée.\n\nMontant de la plus-value : {Montant}\n\nPrestations complémentaires autorisées :\n{Description des prestations}\n\nMerci de réaliser uniquement les prestations validées.\n\nÀ l''issue de l''intervention, nous vous remercions de nous transmettre :\n- Les photos de fin de chantier ;\n- Votre compte rendu d''intervention ;\n- Toute observation utile concernant le déroulement de la prestation.\n\nNous vous remercions pour votre professionnalisme.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 4),

  -- ── Fin d'intervention ─────────────────────────────────────────────────
  ('email', 'fin_intervention', 'Intervenant — Demande de photos de fin',
   'Photos de fin d''intervention',
   E'Bonjour,\n\nAvant de quitter les lieux, nous vous remercions de bien vouloir nous transmettre les photos de fin d''intervention.\n\nMerci de photographier les différentes zones traitées afin de nous permettre :\n- de valider la conformité de la prestation ;\n- de conserver un dossier complet ;\n- de répondre à toute éventuelle demande du client.\n\nSi une réserve, un dommage ou un élément particulier est constaté, merci de le photographier et de nous en informer immédiatement.\n\nDès réception des photos, nous procéderons à la validation de l''intervention.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 1),

  ('email', 'fin_intervention', 'Intervenant — Demande du compte rendu',
   'Compte rendu d''intervention',
   E'Bonjour,\n\nAfin de finaliser le dossier de cette intervention, nous vous remercions de bien vouloir nous transmettre votre compte rendu.\n\nMerci d''y préciser, si applicable :\n- Les horaires de début et de fin de l''intervention ;\n- Les prestations réalisées ;\n- Les éventuelles difficultés rencontrées ;\n- Les réserves ou anomalies constatées ;\n- Les prestations non réalisées et leur motif ;\n- Toute information utile pour le suivi du dossier.\n\nSi ce n''est pas déjà fait, merci de joindre également les photos de fin d''intervention.\n\nDès réception de ces éléments, nous procéderons à la clôture administrative du dossier.\n\nNous vous remercions pour votre retour.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 2),

  ('email', 'fin_intervention', 'Intervenant — Validation de l''intervention',
   'Intervention validée',
   E'Bonjour,\n\nNous vous confirmons que votre intervention a bien été réceptionnée et validée.\n\nNous vous remercions pour la transmission des photos de fin de chantier ainsi que de votre compte rendu d''intervention.\n\nLe dossier est désormais complet et peut être traité administrativement.\n\nNous vous remercions pour la qualité de votre travail, votre professionnalisme et votre réactivité.\n\nNous ne manquerons pas de revenir vers vous pour de prochaines interventions.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 3),

  ('email', 'fin_intervention', 'Intervenant — Signalement d''un incident ou réserve',
   'Signalement d''incident ou de réserve',
   E'Bonjour,\n\nDans le cadre de l''intervention réalisée, un incident ou une réserve a été signalé(e).\n\nAfin de nous permettre de traiter rapidement le dossier, nous vous remercions de bien vouloir nous transmettre les informations suivantes :\n- Une description précise des faits ;\n- Les circonstances de l''incident ou de la réserve ;\n- Les photos ou vidéos correspondantes, si disponibles ;\n- Les mesures éventuellement prises sur place ;\n- Toute information complémentaire pouvant nous être utile.\n\nMerci de nous adresser votre retour dans les meilleurs délais afin que nous puissions assurer le suivi auprès du client.\n\nNous vous remercions pour votre réactivité.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 4),

  -- ── Clôture de mission ─────────────────────────────────────────────────
  ('email', 'cloture', 'Intervenant — Clôture de la mission',
   'Clôture de votre mission',
   E'Bonjour,\n\nNous vous confirmons la clôture de votre mission.\n\nNous avons bien reçu l''ensemble des éléments relatifs à cette intervention, notamment :\n- Les photos de fin d''intervention ;\n- Le compte rendu d''intervention ;\n- Les informations administratives nécessaires à la clôture du dossier.\n\nNous vous remercions pour votre professionnalisme, votre disponibilité et la qualité de votre travail.\n\nNous ne manquerons pas de vous solliciter pour de prochaines interventions.\n\nBien professionnellement,\nLa planificatrice\nOptimivv Nettoyage',
   '{planification}', 'intervenant', 2)
) as v(channel, category, name, subject, body, audiences, recipient, sort_order)
where not exists (select 1 from message_templates mt where mt.name = v.name);
