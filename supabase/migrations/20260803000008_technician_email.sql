-- Email de l'intervenant (sous-traitant), pour l'envoi des mails de mission
-- depuis la planification (client 2026-08-03).
alter table technicians add column if not exists email text;
