-- Nouveau modèle e-mail « Mail devis urgent — 100 % prépaiement (Déménagement) »
-- (demande client 2026-10-12) : jumeau du modèle Débarras urgent, avec
-- « débarras » remplacé par « déménagement ».
--
-- Un seul écart à la copie littérale : la signature est celle de l'identité
-- Déménagement, comme les autres modèles de cette activité, et non
-- « Optimivv Nettoyage ».
--
-- La variable {devis.numero} est remplacée côté serveur par /api/devis/envoyer.
-- Idempotent : rien n'est inséré si le nom existe déjà.

insert into message_templates
  (channel, category, name, subject, body, audiences, recipient, is_active, sort_order)
select
  'email',
  'devis',
  'Mail devis urgent — 100 % prépaiement (Déménagement)',
  'Votre devis déménagement (urgent) — {societe.nom}',
  $corps$Bonjour

Suite à notre échange téléphonique, veuillez trouver ci-joint, comme convenu, le devis relatif à la prestation du déménagement.

Pour valider votre devis, vous pouvez utiliser le lien de signature électronique ou simplement répondre à ce mail avec la mention « Bon pour accord – Devis n° {devis.numero} ».

Vous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.

Afin de permettre une planification rapide de cette intervention demandée en urgence, nous vous remercions d'effectuer un virement instantané dès réception du présent mail.

Dès réception du devis signé ainsi que du règlement, nous vous confirmerons par retour d'email la date d'intervention ainsi que le créneau horaire prévu.

À titre exceptionnel, compte tenu du caractère urgent de votre demande, nous sommes en mesure de vous proposer une intervention le ….

Bien professionnellement,
L'équipe Optimivv Déménagement
Votre nouveau départ commence ici !$corps$,
  array['entrant', 'emission', 'demenagement']::text[],
  'client',
  true,
  0
where not exists (
  select 1 from message_templates
   where name = 'Mail devis urgent — 100 % prépaiement (Déménagement)'
);
