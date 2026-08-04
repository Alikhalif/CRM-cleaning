-- Signature mode sub-status + planner can sign (client call 2026-08-02).
--
-- 1. A tracked "how was this devis signed" dimension, alongside the existing
--    sub_signature (sans/avec acompte):
--      logiciel      = signé via le logiciel de signature électronique
--      planificateur = signé manuellement par le/la planificateur·rice
--    Load-bearing for analytics (hand-signed vs. software-signed), same spirit
--    as the mano/auto Envoi split.
--
-- 2. Grants planners UPDATE on leads so they can move a lead to 'signe'. Until
--    now leads were owner/admin-only for writes; the planificateur was
--    read-only (CDC matrix §3.3). This is a deliberate role expansion —
--    mirrors the clients/documents policies that already allow planner writes.

create type sub_signature_mode as enum ('logiciel', 'planificateur');

alter table leads add column if not exists sub_signature_mode sub_signature_mode;

comment on column leads.sub_signature_mode is
  'How the devis was signed: logiciel = e-signature software, planificateur = marked signed manually by a planner.';

-- Planner can now UPDATE leads (previously owner/admin only).
drop policy if exists "leads updatable by owner or admin" on leads;
create policy "leads updatable by owner / admin / planner"
  on leads for update
  to authenticated
  using (owner_id = auth.uid() or is_admin() or is_planificateur())
  with check (owner_id = auth.uid() or is_admin() or is_planificateur());
