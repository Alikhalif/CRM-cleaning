-- ============================================================================
-- Champs spécifiques au secteur DÉMÉNAGEMENT sur les leads (formulaire site déména.).
-- Additif : départ / arrivée / volume / date de déménagement, à côté des champs
-- existants. Alimentés par le webhook WF1. N'altère aucune donnée existante.
-- ============================================================================

alter table leads add column if not exists move_from_city   text;
alter table leads add column if not exists move_from_postal text;
alter table leads add column if not exists move_to_city     text;
alter table leads add column if not exists move_to_postal   text;
alter table leads add column if not exists move_volume      text;  -- ex. "30-50" (m³)
alter table leads add column if not exists move_date        date;  -- date souhaitée

comment on column leads.move_volume is 'Volume estimé du déménagement (ex. "30-50" m³). Renseigné par WF1.';
