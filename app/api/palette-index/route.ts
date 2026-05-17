import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getPaletteIndex } from "@/lib/palette-server";

// Fetched lazily by the ⌘K palette on every open. The proxy whitelists
// all of /api/* as public (n8n webhooks need it), so this handler does
// its own auth gate. Defense-in-depth: even without this check, RLS would
// return empty arrays for unauthenticated callers, but an explicit 401
// surfaces the issue instead of silently returning [].
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const entities = await getPaletteIndex();
  return NextResponse.json({ entities });
}
