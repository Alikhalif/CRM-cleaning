import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { recordOffline } from "@/lib/presence/heartbeat-server";

export const runtime = "nodejs";

// POST /api/presence/offline — appelé par navigator.sendBeacon à la fermeture
// de l'onglet. Clôt proprement la session pour un temps de session exact.
export async function POST() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await recordOffline(user.id, "beacon");
  } catch {
    /* best-effort */
  }
  return new NextResponse(null, { status: 204 });
}
