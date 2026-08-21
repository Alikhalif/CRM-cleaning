-- ============================================================================
-- Générateur de devis OPTIMIVV (déménagement/débarras) — flux autonome.
-- Numérotation gapless dédiée au format « AAAA-00001 » (séparée de la
-- numérotation DEV-/FA-/FAC- du CRM), archive du binaire PDF + lien à l'affaire.
-- Idempotent.
-- ============================================================================

-- 1. Compteur gapless par année (même principe que doc_counters / next_doc_num).
create table if not exists devis_optimivv_counters (
  year       integer primary key,
  next_value integer not null default 1
);

-- Séquence atomique : la ligne est verrouillée le temps de l'UPDATE, donc deux
-- appels concurrents obtiennent deux numéros distincts et consécutifs. Un numéro
-- manquant ou dupliqué est un problème comptable — d'où l'allocation en base et
-- non en mémoire. Format « 2026-00001 », remis à 1 chaque année.
create or replace function next_devis_optimivv_num(p_year integer)
returns text
language plpgsql
as $fn$
declare
  v_n integer;
begin
  insert into devis_optimivv_counters (year, next_value)
  values (p_year, 2)
  on conflict (year)
    do update set next_value = devis_optimivv_counters.next_value + 1
  returning next_value - 1 into v_n;

  return p_year::text || '-' || lpad(v_n::text, 5, '0');
end;
$fn$;

alter function next_devis_optimivv_num(integer)
  security definer
  set search_path = public, pg_temp;

revoke all on function next_devis_optimivv_num(integer) from public;
grant execute on function next_devis_optimivv_num(integer) to authenticated, service_role;

-- 2. Archive : un devis émis = une ligne + le PDF exact (pièce qui fait foi).
create table if not exists devis_optimivv (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null unique,
  lead_id     uuid references leads (id) on delete set null,
  data        jsonb not null,
  montant_ht  numeric,
  client_nom  text,
  client_email text,
  pdf_path    text not null,
  sent_to     text,
  sent_at     timestamptz,
  created_by  uuid references users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_devis_optimivv_lead on devis_optimivv (lead_id);
create index if not exists idx_devis_optimivv_created on devis_optimivv (created_at desc);

alter table devis_optimivv enable row level security;

-- Lecture : tout utilisateur authentifié du back-office (écriture réservée au
-- service-role côté serveur, qui contourne la RLS). L'endpoint de génération
-- vérifie déjà la session ; l'archive n'expose pas de donnée confidentielle.
do $rls$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'devis_optimivv'
      and policyname = 'devis_optimivv_select_authenticated'
  ) then
    create policy devis_optimivv_select_authenticated
      on devis_optimivv for select
      to authenticated
      using (true);
  end if;
end;
$rls$;

-- 3. Bucket de stockage privé (jamais d'URL publique — TTL via URL signée).
insert into storage.buckets (id, name, public)
values ('devis-optimivv', 'devis-optimivv', false)
on conflict (id) do nothing;
