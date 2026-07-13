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
