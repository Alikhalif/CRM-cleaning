-- ============================================================================
-- D23 — Liens d'accès aux contrats : 60 minutes, renouvelables, tracés
-- (2026-11-09)
--
-- ⚠️ PRÉPARÉE, NON APPLIQUÉE. Recette d'abord ; production sur autorisation.
--
-- Décision du client : « un lien sécurisé valable 60 minutes, renouvelable.
-- Le renouvellement doit être contrôlé et tracé. Ne joins pas
-- automatiquement de documents sensibles aux courriels. »
--
-- Le courriel ne porte plus une URL de stockage signée 7 jours, mais un
-- JETON aléatoire (256 bits) dont seule l'empreinte SHA-256 est stockée —
-- même principe que la signature des devis. À l'ouverture, le CRM vérifie le
-- jeton et redirige vers une URL de stockage de 5 minutes.
--
-- Une ligne par lien émis : la chaîne des renouvellements (`renouvelle_id`)
-- EST l'historique. Les écritures passent par le serveur (service-role) ;
-- aucune session ne peut créer, prolonger ou effacer un lien.
-- ============================================================================

create table if not exists contrat_liens_acces (
  id                uuid primary key default gen_random_uuid(),
  contract_id       uuid not null references contracts (id) on delete cascade,
  token_hash        text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  destinataire      text not null,
  -- Calculée PAR LA BASE : une horloge applicative en avance de quelques
  -- secondes ferait sinon violer la contrainte de durée à chaque lien.
  expire_at         timestamptz not null default (now() + interval '60 minutes'),
  cree_par          uuid references users (id) on delete set null,  -- null = renouvellement demandé par le client
  origine           text not null check (origine in ('envoi', 'renouvellement')),
  renouvelle_id     uuid references contrat_liens_acces (id) on delete set null,
  revoque_at        timestamptz,
  ouvertures        integer not null default 0,
  derniere_ouverture timestamptz,
  created_at        timestamptz not null default now(),
  -- 60 minutes, pas une de plus : la règle est en base, pas seulement dans le code.
  constraint contrat_liens_acces_duree check (expire_at <= created_at + interval '60 minutes')
);

create index if not exists idx_contrat_liens_contrat
  on contrat_liens_acces (contract_id, created_at desc);

alter table contrat_liens_acces enable row level security;

-- Lecture back-office : la traçabilité se consulte. Aucune politique
-- d'écriture : seul le serveur, par service-role, émet ou révoque un lien.
do $rls$
begin
  if not exists (select 1 from pg_policies where tablename = 'contrat_liens_acces' and policyname = 'contrat_liens_acces_select') then
    create policy contrat_liens_acces_select on contrat_liens_acces
      for select to authenticated
      using (is_admin() or is_planificateur());
  end if;
end;
$rls$;
