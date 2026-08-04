-- Add the "NRP débarras" relance SMS (client 2026-08-02), verbatim content.
-- Audience: emission (all relances) + debarras (sector relance éventuelle).
-- Idempotent by name.
insert into message_templates (channel, category, name, subject, body, audiences)
select 'sms', 'relance', 'SMS relance — NRP (Débarras)', null,
  E'Bonjour Mme\n\nVous m''avez formulé une demande pour un debarras.\n\nJe suis bien disponible.\n\nMerci de me recontacter afin que je puisse prendre vos informations et planifier avec vous un rendez-vous.\n\nCordialement\n\nDavid',
  '{emission,debarras}'::text[]
where not exists (
  select 1 from message_templates where name = 'SMS relance — NRP (Débarras)'
);
