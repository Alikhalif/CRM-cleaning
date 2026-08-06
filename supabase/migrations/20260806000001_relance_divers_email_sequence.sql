-- Séquence de relance email pour le profil commercial « Divers » (client 2026-08-06).
-- 4 emails : accusé de réception + 3 relances (inspirés d'un modèle nettoyage).
-- Marque = {societe.nom}, téléphones = {societe.telephone} (nous rappeler) /
-- {client.telephone} (numéro injoignable). Catégorie relance, audience divers,
-- destinataire client. Idempotent par nom. Corps en dollar-quoting.
insert into message_templates (channel, category, name, subject, body, audiences, recipient, sort_order)
select v.channel, v.category, v.name, v.subject, v.body, v.audiences::text[], v.recipient, v.sort_order
from (values
  ('email', 'relance', 'Divers — Accusé réception demande de devis (email)',
   'Nous avons bien reçu votre demande de devis',
   $D$Bonjour {client.prenom},

Ici {societe.nom} 🫧

Nous avons bien reçu votre demande de devis pour le nettoyage de voiture.

Un de nos experts va vous rappeler au plus vite avec le numéro suivant : {societe.telephone} afin de réaliser votre devis.

Restez attentif pour ne pas manquer notre appel,

À très vite 🤩

| L'équipe {societe.nom}$D$,
   '{divers}', 'client', 1),

  ('email', 'relance', 'Divers — Relance 1 nettoyage (email)',
   'Nous avons tenté de vous joindre',
   $D$Bonjour,

Ici l'équipe {societe.nom},

Un membre de notre équipe vient de tenter de vous appeler car vous avez rempli notre formulaire de demande de devis pour votre nettoyage de voiture mais nous n'avons pas réussi à vous joindre...

Vous pouvez nous rappeler de vous-même au : {societe.telephone}

Profitez-en pour rendre vos éléments tout propres !

À très vite !

| L'équipe {societe.nom}
| {societe.telephone}$D$,
   '{divers}', 'client', 2),

  ('email', 'relance', 'Divers — Relance 2 nettoyage (email)',
   'Nous n''arrivons pas à vous joindre',
   $D$Bonjour {client.prenom},

Vous avez rempli notre formulaire pour que l'on vous appelle afin de nettoyer votre voiture ou autre à {client.ville}.

Mais nous n'arrivons pas à vous joindre sur le numéro suivant : {client.telephone}

Rappelez-nous au {societe.telephone} pour faire votre devis.

Sinon nous vous rappellerons demain !

| L'équipe {societe.nom}
| {societe.telephone}$D$,
   '{divers}', 'client', 3),

  ('email', 'relance', 'Divers — Relance 3 nettoyage — mot du directeur (email)',
   'Un mot de notre directeur',
   $D$Bonjour {client.prenom},

Ici Lionel, directeur de {societe.nom}, j'espère que vous allez bien ?

Nous n'arrivons pas à vous avoir au téléphone ces derniers jours. Vous avez rempli notre formulaire de demande de devis concernant le nettoyage de votre voiture.

N'hésitez pas à nous appeler au {societe.telephone}.

À bientôt !

| L'équipe {societe.nom}
| {societe.telephone}$D$,
   '{divers}', 'client', 4)
) as v(channel, category, name, subject, body, audiences, recipient, sort_order)
where not exists (select 1 from message_templates mt where mt.name = v.name);
