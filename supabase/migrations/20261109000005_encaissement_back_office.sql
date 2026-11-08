-- ============================================================================
-- D29 — L'encaissement se valide au back-office, et nulle part ailleurs
-- (2026-11-09)
--
-- ⚠️ PRÉPARÉE, NON APPLIQUÉE. Recette d'abord ; production sur autorisation.
--
-- Décision du client : « seuls les utilisateurs back-office habilités et le
-- Super Admin peuvent valider comptablement un encaissement. Le commercial
-- peut consulter les informations de paiement autorisées, mais ne peut pas
-- modifier directement le statut comptable. Vérifie les permissions côté
-- serveur ET EN BASE. »
--
-- Pourquoi un trigger et pas la RLS : la politique `documents writable by
-- admin / planner / lead-owner` (20260515000005) donne au propriétaire du lead
-- l'écriture sur ses documents — il en a besoin pour ses devis. La RLS
-- raisonne par LIGNE ; ce qu'il faut interdire ici, c'est une TRANSITION de
-- colonnes. Le trigger la refuse quel que soit le chemin : écran, server
-- action, appel direct à l'API avec la clé anonyme.
--
-- Le service-role (webhooks, scripts gardés) n'a pas d'`auth.uid()` et n'est
-- pas concerné : il ne passe pas par une session utilisateur.
--
-- Rien ne change pour la LECTURE : le commercial voit toujours si sa facture
-- est payée — la RLS de lecture n'est pas touchée.
-- ============================================================================

create or replace function garder_encaissement_facture()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.type not in ('acompte', 'finale') then
    return new;
  end if;
  if auth.uid() is null or is_admin() or is_planificateur() then
    return new;
  end if;
  if (new.status = 'paye' and old.status is distinct from 'paye')
     or (old.status = 'paye' and new.status is distinct from 'paye')
     or new.paid_at is distinct from old.paid_at
     or new.payment_reference is distinct from old.payment_reference then
    raise exception 'Facture % : l''encaissement se valide au back-office (planification ou Super Admin).', old.num
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_documents_garder_encaissement on documents;
create trigger trg_documents_garder_encaissement
  before update on documents
  for each row execute function garder_encaissement_facture();

-- Le lead « encaissé » est le reflet commercial d'un encaissement COMPTABLE :
-- il ne se pose pas à la main par une session commerciale.
create or replace function garder_lead_encaisse()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'encaisse' and old.status is distinct from 'encaisse'
     and auth.uid() is not null and not (is_admin() or is_planificateur()) then
    raise exception 'Le passage à « encaissé » suit la validation comptable du back-office.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_garder_encaisse on leads;
create trigger trg_leads_garder_encaisse
  before update of status on leads
  for each row execute function garder_lead_encaisse();
