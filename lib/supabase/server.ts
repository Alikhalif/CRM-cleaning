// Supabase client for server code (RSC, route handlers, server actions).
//
// In Next.js 16 the App Router's `cookies()` API returns a Promise — we await
// it inside the get/set adapters. Each request creates a fresh client so
// cookies are scoped correctly.
//
// `supabaseAdmin()` is a separate factory using the service-role key. It
// bypasses RLS and MUST only be called from server-only code (no "use client",
// no route exposed to the browser). CDC §8.2 calls this out explicitly.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const store = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        // RSC can't write cookies — the App Router throws if we try. Route
        // handlers and server actions can. We catch + ignore the throw so
        // RSC reads work; mutation flows should call this from a route
        // handler / server action where writes succeed.
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          /* called from a RSC — safe to ignore */
        }
      },
    },
  });
}

// Service-role client. Bypasses RLS. Server-only.
//
// Guard against accidental import in client code via a runtime check on
// process.env.NEXT_PUBLIC_… being absent of the service key (Next.js
// inlines NEXT_PUBLIC_ vars but never SUPABASE_SERVICE_ROLE_KEY into the
// browser bundle, so this throws loudly if someone imports it client-side).
export function supabaseAdmin() {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin() must never be called in the browser");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
