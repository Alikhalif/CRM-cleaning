"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type {
  Recipient,
  TemplateAudience,
  TemplateCategory,
  TemplateChannel,
} from "@/lib/message-templates-shared";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

export type TemplateInput = {
  channel: TemplateChannel;
  category: TemplateCategory;
  name: string;
  subject: string; // email only ("" allowed)
  body: string;
  activityId: string; // "" = global (tous secteurs)
  audiences: TemplateAudience[]; // [] = visible par tous
  recipient: Recipient;
  sortOrder: number;
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

function validate(input: TemplateInput): string | null {
  if (!input.name.trim()) return "Nom requis.";
  if (!input.body.trim()) return "Le corps du message est requis.";
  return null;
}

function toRow(input: TemplateInput) {
  return {
    channel: input.channel,
    category: input.category,
    name: input.name.trim(),
    // Le sujet ne concerne que l'email.
    subject: input.channel === "email" ? input.subject.trim() || null : null,
    body: input.body,
    activity_id: input.activityId || null,
    audiences: input.audiences,
    recipient: input.recipient,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  };
}

export async function createTemplate(input: TemplateInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { data, error } = await supabase
    .from("message_templates")
    .insert(toRow(input) as never)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !data) return { ok: false, error: `Échec création : ${error?.message ?? "inconnu"}.` };

  revalidatePath("/settings/templates");
  await auditLog({ action: "template.create", entityType: "user", entityId: data.id, after: { name: input.name, channel: input.channel } });
  return { ok: true, id: data.id };
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<Result> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { error } = await supabase.from("message_templates").update(toRow(input) as never).eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}.` };

  revalidatePath("/settings/templates");
  await auditLog({ action: "template.update", entityType: "user", entityId: id, after: { name: input.name, channel: input.channel } });
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  if (!(await callerIsAdmin(supabase))) return { ok: false, error: "Réservé aux administrateurs." };

  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  if (error) return { ok: false, error: `Échec : ${error.message}.` };

  revalidatePath("/settings/templates");
  await auditLog({ action: "template.delete", entityType: "user", entityId: id });
  return { ok: true };
}
