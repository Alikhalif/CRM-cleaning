-- ── Drop the scaffold-anon-read policies (security hygiene) ───────────
-- Migration 0006 (20260516000001_scaffold_anon_read.sql) added `to anon`
-- SELECT policies so the unauthenticated app could read seed data while
-- screens were being wired. Now that Supabase Auth is in place and every
-- /(app) route is gated by proxy.ts, anon reads are no longer required.
--
-- The strict `to authenticated` policies from migration 0005 take over:
-- a commercial sees only their own leads, admins/planners see everything,
-- the immobTravaux annotation needs the granular permission, etc.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists "scaffold anon read activities"              on activities;
drop policy if exists "scaffold anon read lead_sources"            on lead_sources;
drop policy if exists "scaffold anon read payment_terms"           on payment_terms;
drop policy if exists "scaffold anon read legal_entities"          on legal_entities;
drop policy if exists "scaffold anon read legal_entity_activities" on legal_entity_activities;
drop policy if exists "scaffold anon read prestations"             on prestations;
drop policy if exists "scaffold anon read technicians"             on technicians;
drop policy if exists "scaffold anon read roles"                   on roles;
drop policy if exists "scaffold anon read leads"                   on leads;
drop policy if exists "scaffold anon read clients"                 on clients;
drop policy if exists "scaffold anon read documents"               on documents;
drop policy if exists "scaffold anon read document_lines"          on document_lines;
drop policy if exists "scaffold anon read dossiers"                on dossiers;
