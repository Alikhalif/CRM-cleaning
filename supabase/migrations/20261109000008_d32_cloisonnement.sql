-- ============================================================================
-- D32 — Cloisonnement des données par PAYS et ENTITÉ JURIDIQUE, en base
-- (2026-11-09)
--
-- ⚠️ PRÉPARÉE, NON APPLIQUÉE. Recette d'abord ; production sur autorisation.
-- GÉNÉRÉE en partie : la section « Politiques » est produite par
-- scripts/d32/generer.ts à partir du schéma effectif ; ne pas la retoucher à
-- la main — corriger le générateur, puis régénérer.
--
-- ── LE CONSTAT (D32, confirmé) ───────────────────────────────────────────
--
-- Les politiques de lecture et d'écriture de 30 tables métier accordaient
-- `is_planificateur()` sur TOUTES les lignes. Le cloisonnement par pays
-- n'existait qu'à l'écran (A17) : une planificatrice qui interrogeait l'API
-- lisait les dossiers des autres pays et des autres sociétés.
--
-- ── LA RÈGLE ─────────────────────────────────────────────────────────────
--
-- Super Admin : tout (`is_admin()`, inchangé dans chaque politique).
-- Commercial  : ses propres lignes (branches `owner_id`, inchangées).
-- Planificatrice, selon son MODE :
--   · strict  — elle ne voit une ligne que si son PAYS est dans
--               `users.countries` ET son ENTITÉ dans `users.entites_autorisees`.
--               Aucune entité cochée = AUCUN accès. Pays ou entité inconnus =
--               refus (fail-closed). C'est le mode de TOUT NOUVEAU compte.
--   · herite  — son accès d'AVANT D32, inchangé. Posé par cette migration sur
--               les planificatrices EXISTANTES, pour n'en bloquer aucune sans
--               inventaire et validation (instruction du client). Il se lève
--               compte par compte : supabase/procedures/d32-passage-strict.sql.
--
-- ── POURQUOI DES FONCTIONS « LIGNE » ET DES FONCTIONS « PAR ID » ──────────
--
-- Une politique d'INSERTION ne peut pas chercher la ligne par son id : elle
-- n'existe pas encore. Les tables de premier niveau (leads, clients,
-- documents, contrats, contrats de sous-traitance) sont donc jugées sur LEURS
-- colonnes ; les tables enfants, sur leur parent (qui, lui, existe).
-- Toutes sont SECURITY DEFINER : elles lisent les tables de rattachement sans
-- repasser par leurs politiques (pas de récursion), et ne renvoient qu'un
-- booléen.
-- ============================================================================

-- ── 0. Les autorisations : mode et clients sans lead ─────────────────────
alter table users
  add column if not exists perimetre_herite boolean not null default false;

comment on column users.perimetre_herite is
  'D32 — VRAI : accès d''avant D32 conservé (planificatrices existantes, en attendant validation). '
  'FAUX : cloisonnement strict par pays ET entité. Défaut FAUX : tout nouveau compte est strict.';

-- Migration CONTRÔLÉE des comptes existants : aucune planificatrice n'est
-- bloquée par cette migration. La liste des comptes concernés se lit à
-- l'étape 1 de supabase/procedures/d32-passage-strict.sql.
update users u
   set perimetre_herite = true
 where exists (select 1 from user_roles ur join roles r on r.id = ur.role_id
                where ur.user_id = u.id and r.slug = 'planification');

-- Clients SANS lead (clients directs) : rien ne disait leur pays ni leur
-- société. Colonnes nullables, renseignées par le back-office ; tant qu'elles
-- sont vides, un client direct n'est visible qu'en mode « herite » et par
-- l'admin.
alter table clients
  add column if not exists pays      text,
  add column if not exists entite_id uuid references legal_entities (id) on delete set null;

-- ── 1. Le mode et la règle ───────────────────────────────────────────────
create or replace function planif_mode()
returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when not exists (select 1 from user_roles ur join roles r on r.id = ur.role_id
                      where ur.user_id = auth.uid() and r.slug = 'planification') then 'aucun'
    when coalesce((select perimetre_herite from users where id = auth.uid()), false) then 'herite'
    else 'strict'
  end;
$$;

create or replace function planif_perimetre(p_pays text, p_entite uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select case planif_mode()
    when 'aucun'  then false
    when 'herite' then true
    else exists (
      select 1 from users u
       where u.id = auth.uid()
         and p_pays is not null and p_pays = any (u.countries)
         and p_entite is not null and p_entite = any (u.entites_autorisees)
    )
  end;
$$;

-- ── 2. Par LIGNE (tables de premier niveau : vrai aussi à l'insertion) ────
create or replace function planif_lead(p_lead uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select planif_perimetre(l.country, l.entity_id) from leads l where l.id = p_lead),
    planif_mode() = 'herite');
$$;

create or replace function planif_client_ligne(p_source_lead uuid, p_pays text, p_entite uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select planif_perimetre(
    coalesce(p_pays,   (select l.country   from leads l where l.id = p_source_lead)),
    coalesce(p_entite, (select l.entity_id from leads l where l.id = p_source_lead)));
$$;

-- Un document : le pays du lead (à défaut, celui du client, puis celui de la
-- société émettrice) ; l'entité = la société ÉMETTRICE.
create or replace function planif_document_ligne(p_lead uuid, p_client uuid, p_entite uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select planif_perimetre(
    coalesce((select l.country from leads l where l.id = p_lead),
             (select coalesce(c.pays, cl.country) from clients c left join leads cl on cl.id = c.source_lead_id where c.id = p_client),
             (select e.country from legal_entities e where e.id = p_entite)),
    coalesce(p_entite, (select l.entity_id from leads l where l.id = p_lead)));
$$;

create or replace function planif_st_ligne(p_lead uuid, p_entite uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select planif_perimetre(
    coalesce((select l.country from leads l where l.id = p_lead),
             (select e.country from legal_entities e where e.id = p_entite)),
    coalesce(p_entite, (select l.entity_id from leads l where l.id = p_lead)));
$$;

-- ── 3. Par ID (tables enfants : le parent existe toujours) ───────────────
create or replace function planif_client(p_client uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select planif_client_ligne(c.source_lead_id, c.pays, c.entite_id) from clients c where c.id = p_client),
    planif_mode() = 'herite');
$$;

create or replace function planif_document(p_document uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select planif_document_ligne(d.lead_id, d.client_id, d.entity_id) from documents d where d.id = p_document),
    planif_mode() = 'herite');
$$;

create or replace function planif_contrat(p_contrat uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select planif_document_ligne(c.lead_id, c.client_id, c.entity_id) from contracts c where c.id = p_contrat),
    planif_mode() = 'herite');
$$;

create or replace function planif_lead_ou_dossier(p_lead uuid, p_dossier uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select planif_lead(coalesce(p_lead, (select x.lead_id from dossiers x where x.id = p_dossier)));
$$;

create or replace function planif_signature(p_demande uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select case when s.document_id is not null then planif_document(s.document_id) else planif_lead(s.lead_id) end
       from signature_requests s where s.id = p_demande),
    planif_mode() = 'herite');
$$;

create or replace function planif_soustraitance(p_contrat uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select planif_st_ligne(c.lead_id, c.entity_id) from subcontract_contracts c where c.id = p_contrat),
    planif_mode() = 'herite');
$$;

create or replace function planif_rapport_st(p_rapport uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select planif_soustraitance(r.contract_id) from subcontract_reports r where r.id = p_rapport),
    planif_mode() = 'herite');
$$;

-- Facture d'un sous-traitant : rattachée à un dossier → le périmètre du
-- dossier ; sans dossier, c'est une pièce de l'ANNUAIRE fournisseurs, ouverte
-- à la planification comme l'annuaire lui-même (D35, décision ouverte).
create or replace function planif_facture_st(p_dossier uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select case when p_dossier is null then planif_mode() <> 'aucun'
              else planif_lead((select x.lead_id from dossiers x where x.id = p_dossier)) end;
$$;

-- ── 3 bis. Tables révélées par la seconde lecture (blocs DO sans boucle) ──
create or replace function planif_dossier(p_dossier uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select planif_lead_ou_dossier(null, p_dossier);
$$;

create or replace function planif_action_commerciale(p_action uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select planif_lead(a.lead_id) from commercial_actions a where a.id = p_action), planif_mode() = 'herite');
$$;

create or replace function planif_tache_commerciale(p_tache uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select planif_lead(t.lead_id) from commercial_tasks t where t.id = p_tache), planif_mode() = 'herite');
$$;

-- Archive DocuSign : par le contrat de sous-traitance, à défaut le client, à
-- défaut la société émettrice (toujours renseignée).
create or replace function planif_archive(p_contrat uuid, p_client uuid, p_entite uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when p_contrat is not null then planif_soustraitance(p_contrat)
    when p_client  is not null then planif_client(p_client)
    else planif_st_ligne(null, p_entite)
  end;
$$;

create or replace function planif_enveloppe_ligne(p_contrat uuid, p_entite uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select case when p_contrat is not null then planif_soustraitance(p_contrat)
              else planif_st_ligne(null, p_entite) end;
$$;

-- `docusign_envelope_events.envelope_id` est l'identifiant TEXTE DocuSign.
create or replace function planif_enveloppe(p_enveloppe text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select planif_enveloppe_ligne(e.contract_id, e.entity_id) from docusign_envelopes e where e.envelope_id = p_enveloppe),
                  planif_mode() = 'herite');
$$;

-- Ces fonctions ne renvoient qu'un booléen sur le périmètre de l'APPELANT :
-- elles s'emploient dans les politiques, pas comme une API.
do $g$
declare f text;
begin
  foreach f in array array[
    'planif_mode()', 'planif_perimetre(text, uuid)', 'planif_lead(uuid)',
    'planif_client_ligne(uuid, text, uuid)', 'planif_document_ligne(uuid, uuid, uuid)',
    'planif_st_ligne(uuid, uuid)', 'planif_client(uuid)', 'planif_document(uuid)',
    'planif_contrat(uuid)', 'planif_lead_ou_dossier(uuid, uuid)', 'planif_signature(uuid)',
    'planif_soustraitance(uuid)', 'planif_rapport_st(uuid)', 'planif_facture_st(uuid)',
    'planif_dossier(uuid)', 'planif_action_commerciale(uuid)', 'planif_tache_commerciale(uuid)',
    'planif_archive(uuid, uuid, uuid)', 'planif_enveloppe_ligne(uuid, uuid)', 'planif_enveloppe(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$g$;

-- ── 4. Les notifications (D31) suivent le mode ───────────────────────────
-- « herite » : la règle de D31 (pays ; entités si cochées). « strict » : la
-- règle de D32 (pays ET entité, aucune entité = rien).
create or replace function notification_dans_perimetre(p_user uuid, p_pays text, p_entite uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when p_pays is null then true
    when exists (select 1 from user_roles ur join roles r on r.id = ur.role_id
                  where ur.user_id = p_user and r.slug = 'admin') then true
    when exists (select 1 from user_roles ur join roles r on r.id = ur.role_id
                  where ur.user_id = p_user and r.slug = 'planification') then
      exists (
        select 1 from users u
         where u.id = p_user
           and p_pays = any (u.countries)
           and case when u.perimetre_herite
                    then cardinality(u.entites_autorisees) = 0
                         or (p_entite is not null and p_entite = any (u.entites_autorisees))
                    else p_entite is not null and p_entite = any (u.entites_autorisees)
               end
      )
    else true
  end;
$$;

-- ── 5. D33 — compteurs SANS RLS : écrits par des fonctions SECURITY DEFINER
--      seulement ; aucune session n'a à les lire ni à les modifier. ───────────
alter table cert_hotte_counters       enable row level security;
alter table contract_counters         enable row level security;
alter table devis_optimivv_counters   enable row level security;
alter table facture_optimivv_counters enable row level security;

-- ── 6. D34 — fonctions de numérotation encore exécutables par PUBLIC ─────
--      (donc par la clé anonyme) : chaque appel brûle un numéro.
revoke all on function next_contract_num(integer) from public, anon;
grant execute on function next_contract_num(integer) to authenticated, service_role;
revoke all on function allocate_subcontract_ref(text, text) from public, anon;
grant execute on function allocate_subcontract_ref(text, text) to authenticated, service_role;
revoke all on function allocate_document_archive_ref(text) from public, anon;
grant execute on function allocate_document_archive_ref(text) to authenticated, service_role;

-- ── 7. Politiques ────────────────────────────────────────────────────────
-- (section GÉNÉRÉE par scripts/d32/generer.ts — ne pas modifier à la main)

-- actions_back_office · « actions_bo_select » (20261109000007_notifications_perimetre.sql)
drop policy if exists "actions_bo_select" on actions_back_office;
create policy "actions_bo_select" on actions_back_office
  for select to authenticated using ( is_admin() or (planif_perimetre(actions_back_office.pays, actions_back_office.entite_id) and role_cible = 'planification' and pays is not null and notification_dans_perimetre(auth.uid(), pays, entite_id)) );

-- cert_hotte · « cert_hotte_select » (20260924000001_tighten_cert_hotte_devis_optimivv_rls.sql)
drop policy if exists "cert_hotte_select" on cert_hotte;
create policy "cert_hotte_select" on cert_hotte
  for select to authenticated using ( is_admin() or planif_lead_ou_dossier(cert_hotte.lead_id, cert_hotte.dossier_id) or exists ( select 1 from leads l where l.id = cert_hotte.lead_id and l.owner_id = auth.uid() ) );

-- client_documents · « client_docs_delete » (20260915000001_client_documents.sql)
drop policy if exists "client_docs_delete" on client_documents;
create policy "client_docs_delete" on client_documents
  for delete to authenticated using (created_by = auth.uid() or is_admin() or planif_client(client_documents.client_id));

-- client_documents · « client_docs_insert » (20260915000001_client_documents.sql)
drop policy if exists "client_docs_insert" on client_documents;
create policy "client_docs_insert" on client_documents
  for insert to authenticated with check (created_by = auth.uid() or is_admin() or planif_client(client_documents.client_id));

-- client_documents · « client_docs_select » (20260918000003_tighten_documents_contracts_rls.sql)
drop policy if exists "client_docs_select" on client_documents;
create policy "client_docs_select" on client_documents
  for select to authenticated using ( deleted_at is null and ( is_admin() or planif_client(client_documents.client_id) or exists ( select 1 from clients c join leads l on l.id = c.source_lead_id where c.id = client_documents.client_id and l.owner_id = auth.uid() ) ) );

-- client_documents · « client_docs_update » (20260915000001_client_documents.sql)
drop policy if exists "client_docs_update" on client_documents;
create policy "client_docs_update" on client_documents
  for update to authenticated using (created_by = auth.uid() or is_admin() or planif_client(client_documents.client_id));

-- clients · « clients visible to admin / planner / lead-owner » (20260515000005_init_rls.sql)
drop policy if exists "clients visible to admin / planner / lead-owner" on clients;
create policy "clients visible to admin / planner / lead-owner" on clients
  for select to authenticated using ( deleted_at is null and ( is_admin() or planif_client_ligne(clients.source_lead_id, clients.pays, clients.entite_id) or ( source_lead_id is not null and exists ( select 1 from leads l where l.id = clients.source_lead_id and l.owner_id = auth.uid() ) ) ) );

-- clients · « clients writable by admin / planner » (20260515000005_init_rls.sql)
drop policy if exists "clients writable by admin / planner" on clients;
create policy "clients writable by admin / planner" on clients
  for all to authenticated using (is_admin() or planif_client_ligne(clients.source_lead_id, clients.pays, clients.entite_id)) with check (is_admin() or planif_client_ligne(clients.source_lead_id, clients.pays, clients.entite_id));

-- commercial_action_events · « comm_events_read » (20260911000001_commercial_actions.sql)
drop policy if exists "comm_events_read" on commercial_action_events;
create policy "comm_events_read" on commercial_action_events
  for select to authenticated using ( is_admin() or planif_action_commerciale(commercial_action_events.action_id) or exists (select 1 from commercial_actions a where a.id = action_id and a.owner_id = auth.uid()) );

-- commercial_actions · « comm_actions_select » (20260911000001_commercial_actions.sql)
drop policy if exists "comm_actions_select" on commercial_actions;
create policy "comm_actions_select" on commercial_actions
  for select to authenticated using (owner_id = auth.uid() or is_admin() or planif_lead(commercial_actions.lead_id));

-- commercial_task_events · « comm_task_events_select » (20261024000001_mes_actions_taches.sql)
drop policy if exists "comm_task_events_select" on commercial_task_events;
create policy "comm_task_events_select" on commercial_task_events
  for select to authenticated using ( is_admin() or planif_tache_commerciale(commercial_task_events.task_id) or exists (select 1 from commercial_tasks t where t.id = task_id and t.owner_id = auth.uid()) );

-- commercial_tasks · « comm_tasks_select » (20261024000001_mes_actions_taches.sql)
drop policy if exists "comm_tasks_select" on commercial_tasks;
create policy "comm_tasks_select" on commercial_tasks
  for select to authenticated using (owner_id = auth.uid() or is_admin() or planif_lead(commercial_tasks.lead_id));

-- contract_passages · « passages_all » (20260918000003_tighten_documents_contracts_rls.sql)
drop policy if exists "passages_all" on contract_passages;
create policy "passages_all" on contract_passages
  for all to authenticated using ( is_admin() or planif_contrat(contract_passages.contract_id) or exists ( select 1 from contracts ct join clients c on c.id = ct.client_id join leads l on l.id = c.source_lead_id where ct.id = contract_passages.contract_id and l.owner_id = auth.uid() ) ) with check ( is_admin() or planif_contrat(contract_passages.contract_id) or exists ( select 1 from contracts ct join clients c on c.id = ct.client_id join leads l on l.id = c.source_lead_id where ct.id = contract_passages.contract_id and l.owner_id = auth.uid() ) );

-- contracts · « contracts_delete » (20260915000002_contracts.sql)
drop policy if exists "contracts_delete" on contracts;
create policy "contracts_delete" on contracts
  for delete to authenticated using (created_by = auth.uid() or is_admin() or planif_document_ligne(contracts.lead_id, contracts.client_id, contracts.entity_id));

-- contracts · « contracts_insert » (20260915000002_contracts.sql)
drop policy if exists "contracts_insert" on contracts;
create policy "contracts_insert" on contracts
  for insert to authenticated with check (created_by = auth.uid() or is_admin() or planif_document_ligne(contracts.lead_id, contracts.client_id, contracts.entity_id));

-- contracts · « contracts_select » (20260918000003_tighten_documents_contracts_rls.sql)
drop policy if exists "contracts_select" on contracts;
create policy "contracts_select" on contracts
  for select to authenticated using ( deleted_at is null and ( is_admin() or planif_document_ligne(contracts.lead_id, contracts.client_id, contracts.entity_id) or exists ( select 1 from clients c join leads l on l.id = c.source_lead_id where c.id = contracts.client_id and l.owner_id = auth.uid() ) ) );

-- contracts · « contracts_update » (20260915000002_contracts.sql)
drop policy if exists "contracts_update" on contracts;
create policy "contracts_update" on contracts
  for update to authenticated using (created_by = auth.uid() or is_admin() or planif_document_ligne(contracts.lead_id, contracts.client_id, contracts.entity_id));

-- contrat_liens_acces · « contrat_liens_acces_select » (20261109000004_contrat_liens_acces.sql)
drop policy if exists "contrat_liens_acces_select" on contrat_liens_acces;
create policy "contrat_liens_acces_select" on contrat_liens_acces
  for select to authenticated using (is_admin() or planif_contrat(contrat_liens_acces.contract_id));

-- devis_optimivv · « devis_optimivv_select » (20260924000001_tighten_cert_hotte_devis_optimivv_rls.sql)
drop policy if exists "devis_optimivv_select" on devis_optimivv;
create policy "devis_optimivv_select" on devis_optimivv
  for select to authenticated using ( is_admin() or planif_lead(devis_optimivv.lead_id) or exists ( select 1 from leads l where l.id = devis_optimivv.lead_id and l.owner_id = auth.uid() ) );

-- document_archive · « docarch_backoffice » (20261031000002_docusign_archive_entites.sql)
drop policy if exists "docarch_backoffice" on document_archive;
create policy "docarch_backoffice" on document_archive
  for select to authenticated using (is_admin() or planif_archive(document_archive.contract_id, document_archive.client_id, document_archive.entity_id));

-- document_lines · « document_lines follow parent document » (20260515000005_init_rls.sql)
drop policy if exists "document_lines follow parent document" on document_lines;
create policy "document_lines follow parent document" on document_lines
  for all to authenticated using ( exists ( select 1 from documents d where d.id = document_lines.document_id and ( is_admin() or planif_document(document_lines.document_id) or ( d.lead_id is not null and exists ( select 1 from leads l where l.id = d.lead_id and l.owner_id = auth.uid() ) ) ) ) ) with check ( exists ( select 1 from documents d where d.id = document_lines.document_id and ( is_admin() or planif_document(document_lines.document_id) or ( d.lead_id is not null and exists ( select 1 from leads l where l.id = d.lead_id and l.owner_id = auth.uid() ) ) ) ) );

-- document_versions · « document_versions écrivable comme le devis » (20261108000001_document_versions_historique_devis.sql)
drop policy if exists "document_versions écrivable comme le devis" on document_versions;
create policy "document_versions écrivable comme le devis" on document_versions
  for insert to authenticated with check ( exists ( select 1 from documents d where d.id = document_versions.document_id and d.deleted_at is null and ( is_admin() or planif_document(document_versions.document_id) or ( d.lead_id is not null and exists ( select 1 from leads l where l.id = d.lead_id and l.owner_id = auth.uid() ) ) ) ) );

-- document_versions · « document_versions visible comme le devis » (20261108000001_document_versions_historique_devis.sql)
drop policy if exists "document_versions visible comme le devis" on document_versions;
create policy "document_versions visible comme le devis" on document_versions
  for select to authenticated using ( exists ( select 1 from documents d where d.id = document_versions.document_id and d.deleted_at is null and ( is_admin() or planif_document(document_versions.document_id) or ( d.lead_id is not null and exists ( select 1 from leads l where l.id = d.lead_id and l.owner_id = auth.uid() ) ) ) ) );

-- documents · « documents visible to admin / planner / lead-owner » (20260515000005_init_rls.sql)
drop policy if exists "documents visible to admin / planner / lead-owner" on documents;
create policy "documents visible to admin / planner / lead-owner" on documents
  for select to authenticated using ( deleted_at is null and ( is_admin() or planif_document_ligne(documents.lead_id, documents.client_id, documents.entity_id) or ( lead_id is not null and exists ( select 1 from leads l where l.id = documents.lead_id and l.owner_id = auth.uid() ) ) ) );

-- documents · « documents writable by admin / planner / lead-owner » (20260515000005_init_rls.sql)
drop policy if exists "documents writable by admin / planner / lead-owner" on documents;
create policy "documents writable by admin / planner / lead-owner" on documents
  for all to authenticated using ( is_admin() or planif_document_ligne(documents.lead_id, documents.client_id, documents.entity_id) or ( lead_id is not null and exists ( select 1 from leads l where l.id = documents.lead_id and l.owner_id = auth.uid() ) ) ) with check ( is_admin() or planif_document_ligne(documents.lead_id, documents.client_id, documents.entity_id) or ( lead_id is not null and exists ( select 1 from leads l where l.id = documents.lead_id and l.owner_id = auth.uid() ) ) );

-- docusign_envelope_events · « dsee_backoffice » (20261031000002_docusign_archive_entites.sql)
drop policy if exists "dsee_backoffice" on docusign_envelope_events;
create policy "dsee_backoffice" on docusign_envelope_events
  for select to authenticated using (is_admin() or planif_enveloppe(docusign_envelope_events.envelope_id));

-- docusign_envelopes · « dse_backoffice » (20261031000002_docusign_archive_entites.sql)
drop policy if exists "dse_backoffice" on docusign_envelopes;
create policy "dse_backoffice" on docusign_envelopes
  for select to authenticated using (is_admin() or planif_enveloppe_ligne(docusign_envelopes.contract_id, docusign_envelopes.entity_id));

-- dossier_validations · « dossier_validations_insert » (20261109000002_dossier_validation_historique.sql)
drop policy if exists "dossier_validations_insert" on dossier_validations;
create policy "dossier_validations_insert" on dossier_validations
  for insert to authenticated with check ((is_admin() or planif_dossier(dossier_validations.dossier_id)) and user_id = auth.uid());

-- dossier_validations · « dossier_validations_select » (20261109000002_dossier_validation_historique.sql)
drop policy if exists "dossier_validations_select" on dossier_validations;
create policy "dossier_validations_select" on dossier_validations
  for select to authenticated using (is_admin() or planif_dossier(dossier_validations.dossier_id));

-- dossiers · « dossiers readable to admin / planner / lead-owner » (20260515000005_init_rls.sql)
drop policy if exists "dossiers readable to admin / planner / lead-owner" on dossiers;
create policy "dossiers readable to admin / planner / lead-owner" on dossiers
  for select to authenticated using ( is_admin() or planif_lead(dossiers.lead_id) or exists ( select 1 from leads l where l.id = dossiers.lead_id and l.owner_id = auth.uid() ) );

-- dossiers · « dossiers writable by admin / planner » (20260515000005_init_rls.sql)
drop policy if exists "dossiers writable by admin / planner" on dossiers;
create policy "dossiers writable by admin / planner" on dossiers
  for all to authenticated using (is_admin() or planif_lead(dossiers.lead_id)) with check (is_admin() or planif_lead(dossiers.lead_id));

-- intervenant_consultations · « consultations visible to admin / planner » (20260805000001_intervenant_consultations.sql)
drop policy if exists "consultations visible to admin / planner" on intervenant_consultations;
create policy "consultations visible to admin / planner" on intervenant_consultations
  for select to authenticated using (is_admin() or planif_lead(intervenant_consultations.lead_id));

-- intervenant_consultations · « consultations writable by admin / planner » (20260805000001_intervenant_consultations.sql)
drop policy if exists "consultations writable by admin / planner" on intervenant_consultations;
create policy "consultations writable by admin / planner" on intervenant_consultations
  for all to authenticated using (is_admin() or planif_lead(intervenant_consultations.lead_id)) with check (is_admin() or planif_lead(intervenant_consultations.lead_id));

-- lead_media · « lead_media insertable by owner / admin / planner » (20260803000007_lead_media.sql)
drop policy if exists "lead_media insertable by owner / admin / planner" on lead_media;
create policy "lead_media insertable by owner / admin / planner" on lead_media
  for insert to authenticated with check ( uploaded_by = auth.uid() and ( is_admin() or planif_lead(lead_media.lead_id) or exists (select 1 from leads l where l.id = lead_media.lead_id and l.owner_id = auth.uid()) ) );

-- lead_media · « lead_media updatable by author / admin / planner » (20260803000007_lead_media.sql)
drop policy if exists "lead_media updatable by author / admin / planner" on lead_media;
create policy "lead_media updatable by author / admin / planner" on lead_media
  for update to authenticated using (is_admin() or planif_lead(lead_media.lead_id) or uploaded_by = auth.uid()) with check (is_admin() or planif_lead(lead_media.lead_id) or uploaded_by = auth.uid());

-- lead_media · « lead_media visible to owner / admin / planner » (20260803000007_lead_media.sql)
drop policy if exists "lead_media visible to owner / admin / planner" on lead_media;
create policy "lead_media visible to owner / admin / planner" on lead_media
  for select to authenticated using ( deleted_at is null and ( is_admin() or planif_lead(lead_media.lead_id) or exists (select 1 from leads l where l.id = lead_media.lead_id and l.owner_id = auth.uid()) ) );

-- leads · « leads updatable by owner / admin / planner » (20260801000001_signature_mode.sql)
drop policy if exists "leads updatable by owner / admin / planner" on leads;
create policy "leads updatable by owner / admin / planner" on leads
  for update to authenticated using (owner_id = auth.uid() or is_admin() or planif_perimetre(leads.country, leads.entity_id)) with check (owner_id = auth.uid() or is_admin() or planif_perimetre(leads.country, leads.entity_id));

-- leads · « leads visible to owner / admin / planner » (20260515000005_init_rls.sql)
drop policy if exists "leads visible to owner / admin / planner" on leads;
create policy "leads visible to owner / admin / planner" on leads
  for select to authenticated using ( deleted_at is null and ( owner_id = auth.uid() or is_admin() or planif_perimetre(leads.country, leads.entity_id) ) );

-- signature_events · « signature_events readable » (20260807000015_signature_system.sql)
drop policy if exists "signature_events readable" on signature_events;
create policy "signature_events readable" on signature_events
  for select to authenticated using ( is_admin() or planif_signature(signature_events.signature_request_id) or exists ( select 1 from signature_requests sr join leads l on l.id = sr.lead_id where sr.id = signature_events.signature_request_id and l.owner_id = auth.uid() ) );

-- signature_requests · « signature_requests insertable » (20260807000015_signature_system.sql)
drop policy if exists "signature_requests insertable" on signature_requests;
create policy "signature_requests insertable" on signature_requests
  for insert to authenticated with check ( is_admin() or planif_document_ligne(signature_requests.lead_id, signature_requests.client_id, null) or exists (select 1 from leads l where l.id = signature_requests.lead_id and l.owner_id = auth.uid()) );

-- signature_requests · « signature_requests readable » (20260807000015_signature_system.sql)
drop policy if exists "signature_requests readable" on signature_requests;
create policy "signature_requests readable" on signature_requests
  for select to authenticated using ( is_admin() or planif_document_ligne(signature_requests.lead_id, signature_requests.client_id, null) or exists (select 1 from leads l where l.id = signature_requests.lead_id and l.owner_id = auth.uid()) );

-- signature_requests · « signature_requests updatable » (20260807000015_signature_system.sql)
drop policy if exists "signature_requests updatable" on signature_requests;
create policy "signature_requests updatable" on signature_requests
  for update to authenticated using ( is_admin() or planif_document_ligne(signature_requests.lead_id, signature_requests.client_id, null) or exists (select 1 from leads l where l.id = signature_requests.lead_id and l.owner_id = auth.uid()) ) with check ( is_admin() or planif_document_ligne(signature_requests.lead_id, signature_requests.client_id, null) or exists (select 1 from leads l where l.id = signature_requests.lead_id and l.owner_id = auth.uid()) );

-- subcontract_amendments · « subcontract_amendments_backoffice » (20261031000001_sous_traitance_contrats.sql)
drop policy if exists "subcontract_amendments_backoffice" on subcontract_amendments;
create policy "subcontract_amendments_backoffice" on subcontract_amendments
  for select to authenticated using (is_admin() or planif_soustraitance(subcontract_amendments.contract_id));

-- subcontract_amendments · « subcontract_amendments_backoffice_insert » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_amendments_backoffice_insert" on subcontract_amendments;
create policy "subcontract_amendments_backoffice_insert" on subcontract_amendments
  for insert to authenticated with check (is_admin() or planif_soustraitance(subcontract_amendments.contract_id));

-- subcontract_amendments · « subcontract_amendments_backoffice_update » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_amendments_backoffice_update" on subcontract_amendments;
create policy "subcontract_amendments_backoffice_update" on subcontract_amendments
  for update to authenticated using (is_admin() or planif_soustraitance(subcontract_amendments.contract_id)) with check (is_admin() or planif_soustraitance(subcontract_amendments.contract_id));

-- subcontract_contracts · « subcontract_contracts_backoffice » (20261031000001_sous_traitance_contrats.sql)
drop policy if exists "subcontract_contracts_backoffice" on subcontract_contracts;
create policy "subcontract_contracts_backoffice" on subcontract_contracts
  for select to authenticated using (is_admin() or planif_st_ligne(subcontract_contracts.lead_id, subcontract_contracts.entity_id));

-- subcontract_contracts · « subcontract_contracts_backoffice_insert » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_contracts_backoffice_insert" on subcontract_contracts;
create policy "subcontract_contracts_backoffice_insert" on subcontract_contracts
  for insert to authenticated with check (is_admin() or planif_st_ligne(subcontract_contracts.lead_id, subcontract_contracts.entity_id));

-- subcontract_contracts · « subcontract_contracts_backoffice_update » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_contracts_backoffice_update" on subcontract_contracts;
create policy "subcontract_contracts_backoffice_update" on subcontract_contracts
  for update to authenticated using (is_admin() or planif_st_ligne(subcontract_contracts.lead_id, subcontract_contracts.entity_id)) with check (is_admin() or planif_st_ligne(subcontract_contracts.lead_id, subcontract_contracts.entity_id));

-- subcontract_events · « subcontract_events_backoffice » (20261031000001_sous_traitance_contrats.sql)
drop policy if exists "subcontract_events_backoffice" on subcontract_events;
create policy "subcontract_events_backoffice" on subcontract_events
  for select to authenticated using (is_admin() or planif_soustraitance(subcontract_events.contract_id));

-- subcontract_events · « subcontract_events_backoffice_insert » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_events_backoffice_insert" on subcontract_events;
create policy "subcontract_events_backoffice_insert" on subcontract_events
  for insert to authenticated with check (is_admin() or planif_soustraitance(subcontract_events.contract_id));

-- subcontract_events · « subcontract_events_backoffice_update » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_events_backoffice_update" on subcontract_events;
create policy "subcontract_events_backoffice_update" on subcontract_events
  for update to authenticated using (is_admin() or planif_soustraitance(subcontract_events.contract_id)) with check (is_admin() or planif_soustraitance(subcontract_events.contract_id));

-- subcontract_incidents · « subcontract_incidents_backoffice » (20261031000001_sous_traitance_contrats.sql)
drop policy if exists "subcontract_incidents_backoffice" on subcontract_incidents;
create policy "subcontract_incidents_backoffice" on subcontract_incidents
  for select to authenticated using (is_admin() or planif_soustraitance(subcontract_incidents.contract_id));

-- subcontract_incidents · « subcontract_incidents_backoffice_insert » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_incidents_backoffice_insert" on subcontract_incidents;
create policy "subcontract_incidents_backoffice_insert" on subcontract_incidents
  for insert to authenticated with check (is_admin() or planif_soustraitance(subcontract_incidents.contract_id));

-- subcontract_incidents · « subcontract_incidents_backoffice_update » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_incidents_backoffice_update" on subcontract_incidents;
create policy "subcontract_incidents_backoffice_update" on subcontract_incidents
  for update to authenticated using (is_admin() or planif_soustraitance(subcontract_incidents.contract_id)) with check (is_admin() or planif_soustraitance(subcontract_incidents.contract_id));

-- subcontract_lines · « subcontract_lines_backoffice » (20261031000001_sous_traitance_contrats.sql)
drop policy if exists "subcontract_lines_backoffice" on subcontract_lines;
create policy "subcontract_lines_backoffice" on subcontract_lines
  for select to authenticated using (is_admin() or planif_soustraitance(subcontract_lines.contract_id));

-- subcontract_lines · « subcontract_lines_backoffice_delete » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_lines_backoffice_delete" on subcontract_lines;
create policy "subcontract_lines_backoffice_delete" on subcontract_lines
  for delete to authenticated using (is_admin() or planif_soustraitance(subcontract_lines.contract_id));

-- subcontract_lines · « subcontract_lines_backoffice_insert » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_lines_backoffice_insert" on subcontract_lines;
create policy "subcontract_lines_backoffice_insert" on subcontract_lines
  for insert to authenticated with check (is_admin() or planif_soustraitance(subcontract_lines.contract_id));

-- subcontract_lines · « subcontract_lines_backoffice_update » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_lines_backoffice_update" on subcontract_lines;
create policy "subcontract_lines_backoffice_update" on subcontract_lines
  for update to authenticated using (is_admin() or planif_soustraitance(subcontract_lines.contract_id)) with check (is_admin() or planif_soustraitance(subcontract_lines.contract_id));

-- subcontract_missions · « subcontract_missions_backoffice » (20261031000001_sous_traitance_contrats.sql)
drop policy if exists "subcontract_missions_backoffice" on subcontract_missions;
create policy "subcontract_missions_backoffice" on subcontract_missions
  for select to authenticated using (is_admin() or planif_soustraitance(subcontract_missions.contract_id));

-- subcontract_missions · « subcontract_missions_backoffice_insert » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_missions_backoffice_insert" on subcontract_missions;
create policy "subcontract_missions_backoffice_insert" on subcontract_missions
  for insert to authenticated with check (is_admin() or planif_soustraitance(subcontract_missions.contract_id));

-- subcontract_missions · « subcontract_missions_backoffice_update » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_missions_backoffice_update" on subcontract_missions;
create policy "subcontract_missions_backoffice_update" on subcontract_missions
  for update to authenticated using (is_admin() or planif_soustraitance(subcontract_missions.contract_id)) with check (is_admin() or planif_soustraitance(subcontract_missions.contract_id));

-- subcontract_report_photos · « subcontract_report_photos_backoffice » (20261031000001_sous_traitance_contrats.sql)
drop policy if exists "subcontract_report_photos_backoffice" on subcontract_report_photos;
create policy "subcontract_report_photos_backoffice" on subcontract_report_photos
  for select to authenticated using (is_admin() or planif_rapport_st(subcontract_report_photos.report_id));

-- subcontract_report_photos · « subcontract_report_photos_backoffice_insert » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_report_photos_backoffice_insert" on subcontract_report_photos;
create policy "subcontract_report_photos_backoffice_insert" on subcontract_report_photos
  for insert to authenticated with check (is_admin() or planif_rapport_st(subcontract_report_photos.report_id));

-- subcontract_report_photos · « subcontract_report_photos_backoffice_update » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_report_photos_backoffice_update" on subcontract_report_photos;
create policy "subcontract_report_photos_backoffice_update" on subcontract_report_photos
  for update to authenticated using (is_admin() or planif_rapport_st(subcontract_report_photos.report_id)) with check (is_admin() or planif_rapport_st(subcontract_report_photos.report_id));

-- subcontract_reports · « subcontract_reports_backoffice » (20261031000001_sous_traitance_contrats.sql)
drop policy if exists "subcontract_reports_backoffice" on subcontract_reports;
create policy "subcontract_reports_backoffice" on subcontract_reports
  for select to authenticated using (is_admin() or planif_soustraitance(subcontract_reports.contract_id));

-- subcontract_reports · « subcontract_reports_backoffice_insert » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_reports_backoffice_insert" on subcontract_reports;
create policy "subcontract_reports_backoffice_insert" on subcontract_reports
  for insert to authenticated with check (is_admin() or planif_soustraitance(subcontract_reports.contract_id));

-- subcontract_reports · « subcontract_reports_backoffice_update » (20261102000001_sous_traitance_neuf_modeles.sql)
drop policy if exists "subcontract_reports_backoffice_update" on subcontract_reports;
create policy "subcontract_reports_backoffice_update" on subcontract_reports
  for update to authenticated using (is_admin() or planif_soustraitance(subcontract_reports.contract_id)) with check (is_admin() or planif_soustraitance(subcontract_reports.contract_id));

-- subcontractor_invoices · « subcontractor_invoices_select » (20260930000001_subcontractor_module.sql)
drop policy if exists "subcontractor_invoices_select" on subcontractor_invoices;
create policy "subcontractor_invoices_select" on subcontractor_invoices
  for select to authenticated using (is_admin() or planif_facture_st(subcontractor_invoices.dossier_id));

-- subcontractor_invoices · « subcontractor_invoices_write » (20260930000001_subcontractor_module.sql)
drop policy if exists "subcontractor_invoices_write" on subcontractor_invoices;
create policy "subcontractor_invoices_write" on subcontractor_invoices
  for all to authenticated using (is_admin() or planif_facture_st(subcontractor_invoices.dossier_id)) with check (is_admin() or planif_facture_st(subcontractor_invoices.dossier_id));
