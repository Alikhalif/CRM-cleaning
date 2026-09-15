-- ============================================================================
-- MODULE « DOCUMENTS & CONTRATS » — Lot 2 (contrats + templates dynamiques).
-- Additif : gestion des contrats (cycle de vie, PDF, signature) + un système de
-- templates DYNAMIQUES (ajouter un modèle = 1 ligne, sans redéveloppement §16).
-- N'altère aucune table existante.
-- ============================================================================

-- ── 1. Numérotation gapless des contrats : CTR-AAAA-0001 ────────────────────
create table if not exists contract_counters (
  year       integer primary key,
  next_value integer not null default 1
);

create or replace function next_contract_num(p_year integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v integer;
begin
  insert into contract_counters (year, next_value) values (p_year, 2)
  on conflict (year) do update set next_value = contract_counters.next_value + 1
  returning next_value - 1 into v;
  return v;
end;
$$;
grant execute on function next_contract_num(integer) to authenticated;

-- ── 2. Templates dynamiques (schéma de champs + clauses en JSON) ────────────
create table if not exists contract_templates (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  name       text not null,
  kind       text not null default 'contrat',   -- contrat | attestation | rapport …
  category   text,                                -- hotte | desinsectisation | deratisation …
  schema     jsonb not null default '{}'::jsonb,  -- sections[] + fields[] (formulaire dynamique)
  clauses    jsonb not null default '[]'::jsonb,  -- [{title, body}] (clauses légales)
  is_active  boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ── 3. Contrats ─────────────────────────────────────────────────────────────
create table if not exists contracts (
  id                uuid primary key default gen_random_uuid(),
  ref               text unique,
  client_id         uuid not null references clients (id) on delete cascade,
  lead_id           uuid references leads (id) on delete set null,
  template_key      text,                          -- lien logique vers contract_templates.key
  category          text,                          -- hotte | desinsectisation | …
  title             text not null,
  status            text not null default 'en_attente_signature', -- actif | a_renouveler | expire | resilie | en_attente_signature
  start_date        date,
  end_date          date,
  signed_date       date,
  frequency         text,                          -- '1_an' | '2_an' | '3_an' | '4_an' | 'autre'
  passages_per_year integer,
  passages_done     integer not null default 0,
  amount            numeric(10,2),
  billing_mode      text,
  entity_id         uuid references legal_entities (id) on delete set null,
  data              jsonb not null default '{}'::jsonb,  -- valeurs saisies (champs du template)
  pdf_path          text,
  signature_request_id uuid,
  sent_to           text,
  sent_at           timestamptz,
  created_by        uuid references users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  deleted_by        uuid references users (id) on delete set null
);

create index if not exists idx_contracts_client on contracts (client_id, created_at desc);
create index if not exists idx_contracts_status on contracts (status);
create index if not exists idx_contracts_category on contracts (category);

-- Rattache le registre documentaire aux contrats (colonne créée au Lot 1).
do $fk$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'client_documents_contract_id_fkey' and table_name = 'client_documents'
  ) then
    alter table client_documents
      add constraint client_documents_contract_id_fkey
      foreign key (contract_id) references contracts (id) on delete set null;
  end if;
end;
$fk$;

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
alter table contracts enable row level security;
alter table contract_templates enable row level security;
do $rls$
begin
  if not exists (select 1 from pg_policies where tablename='contracts' and policyname='contracts_select') then
    create policy contracts_select on contracts for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='contracts' and policyname='contracts_insert') then
    create policy contracts_insert on contracts for insert to authenticated
      with check (created_by = auth.uid() or is_admin() or is_planificateur());
  end if;
  if not exists (select 1 from pg_policies where tablename='contracts' and policyname='contracts_update') then
    create policy contracts_update on contracts for update to authenticated
      using (created_by = auth.uid() or is_admin() or is_planificateur());
  end if;
  if not exists (select 1 from pg_policies where tablename='contracts' and policyname='contracts_delete') then
    create policy contracts_delete on contracts for delete to authenticated
      using (created_by = auth.uid() or is_admin() or is_planificateur());
  end if;
  -- Templates : lecture pour tous les authentifiés, écriture admin.
  if not exists (select 1 from pg_policies where tablename='contract_templates' and policyname='contract_tpl_select') then
    create policy contract_tpl_select on contract_templates for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='contract_templates' and policyname='contract_tpl_write') then
    create policy contract_tpl_write on contract_templates for all to authenticated
      using (is_admin()) with check (is_admin());
  end if;
end;
$rls$;

-- ── 5. Seed : 2 modèles (Hotte + Désinsectisation) ──────────────────────────
insert into contract_templates (key, name, kind, category, schema, clauses) values
(
  'contrat_hotte', 'Contrat d''entretien — Hotte / Extraction professionnelle', 'contrat', 'hotte',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object('title', 'Client', 'fields', jsonb_build_array(
        jsonb_build_object('name','client_nom','label','Raison sociale / Nom','type','text','prefill','client.name','full',true),
        jsonb_build_object('name','contact','label','Contact','type','text','prefill','client.contact'),
        jsonb_build_object('name','siret','label','SIRET','type','text','prefill','client.siret'),
        jsonb_build_object('name','tel','label','Téléphone','type','text','prefill','client.phone'),
        jsonb_build_object('name','email','label','Email','type','text','prefill','client.email')
      )),
      jsonb_build_object('title', 'Établissement / Site', 'fields', jsonb_build_array(
        jsonb_build_object('name','etablissement','label','Nom de l''établissement','type','text','prefill','client.name'),
        jsonb_build_object('name','adresse','label','Adresse d''intervention','type','text','prefill','client.address','full',true),
        jsonb_build_object('name','cp_ville','label','Code postal / Ville','type','text','prefill','client.cpville')
      )),
      jsonb_build_object('title', 'Équipements & prestations', 'fields', jsonb_build_array(
        jsonb_build_object('name','equipements','label','Équipements concernés','type','checkgroup','options', jsonb_build_array('Hotte','Filtres','Conduits','Moteur / turbine','Tourelle d''extraction')),
        jsonb_build_object('name','prestations','label','Prestations incluses','type','textarea','full',true)
      )),
      jsonb_build_object('title', 'Conditions', 'fields', jsonb_build_array(
        jsonb_build_object('name','frequency','label','Fréquence','type','select','options', jsonb_build_array('1 passage / an','2 passages / an','3 passages / an','4 passages / an','Autre')),
        jsonb_build_object('name','date_debut','label','Date de début','type','date'),
        jsonb_build_object('name','duree','label','Durée','type','text'),
        jsonb_build_object('name','tarif','label','Tarif (€ HT)','type','number'),
        jsonb_build_object('name','reglement','label','Modalités de règlement','type','text'),
        jsonb_build_object('name','conditions','label','Conditions particulières','type','textarea','full',true)
      ))
    )
  ),
  jsonb_build_array(
    jsonb_build_object('title','Renouvellement','body','Le présent contrat est renouvelable par tacite reconduction pour des périodes successives équivalentes, sauf dénonciation par l''une des parties.'),
    jsonb_build_object('title','Résiliation','body','La résiliation peut intervenir à l''échéance moyennant un préavis écrit d''un (1) mois adressé par lettre recommandée avec accusé de réception.')
  )
),
(
  'contrat_desinsectisation', 'Contrat de désinsectisation / éradication des nuisibles', 'contrat', 'desinsectisation',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object('title', 'Client', 'fields', jsonb_build_array(
        jsonb_build_object('name','client_nom','label','Nom / Raison sociale','type','text','prefill','client.name','full',true),
        jsonb_build_object('name','contact','label','Contact','type','text','prefill','client.contact'),
        jsonb_build_object('name','tel','label','Téléphone','type','text','prefill','client.phone'),
        jsonb_build_object('name','email','label','Email','type','text','prefill','client.email')
      )),
      jsonb_build_object('title', 'Site traité', 'fields', jsonb_build_array(
        jsonb_build_object('name','adresse','label','Adresse du site','type','text','prefill','client.address','full',true),
        jsonb_build_object('name','cp_ville','label','Code postal / Ville','type','text','prefill','client.cpville'),
        jsonb_build_object('name','type_locaux','label','Type de locaux','type','text')
      )),
      jsonb_build_object('title', 'Nuisibles & traitement', 'fields', jsonb_build_array(
        jsonb_build_object('name','nuisibles','label','Nuisible(s) concerné(s)','type','checkgroup','options', jsonb_build_array('Cafards / blattes','Punaises de lit','Fourmis','Puces','Mouches','Moustiques','Guêpes','Frelons','Rongeurs','Autres')),
        jsonb_build_object('name','infestation','label','Niveau d''infestation','type','select','options', jsonb_build_array('Faible','Moyen','Élevé')),
        jsonb_build_object('name','traitement','label','Traitement / produits / méthodes','type','textarea','full',true),
        jsonb_build_object('name','preconisations','label','Obligations / préconisations client','type','textarea','full',true)
      )),
      jsonb_build_object('title', 'Conditions', 'fields', jsonb_build_array(
        jsonb_build_object('name','nb_passages','label','Nombre de passages','type','number'),
        jsonb_build_object('name','frequency','label','Fréquence','type','select','options', jsonb_build_array('Passage unique','1 passage / an','2 passages / an','3 passages / an','4 passages / an','Autre')),
        jsonb_build_object('name','date_debut','label','Date de prise d''effet','type','date'),
        jsonb_build_object('name','duree','label','Durée du contrat','type','text'),
        jsonb_build_object('name','tarif','label','Tarif (€ HT)','type','number'),
        jsonb_build_object('name','reglement','label','Modalités de paiement','type','text'),
        jsonb_build_object('name','observations','label','Observations','type','textarea','full',true)
      ))
    )
  ),
  jsonb_build_array(
    jsonb_build_object('title','Suivi & garantie','body','Un suivi est assuré après chaque passage. En cas de persistance de l''infestation dans la période contractuelle, un passage complémentaire est réalisé sans frais.'),
    jsonb_build_object('title','Renouvellement','body','Le contrat annuel est renouvelable par tacite reconduction, sauf dénonciation écrite avant l''échéance.'),
    jsonb_build_object('title','Résiliation','body','La résiliation intervient moyennant un préavis d''un (1) mois par lettre recommandée avec accusé de réception.')
  )
)
on conflict (key) do nothing;
