-- « SMS demande de photos (Débarras) » : nouveau corps fourni par le client
-- (2026-10-13). Remplacement et non création : le client a confirmé que ce
-- texte EST le modèle Débarras, et deux SMS « demande de photos » quasi
-- identiques sur un même dossier n'auraient servi personne.
--
-- Ce que le remplacement change, par rapport à l'ancien corps :
--   • l'adresse passe de devis@optimivv-nettoyage.com à
--     Devispro@optimivv-demenagement.com — les demandes de photos Débarras
--     arrivent donc désormais dans la boîte Déménagement, cohérent avec Dem 1
--     et Dem 2 qui traitent les deux activités depuis ce matin ;
--   • « David » écrit en dur devient {commercial.prenom} ;
--   • le « et » orphelin de l'ancien texte disparaît.
--
-- Texte repris AU MOT PRÈS, y compris « éléments à déménager » — formulation
-- du client, conservée telle quelle sur un modèle Débarras. Seule substitution :
-- « David » → {commercial.prenom}, conformément à la demande du jour.
--
-- activity_id (debarras) et audiences inchangés : le modèle reste cantonné aux
-- dossiers débarras.
--
-- Idempotent : ré-exécuter réécrit la même valeur.

update message_templates
   set body = $corps$dans la continuité de notre échange téléphonique vous trouverez ci joint mon email :

Devispro@optimivv-demenagement.com

Merci de m'envoyer par email les photos concernant les surfaces et éléments à déménager, préciser dans votre e-mail l'étage si appartement ou maison, vos nom, prénom, adresse pour l'établissement du devis.

Cordialement

{commercial.prenom}$corps$
 where name = 'SMS demande de photos (Débarras)'
   and channel = 'sms';
