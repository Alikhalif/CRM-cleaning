-- ═══════════════════════════════════════════════════════════════════════
-- ⚠️  TEMPORARY SCAFFOLD — REMOVE BEFORE PRODUCTION  ⚠️
--
-- Grants SELECT on every demo table to the `anon` role so the unauthenticated
-- Next.js app can read seed data while we build screens. Real RLS is in
-- migration 0005 and only activates once a user is logged in via Supabase
-- Auth (the `authenticated` role).
--
-- When auth is wired:
--   1. Run a follow-up migration that drops every policy created here.
--   2. Verify with `supabase db diff` that the only remaining policies are
--      the strict `to authenticated` ones from 0005.
--   3. Smoke-test that anon requests return 0 rows on `leads`/`documents`.
--
-- DO NOT ship this migration to production. It exposes the seeded demo
-- dataset to anyone with the anon key — which for a CRM is exactly the
-- vulnerability CDC §8.2 calls out.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Reference tables (low-sensitivity, scaffold + real prod both safe) ──
create policy "scaffold anon read activities"
  on activities for select to anon using (true);
create policy "scaffold anon read lead_sources"
  on lead_sources for select to anon using (true);
create policy "scaffold anon read payment_terms"
  on payment_terms for select to anon using (true);
create policy "scaffold anon read legal_entities"
  on legal_entities for select to anon using (true);
create policy "scaffold anon read legal_entity_activities"
  on legal_entity_activities for select to anon using (true);
create policy "scaffold anon read prestations"
  on prestations for select to anon using (true);
create policy "scaffold anon read technicians"
  on technicians for select to anon using (true);
create policy "scaffold anon read roles"
  on roles for select to anon using (true);

-- ── Business tables — sensitive in prod, fine for scaffold demo data ──
create policy "scaffold anon read leads"
  on leads for select to anon using (true);
create policy "scaffold anon read clients"
  on clients for select to anon using (true);
create policy "scaffold anon read documents"
  on documents for select to anon using (true);
create policy "scaffold anon read document_lines"
  on document_lines for select to anon using (true);
create policy "scaffold anon read dossiers"
  on dossiers for select to anon using (true);

-- Users intentionally NOT exposed — owner joins resolve to null when anon,
-- which matches the existing UI's "Non assigné" fallback.
