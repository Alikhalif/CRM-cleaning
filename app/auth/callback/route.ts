import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// OAuth callback handler. Google (and any other Supabase OAuth provider)
// sends the user back here with a one-time `code` after they accept the
// permission prompt. We exchange that code for a session cookie via
// supabase.auth.exchangeCodeForSession, then redirect to `?next=` (or
// /dashboard by default).
//
// Configure in Google Cloud → APIs & Services → Credentials → OAuth 2.0:
//   Authorized redirect URI: https://<your-supabase-ref>.supabase.co/auth/v1/callback
// Supabase Auth then forwards back to this route once it has set the
// session cookie. The `next` param survives the round-trip via the
// `redirectTo` in the original signInWithOAuth call.

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const errorParam = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (errorParam) {
    // User cancelled or provider error — send them back to login with a friendly message.
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", `Connexion Google annulée : ${errorParam}`);
    return NextResponse.redirect(login);
  }

  if (!code) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", "Code OAuth manquant.");
    return NextResponse.redirect(login);
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", `Échec de l'authentification : ${error.message}`);
    return NextResponse.redirect(login);
  }

  // Success — session cookie is now set. Bounce to the originally-requested page.
  return NextResponse.redirect(new URL(next, url.origin));
}
