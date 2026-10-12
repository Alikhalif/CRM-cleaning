-- Nouveau modèle e-mail « Mail devis — virement (Déménagement) 100% »
-- (demande client 2026-10-12) : jumeau du modèle Débarras 100%, avec le mot
-- « débarras » remplacé par « déménagement ».
--
-- Deux écarts assumés par rapport à une copie littérale :
--   • la signature est celle de l'identité Déménagement (comme les quatre
--     autres modèles déménagement), et non « Optimivv Nettoyage » ;
--   • une virgule manquante avant « nous vous confirmerons » est ajoutée.
--
-- La variable {devis.numero} est remplacée côté serveur par /api/devis/envoyer.
-- Idempotent : rien n'est inséré si le nom existe déjà.

insert into message_templates
  (channel, category, name, subject, body, audiences, recipient, is_active, sort_order)
select
  'email',
  'devis',
  'Mail devis — virement (Déménagement) 100%',
  'Votre devis déménagement — {societe.nom}',
  $corps$Bonjour

Suite à notre échange téléphonique, veuillez trouver ci-joint le devis relatif à la prestation de déménagement demandée.

Pour valider votre devis, vous pouvez utiliser le lien de signature électronique ou simplement répondre à ce mail avec la mention « Bon pour accord – Devis n° {devis.numero} ».

Vous trouverez également en pièce jointe notre RIB pour le règlement du montant de la prestation.

Dès réception du devis signé ainsi que du règlement du devis, nous vous confirmerons par retour d'email la date d'intervention ainsi que le créneau horaire.

Bien professionnellement,
L'équipe Optimivv Déménagement
Votre nouveau départ commence ici !$corps$,
  array['entrant', 'emission', 'demenagement']::text[],
  'client',
  true,
  0
where not exists (
  select 1 from message_templates
   where name = 'Mail devis — virement (Déménagement) 100%'
);
