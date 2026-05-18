"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Mounted once in the app layout. Subscribes to Supabase Realtime on
// `notifications` filtered by the current user. On INSERT (or UPDATE that
// toggles read_at, which is how the badge count drops), trigger
// router.refresh() — the layout re-fetches getUnreadCount() and the bell
// badge updates in place without a full page reload.
//
// RLS is enforced on the realtime channel too, so the filter is belt +
// braces: even if we didn't filter client-side, Postgres would only emit
// rows where user_id = auth.uid().

type Props = { userId: string };

export default function RealtimeNotifications({ userId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();

    // Unique channel name per user so multiple tabs don't collide on the
    // server side (Supabase Realtime multiplexes channels per connection).
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT for new arrivals, UPDATE for mark-read toggles
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Cheapest correct update: tell Next to refetch the layout's
          // server-rendered count. The bell re-renders with the new badge.
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
