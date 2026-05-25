-- "Notes d'appel" — free-text field captured by the commercial on the lead
-- detail page. Autosaves on every pause. The init schema only had
-- annotation_segment + immob_travaux_annotation (both specific use cases);
-- we need a general-purpose notes column for the daily-driver call log.

alter table leads add column notes text;
