-- ============================================================================
-- Certificat de conformité / attestation d'entretien — NETTOYAGE DE HOTTE.
-- Flux autonome de la planificatrice : génère un certificat A4 (1 page) depuis
-- un dossier, l'archive, l'envoie. Numérotation gapless dédiée
-- « CERT-HOTTE-AAAA-00001 ». Même patron que devis_optimivv.
-- ============================================================================

-- 1. Compteur gapless par année.
create table if not exists cert_hotte_counters (
  year       integer primary key,
  next_value integer not null default 1
);

-- Séquence atomique (verrou de ligne le temps de l'UPDATE) → deux appels
-- concurrents obtiennent deux numéros distincts et consécutifs, sans trou.
create or replace function next_cert_hotte_num(p_year integer)
returns text
language plpgsql
as $fn$
declare
  v_n integer;
begin
  insert into cert_hotte_counters (year, next_value)
  values (p_year, 2)
  on conflict (year)
    do update set next_value = cert_hotte_counters.next_value + 1
  returning next_value - 1 into v_n;

  return 'CERT-HOTTE-' || p_year::text || '-' || lpad(v_n::text, 5, '0');
end;
$fn$;

alter function next_cert_hotte_num(integer)
  security definer
  set search_path = public, pg_temp;

revoke all on function next_cert_hotte_num(integer) from public;
grant execute on function next_cert_hotte_num(integer) to authenticated, service_role;

-- 2. Archive : un certificat émis = une ligne + le PDF exact (pièce qui fait foi).
create table if not exists cert_hotte (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique,
  lead_id      uuid references leads (id) on delete set null,
  dossier_id   uuid references dossiers (id) on delete set null,
  data         jsonb not null,
  client_nom   text,
  client_email text,
  pdf_path     text not null,
  sent_to      text,
  sent_at      timestamptz,
  created_by   uuid references users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_cert_hotte_lead on cert_hotte (lead_id);
create index if not exists idx_cert_hotte_dossier on cert_hotte (dossier_id);
create index if not exists idx_cert_hotte_created on cert_hotte (created_at desc);

alter table cert_hotte enable row level security;

-- Lecture : back-office authentifié (l'écriture passe par le service-role côté
-- serveur, qui contourne la RLS ; l'endpoint vérifie déjà la session + le rôle).
do $rls$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cert_hotte'
      and policyname = 'cert_hotte_select_authenticated'
  ) then
    create policy cert_hotte_select_authenticated
      on cert_hotte for select
      to authenticated
      using (true);
  end if;
end;
$rls$;

-- 3. Le PDF est stocké dans le bucket privé existant « devis-optimivv » sous le
--    préfixe « certificats/ » — pas de nouveau bucket nécessaire.
