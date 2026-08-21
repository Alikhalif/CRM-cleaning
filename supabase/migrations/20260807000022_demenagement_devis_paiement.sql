-- Modèles devis Déménagement — variantes de règlement (client 2026-08-08).
-- Audience : demenagement + debarras (l'admin voit tout). Idempotent par nom.

insert into message_templates (channel, category, name, subject, body, audiences, recipient, sort_order)
select v.channel, v.category, v.name, v.subject, v.body, v.audiences::text[], v.recipient, v.sort_order
from (values
  ('email', 'devis', 'Mail devis — virement (Déménagement)', 'Votre devis de déménagement',
   E'Bonjour,

Suite à nos échanges, veuillez trouver ci-joint votre devis de déménagement.

Pour valider votre réservation, il vous suffit de nous retourner le devis signé (mention « Bon pour accord ») et de procéder au règlement par virement bancaire.

Coordonnées bancaires pour le virement :
IBAN : [à compléter]
BIC : [à compléter]
Titulaire : OPTIMIVV Déménagement

Dès réception du devis signé et du virement, notre planificatrice prendra contact avec vous afin d''organiser votre déménagement et de vous communiquer la date ainsi que le créneau d''intervention.

Nous restons à votre disposition pour toute question.

Bien professionnellement,
L''équipe Optimivv Déménagement
Votre nouveau départ commence ici !',
   '{demenagement,debarras}', 'client', 4),
  ('email', 'devis', 'Mail devis — virement avec acompte (Déménagement)', 'Votre devis de déménagement — acompte pour validation',
   E'Bonjour,

Suite à nos échanges, veuillez trouver ci-joint votre devis de déménagement.

Pour valider définitivement votre réservation, nous vous remercions de nous retourner le devis signé (mention « Bon pour accord ») et de régler l''acompte de {acompte.pct} ({montant.acompte}) par virement bancaire.

Coordonnées bancaires pour le virement :
IBAN : [à compléter]
BIC : [à compléter]
Titulaire : OPTIMIVV Déménagement

Le solde ({montant.solde}) sera à régler à réception de la facture, selon les modalités convenues.

Dès réception du devis signé et de l''acompte, notre planificatrice vous contactera pour fixer la date et le créneau de votre intervention.

Nous restons à votre disposition pour toute question.

Bien professionnellement,
L''équipe Optimivv Déménagement
Votre nouveau départ commence ici !',
   '{demenagement,debarras}', 'client', 5),
  ('email', 'devis', 'Mail devis urgent — 100 % prépaiement (Déménagement)', 'Votre devis de déménagement — intervention urgente',
   E'Bonjour,

Suite à votre demande d''intervention urgente, veuillez trouver ci-joint votre devis de déménagement.

Compte tenu du caractère urgent et de la mobilisation rapide de nos équipes, cette prestation est soumise à un règlement intégral (100 %) avant l''intervention.

Pour confirmer votre réservation, merci de nous retourner le devis signé (mention « Bon pour accord ») et de procéder au règlement de la totalité, soit {montant.total}, par virement bancaire.

Coordonnées bancaires pour le virement :
IBAN : [à compléter]
BIC : [à compléter]
Titulaire : OPTIMIVV Déménagement

Dès réception du devis signé et du règlement, nous confirmerons immédiatement la date et le créneau d''intervention.

Nous restons à votre entière disposition.

Bien professionnellement,
L''équipe Optimivv Déménagement
Votre nouveau départ commence ici !',
   '{demenagement,debarras}', 'client', 6)
) as v(channel, category, name, subject, body, audiences, recipient, sort_order)
where not exists (select 1 from message_templates m where m.name = v.name);
