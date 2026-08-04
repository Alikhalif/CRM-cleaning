-- Gestion centralisée des photos/vidéos par dossier (client 2026-08-03).
-- Un bucket privé + une table lead_media. Le stockage est piloté côté serveur
-- (service role) ; l'accès en lecture passe par des URLs signées générées pour
-- les utilisateurs autorisés. La table porte la RLS (qui voit/ajoute/supprime).

-- ── Bucket privé (accès objets = service role uniquement, pas de policy) ──
insert into storage.buckets (id, name, public)
values ('lead-media', 'lead-media', false)
on conflict (id) do nothing;

-- ── Table des médias ─────────────────────────────────────────────────────
create table if not exists lead_media (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  storage_path text not null,                 -- chemin dans le bucket
  file_name text not null,
  mime_type text not null,
  kind text not null check (kind in ('photo', 'video')),
  size_bytes bigint,
  comment text,
  uploaded_by uuid references users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references users(id)
);

create index if not exists lead_media_lead_id_idx on lead_media (lead_id, created_at desc);

alter table lead_media enable row level security;

-- Lecture : admin, planificatrice, ou propriétaire du lead (commercial).
create policy "lead_media visible to owner / admin / planner"
  on lead_media for select to authenticated
  using (
    deleted_at is null and (
      is_admin() or is_planificateur()
      or exists (select 1 from leads l where l.id = lead_media.lead_id and l.owner_id = auth.uid())
    )
  );

-- Ajout : admin, planificatrice, ou propriétaire du lead ; toujours en tant
-- que soi-même (uploaded_by = auth.uid()).
create policy "lead_media insertable by owner / admin / planner"
  on lead_media for insert to authenticated
  with check (
    uploaded_by = auth.uid() and (
      is_admin() or is_planificateur()
      or exists (select 1 from leads l where l.id = lead_media.lead_id and l.owner_id = auth.uid())
    )
  );

-- Commentaire : admin, planificatrice, ou l'auteur du média.
create policy "lead_media updatable by author / admin / planner"
  on lead_media for update to authenticated
  using (is_admin() or is_planificateur() or uploaded_by = auth.uid())
  with check (is_admin() or is_planificateur() or uploaded_by = auth.uid());

-- Suppression : admin ou auteur uniquement (la planificatrice ne supprime pas).
create policy "lead_media deletable by author / admin"
  on lead_media for delete to authenticated
  using (is_admin() or uploaded_by = auth.uid());
