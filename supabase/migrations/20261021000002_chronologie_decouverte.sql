-- Chronologie des découvertes (demande client du 2026-10-21).
--
-- Le Suivi commercial doit classer les dossiers du plus récent au plus
-- ancien, sur la date de CRÉATION de la découverte — et une découverte
-- ancienne que l'on rouvre ne doit PAS remonter en tête.
--
-- Le CRM ne savait pas répondre à cette question : il ne gardait que
-- `discovery_done_at` (le dernier « Enregistrer »). Impossible de distinguer
-- quand une découverte a été commencée de quand elle a été retouchée.
--
-- Trois horodatages distincts, désormais :
--   • discovery_started_at — création : posée au premier contenu, JAMAIS
--     modifiée ensuite. C'est la clé de tri du Suivi.
--   • discovery_updated_at — dernière modification, enregistrement
--     automatique du brouillon compris.
--   • discovery_done_at    — dernier enregistrement explicite (existant).

alter table leads
  add column if not exists discovery_started_at timestamptz,
  add column if not exists discovery_updated_at timestamptz;

comment on column leads.discovery_started_at is
  'Création de la découverte : posée au premier contenu saisi, immuable ensuite. Clé de tri chronologique du Suivi commercial.';
comment on column leads.discovery_updated_at is
  'Dernière modification de la découverte, brouillon auto-enregistré compris.';

-- ── Reprise de l'existant ────────────────────────────────────────────
--
-- Fait AVANT la création du déclencheur, qui rendrait ensuite la colonne
-- immuable. Pour les dossiers déjà découverts on ne connaît pas la date de
-- début : on retient l'enregistrement s'il existe, sinon l'arrivée du lead.
-- C'est une APPROXIMATION assumée sur l'historique — la découverte se fait
-- presque toujours pendant le premier appel, donc l'écart est faible. Les
-- découvertes à venir, elles, portent leur vraie date de création.
update leads
set
  discovery_started_at = coalesce(discovery_done_at, received_at, created_at),
  discovery_updated_at = coalesce(discovery_done_at, updated_at, received_at, created_at)
where discovery_started_at is null
  and (
    discovery_done_at is not null
    or (discovery_details is not null and discovery_details <> '{}'::jsonb)
  );

-- ── Le déclencheur ───────────────────────────────────────────────────
--
-- Posé en base, et non dans une action serveur, pour une raison précise : la
-- découverte est écrite par plusieurs chemins (enregistrement manuel,
-- brouillon automatique, reclassement d'activité, webhooks n8n). Un seul de
-- ces chemins qui oublierait les horodatages suffirait à fausser le
-- classement. Ici, aucun ne peut l'oublier.
create or replace function leads_set_discovery_timestamps()
returns trigger
language plpgsql
as $$
declare
  a_du_contenu boolean;
begin
  a_du_contenu :=
    (new.discovery_details is not null and new.discovery_details <> '{}'::jsonb)
    or new.discovery_done_at is not null;

  if tg_op = 'INSERT' then
    if a_du_contenu then
      new.discovery_started_at := coalesce(new.discovery_started_at, now());
      new.discovery_updated_at := coalesce(new.discovery_updated_at, now());
    end if;
    return new;
  end if;

  -- La date de création ne bouge JAMAIS une fois posée : c'est toute la règle
  -- demandée. Rouvrir un vieux dossier le laisse à sa place dans la liste.
  if old.discovery_started_at is not null then
    new.discovery_started_at := old.discovery_started_at;
  end if;

  -- Une mise à jour qui ne touche pas la découverte (changement de statut,
  -- relance, affectation…) ne doit modifier aucun des deux horodatages.
  if a_du_contenu
     and (new.discovery_details is distinct from old.discovery_details
          or new.discovery_done_at is distinct from old.discovery_done_at)
  then
    new.discovery_started_at := coalesce(new.discovery_started_at, now());
    new.discovery_updated_at := now();
  end if;

  return new;
end
$$;

drop trigger if exists leads_discovery_timestamps on leads;
create trigger leads_discovery_timestamps
  before insert or update on leads
  for each row execute function leads_set_discovery_timestamps();

-- Tri du Suivi commercial : le plus récent d'abord, les dossiers sans
-- découverte en dernier.
create index if not exists leads_discovery_started_idx
  on leads (discovery_started_at desc nulls last);
