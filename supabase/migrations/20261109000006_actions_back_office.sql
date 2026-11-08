-- ============================================================================
-- Notifications intermodules — les ACTIONS ATTENDUES du back-office
-- (2026-11-09)
--
-- ⚠️ PRÉPARÉE, NON APPLIQUÉE. Recette d'abord ; production sur autorisation.
--
-- Décision du client : « Les alertes doivent être immédiates lorsqu'une action
-- est attendue. Elles doivent rester actives tant que l'action n'est pas
-- effectuée. Délais d'escalade paramétrables. Aucun doublon. »
--
-- ── LE PRINCIPE, QUI REND LA RÈGLE « LIRE NE FERME RIEN » STRUCTURELLE ──
--
-- Une action NAÎT d'un état (un dossier `finalise`, une facture échue…) et
-- ne se FERME que lorsque cet état disparaît. Cette table n'a AUCUNE colonne
-- « lue » : il n'existe pas de chemin, dans le code ni en base, par lequel
-- lire une notification fermerait une action. La notification n'est que le
-- signal de la naissance ; l'état vit ici.
--
-- ── AUCUN DOUBLON ────────────────────────────────────────────────────────
--
--   · une seule action OUVERTE par clé (index unique partiel) : le cron et
--     une évaluation immédiate qui se croisent ne peuvent pas en créer deux ;
--   · une notification n'est envoyée QUE par le gagnant de l'insertion ;
--   · les informations sans action (contrat DocuSign signé) passent par
--     `notifications_emises`, dont la clé primaire interdit le second envoi.
--
-- Écritures : moteur serveur (service-role) uniquement. Lecture : le rôle
-- concerné, et le Super Admin pour tout.
-- ============================================================================

create table if not exists actions_back_office (
  id               uuid primary key default gen_random_uuid(),
  cle              text not null,                -- ex. « dossier.a_valider:<uuid> »
  type             text not null check (type in (
                     'dossier.a_planifier', 'dossier.a_valider', 'facture.a_preparer',
                     'facture.a_emettre', 'facture.impayee', 'acompte.impaye')),
  role_cible       text not null check (role_cible in ('planification', 'admin')),
  entity_type      text not null check (entity_type in ('dossier', 'document')),
  entity_id        uuid not null,
  -- Pays du dossier : un planificateur ne voit que SES pays (CDC §11, A17).
  -- Sans lui, le panneau et les notifications contourneraient ce cloisonnement.
  pays             text,
  -- Société concernée (D31) : la RLS de …07 la confronte au périmètre.
  entite_id        uuid references legal_entities (id) on delete set null,
  titre            text not null,
  detail           text,
  href             text,
  ouverte_at       timestamptz not null default now(),
  escaladee_at     timestamptz,                  -- remontée au Super Admin
  fermee_at        timestamptz,
  raison_fermeture text check (raison_fermeture in ('action_effectuee', 'objet_disparu')),
  constraint actions_bo_fermeture_coherente
    check ((fermee_at is null) = (raison_fermeture is null))
);

create unique index if not exists uq_actions_bo_ouverte
  on actions_back_office (cle) where fermee_at is null;
create index if not exists idx_actions_bo_ouvertes
  on actions_back_office (role_cible, ouverte_at) where fermee_at is null;

alter table actions_back_office enable row level security;

do $rls$
begin
  if not exists (select 1 from pg_policies where tablename = 'actions_back_office' and policyname = 'actions_bo_select') then
    create policy actions_bo_select on actions_back_office
      for select to authenticated
      using (
        is_admin()
        or (is_planificateur() and role_cible = 'planification'
            and pays is not null
            and exists (select 1 from users u where u.id = auth.uid() and pays = any (u.countries)))
      );
  end if;
end;
$rls$;

-- Une action fermée ne se rouvre pas et ne se réécrit pas : une nouvelle
-- naissance du même état crée une NOUVELLE ligne (l'historique reste lisible).
create or replace function garder_action_back_office()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'actions_back_office est un historique : pas de suppression.' using errcode = 'P0001';
  end if;
  if old.fermee_at is not null then
    raise exception 'Action % fermée : elle ne se modifie plus.', old.cle using errcode = 'P0001';
  end if;
  if (new.cle, new.type, new.role_cible, new.entity_type, new.entity_id, new.ouverte_at)
     is distinct from (old.cle, old.type, old.role_cible, old.entity_type, old.entity_id, old.ouverte_at) then
    raise exception 'Action % : son identité ne change pas.', old.cle using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_actions_bo_garde on actions_back_office;
create trigger trg_actions_bo_garde
  before update or delete on actions_back_office
  for each row execute function garder_action_back_office();

-- Informations ponctuelles (sans action à effectuer) : une clé, un envoi.
create table if not exists notifications_emises (
  cle        text primary key,
  emise_at   timestamptz not null default now()
);
alter table notifications_emises enable row level security;
-- Aucune politique : seul le moteur (service-role) y écrit et y lit.
