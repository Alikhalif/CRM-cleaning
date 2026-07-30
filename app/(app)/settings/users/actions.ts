"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { sendBrevoEmail } from "@/lib/brevo";
import { buildInviteEmail } from "@/lib/templates";
import { auditLog } from "@/lib/audit";

// Admin-only user management (roles + premium/extrême pool flags). RLS already
// lets an admin write these tables, BUT the users update policy also allows a
// user to update their OWN row — so a self-escalation to is_premium would slip
// through RLS alone. Hence every action re-checks the caller is an admin.

export type Result = { ok: true } | { ok: false; error: string };

type SB = Awaited<ReturnType<typeof supabaseServer>>;

async function callerIsAdmin(supabase: SB): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("roles(slug)")
    .eq("user_id", user.id)
    .returns<{ roles: { slug: string } | null }[]>();
  return (data ?? []).some((r) => r.roles?.slug === "admin");
}

export async function setUserFlag(
  userId: string,
  flag: "is_premium" | "is_extreme",
  value: boolean,
): Promise<Result> {
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { error } = await supabase
    .from("users")
    .update({ [flag]: value } as never)
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/users");
  await auditLog({
    action: flag === "is_premium" ? "user.premium.set" : "user.extreme.set",
    entityType: "user",
    entityId: userId,
    after: { value },
  });
  return { ok: true };
}

export async function setRingoverAgentId(userId: string, value: string): Promise<Result> {
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { error } = await supabase
    .from("users")
    .update({ ringover_agent_id: value.trim() || null } as never)
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/users");
  await auditLog({
    action: "user.ringover.set",
    entityType: "user",
    entityId: userId,
    after: { value: value.trim() || null },
  });
  return { ok: true };
}

// Replace a user's commercial profiles or country coverage (multi-value).
async function setUserArray(
  userId: string,
  column: "commercial_profiles" | "countries",
  values: string[],
  auditAction: string,
): Promise<Result> {
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { error } = await supabase
    .from("users")
    .update({ [column]: values } as never)
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/users");
  await auditLog({ action: auditAction, entityType: "user", entityId: userId, after: { values } });
  return { ok: true };
}

export async function setUserEntity(userId: string, entityId: string): Promise<Result> {
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { error } = await supabase
    .from("users")
    .update({ entity_id: entityId || null } as never)
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/users");
  await auditLog({
    action: "user.entity.set",
    entityType: "user",
    entityId: userId,
    after: { entity_id: entityId || null },
  });
  return { ok: true };
}

export async function setUserProfiles(userId: string, profiles: string[]): Promise<Result> {
  return setUserArray(userId, "commercial_profiles", profiles, "user.profiles.set");
}

export async function setUserCountries(userId: string, countries: string[]): Promise<Result> {
  return setUserArray(userId, "countries", countries, "user.countries.set");
}

export async function assignRole(userId: string, roleId: string): Promise<Result> {
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role_id: roleId } as never);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/users");
  await auditLog({ action: "user.role.assign", entityType: "user", entityId: userId, after: { roleId } });
  return { ok: true };
}

// Invite a new user by email: create the auth account via the admin API,
// grab the activation link, and email it through Brevo. The auth trigger
// provisions the public.users row (+ default role); the admin can then set
// roles/pools from the table once the invitee appears. Service-role is needed
// for auth.admin — guarded by the same admin check + audited.
// Crée un compte commercial AVEC un mot de passe et email déjà confirmé —
// accès immédiat, sans dépendre de l'email d'invitation. Le trigger
// on_auth_user_created crée la ligne public.users + attribue le rôle Commercial.
export async function createUserWithPassword(
  email: string,
  firstName: string,
  lastName: string,
  password: string,
): Promise<Result> {
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return { ok: false, error: "Email invalide." };
  if (password.length < 12) return { ok: false, error: "Mot de passe : 12 caractères minimum." };

  const admin = await supabaseServiceRole();
  const { data, error } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName.trim() || null, last_name: lastName.trim() || null },
  });
  if (error || !data?.user) {
    return { ok: false, error: `Échec de la création : ${error?.message ?? "inconnu"}.` };
  }

  revalidatePath("/settings/users");
  await auditLog({
    action: "user.create",
    entityType: "user",
    entityId: data.user.id,
    after: { email: cleanEmail, method: "password" },
  });
  return { ok: true };
}

export async function inviteUser(
  email: string,
  firstName: string,
  lastName: string,
): Promise<Result> {
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return { ok: false, error: "Email invalide." };

  const admin = await supabaseServiceRole();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: cleanEmail,
    options: {
      data: { first_name: firstName.trim() || null, last_name: lastName.trim() || null },
    },
  });
  if (error || !data) {
    return { ok: false, error: `Échec de l'invitation : ${error?.message ?? "inconnu"}.` };
  }
  const actionLink = data.properties?.action_link;
  if (!actionLink) return { ok: false, error: "Lien d'activation introuvable." };

  const inviteeName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const tpl = buildInviteEmail({ inviteeName, actionLink });
  const res = await sendBrevoEmail({
    to: cleanEmail,
    toName: inviteeName || undefined,
    subject: tpl.subject,
    htmlContent: tpl.htmlContent,
  });
  if (!res.ok) {
    return { ok: false, error: `Compte créé, mais l'email n'a pas pu être envoyé : ${res.error}` };
  }

  revalidatePath("/settings/users");
  await auditLog({
    action: "user.invite",
    entityType: "user",
    entityId: data.user?.id ?? cleanEmail,
    after: { email: cleanEmail },
  });
  return { ok: true };
}

export async function removeRole(userId: string, roleId: string): Promise<Result> {
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role_id", roleId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/users");
  await auditLog({ action: "user.role.remove", entityType: "user", entityId: userId, after: { roleId } });
  return { ok: true };
}
