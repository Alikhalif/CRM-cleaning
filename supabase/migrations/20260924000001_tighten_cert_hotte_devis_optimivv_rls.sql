-- Recette 2026-09-24 · Correctif P1 (cloisonnement / tenancy) — suite de A03.
--
-- `cert_hotte` et `devis_optimivv` (cette dernière stocke aussi les FACTURES
-- OPTIMIVV) ont été livrées avec une politique de LECTURE ouverte `using (true)`.
-- Conséquence (confirmée en test réel le 2026-09-24) : n'importe quel utilisateur
-- authentifié — donc tout commercial via la clé anon — lit les noms, emails et
-- montants de TOUS les clients. Même classe de fuite que A03
-- (20260918000003_tighten_documents_contracts_rls), mais ces deux tables avaient
-- été oubliées.
--
-- On restreint la LECTURE au même prédicat de propriété que le reste du CRM :
-- admin OU planificateur OU propriétaire du lead rattaché (leads.owner_id via
-- la colonne lead_id présente sur les deux tables). Les ÉCRITURES passent déjà
-- par le service-role (aucune policy authenticated d'insert) → inchangées, et
-- toutes les lectures applicatives passent aussi par le service-role (qui ignore
-- la RLS), donc ce durcissement n'a AUCUN impact fonctionnel : il ne ferme que
-- l'accès direct via la clé anon.
--
-- Additif + idempotent (`drop policy if exists`).

-- ── cert_hotte : lecture scopée au propriétaire du lead ──────────────────
drop policy if exists cert_hotte_select_authenticated on cert_hotte;
drop policy if exists cert_hotte_select on cert_hotte;
create policy cert_hotte_select on cert_hotte
  for select to authenticated
  using (
    is_admin()
    or is_planificateur()
    or exists (
      select 1 from leads l
      where l.id = cert_hotte.lead_id
        and l.owner_id = auth.uid()
    )
  );

-- ── devis_optimivv (+ factures OPTIMIVV) : lecture scopée au propriétaire ─
drop policy if exists devis_optimivv_select_authenticated on devis_optimivv;
drop policy if exists devis_optimivv_select on devis_optimivv;
create policy devis_optimivv_select on devis_optimivv
  for select to authenticated
  using (
    is_admin()
    or is_planificateur()
    or exists (
      select 1 from leads l
      where l.id = devis_optimivv.lead_id
        and l.owner_id = auth.uid()
    )
  );
