-- Suivi des demandes de chiffrage (client 2026-08-05) : relances, attribution,
-- et statut « Expirée ».
alter table intervenant_consultations add column if not exists relances integer not null default 0;
alter table intervenant_consultations add column if not exists last_relance_at timestamptz;
alter table intervenant_consultations add column if not exists attributed_at timestamptz;

alter table intervenant_consultations drop constraint if exists intervenant_consultations_status_check;
alter table intervenant_consultations add constraint intervenant_consultations_status_check
  check (status in ('envoyee', 'repondue', 'retenue', 'refusee', 'expiree'));
