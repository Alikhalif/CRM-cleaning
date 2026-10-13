-- Nettoyage de la liste SMS vue par un commercial Déménagement (demande client
-- 2026-10-13). Deux modèles devaient en disparaître, pour deux raisons
-- différentes — d'où deux traitements différents.
--
-- 1) « SMS demande de photos (Débarras) » n'est PAS supprimé.
--    Il apparaissait sur un dossier déménagement parce que le profil
--    debarras_demenagement porte les deux audiences, et que son activity_id
--    était vide. On le rattache à l'activité Débarras : le modal SMS filtre
--    déjà sur « activité absente OU égale au secteur du lead »
--    (SmsModal.tsx). Il disparaît donc des dossiers déménagement et reste
--    disponible sur les dossiers débarras — que Dem 1 et Dem 2 traitent
--    désormais, depuis l'ajout du secteur ce matin.
--
--    C'est la première utilisation réelle d'activity_id, vide sur les 86
--    modèles. Le même geste, généralisé, réglerait tout le mélange
--    Débarras/Déménagement signalé sur le bouton « Model email ».
--
-- 2) « Déménagement — Découverte (SMS après appel) » est SUPPRIMÉ.
--    Rattacher l'activité n'y changerait rien : c'est un modèle déménagement
--    sur un dossier déménagement. Il est de toute façon périmé — il renvoie
--    vers devis@optimivv-nettoyage.com alors que le Déménagement utilise
--    Devispro@optimivv-demenagement.com — et remplacé par les deux « SMS
--    demande de photos (Déménagement) » créés ce matin. 707 caractères,
--    soit 5 segments SMS facturés.
--
-- Aucun des deux n'est appelé par son nom dans le code (getTemplateByName).
--
-- Idempotent.

update message_templates
   set activity_id = (select id from activities where slug = 'debarras')
 where name = 'SMS demande de photos (Débarras)'
   and channel = 'sms';

delete from message_templates
 where name = 'Déménagement — Découverte (SMS après appel)'
   and channel = 'sms';
