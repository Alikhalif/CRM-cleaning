-- Jumeaux E-MAIL des trois SMS « demande de photos » (demande client
-- 2026-10-13). Le commercial pouvait réclamer les photos par SMS, pas par
-- e-mail : le bouton « Model email » n'avait aucun modèle pour ça.
--
-- Une adaptation s'imposait et n'est pas une copie littérale : les SMS disent
-- « vous trouverez ci joint mon email : devispro@… », ce qui n'a aucun sens
-- dans un e-mail, où le client a déjà l'adresse sous les yeux et peut
-- simplement répondre. La phrase devient « Vous pouvez répondre directement à
-- ce mail », formulation déjà employée par « Déménagement — Découverte :
-- informations devis ».
--
-- Signature : le bloc d'équipe, comme TOUS les modèles e-mail. Les SMS signent
-- du prénom du commercial ; aucun e-mail de la bibliothèque ne le fait.
--
-- Catégorie 'photos' → groupe commercial, hors relances, donc visible sous le
-- bouton « Model email » et pas sous « Relance ».
--
-- Idempotent : rien n'est inséré si le nom existe déjà.

-- 1) Déménagement — version courte.
insert into message_templates
  (channel, category, name, subject, body, audiences, recipient, is_active, sort_order)
select
  'email', 'photos',
  'Mail demande de photos (Déménagement)',
  'Photos pour l''établissement de votre devis de déménagement',
  $corps$Bonjour,

Dans la continuité de notre échange téléphonique, afin d'établir votre devis de déménagement, merci de nous transmettre des photos des surfaces et des éléments à déménager.

Merci de préciser également l'étage (maison ou appartement), ainsi que vos nom, prénom et adresse, pour l'établissement du devis.

Vous pouvez répondre directement à ce mail en joignant les photos.

Dès réception de ces éléments, nous établirons votre devis dans les meilleurs délais.

Bien professionnellement,
L'équipe Optimivv Déménagement
Votre nouveau départ commence ici !$corps$,
  array['demenagement']::text[], 'client', true, 0
where not exists (
  select 1 from message_templates where name = 'Mail demande de photos (Déménagement)'
);

-- 2) Déménagement — version détaillée, en liste.
insert into message_templates
  (channel, category, name, subject, body, audiences, recipient, is_active, sort_order)
select
  'email', 'photos',
  'Mail demande de photos — détaillé (Déménagement)',
  'Photos et informations pour votre devis de déménagement',
  $corps$Bonjour,

Suite à notre échange téléphonique, afin d'établir votre devis de déménagement, merci de nous transmettre :
- Des photos des pièces et des éléments à déménager
- Vos nom et prénom
- Les adresses complètes de départ et d'arrivée
- Les étages au départ et à l'arrivée, ainsi que la présence ou non d'un ascenseur

Vous pouvez répondre directement à ce mail en joignant les éléments demandés.

Dès réception de ces informations, nous procéderons à l'établissement de votre devis.

Bien professionnellement,
L'équipe Optimivv Déménagement
Votre nouveau départ commence ici !$corps$,
  array['demenagement']::text[], 'client', true, 1
where not exists (
  select 1 from message_templates where name = 'Mail demande de photos — détaillé (Déménagement)'
);

-- 3) Débarras — version courte.
insert into message_templates
  (channel, category, name, subject, body, audiences, recipient, is_active, sort_order)
select
  'email', 'photos',
  'Mail demande de photos (Débarras)',
  'Photos pour l''établissement de votre devis débarras',
  $corps$Bonjour,

Dans la continuité de notre échange téléphonique, afin d'établir votre devis de débarras, merci de nous transmettre des photos des surfaces et des éléments à évacuer.

Merci de préciser également vos nom, prénom et adresse, pour l'établissement du devis.

Vous pouvez répondre directement à ce mail en joignant les photos.

Dès réception de ces éléments, nous établirons votre devis dans les meilleurs délais.

Bien professionnellement,
L'équipe Optimivv Nettoyage
La qualité professionnelle, la proximité d'un artisan$corps$,
  array['debarras']::text[], 'client', true, 0
where not exists (
  select 1 from message_templates where name = 'Mail demande de photos (Débarras)'
);
