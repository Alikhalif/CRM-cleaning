-- Remove the legacy generic "Demande de photos (SMS)" default template — it's
-- superseded by the role-scoped "SMS demande de photos (Nettoyage/Débarras)"
-- from the library (client request 2026-08-02). Idempotent.
delete from message_templates
where name = 'Demande de photos (SMS)' and channel = 'sms';
