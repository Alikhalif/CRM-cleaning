-- NRP quick-actions for the "Divers" profile (client 2026-08-02):
--   1. Make the NRP SMS visible to Divers (add the 'divers' audience).
--   2. Add a dedicated NRP relance EMAIL (draft — editable in Settings).
-- Idempotent.

-- 1. NRP SMS → also visible to Divers.
update message_templates
set audiences = (
  select array(select distinct unnest(audiences || array['divers']))
)
where name = 'SMS relance — NRP (non joignable)';

-- 2. NRP relance email.
insert into message_templates (channel, category, name, subject, body, audiences)
select 'email', 'relance', 'Mail relance — NRP (non joignable)',
  'Votre demande — nous restons disponibles',
  E'Bonjour {client.prenom},\n\nVous nous avez formulé une demande pour une prestation et nous avons tenté de vous joindre par téléphone sans succès.\n\nNous restons à votre disposition pour échanger sur votre projet et planifier ensemble un rendez-vous.\n\nVous pouvez nous recontacter par retour d''email ou par téléphone, à votre convenance.\n\nDans l''attente de votre retour.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
  '{emission,divers}'::text[]
where not exists (
  select 1 from message_templates where name = 'Mail relance — NRP (non joignable)'
);
