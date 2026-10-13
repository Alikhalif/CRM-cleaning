-- Les SMS signent du PRÉNOM du commercial, pas de son identité complète
-- (demande client 2026-10-13).
--
-- {commercial.nom} rend le displayName, soit « prénom + nom » : un SMS signé
-- « David Dem 1 » au lieu de « David ». La nouvelle variable
-- {commercial.prenom} rend le first_name seul (lib/message-templates-shared.ts),
-- avec repli sur le nom complet si l'appelant ne le fournit pas — mieux vaut
-- une signature trop complète qu'une signature absente.
--
-- Portée : canal SMS uniquement. Les modèles e-mail gardent {commercial.nom},
-- où l'identité complète reste la bonne forme.
--
-- Idempotent : la seconde exécution ne trouve plus rien à remplacer.

update message_templates
   set body = replace(body, '{commercial.nom}', '{commercial.prenom}')
 where channel = 'sms'
   and body like '%{commercial.nom}%';

update message_templates
   set subject = replace(subject, '{commercial.nom}', '{commercial.prenom}')
 where channel = 'sms'
   and subject like '%{commercial.nom}%';
