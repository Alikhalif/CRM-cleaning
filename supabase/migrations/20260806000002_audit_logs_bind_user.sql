-- Durcissement de la piste d'audit (audit sécurité 2026-08-06).
-- L'ancienne policy INSERT `with check (true)` laissait un utilisateur
-- authentifié forger des entrées (action/entité arbitraires, voire user_id
-- d'un tiers). On lie désormais user_id à l'appelant : impossible d'insérer
-- une entrée au nom de quelqu'un d'autre.
-- Les écritures sans session (webhooks) passent par le service-role, qui
-- bypasse la RLS — elles ne sont donc pas affectées.
drop policy if exists "audit_logs insertable by authenticated" on audit_logs;
create policy "audit_logs insertable by authenticated"
  on audit_logs for insert to authenticated
  with check (user_id = auth.uid());
