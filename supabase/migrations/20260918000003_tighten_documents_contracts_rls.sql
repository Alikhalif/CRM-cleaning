-- Recette 2026-09-18 · Correctif A03 (P1, cloisonnement / tenancy)
--
-- Les tables du module « Documents & Contrats » ont été livrées avec des
-- politiques de LECTURE ouvertes (`using (true)`) et, pour contract_passages,
-- une politique d'ÉCRITURE ouverte (`for all using(true) with check(true)`).
-- Conséquence : n'importe quel utilisateur authentifié (donc tout commercial)
-- peut lire les contrats / documents / passages de TOUS les clients, et
-- modifier/supprimer n'importe quel passage. Cela contredit le modèle « mine »
-- (CDC §3.4 / §8.2) déjà appliqué aux leads, clients et documents.
--
-- On restreint la LECTURE au même prédicat de propriété que la table `clients`
-- (admin OU planificateur OU propriétaire du lead source du client), et on
-- scope l'ÉCRITURE des passages de la même façon. Les écritures de contracts /
-- client_documents restent inchangées (déjà scopées `created_by`).
--
-- Additif : ne touche qu'aux politiques SELECT (et au for-all des passages).
-- `drop policy if exists` rend la migration idempotente.

-- ── client_documents : lecture scopée au propriétaire du client ──────────
drop policy if exists client_docs_select on client_documents;
create policy client_docs_select on client_documents
  for select to authenticated
  using (
    deleted_at is null
    and (
      is_admin()
      or is_planificateur()
      or exists (
        select 1 from clients c
        join leads l on l.id = c.source_lead_id
        where c.id = client_documents.client_id
          and l.owner_id = auth.uid()
      )
    )
  );

-- ── contracts : lecture scopée au propriétaire du client ─────────────────
drop policy if exists contracts_select on contracts;
create policy contracts_select on contracts
  for select to authenticated
  using (
    deleted_at is null
    and (
      is_admin()
      or is_planificateur()
      or exists (
        select 1 from clients c
        join leads l on l.id = c.source_lead_id
        where c.id = contracts.client_id
          and l.owner_id = auth.uid()
      )
    )
  );

-- ── contract_passages : lecture ET écriture scopées via le contrat ───────
-- L'ancienne paire (passages_select using(true) + passages_write for all
-- using(true)) est remplacée par une politique unique `for all` scopée : la
-- lecture, l'insertion, la mise à jour (statut de passage depuis la fiche
-- client) et la suppression exigent d'être admin / planificateur / propriétaire
-- du client rattaché au contrat.
drop policy if exists passages_select on contract_passages;
drop policy if exists passages_write on contract_passages;
create policy passages_all on contract_passages
  for all to authenticated
  using (
    is_admin()
    or is_planificateur()
    or exists (
      select 1 from contracts ct
      join clients c on c.id = ct.client_id
      join leads l on l.id = c.source_lead_id
      where ct.id = contract_passages.contract_id
        and l.owner_id = auth.uid()
    )
  )
  with check (
    is_admin()
    or is_planificateur()
    or exists (
      select 1 from contracts ct
      join clients c on c.id = ct.client_id
      join leads l on l.id = c.source_lead_id
      where ct.id = contract_passages.contract_id
        and l.owner_id = auth.uid()
    )
  );
