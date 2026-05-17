-- ── Indexes ───────────────────────────────────────────────────────────
-- Cover the common access paths used by the current screens. FK columns
-- get btree indexes; the heavy hitters get partial indexes for the
-- "not deleted" predicate.
-- ─────────────────────────────────────────────────────────────────────

-- leads
create index idx_leads_owner_id        on leads (owner_id) where deleted_at is null;
create index idx_leads_status          on leads (status) where deleted_at is null;
create index idx_leads_activity_id     on leads (activity_id);
create index idx_leads_source_id       on leads (source_id);
create index idx_leads_received_at     on leads (received_at desc);
create index idx_leads_email           on leads (lower(client_email)) where client_email is not null;
create index idx_leads_phone           on leads (client_phone) where client_phone is not null;

-- clients
create index idx_clients_source        on clients (source);
create index idx_clients_type          on clients (type);
create index idx_clients_source_lead_id on clients (source_lead_id) where source_lead_id is not null;
create index idx_clients_name_lower    on clients (lower(name));

-- documents
create index idx_documents_lead_id     on documents (lead_id);
create index idx_documents_client_id   on documents (client_id);
create index idx_documents_entity_id   on documents (entity_id);
create index idx_documents_status      on documents (status);
create index idx_documents_type        on documents (type);
create index idx_documents_issued_at   on documents (issued_at desc);

-- document_lines
create index idx_document_lines_document_id on document_lines (document_id);

-- dossiers
create index idx_dossiers_lead_id      on dossiers (lead_id);
create index idx_dossiers_status       on dossiers (status);
create index idx_dossiers_payment      on dossiers (payment_status);
create index idx_dossiers_technician_id on dossiers (technician_id) where technician_id is not null;
create index idx_dossiers_planned_at   on dossiers (planned_at) where planned_at is not null;

-- audit_logs — query by entity is the dominant pattern (CDC §8.6).
create index idx_audit_logs_entity     on audit_logs (entity_type, entity_id, created_at desc);
create index idx_audit_logs_user       on audit_logs (user_id, created_at desc);

-- prestations
create index idx_prestations_activity  on prestations (activity_id) where is_active = true;
