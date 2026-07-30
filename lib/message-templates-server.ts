import "server-only";
import { supabaseServer } from "./supabase/server";
import type { TemplateChannel, TemplateCategory } from "./message-templates-shared";

// Data layer for communication templates. RLS: readable by any authenticated
// user, writable by admins only (see the migration).

export type MessageTemplate = {
  id: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  name: string;
  subject: string | null;
  body: string;
  activityId: string | null;
  activitySlug: string | null;
  activityLabel: string | null;
  isActive: boolean;
};

type TemplateJoined = {
  id: string;
  channel: string;
  category: string;
  name: string;
  subject: string | null;
  body: string;
  activity_id: string | null;
  is_active: boolean;
  activity: { slug: string; label: string } | null;
};

function mapRow(r: TemplateJoined): MessageTemplate {
  return {
    id: r.id,
    channel: r.channel as TemplateChannel,
    category: r.category as TemplateCategory,
    name: r.name,
    subject: r.subject,
    body: r.body,
    activityId: r.activity_id,
    activitySlug: r.activity?.slug ?? null,
    activityLabel: r.activity?.label ?? null,
    isActive: r.is_active,
  };
}

const SELECT =
  "id, channel, category, name, subject, body, activity_id, is_active, activity:activities(slug, label)";

// All templates, for the settings page.
export async function getMessageTemplates(): Promise<MessageTemplate[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("message_templates")
    .select(SELECT)
    .order("channel", { ascending: true })
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .returns<TemplateJoined[]>();
  if (error || !data) return [];
  return data.map(mapRow);
}

// Active SMS templates, for the lead "SMS" compose modal.
export async function getActiveSmsTemplates(): Promise<MessageTemplate[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("message_templates")
    .select(SELECT)
    .eq("channel", "sms")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .returns<TemplateJoined[]>();
  if (error || !data) return [];
  return data.map(mapRow);
}

// Sector options for the template editor (optional targeting).
export async function getTemplateSectorOptions(): Promise<{ id: string; label: string }[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("activities")
    .select("id, label")
    .eq("is_active", true)
    .order("label", { ascending: true })
    .returns<{ id: string; label: string }[]>();
  return data ?? [];
}
