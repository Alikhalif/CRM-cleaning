-- Intervention delay desired by the client, captured post-signature by the
-- commercial during the closing call. Surfaces on the lead detail page
-- ("Délai d'intervention souhaité" card) and feeds the Planification team
-- so the planificatrice can prioritise scheduling.
--
-- intervention_delay = one of the 5 known buckets (or null = not captured)
-- intervention_delay_notes = free-text précisions ("présence requise",
-- "contrainte copropriété", etc.) — never structured, intentionally.

alter table leads add column intervention_delay text;
alter table leads add column intervention_delay_notes text;

alter table leads add constraint leads_intervention_delay_check
  check (
    intervention_delay is null
    or intervention_delay in ('sous_72h', '1_semaine', '15_jours', '1_mois', 'personnalise')
  );
