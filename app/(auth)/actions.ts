"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { passwordLengthError, isPasswordPwned } from "@/lib/password-policy";

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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Diagnostic temporaire : révèle ce que le serveur reçoit réellement
    // (email + longueur du mot de passe) et le projet visé, sans logguer le
    // mot de passe. À retirer une fois le login débloqué.
    console.warn(
      `[login:debug] échec — email="${email}" | longueur mdp=${password.length} | ` +
        `projet=${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "?").replace(/https:\/\/([a-z0-9]+).*/, "$1")} | ` +
        `erreur="${error.message}"`,
    );
    // Failed-login audit row — no user id since auth didn't succeed, but the
    // email + reason are useful for forensics (brute-force detection later).
    await auditLog({
      action: "auth.login.failed",
      entityType: "user",
      entityId: null,
      after: { email, reason: error.message },
    });
    redirect(
      `/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`,
    );
  }
  if (data.user) {
    await auditLog({ action: "auth.login", entityType: "user", entityId: data.user.id });
  }
  redirect(next);
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const next = safeNext(formData.get("next"));

  const lengthErr = passwordLengthError(password);
  if (lengthErr) {
    redirect(`/signup?next=${encodeURIComponent(next)}&error=${encodeURIComponent(lengthErr)}`);
  }

  // Reject passwords known from a public breach (HaveIBeenPwned, CDC §8).
  if (await isPasswordPwned(password)) {
    redirect(
      `/signup?next=${encodeURIComponent(next)}&error=${encodeURIComponent(
        "Ce mot de passe figure dans une fuite de données connue. Choisissez-en un autre.",
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

  if (data.user) {
    await auditLog({
      action: "auth.signup",
      entityType: "user",
      entityId: data.user.id,
      after: { email, firstName, lastName },
    });
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
  // Capture the user before signOut clears the session — afterwards
  // auth.getUser() returns null and we'd lose the actor on the audit row.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await auditLog({ action: "auth.logout", entityType: "user", entityId: user.id });
  }
  await supabase.auth.signOut();
  redirect("/login");
}
