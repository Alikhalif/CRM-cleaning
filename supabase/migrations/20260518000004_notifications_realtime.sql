-- Enable Supabase Realtime broadcast for the notifications table so the
-- topbar bell badge updates without a page refresh. Subscribers see only
-- their own rows because RLS still applies on the channel — the SELECT
-- policy "notifications: user reads own" gates row visibility.

alter publication supabase_realtime add table notifications;
