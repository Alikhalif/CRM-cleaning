-- In-app notifications. Per-user inbox driven by webhooks (Brevo inbound,
-- Ringover) + cross-user actions (lead reassignment). The topbar bell
-- shows an unread count; clicking it routes to /notifications.
--
-- Inserts happen server-side via service-role (the inserting actor is often
-- DIFFERENT from the recipient, e.g., reassign → notify the new owner), so
-- the RLS check is permissive for inserts but locked for select/update.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,                  -- 'email.reply', 'call.missed', 'lead.assigned', etc.
  entity_type text,
  entity_id uuid,
  title text not null,
  body text,
  href text,                            -- click target, e.g. '/leads/<id>'
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Hot path: count + list unread per user, ordered by recency.
create index notifications_user_unread_idx
  on notifications(user_id, created_at desc)
  where read_at is null;

-- Full-list view (read + unread, recent first).
create index notifications_user_recent_idx
  on notifications(user_id, created_at desc);

alter table notifications enable row level security;

create policy "notifications: user reads own"
  on notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications: user marks own as read"
  on notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts are intended to flow through service-role from server actions /
-- webhooks. We don't grant authenticated insert — that would let a user
-- spam their own (or others') inbox via the JS client.
