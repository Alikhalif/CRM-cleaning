-- ── Auth → public.users bridge ────────────────────────────────────────
-- Supabase Auth owns auth.users; the app's RLS policies key off public.users.
-- This trigger mirrors a freshly-created auth user into public.users and
-- assigns baseline roles so the UI works immediately after sign-up.
--
-- Role bootstrap:
--   • every new user gets the `commercial` role (baseline access to "their"
--     leads)
--   • the *first* user to sign up additionally gets `admin` (bootstrap), so
--     the demo environment has at least one Super Admin without manual SQL
--
-- Once role-management UI exists, drop the admin-bootstrap branch.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_role_id      uuid;
  commercial_role_id uuid;
  admin_exists       boolean;
begin
  -- Mirror the auth row into public.users.
  insert into public.users (id, email, first_name, last_name, color, is_active)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'first_name', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'last_name', ''), ''),
    '#5b4bcc',
    true
  )
  on conflict (id) do nothing;

  select id into admin_role_id      from public.roles where slug = 'admin';
  select id into commercial_role_id from public.roles where slug = 'commercial';

  -- Baseline role for every new user.
  if commercial_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, commercial_role_id)
    on conflict (user_id, role_id) do nothing;
  end if;

  -- First-user bootstrap: no admin exists yet → make this one an admin.
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.slug = 'admin'
  ) into admin_exists;

  if not admin_exists and admin_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, admin_role_id)
    on conflict (user_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
