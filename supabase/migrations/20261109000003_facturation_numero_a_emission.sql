-- ============================================================================
-- Factures : numéro attribué à l'ÉMISSION, séries par société, factures
-- émises figées (2026-11-09)
--
-- ⚠️ PRÉPARÉE, NON APPLIQUÉE. Recette d'abord ; production sur autorisation
-- explicite du client. Le CODE de cette livraison et cette migration sont
-- INDISSOCIABLES pour la facture finale (colonne `dossier_id`, état `valide`).
--
-- Décisions du client du 2026-11-09 :
--   « Les brouillons ne doivent pas consommer de numéro définitif. »
--   « Le numéro est attribué au moment de l'émission. »
--   « Numérotation sécurisée, chronologique, sans doublon, adaptée aux
--     entités juridiques et aux obligations de chaque pays. »
--   « Une facture émise ne doit pas être supprimée ou renumérotée librement. »
--   « Empêche la création de plusieurs factures finales pour un même dossier,
--     sauf procédure explicite et justifiée de correction. »
--
-- Périmètre : factures d'ACOMPTE et FINALES (`documents.type` = acompte |
-- finale). Les DEVIS ne changent pas — leur numérotation n'est pas une
-- obligation comptable, et leur flux est éprouvé par 1 480 contrôles.
-- Les factures OPTIMIVV (`next_facture_optimivv_num`, autre table) ne sont
-- PAS touchées : voir le registre, anomalie de la série parallèle.
--
-- ── CE QUI GARANTIT L'ABSENCE DE TROU ET DE DOUBLON ─────────────────────
--
--   · le numéro définitif est alloué DANS le trigger, donc dans la MÊME
--     transaction que le passage brouillon → émise : si l'émission échoue,
--     l'incrément du compteur est annulé avec elle ;
--   · le compteur est incrémenté par `insert … on conflict do update`, qui
--     prend un verrou de ligne : deux émissions simultanées sont SÉRIALISÉES ;
--   · un DOUBLE CLIC sur la même facture : le second UPDATE attend le verrou
--     de la ligne, puis réévalue `status = 'brouillon'` — devenu faux — et ne
--     touche aucune ligne. Le trigger ne s'exécute pas : aucun numéro consommé.
--     (Condition : l'application émet avec le filtre `status = 'brouillon'`.)
--   · `documents.num` reste UNIQUE : un doublon est refusé par la base.
--
-- ── SÉRIES PAR SOCIÉTÉ — ACTIVATION PAR SOCIÉTÉ ────────────────────────
--
-- Aujourd'hui `doc_counters` est indexé par (type, année) : la série est
-- COMMUNE à toutes les sociétés émettrices. Pour une société donnée, ses
-- factures ont donc des TROUS — chaque numéro pris par une autre société en
-- est un. C'est un défaut confirmé par le schéma (clé primaire de
-- `doc_counters`), pas par une recherche textuelle.
--
-- La série par société s'active en renseignant `legal_entities.
-- code_numerotation` (ex. CGK) : ses factures deviennent FAC-CGK-2027-0001.
-- Sans code, la série historique continue À L'IDENTIQUE. Rien ne bascule
-- donc tant que le client — et son expert-comptable — n'ont pas choisi la date
-- (recommandation : un 1er janvier, pour qu'une société n'ait jamais deux
-- séries dans la même année).
--
-- Obligations par pays : FR, BE et LU exigent une numérotation unique et
-- continue ; CH et CA (Québec) ne l'imposent pas aussi strictement mais la
-- pratiquent. Une série continue par société, par type et par année satisfait
-- les cinq. La LÉGALITÉ précise de chaque série relève du conseil comptable.
-- ============================================================================

-- ── 1. Code de numérotation par société (activation de la série dédiée) ──
alter table legal_entities
  add column if not exists code_numerotation text,
  -- Date d'EFFET de la série dédiée (D26, décision du 2026-11-09 : « la date
  -- de bascule reste en attente »). Avant elle, la série historique continue :
  -- on peut tout préparer — code, contrôles — et ne rien faire basculer avant
  -- le jour choisi, de préférence un 1er janvier.
  add column if not exists numerotation_depuis date,
  -- ACTIVATION (instruction du client du 2026-11-09 : « aucune activation de
  -- nouvelle série sans validation explicite »). Préparer une série — code et
  -- date — ne l'active PAS. Seule `activer_serie_societe()`, qu'aucun rôle
  -- applicatif ne peut appeler, pose ces trois colonnes, avec une
  -- justification. Sans elles, la série historique continue, quelle que soit
  -- la date.
  add column if not exists serie_activee_le timestamptz,
  add column if not exists serie_activee_par text,
  add column if not exists serie_activation_justification text;

do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'legal_entities_code_numerotation_format') then
    alter table legal_entities
      add constraint legal_entities_code_numerotation_format
      check (code_numerotation is null or code_numerotation ~ '^[A-Z0-9]{2,8}$');
  end if;
end;
$c$;

do $c2$
begin
  if not exists (select 1 from pg_constraint where conname = 'legal_entities_serie_complete') then
    alter table legal_entities
      add constraint legal_entities_serie_complete
      check ((code_numerotation is null) = (numerotation_depuis is null));
  end if;
end;
$c2$;

create unique index if not exists uq_legal_entities_code_numerotation
  on legal_entities (code_numerotation)
  where code_numerotation is not null;

comment on column legal_entities.code_numerotation is
  'Série de factures PROPRE à la société (FA-<code>-AAAA-NNNN), effective à numerotation_depuis. '
  'NULL = série historique commune. À fixer avec l''expert-comptable, de préférence au 1er janvier.';

-- ── 1 bis. Une série active ou déjà employée ne change plus ──────────────
-- Changer le code d'une série qui a servi créerait une seconde série pour la
-- même société ; avancer ou reculer sa date d'effet une fois atteinte
-- réécrirait la frontière entre deux séries. Les deux sont refusés — y
-- compris pour le service-role, qui ne contourne pas les triggers. Avant sa
-- date d'effet et sans aucune facture, la série reste modifiable : c'est le
-- temps de la préparer avec l'expert-comptable.
create or replace function garder_serie_societe()
returns trigger
language plpgsql
as $$
begin
  -- L'activation ne se pose, ni ne se défait, que par activer_serie_societe().
  if (new.serie_activee_le, new.serie_activee_par, new.serie_activation_justification)
     is distinct from (old.serie_activee_le, old.serie_activee_par, old.serie_activation_justification)
     and coalesce(current_setting('cgk.activation_serie', true), '') <> 'autorisee' then
    raise exception 'Société % : une série ne s''active que par la procédure de validation explicite.', old.legal_name
      using errcode = 'P0001';
  end if;
  if old.serie_activee_le is not null
     and (new.serie_activee_le, new.serie_activee_par, new.serie_activation_justification)
         is distinct from (old.serie_activee_le, old.serie_activee_par, old.serie_activation_justification) then
    raise exception 'Société % : son activation est déjà enregistrée et ne se défait pas.', old.legal_name
      using errcode = 'P0001';
  end if;
  if (new.code_numerotation, new.numerotation_depuis)
     is not distinct from (old.code_numerotation, old.numerotation_depuis) then
    return new;
  end if;
  if old.code_numerotation is not null and (
       old.serie_activee_le is not null
       or exists (select 1 from facture_counters c where c.entity_id = old.id)
     ) then
    raise exception 'Société % : sa série de factures est active ou a déjà servi — elle ne se modifie plus.', old.legal_name
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ── 2. Compteurs par société, type et année ──────────────────────────────
create table if not exists facture_counters (
  entity_id  uuid not null references legal_entities (id) on delete restrict,
  doc_type   document_type not null check (doc_type in ('acompte', 'finale')),
  year       integer not null,
  next_value integer not null default 1,
  primary key (entity_id, doc_type, year)
);

-- RLS sans politique, VOLONTAIREMENT : seules les fonctions SECURITY DEFINER
-- ci-dessous y écrivent. Aucune session ne lit ni ne modifie un compteur.
alter table facture_counters enable row level security;

-- (Le trigger de 1 bis lit `facture_counters` : il est posé APRÈS sa création.)
-- Même verrou à la CRÉATION : sans lui, une société créée avec ses colonnes
-- d'activation déjà remplies contournerait la validation explicite.
create or replace function garder_activation_a_la_creation()
returns trigger
language plpgsql
as $$
begin
  if (new.serie_activee_le is not null or new.serie_activee_par is not null
      or new.serie_activation_justification is not null)
     and coalesce(current_setting('cgk.activation_serie', true), '') <> 'autorisee' then
    raise exception 'Une série ne s''active que par la procédure de validation explicite, pas à la création.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_legal_entities_activation_creation on legal_entities;
create trigger trg_legal_entities_activation_creation
  before insert on legal_entities
  for each row execute function garder_activation_a_la_creation();

drop trigger if exists trg_legal_entities_garder_serie on legal_entities;
create trigger trg_legal_entities_garder_serie
  before update of code_numerotation, numerotation_depuis,
                   serie_activee_le, serie_activee_par, serie_activation_justification on legal_entities
  for each row execute function garder_serie_societe();

-- ── 3. Colonnes de traçabilité sur `documents` ───────────────────────────
alter table documents
  add column if not exists dossier_id            uuid references dossiers (id) on delete restrict,
  add column if not exists emise_at              timestamptz,
  add column if not exists emise_par             uuid references users (id) on delete set null,
  add column if not exists annulee_at            timestamptz,
  add column if not exists annulee_par           uuid references users (id) on delete set null,
  add column if not exists annulation_motif      text,
  add column if not exists remplace_document_id  uuid references documents (id) on delete restrict;

create index if not exists idx_documents_dossier
  on documents (dossier_id) where dossier_id is not null;

-- Reprise de l'existant AVANT la pose des protections : une facture déjà
-- émise reçoit sa date d'émission, sans changer de numéro.
update documents
   set emise_at = issued_at
 where type in ('acompte', 'finale')
   and status <> 'brouillon'
   and emise_at is null;

-- ── 4. Numéro provisoire d'un brouillon ──────────────────────────────────
-- Unique (aléatoire 48 bits), lisible, et impossible à confondre avec un
-- numéro légal. L'interface l'affiche « Brouillon — non numérotée ».
create or replace function numero_provisoire()
returns text
language sql
volatile
as $$
  select 'BROUILLON-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
$$;

-- ── 4 bis. Fuseau légal de la société ────────────────────────────────────
-- L'année d'une facture et la date de bascule se lisent à l'heure LÉGALE de
-- la société, pas à celle du serveur (UTC) : sans cela, une facture émise le
-- 1er janvier à 0 h 30 à Paris tomberait dans la série de l'année précédente.
-- FR, CH, LU, BE : Europe/Paris. CA : America/Toronto (heure de l'Est, celle
-- du Québec et de l'Ontario) — ⚠️ à confirmer si une société canadienne
-- opère dans une autre province.
create or replace function fuseau_societe(p_entity uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case (select country from legal_entities where id = p_entity)
           when 'CA' then 'America/Toronto'
           else 'Europe/Paris'
         end;
$$;

create or replace function annee_legale(p_entity uuid, p_instant timestamptz)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select extract(year from (p_instant at time zone fuseau_societe(p_entity)))::int;
$$;

-- ── 5. Allocation du numéro définitif ────────────────────────────────────
create or replace function allouer_numero_facture(p_entity uuid, p_type document_type, p_year integer)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code   text;
  v_depuis date;
  v_activee timestamptz;
  v_n      integer;
  v_prefix text;
begin
  if p_type not in ('acompte', 'finale') then
    raise exception 'allouer_numero_facture : le type % n''est pas une facture.', p_type
      using errcode = 'P0001';
  end if;

  select code_numerotation, numerotation_depuis, serie_activee_le into v_code, v_depuis, v_activee
    from legal_entities where id = p_entity;

  if v_code is null
     or v_activee is null
     or (now() at time zone fuseau_societe(p_entity))::date < v_depuis then
    -- Série historique commune : comportement INCHANGÉ tant que la société
    -- n'a pas de série dédiée ACTIVÉE, ou que sa date d'effet n'est pas atteinte.
    return next_doc_num(p_type, p_year);
  end if;

  insert into facture_counters (entity_id, doc_type, year, next_value)
  values (p_entity, p_type, p_year, 2)
  on conflict (entity_id, doc_type, year)
    do update set next_value = facture_counters.next_value + 1
  returning next_value - 1 into v_n;

  v_prefix := case p_type when 'acompte' then 'FA' else 'FAC' end;
  return v_prefix || '-' || v_code || '-' || p_year::text || '-' || lpad(v_n::text, 4, '0');
end;
$$;

-- Appelée seulement par les triggers ci-dessous (eux-mêmes SECURITY DEFINER) :
-- aucune session ne peut brûler un numéro en l'appelant directement.
revoke all on function allouer_numero_facture(uuid, document_type, integer) from public;

-- ── 5 bis. Activation d'une série — VALIDATION EXPLICITE ─────────────────
-- Exécutable par AUCUN rôle applicatif : ni `authenticated`, ni
-- `service_role`. Elle ne s'appelle que depuis l'éditeur SQL, par
-- l'opérateur, après la validation écrite du client et de son
-- expert-comptable (supabase/procedures/activation-serie-societe.sql).
create or replace function activer_serie_societe(p_entity uuid, p_valide_par text, p_justification text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text; v_depuis date; v_activee timestamptz;
begin
  select code_numerotation, numerotation_depuis, serie_activee_le into v_code, v_depuis, v_activee
    from legal_entities where id = p_entity for update;
  if not found then raise exception 'Société introuvable.' using errcode = 'P0001'; end if;
  if v_activee is not null then raise exception 'Série déjà activée le %.', v_activee using errcode = 'P0001'; end if;
  if v_code is null or v_depuis is null then
    raise exception 'Aucune série préparée (code et date d''effet) pour cette société.' using errcode = 'P0001';
  end if;
  if coalesce(length(btrim(p_valide_par)), 0) < 3 or coalesce(length(btrim(p_justification)), 0) < 20 then
    raise exception 'Validation explicite requise : nom du validateur et justification (20 caractères au moins).'
      using errcode = 'P0001';
  end if;
  perform set_config('cgk.activation_serie', 'autorisee', true);
  update legal_entities
     set serie_activee_le = now(),
         serie_activee_par = btrim(p_valide_par),
         serie_activation_justification = btrim(p_justification)
   where id = p_entity;
  perform set_config('cgk.activation_serie', '', true);
end;
$$;

revoke all on function activer_serie_societe(uuid, text, text) from public;
revoke all on function activer_serie_societe(uuid, text, text) from anon, authenticated, service_role;

-- ── 6. À l'INSERTION : un brouillon n'a qu'un numéro provisoire ──────────
create or replace function assign_doc_num()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.type in ('acompte', 'finale') then
    if new.status = 'brouillon' then
      -- Un brouillon ne consomme JAMAIS de numéro définitif.
      new.num      := numero_provisoire();
      new.emise_at := null;
    elsif new.num is null or new.num = '' or new.num like 'BROUILLON-%' then
      -- Insertion directement émise (ex. import) : numéro à l'instant même.
      new.issued_at := now();
      new.num       := allouer_numero_facture(new.entity_id, new.type, annee_legale(new.entity_id, new.issued_at));
      new.emise_at  := now();
      new.emise_par := auth.uid();
    end if;

    -- Une facture de REMPLACEMENT ne remplace qu'une facture ANNULÉE.
    if new.remplace_document_id is not null and not exists (
      select 1 from documents d
       where d.id = new.remplace_document_id
         and d.type = new.type
         and d.annulee_at is not null
    ) then
      raise exception 'Une facture de remplacement doit désigner une facture du même type, ANNULÉE au préalable.'
        using errcode = 'P0001';
    end if;

    -- Une facture finale rattachée à un dossier exige une intervention VALIDÉE.
    if new.type = 'finale' and new.dossier_id is not null and not exists (
      select 1 from dossiers x where x.id = new.dossier_id and x.status = 'valide'
    ) then
      raise exception 'La facture finale exige une intervention validée.'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- Devis : inchangé.
  if new.num is null or new.num = '' then
    new.num := next_doc_num(new.type, extract(year from coalesce(new.issued_at, now()))::int);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_documents_assign_num on documents;
create trigger trg_documents_assign_num
  before insert on documents
  for each row execute function assign_doc_num();

-- ── 7. À la MISE À JOUR : émission, puis facture figée ───────────────────
create or replace function proteger_facture()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.type not in ('acompte', 'finale') then
    return new;
  end if;
  if new.type is distinct from old.type then
    raise exception 'Le type d''une facture ne change pas.' using errcode = 'P0001';
  end if;

  if old.status = 'brouillon' then
    if new.status <> 'brouillon' then
      -- ÉMISSION. Le numéro définitif naît ICI, dans la transaction même.
      if old.num like 'BROUILLON-%' or old.num = '' then
        new.issued_at := now();
        new.num := allouer_numero_facture(new.entity_id, new.type, annee_legale(new.entity_id, new.issued_at));
      end if;
      -- (Un brouillon ANTÉRIEUR à cette migration porte déjà un numéro
      -- définitif : il le garde — le renuméroter créerait un trou.)
      new.emise_at  := now();
      new.emise_par := coalesce(auth.uid(), new.emise_par);
    elsif old.num like 'BROUILLON-%' then
      -- Brouillon modifié : son numéro provisoire ne se remplace pas à la main.
      new.num := old.num;
    end if;
    return new;
  end if;

  -- ── Facture ÉMISE ──────────────────────────────────────────────────────
  if new.num is distinct from old.num then
    raise exception 'Facture % émise : son numéro ne change pas.', old.num using errcode = 'P0001';
  end if;
  if new.status = 'brouillon' then
    raise exception 'Facture % émise : elle ne redevient pas un brouillon.', old.num using errcode = 'P0001';
  end if;
  if old.deleted_at is null and new.deleted_at is not null then
    raise exception 'Facture % émise : elle ne se supprime pas. Procédure : annulation motivée.', old.num
      using errcode = 'P0001';
  end if;
  if (new.entity_id, new.client_id, new.lead_id, new.activity_id, new.issued_at,
      new.total_ht, new.total_vat, new.total_ttc, new.acompte_amount, new.acompte_deduit,
      new.related_devis_id, new.dossier_id, new.emise_at, new.emise_par, new.remplace_document_id)
     is distinct from
     (old.entity_id, old.client_id, old.lead_id, old.activity_id, old.issued_at,
      old.total_ht, old.total_vat, old.total_ttc, old.acompte_amount, old.acompte_deduit,
      old.related_devis_id, old.dossier_id, old.emise_at, old.emise_par, old.remplace_document_id) then
    raise exception 'Facture % émise : son contenu est figé.', old.num using errcode = 'P0001';
  end if;
  -- L'annulation s'enregistre UNE fois, avec son motif, et ne se défait pas.
  if old.annulee_at is not null
     and (new.annulee_at, new.annulee_par, new.annulation_motif)
         is distinct from (old.annulee_at, old.annulee_par, old.annulation_motif) then
    raise exception 'Facture % : son annulation est déjà enregistrée.', old.num using errcode = 'P0001';
  end if;
  if old.annulee_at is null and new.annulee_at is not null then
    if coalesce(btrim(new.annulation_motif), '') = '' then
      raise exception 'Facture % : une annulation exige un motif.', old.num using errcode = 'P0001';
    end if;
    -- Réservée au Super Admin. Une session sans utilisateur (service-role,
    -- scripts d'exploitation) n'a pas d'`auth.uid()` et reste autorisée :
    -- elle ne passe pas par l'écran, et chaque script est déjà gardé.
    if auth.uid() is not null and not is_admin() then
      raise exception 'Facture % : seule une personne Super Admin peut annuler une facture émise.', old.num
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_documents_proteger_facture on documents;
create trigger trg_documents_proteger_facture
  before update on documents
  for each row execute function proteger_facture();

-- ── 8. Suppression physique d'une facture émise : impossible ────────────
-- Le service-role contourne la RLS, PAS les triggers : la garantie vaut pour
-- tout le monde, scripts compris.
create or replace function interdire_suppression_facture()
returns trigger
language plpgsql
as $$
begin
  if old.type in ('acompte', 'finale') and old.status <> 'brouillon' then
    raise exception 'Facture % émise : suppression interdite.', old.num using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_documents_interdire_suppression on documents;
create trigger trg_documents_interdire_suppression
  before delete on documents
  for each row execute function interdire_suppression_facture();

-- ── 9. Lignes d'une facture émise : figées ───────────────────────────────
create or replace function proteger_lignes_facture()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc uuid;
  v_num text;
begin
  foreach v_doc in array array[
    case when tg_op in ('UPDATE', 'DELETE') then old.document_id end,
    case when tg_op in ('INSERT', 'UPDATE') then new.document_id end
  ]
  loop
    if v_doc is null then continue; end if;
    select d.num into v_num
      from documents d
     where d.id = v_doc and d.type in ('acompte', 'finale') and d.status <> 'brouillon';
    if found then
      raise exception 'Facture % émise : ses lignes sont figées.', v_num using errcode = 'P0001';
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_document_lines_proteger_facture on document_lines;
create trigger trg_document_lines_proteger_facture
  before insert or update or delete on document_lines
  for each row execute function proteger_lignes_facture();

-- ── 10. Une seule facture finale ACTIVE par devis et par dossier ─────────
-- L'ancien index (`uq_one_finale_per_devis`) ne libérait la place qu'à la
-- SUPPRESSION — exactement ce qu'une facture émise ne doit plus subir. La
-- correction passe désormais par une ANNULATION motivée, qui garde la
-- facture et son numéro, puis par une facture de remplacement.
create unique index if not exists uq_finale_active_par_devis
  on documents (related_devis_id)
  where type = 'finale' and deleted_at is null and annulee_at is null;

create unique index if not exists uq_finale_active_par_dossier
  on documents (dossier_id)
  where type = 'finale' and dossier_id is not null and deleted_at is null and annulee_at is null;

drop index if exists uq_one_finale_per_devis;
