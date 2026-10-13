-- Deux modèles SMS « demande de photos » pour le Déménagement (demande client
-- 2026-10-13). L'activité avait un SMS de découverte, mais pas l'équivalent des
-- « SMS demande de photos » qui existent pour Débarras et Nettoyage.
--
-- Le prénom du commercial n'est PAS écrit en dur : {commercial.prenom} est
-- remplacé à l'ouverture du modal par le first_name de l'utilisateur connecté
-- (leadTemplateVars, app/(app)/leads/[id]/page.tsx). Les trois modèles SMS
-- existants signent « David » en dur et partent donc au nom de David quel que
-- soit l'expéditeur réel — ils ne sont pas touchés ici.
--
-- L'adresse e-mail est celle du Déménagement (devispro@optimivv-demenagement.com),
-- pas celle du Nettoyage reprise par les jumeaux Débarras/Nettoyage.
--
-- Audience 'demenagement' : visible par les profils debarras_demenagement et
-- performant. Catégorie 'photos' : réservée au groupe commercial.
--
-- Idempotent : rien n'est inséré si le nom existe déjà.

-- 1) Version courte, calquée sur « SMS demande de photos (Débarras) ».
insert into message_templates
  (channel, category, name, subject, body, audiences, recipient, is_active, sort_order)
select
  'sms',
  'photos',
  'SMS demande de photos (Déménagement)',
  null,
  $corps$dans la continuité de notre échange téléphonique vous trouverez ci joint mon email :

Devispro@optimivv-demenagement.com

Merci de m'envoyer par email les photos concernant les surfaces et éléments à déménager, préciser dans votre e-mail l'étage si appartement ou maison, vos nom, prénom, adresse pour l'établissement du devis.

Cordialement

{commercial.prenom}$corps$,
  array['demenagement']::text[],
  'client',
  true,
  0
where not exists (
  select 1 from message_templates where name = 'SMS demande de photos (Déménagement)'
);

-- 2) Version détaillée, en liste, quand le dossier demande plus de précision.
insert into message_templates
  (channel, category, name, subject, body, audiences, recipient, is_active, sort_order)
select
  'sms',
  'photos',
  'SMS demande de photos — détaillé (Déménagement)',
  null,
  $corps$Bonjour,

Suite à notre échange téléphonique, je vous communique notre adresse e-mail :

Devispro@optimivv-demenagement.com

Afin d'établir votre devis, merci de nous transmettre par e-mail :
- Des photos des pièces et des éléments à déménager
- Vos nom et prénom
- Les adresses complètes de départ et d'arrivée
- Les étages au départ et à l'arrivée, ainsi que la présence ou non d'un ascenseur

Dès réception de ces informations, nous procéderons à l'établissement de votre devis.

Cordialement,

{commercial.prenom}
Optimivv Déménagement$corps$,
  array['demenagement']::text[],
  'client',
  true,
  1
where not exists (
  select 1 from message_templates where name = 'SMS demande de photos — détaillé (Déménagement)'
);
