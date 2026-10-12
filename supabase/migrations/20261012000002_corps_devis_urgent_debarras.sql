-- Corps du modèle « Mail devis urgent — 100 % prépaiement (Débarras) »
-- (demande client 2026-10-12) : ajout de la signature, et correction d'un
-- « de » parasite dans la phrase de confirmation.
--
-- Chaîne en dollar-quoting ($corps$) : le texte contient des apostrophes
-- (« L'équipe », « d'effectuer ») qu'il n'y a ainsi pas à doubler.

update message_templates
   set body = $corps$Bonjour

Suite à notre échange téléphonique, veuillez trouver ci-joint, comme convenu, le devis relatif à la prestation du débarras.

Vous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.

Afin de permettre une planification rapide de cette intervention demandée en urgence, nous vous remercions d'effectuer un virement instantané dès réception du présent mail.

Dès réception du devis signé ainsi que du règlement, nous vous confirmerons par retour d'email la date d'intervention ainsi que le créneau horaire prévu.

À titre exceptionnel, compte tenu du caractère urgent de votre demande, nous sommes en mesure de vous proposer une intervention le ….

Bien professionnellement,
L'équipe Optimivv Nettoyage
La qualité professionnelle, la proximité d'un artisan$corps$
 where name = 'Mail devis urgent — 100 % prépaiement (Débarras)';
