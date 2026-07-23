-- Free-text "type de service" on leads (2026-07-22). A sub-qualifier inside the
-- sector (e.g. sector = demenagement, type_service = 'longue distance'; sector =
-- debarras, type_service = 'succession'). Captured from the landing-page form
-- via WF1 or entered manually in the CRM. No enum — free text.

alter table leads
  add column if not exists type_service text;
