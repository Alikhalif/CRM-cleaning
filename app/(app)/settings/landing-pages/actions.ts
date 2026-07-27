"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { Country } from "@/lib/leads";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

export type LpInput = {
  token: string;
  name: string;
  country: "" | Country;
  entityId: string;
  activityId: string;
  sourceId: string;
  isActive: boolean;
};

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

function validate(input: LpInput): string | null {
  if (!input.token.trim()) return "Token requis.";
  if (!input.name.trim()) return "Nom requis.";
  return null;
}

function toRow(input: LpInput) {
  return {
    token: input.token.trim(),
    name: input.name.trim(),
    country: input.country || null,
    entity_id: input.entityId || null,
    activity_id: input.activityId || null,
    source_id: input.sourceId || null,
    is_active: input.isActive,
  };
}

export async function createLandingPage(input: LpInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { data, error } = await supabase
    .from("landing_pages")
    .insert(toRow(input) as never)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) return { ok: false, error: `Échec création : ${error?.message ?? "inconnu"}.` };

  revalidatePath("/settings/landing-pages");
  await auditLog({ action: "landing_page.create", entityType: "user", entityId: data.id, after: { token: input.token } });
  return { ok: true, id: data.id };
}

export async function updateLandingPage(id: string, input: LpInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { error } = await supabase.from("landing_pages").update(toRow(input) as never).eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}.` };

  revalidatePath("/settings/landing-pages");
  await auditLog({ action: "landing_page.update", entityType: "user", entityId: id, after: { token: input.token } });
  return { ok: true };
}

export async function deleteLandingPage(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { error } = await supabase.from("landing_pages").delete().eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}.` };

  revalidatePath("/settings/landing-pages");
  await auditLog({ action: "landing_page.delete", entityType: "user", entityId: id });
  return { ok: true };
}
