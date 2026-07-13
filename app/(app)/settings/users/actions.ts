"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
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
