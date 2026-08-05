-- Historique des consultations intervenants (demandes de chiffrage) — client
-- 2026-08-05. Seule la planificatrice consulte les intervenants ; le CRM garde
-- la trace de chaque consultation envoyée, des réponses, montants et dispos.
create table if not exists intervenant_consultations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  intervenant_email text not null,
  intervenant_id uuid references technicians(id),
  template_name text,
  media_count integer not null default 0,
  status text not null default 'envoyee'
    check (status in ('envoyee', 'repondue', 'retenue', 'refusee')),
  montant_propose numeric(12,2),
  disponibilites text,
  notes text,
  sent_by uuid references users(id),
  sent_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists intervenant_consultations_lead_idx
  on intervenant_consultations (lead_id, sent_at desc);

alter table intervenant_consultations enable row level security;

-- Seuls admin + planificatrice (qui communiquent avec les intervenants).
create policy "consultations visible to admin / planner"
  on intervenant_consultations for select to authenticated
  using (is_admin() or is_planificateur());
create policy "consultations writable by admin / planner"
  on intervenant_consultations for all to authenticated
  using (is_admin() or is_planificateur())
  with check (is_admin() or is_planificateur());
