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
