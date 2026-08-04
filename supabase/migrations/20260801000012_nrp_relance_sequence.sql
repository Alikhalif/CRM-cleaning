-- NRP relance email sequence (client 2026-08-02, "use the same content" — the
-- Perfect Clean 74 example). Accusé de réception + 3 relances "non joignable",
-- with personal tokens parameterised: {client.prenom}, {societe.nom},
-- {societe.telephone}, {client.ville}, {lead.type_service}, {commercial.nom}.
-- Idempotent by name.

-- Drop the earlier placeholder NRP email (superseded by "Mail relance 1").
delete from message_templates where name = 'Mail relance — NRP (non joignable)';

insert into message_templates (channel, category, name, subject, body, audiences)
select v.channel, v.category, v.name, v.subject, v.body, v.audiences::text[]
from (values
  ('email', 'confirmation', 'Mail accusé de réception',
   'Bien reçu — votre demande de devis',
   E'Bonjour {client.prenom},\n\nIci {societe.nom} 🧼\n\nNous avons bien reçu votre demande de devis pour votre {lead.type_service}.\n\nUn de nos experts va vous rappeler au plus vite avec le numéro suivant : {societe.telephone} afin de réaliser votre devis.\n\nRestez attentif pour ne pas manquer notre appel,\n\nÀ très vite 🤩\n\n| L''équipe {societe.nom}\n| {societe.telephone}',
   '{entrant,emission,divers}'),

  ('email', 'relance', 'Mail relance 1 — non joignable',
   'Nous avons tenté de vous joindre',
   E'Bonjour,\n\nIci l''équipe {societe.nom},\n\nUn membre de notre équipe vient de tenter de vous appeler car vous avez rempli notre formulaire de demande de devis pour votre {lead.type_service} mais nous n''avons pas réussi à vous joindre...\n\nVous pouvez nous rappeler de vous-même au : {societe.telephone}\n\nProfitez-en pour rendre vos éléments tout propres !\n\nÀ très vite !\n\n| L''équipe {societe.nom}\n| {societe.telephone}',
   '{emission,divers}'),

  ('email', 'relance', 'Mail relance 2 — non joignable',
   'Rappelez-nous pour votre devis',
   E'Bonjour {client.prenom},\n\nVous avez rempli notre formulaire pour que l''on vous appelle afin de réaliser votre {lead.type_service} à {client.ville}.\n\nMais nous n''arrivons pas à vous joindre sur le numéro suivant : {societe.telephone}\n\nRappelez-nous au {societe.telephone} pour faire votre devis.\n\nSinon nous vous rappellerons demain !\n\n| L''équipe {societe.nom}\n| {societe.telephone}',
   '{emission,divers}'),

  ('email', 'relance', 'Mail relance 3 — non joignable',
   'Nous cherchons à vous joindre',
   E'Bonjour {client.prenom},\n\nIci {commercial.nom}, directeur de {societe.nom}, j''espère que vous allez bien ?\n\nNous n''arrivons pas à vous avoir au téléphone ces derniers jours, vous avez rempli notre formulaire de demande de devis concernant votre {lead.type_service}.\n\nN''hésitez pas à nous appeler au {societe.telephone}\n\nÀ bientôt !\n\n| L''équipe {societe.nom}\n| {societe.telephone}',
   '{emission,divers}')
) as v(channel, category, name, subject, body, audiences)
where not exists (
  select 1 from message_templates mt where mt.name = v.name
);
