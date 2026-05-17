"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

// Server actions powering the login + signup forms. Each redirects on success
// (Next.js wraps redirect() in a throw, so it won't reach return statements
// after — that's the documented behaviour).

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // Only allow same-origin paths to prevent open-redirect.
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`,
    );
  }
  redirect(next);
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const next = safeNext(formData.get("next"));

  if (password.length < 8) {
    redirect(
      `/signup?next=${encodeURIComponent(next)}&error=${encodeURIComponent(
        "Le mot de passe doit contenir au moins 8 caractères.",
      )}`,
    );
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
    },
  });
  if (error) {
    redirect(
      `/signup?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`,
    );
  }

  // If email confirmation is enabled on the project, `session` will be null
  // and the user must verify before signing in. We surface that explicitly.
  if (!data.session) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&notice=${encodeURIComponent(
        "Compte créé. Vérifiez votre email pour confirmer, puis connectez-vous.",
      )}`,
    );
  }

  redirect(next);
}

export async function logout() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
