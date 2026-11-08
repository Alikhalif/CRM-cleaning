-- ============================================================================
-- D31 — Les notifications respectent le périmètre de leur destinataire
-- (2026-11-09)
--
-- ⚠️ PRÉPARÉE, NON APPLIQUÉE. Recette d'abord ; production sur autorisation.
--
-- Décision du client : « Une planificatrice ne doit recevoir que les
-- notifications concernant les pays et entités juridiques auxquels elle est
-- autorisée à accéder. Vérifié côté serveur ET au niveau des accès aux
-- données. »
--
-- ── LE PÉRIMÈTRE D'UNE PLANIFICATRICE ───────────────────────────────────
--
--   · PAYS : `users.countries` — existant (CDC §11, A17). Vide = aucun pays.
--   · ENTITÉS : `users.entites_autorisees` — NOUVEAU. Aucune autorisation par
--     entité juridique n'existait (`users.entity_id` est la société de
--     RATTACHEMENT d'un commercial, « pour l'affichage » — 20260728000001).
--     Vide = toutes les entités : c'est le comportement d'aujourd'hui, et le
--     changer couperait toute l'équipe. Renseigné par le Super Admin, il
--     RESTREINT.
--
-- ── TROIS VERROUS EN BASE (le serveur filtre déjà en amont) ────────────
--
--   1. `notification_dans_perimetre()` : la règle, en un seul endroit ;
--   2. à l'INSERTION, un trigger refuse une notification hors du périmètre de
--      son destinataire — elle ne peut même pas être enregistrée ;
--   3. à la LECTURE, la RLS ne montre que les notifications dans le
--      périmètre. Une notification ANCIENNE devenue hors périmètre est
--      MASQUÉE, jamais supprimée (procédure : supabase/procedures/).
--
-- Une notification sans `pays` est PERSONNELLE (un lead attribué, son propre
-- devis signé) : elle n'a pas de périmètre à vérifier. Une notification du
-- back-office porte TOUJOURS un pays — le serveur n'en émet pas sans.
-- ============================================================================

alter table users
  add column if not exists entites_autorisees uuid[] not null default '{}';

comment on column users.entites_autorisees is
  'Périmètre d''entités juridiques d''une planificatrice (notifications, D31). '
  'VIDE = toutes les entités (comportement antérieur). Renseigné = restreint à ces entités.';

alter table notifications
  add column if not exists pays      text,
  add column if not exists entite_id uuid references legal_entities (id) on delete set null;

comment on column notifications.pays is
  'Pays de l''objet notifié. NULL = notification personnelle, sans périmètre. '
  'Renseigné = notification back-office, soumise à notification_dans_perimetre().';

-- ── 1. La règle ──────────────────────────────────────────────────────────
create or replace function notification_dans_perimetre(p_user uuid, p_pays text, p_entite uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    -- Personnelle : rien à vérifier.
    when p_pays is null then true
    -- Super Admin : tout.
    when exists (select 1 from user_roles ur join roles r on r.id = ur.role_id
                  where ur.user_id = p_user and r.slug = 'admin') then true
    -- Planificatrice : SES pays, et SES entités si elle en a.
    when exists (select 1 from user_roles ur join roles r on r.id = ur.role_id
                  where ur.user_id = p_user and r.slug = 'planification') then
      exists (
        select 1 from users u
         where u.id = p_user
           and p_pays = any (u.countries)
           and (cardinality(u.entites_autorisees) = 0
                or (p_entite is not null and p_entite = any (u.entites_autorisees)))
      )
    -- Autres rôles : ils ne reçoivent que des notifications qui les visent
    -- personnellement (ex. le propriétaire d'un lead) — pas de périmètre
    -- back-office à leur appliquer.
    else true
  end;
$$;

revoke all on function notification_dans_perimetre(uuid, text, uuid) from public;
grant execute on function notification_dans_perimetre(uuid, text, uuid) to authenticated;

-- ── 2. À l'insertion ─────────────────────────────────────────────────────
create or replace function garder_notification_perimetre()
returns trigger
language plpgsql
as $$
begin
  if not notification_dans_perimetre(new.user_id, new.pays, new.entite_id) then
    raise exception 'Notification hors du périmètre de son destinataire (pays %, entité %) : refusée.',
      new.pays, coalesce(new.entite_id::text, 'aucune')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifications_perimetre on notifications;
create trigger trg_notifications_perimetre
  before insert on notifications
  for each row execute function garder_notification_perimetre();

-- ── 3. À la lecture (et au marquage « lu ») ──────────────────────────────
drop policy if exists "notifications: user reads own" on notifications;
create policy "notifications: user reads own"
  on notifications for select to authenticated
  using (user_id = auth.uid() and notification_dans_perimetre(auth.uid(), pays, entite_id));

-- La PORTÉE d'une notification ne se réécrit pas depuis une session : sans
-- ce verrou, un destinataire passerait `pays` à NULL pour démasquer ce que la
-- RLS lui cache. Seul l'opérateur (éditeur SQL, sans `auth.uid()`) la pose,
-- par la procédure de reprise des notifications existantes.
create or replace function garder_portee_notification()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null
     and (new.pays is distinct from old.pays
          or new.entite_id is distinct from old.entite_id
          or new.user_id is distinct from old.user_id) then
    raise exception 'La portée d''une notification ne se modifie pas.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifications_portee on notifications;
create trigger trg_notifications_portee
  before update on notifications
  for each row execute function garder_portee_notification();

drop policy if exists "notifications: user marks own as read" on notifications;
create policy "notifications: user marks own as read"
  on notifications for update to authenticated
  using (user_id = auth.uid() and notification_dans_perimetre(auth.uid(), pays, entite_id))
  with check (user_id = auth.uid());

-- ── 4. Le panneau « Actions attendues » suit la MÊME règle ───────────────
-- (20261109000006 ne filtrait que par pays : la fonction de périmètre, qui
-- ajoute les entités, n'existait pas encore.)
drop policy if exists actions_bo_select on actions_back_office;
create policy actions_bo_select on actions_back_office
  for select to authenticated
  using (
    is_admin()
    or (is_planificateur() and role_cible = 'planification'
        and pays is not null
        and notification_dans_perimetre(auth.uid(), pays, entite_id))
  );
