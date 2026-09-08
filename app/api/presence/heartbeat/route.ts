import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { recordHeartbeat } from "@/lib/presence/heartbeat-server";

export const runtime = "nodejs";

// POST /api/presence/heartbeat — battement de présence. Écrit UNIQUEMENT la
// présence de l'utilisateur authentifié. Best-effort : ne renvoie jamais
// d'erreur bloquante (le CRM continue quoi qu'il arrive).
export async function POST(request: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new NextResponse(null, { status: 204 });

    let body: { active?: boolean; page?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      /* corps optionnel */
    }
    await recordHeartbeat(user.id, {
      active: body.active === true,
      page: typeof body.page === "string" ? body.page.slice(0, 200) : null,
      userAgent: request.headers.get("user-agent"),
    });
  } catch {
    /* best-effort — présence non critique */
  }
  return new NextResponse(null, { status: 204 });
}
