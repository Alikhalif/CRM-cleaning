-- ── Row Level Security ───────────────────────────────────────────────
-- CDC §3 + §8.2 mandate RLS on every business table. Policies are written
-- against auth.uid() and a small `is_admin()` helper that reads user_roles.
-- Until auth is wired and seeded, auth.uid() returns NULL for unauthenticated
-- requests, which causes every policy below to deny — that's the right
-- default. Service-role connections bypass RLS so the seed script still works.
-- ─────────────────────────────────────────────────────────────────────

-- Helper: does the current user have the admin role?
-- SECURITY DEFINER + immutable search_path = safe inside policies.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.slug = 'admin'
  );
$$;

-- Helper: does the current user hold a granular permission (e.g. immob_travaux)?
create or replace function has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_permissions
    where user_id = auth.uid()
      and permission_key = p_key
  );
$$;

-- Helper: is the current user a planificateur?
create or replace function is_planificateur()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.slug = 'planification'
  );
$$;

-- ── Reference tables (everyone authenticated can read; admin writes) ──

alter table activities     enable row level security;
alter table lead_sources   enable row level security;
alter table payment_terms  enable row level security;
alter table legal_entities enable row level security;
alter table legal_entity_activities enable row level security;
alter table prestations    enable row level security;

create policy "activities readable to authenticated"
  on activities for select
  to authenticated
  using (true);
create policy "activities writable by admin"
  on activities for all
  to authenticated
  using (is_admin()) with check (is_admin());

create policy "lead_sources readable to authenticated"
  on lead_sources for select to authenticated using (true);
create policy "lead_sources writable by admin"
  on lead_sources for all to authenticated using (is_admin()) with check (is_admin());

create policy "payment_terms readable to authenticated"
  on payment_terms for select to authenticated using (true);
create policy "payment_terms writable by admin"
  on payment_terms for all to authenticated using (is_admin()) with check (is_admin());

create policy "legal_entities readable to authenticated"
  on legal_entities for select to authenticated using (true);
create policy "legal_entities writable by admin"
  on legal_entities for all to authenticated using (is_admin()) with check (is_admin());

create policy "legal_entity_activities readable to authenticated"
  on legal_entity_activities for select to authenticated using (true);
create policy "legal_entity_activities writable by admin"
  on legal_entity_activities for all to authenticated using (is_admin()) with check (is_admin());

create policy "prestations readable to authenticated"
  on prestations for select to authenticated using (true);
create policy "prestations writable by admin"
  on prestations for all to authenticated using (is_admin()) with check (is_admin());

-- ── User / roles / permissions ───────────────────────────────────────

alter table users             enable row level security;
alter table roles             enable row level security;
alter table user_roles        enable row level security;
alter table user_activities   enable row level security;
alter table user_permissions  enable row level security;

create policy "users see own row + admin sees all"
  on users for select to authenticated
  using (auth.uid() = id or is_admin());
create policy "users update own row + admin updates any"
  on users for update to authenticated
  using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());
create policy "users insert by admin only"
  on users for insert to authenticated
  with check (is_admin());

create policy "roles readable to authenticated"
  on roles for select to authenticated using (true);
create policy "roles writable by admin"
  on roles for all to authenticated using (is_admin()) with check (is_admin());

create policy "user_roles readable to self + admin"
  on user_roles for select to authenticated
  using (auth.uid() = user_id or is_admin());
create policy "user_roles writable by admin"
  on user_roles for all to authenticated using (is_admin()) with check (is_admin());

create policy "user_activities readable to self + admin"
  on user_activities for select to authenticated
  using (auth.uid() = user_id or is_admin());
create policy "user_activities writable by admin"
  on user_activities for all to authenticated using (is_admin()) with check (is_admin());

create policy "user_permissions readable to self + admin"
  on user_permissions for select to authenticated
  using (auth.uid() = user_id or is_admin());
create policy "user_permissions writable by admin"
  on user_permissions for all to authenticated using (is_admin()) with check (is_admin());

-- ── Leads (the load-bearing one — CDC §3.4 + §8.2) ────────────────────
-- A commercial sees only their own leads; admins see everything;
-- planificateurs see all leads read-only (CDC matrix §3.3).

alter table leads enable row level security;

create policy "leads visible to owner / admin / planner"
  on leads for select
  to authenticated
  using (
    deleted_at is null
    and (
      owner_id = auth.uid()
      or is_admin()
      or is_planificateur()
    )
  );

create policy "leads insertable by owner or admin"
  on leads for insert
  to authenticated
  with check (
    owner_id = auth.uid() or is_admin()
  );

create policy "leads updatable by owner or admin"
  on leads for update
  to authenticated
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

create policy "leads soft-deletable by admin only"
  on leads for delete
  to authenticated
  using (is_admin());

-- ── Clients (mirror lead policy via source_lead_id when present) ──────

alter table clients enable row level security;

create policy "clients visible to admin / planner / lead-owner"
  on clients for select
  to authenticated
  using (
    deleted_at is null
    and (
      is_admin()
      or is_planificateur()
      or (
        source_lead_id is not null
        and exists (
          select 1 from leads l
          where l.id = clients.source_lead_id and l.owner_id = auth.uid()
        )
      )
    )
  );

create policy "clients writable by admin / planner"
  on clients for all
  to authenticated
  using (is_admin() or is_planificateur())
  with check (is_admin() or is_planificateur());

-- ── Documents / lines ────────────────────────────────────────────────

alter table documents      enable row level security;
alter table document_lines enable row level security;
alter table doc_counters   enable row level security;

create policy "documents visible to admin / planner / lead-owner"
  on documents for select
  to authenticated
  using (
    deleted_at is null
    and (
      is_admin()
      or is_planificateur()
      or (
        lead_id is not null
        and exists (
          select 1 from leads l
          where l.id = documents.lead_id and l.owner_id = auth.uid()
        )
      )
    )
  );

create policy "documents writable by admin / planner / lead-owner"
  on documents for all
  to authenticated
  using (
    is_admin()
    or is_planificateur()
    or (
      lead_id is not null
      and exists (
        select 1 from leads l
        where l.id = documents.lead_id and l.owner_id = auth.uid()
      )
    )
  )
  with check (
    is_admin()
    or is_planificateur()
    or (
      lead_id is not null
      and exists (
        select 1 from leads l
        where l.id = documents.lead_id and l.owner_id = auth.uid()
      )
    )
  );

create policy "document_lines follow parent document"
  on document_lines for all
  to authenticated
  using (
    exists (
      select 1 from documents d
      where d.id = document_lines.document_id
        and (
          is_admin()
          or is_planificateur()
          or (
            d.lead_id is not null
            and exists (
              select 1 from leads l
              where l.id = d.lead_id and l.owner_id = auth.uid()
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from documents d
      where d.id = document_lines.document_id
        and (
          is_admin()
          or is_planificateur()
          or (
            d.lead_id is not null
            and exists (
              select 1 from leads l
              where l.id = d.lead_id and l.owner_id = auth.uid()
            )
          )
        )
    )
  );

-- Counters: admins + planners. The next_doc_num() function runs as
-- security definer so callers don't need direct write rights anyway.
create policy "doc_counters readable to admin / planner"
  on doc_counters for select to authenticated
  using (is_admin() or is_planificateur());

-- ── Dossiers / technicians ───────────────────────────────────────────

alter table technicians enable row level security;
alter table dossiers    enable row level security;

create policy "technicians readable to authenticated"
  on technicians for select to authenticated using (true);
create policy "technicians writable by admin / planner"
  on technicians for all to authenticated
  using (is_admin() or is_planificateur())
  with check (is_admin() or is_planificateur());

create policy "dossiers readable to admin / planner / lead-owner"
  on dossiers for select to authenticated
  using (
    is_admin()
    or is_planificateur()
    or exists (
      select 1 from leads l
      where l.id = dossiers.lead_id and l.owner_id = auth.uid()
    )
  );

create policy "dossiers writable by admin / planner"
  on dossiers for all to authenticated
  using (is_admin() or is_planificateur())
  with check (is_admin() or is_planificateur());

-- ── Audit logs + document templates ──────────────────────────────────

alter table audit_logs         enable row level security;
alter table document_templates enable row level security;

-- Append-only: anyone authenticated may insert; only admins may read.
create policy "audit_logs insertable by authenticated"
  on audit_logs for insert to authenticated with check (true);
create policy "audit_logs readable by admin only"
  on audit_logs for select to authenticated using (is_admin());

create policy "document_templates readable to authenticated"
  on document_templates for select to authenticated using (true);
create policy "document_templates writable by admin"
  on document_templates for all to authenticated using (is_admin()) with check (is_admin());
