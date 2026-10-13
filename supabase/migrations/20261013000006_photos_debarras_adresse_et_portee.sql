-- Deux corrections sur la « demande de photos » Débarras (2026-10-13).
--
-- 1) Le SMS redevient visible sur TOUS les dossiers du commercial.
--    Il avait été rattaché à l'activité Débarras plus tôt dans la journée, à la
--    demande du client, pour le faire disparaître des dossiers déménagement.
--    Demande inverse depuis : on retire le rattachement. Le modèle redevient
--    donc proposé sur les dossiers déménagement comme débarras — ce qui est
--    cohérent, son texte parle d'« éléments à déménager » et pointe vers la
--    boîte Déménagement.
--
-- 2) Le modèle E-MAIL reçoit l'adresse Devispro@optimivv-demenagement.com.
--    Il disait seulement « répondre directement à ce mail » : correct pour un
--    e-mail, mais le client veut l'adresse écrite, comme dans le SMS — un
--    destinataire qui transfère le message à son conjoint, ou qui écrit depuis
--    une autre boîte, a alors l'adresse sous les yeux.
--
-- Les deux jumeaux Déménagement (« Mail demande de photos (Déménagement) » et
-- « … — détaillé ») n'ont toujours pas d'adresse dans leur corps : non demandé,
-- donc non touché.
--
-- Idempotent.

update message_templates
   set activity_id = null
 where name = 'SMS demande de photos (Débarras)'
   and channel = 'sms';

update message_templates
   set body = $corps$Bonjour,

Dans la continuité de notre échange téléphonique, afin d'établir votre devis de débarras, merci de nous transmettre des photos des surfaces et des éléments à évacuer.

Merci de préciser également vos nom, prénom et adresse, pour l'établissement du devis.

Vous pouvez répondre directement à ce mail en joignant les photos, ou nous les envoyer à Devispro@optimivv-demenagement.com.

Dès réception de ces éléments, nous établirons votre devis dans les meilleurs délais.

Bien professionnellement,
L'équipe Optimivv Nettoyage
La qualité professionnelle, la proximité d'un artisan$corps$
 where name = 'Mail demande de photos (Débarras)'
   and channel = 'email';
