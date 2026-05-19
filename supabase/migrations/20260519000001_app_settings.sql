-- Global app settings — small key/value store for runtime toggles that
-- admins flip without a redeploy. Currently holds the n8n auto-sequence
-- on/off switch; extensible to future global flags (e.g. maintenance
-- mode, business-hours-only sequences, etc.).
--
-- Read: any authenticated user (so canLaunchSequence() can gate the UI
-- consistently for everyone).
-- Write: admin only.

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

alter table app_settings enable row level security;

create policy "app_settings readable to authenticated"
  on app_settings for select to authenticated using (true);

create policy "app_settings writable by admin"
  on app_settings for all to authenticated
  using (is_admin())
  with check (is_admin());

-- Seed the n8n flag in the "off" position. The UI defaults to off when
-- the row is missing, so this is belt-and-braces — having the row makes
-- the toggle stable on first interaction.
insert into app_settings (key, value)
  values ('n8n_sequence_enabled', 'false'::jsonb);
