-- Recette 2026-09-24 · Correctifs P2 (intégrité des dossiers + anti-escalade users)
-- Migration purement schéma/RLS, idempotente.

-- ── P2-2 : un seul dossier par lead ──────────────────────────────────────
-- Confirmé en test réel : sans contrainte, deux signatures concurrentes (e-sign
-- + Kanban, ou deux devis d'un lead) créent DEUX dossiers ; ensuite les lectures
-- applicatives `.maybeSingle()` par lead_id lèvent « multiple rows », cassant la
-- planif / le solde / le contrôle de statut. Aucun doublon en base à ce jour
-- (vérifié) → l'index unique se pose directement. Les insertions applicatives
-- (document-actions.ts, devis/status.ts) font déjà « select puis insert » et
-- n'inspectent pas l'erreur d'insert → la 2e insertion concurrente échoue
-- silencieusement (violation d'unicité avalée), état final = 1 dossier. Aucun
-- changement de code nécessaire.
create unique index if not exists uq_dossiers_lead on dossiers (lead_id);

-- ── P2-1 : anti auto-escalade sur users ──────────────────────────────────
-- Confirmé en test réel : un commercial peut, via une écriture RLS directe
-- (clé anon) sur SA propre ligne users, se mettre is_premium/is_extreme = true
-- — et par extension modifier countries / commercial_profiles — ce qui détourne
-- le ROUTAGE des leads (pools premium/extrême/pays/profil) vers lui. La garde
-- applicative (callerIsAdmin dans settings/users) ne protège que l'UI.
--
-- La policy UPDATE reste « own row OR admin » (l'app peut en dépendre pour des
-- champs bénins), mais un trigger BEFORE UPDATE neutralise toute modification de
-- ces 4 colonnes de routage par un utilisateur AUTHENTIFIÉ NON-ADMIN. Les mises
-- à jour d'un admin (session admin → is_admin() vrai) et celles de l'écran
-- Paramètres via le service-role (auth.role() = 'service_role') ne sont PAS
-- affectées.
create or replace function guard_users_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not is_admin() then
    new.is_premium          := old.is_premium;
    new.is_extreme          := old.is_extreme;
    new.countries           := old.countries;
    new.commercial_profiles := old.commercial_profiles;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_guard_privesc on users;
create trigger trg_users_guard_privesc
  before update on users
  for each row
  execute function guard_users_privilege_escalation();
