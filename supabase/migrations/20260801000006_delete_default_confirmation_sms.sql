-- Remove the legacy generic "Confirmation intervention (SMS)" default template
-- (client request 2026-08-02) — kept only the role-scoped library. Idempotent.
delete from message_templates
where name = 'Confirmation intervention (SMS)' and channel = 'sms';
