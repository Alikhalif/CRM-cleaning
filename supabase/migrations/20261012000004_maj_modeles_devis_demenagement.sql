-- Modèles e-mail Déménagement (demande client 2026-10-12) :
--   1. le modèle « Modification / mise à jour du devis » absorbe la demande
--      d'acompte et la mention « Bon pour accord » ;
--   2. le modèle « Devis + demande d'acompte », devenu redondant, est supprimé.
--
-- Le numéro de devis n'est PAS écrit en dur : la variable {devis.numero} est
-- remplacée côté serveur par /api/devis/envoyer, après l'allocation du numéro
-- et juste avant l'envoi — le PDF et l'e-mail portent donc le même.

update message_templates
   set subject = 'Envoi de votre devis de déménagement actualisé',
       body = $corps$Bonjour,

Suite à nos derniers échanges et aux informations complémentaires que vous nous avez communiquées, nous vous adressons en pièce jointe une version mise à jour de votre devis de déménagement.

Cette nouvelle version remplace et annule la précédente.

Nous vous invitons à en prendre connaissance. Si vous souhaitez une nouvelle modification ou des précisions sur son contenu, notre équipe reste à votre entière disposition.

Pour valider votre devis, vous pouvez utiliser le lien de signature électronique ou simplement répondre à ce mail avec la mention « Bon pour accord – Devis n° {devis.numero} ».

Vous trouverez également en pièce jointe notre RIB pour le règlement de l'acompte de 50 % du montant de la prestation.

Dès réception de votre accord sur le devis et du règlement de l'acompte, nous vous confirmerons par retour d'email la date et le créneau horaire de votre intervention.

Bien professionnellement,
L'équipe Optimivv Déménagement
Votre nouveau départ commence ici !$corps$
 where name = 'Déménagement — Modification / mise à jour du devis';

delete from message_templates
 where name = 'Déménagement — Devis + demande d''acompte';
