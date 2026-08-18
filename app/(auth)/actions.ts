"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { passwordLengthError, isPasswordPwned } from "@/lib/password-policy";
import { checkLoginLock, recordLoginFailure, resetLoginThrottle, loginKey } from "@/lib/auth-throttle";

// Origine de la requête (proto + host), pour construire le lien de retour du
// mail de réinitialisation — fonctionne en local comme derrière Traefik.
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

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
  const key = loginKey(email);

  // Verrouillage anti-brute-force : refuse avant même de tenter l'authentification.
  const lock = await checkLoginLock(key);
  if (lock.locked) {
    await auditLog({ action: "auth.login.locked", entityType: "user", entityId: null, after: { email, retryInSec: lock.retryInSec } });
    const min = Math.ceil(lock.retryInSec / 60);
    redirect(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(`Trop de tentatives. Réessayez dans ${min} min.`)}`);
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Échec → incrémente le compteur (verrouillage exponentiel au-delà du seuil).
    await recordLoginFailure(key);
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
    await resetLoginThrottle(key); // succès → remet le compteur à zéro
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

// Demande de réinitialisation de mot de passe. Envoie l'email Supabase (type
// recovery) dont le lien revient sur /auth/callback → /reset-password. On
// répond TOUJOURS par un message générique (pas d'énumération de comptes).
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const notice =
    "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé. Pensez à vérifier vos spams.";

  if (email) {
    const supabase = await supabaseServer();
    const origin = await requestOrigin();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
    await auditLog({
      action: "auth.password_reset.request",
      entityType: "user",
      entityId: null,
      after: { email, ok: !error, reason: error?.message ?? null },
    });
  }
  redirect(`/login?notice=${encodeURIComponent(notice)}`);
}

// Applique le nouveau mot de passe pour l'utilisateur dont la session de
// récupération est active (arrivé via le lien du mail). Vérifie la politique
// de mot de passe puis met à jour, et renvoie vers le login.
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    redirect(`/reset-password?error=${encodeURIComponent("Les deux mots de passe ne correspondent pas.")}`);
  }
  const lengthErr = passwordLengthError(password);
  if (lengthErr) {
    redirect(`/reset-password?error=${encodeURIComponent(lengthErr)}`);
  }
  if (await isPasswordPwned(password)) {
    redirect(
      `/reset-password?error=${encodeURIComponent(
        "Ce mot de passe figure dans une fuite de données connue. Choisissez-en un autre.",
      )}`,
    );
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/reset-password?error=${encodeURIComponent("Lien expiré ou invalide. Refaites une demande de réinitialisation.")}`);
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }
  await auditLog({ action: "auth.password_reset.done", entityType: "user", entityId: user!.id });
  await supabase.auth.signOut();
  redirect(`/login?notice=${encodeURIComponent("Mot de passe mis à jour. Connectez-vous avec le nouveau.")}`);
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
