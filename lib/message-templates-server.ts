import "server-only";
import { supabaseServer } from "./supabase/server";
import { getCurrentUserProfile } from "./users-server";
import {
  categoryVisibleTo,
  templateVisibleTo,
  userRoleGroups,
  userTemplateAudiences,
  type Recipient,
  type TemplateAudience,
  type TemplateChannel,
  type TemplateCategory,
} from "./message-templates-shared";

// Data layer for communication templates. RLS: readable by any authenticated
// user, writable by admins only (see the migration). Role scoping (who sees
// which template) is applied in-app via audiences — see getTemplatesForUser.

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
  audiences: TemplateAudience[];
  recipient: Recipient;
  sortOrder: number;
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
  audiences: string[] | null;
  recipient: string | null;
  sort_order: number | null;
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
    audiences: (r.audiences ?? []) as TemplateAudience[],
    recipient: (r.recipient ?? "client") as Recipient,
    sortOrder: r.sort_order ?? 0,
    isActive: r.is_active,
  };
}

const SELECT =
  "id, channel, category, name, subject, body, activity_id, audiences, recipient, sort_order, is_active, activity:activities(slug, label)";

// All templates, for the settings page (admin sees everything).
export async function getMessageTemplates(): Promise<MessageTemplate[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("message_templates")
    .select(SELECT)
    .order("channel", { ascending: true })
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<TemplateJoined[]>();
  if (error || !data) return [];
  return data.map(mapRow);
}

// Active templates visible to the CURRENT user, filtered by audience. Optional
// channel filter (e.g. only SMS for the compose modal). This is the function
// every commercial-facing picker should use so each role only sees its models.
export async function getTemplatesForUser(
  channel?: TemplateChannel,
): Promise<MessageTemplate[]> {
  const [supabase, me] = await Promise.all([supabaseServer(), getCurrentUserProfile()]);
  let query = supabase
    .from("message_templates")
    .select(SELECT)
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (channel) query = query.eq("channel", channel);
  const { data, error } = await query.returns<TemplateJoined[]>();
  if (error || !data) return [];

  const roles = (me?.roles ?? []).map((r) => r.slug);
  const isAdmin = roles.includes("admin");
  const profiles = me?.commercialProfiles ?? [];
  const audiences = userTemplateAudiences(roles, profiles, isAdmin);
  const groups = userRoleGroups(roles, profiles, isAdmin);
  // Double filtre : audience du template ET catégorie autorisée pour le rôle.
  return data
    .map(mapRow)
    .filter((t) => templateVisibleTo(t.audiences, audiences) && categoryVisibleTo(t.category, groups));
}

// Active SMS templates for the current user (SMS compose modal).
export async function getActiveSmsTemplates(): Promise<MessageTemplate[]> {
  return getTemplatesForUser("sms");
}

// Modèles email destinés à l'intervenant (sous-traitant) — pour le module
// « Envoyer à l'intervenant » de la planification. Triés par rubrique + ordre.
export async function getIntervenantTemplates(): Promise<MessageTemplate[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("message_templates")
    .select(SELECT)
    .eq("channel", "email")
    .eq("recipient", "intervenant")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<TemplateJoined[]>();
  if (error || !data) return [];
  return data.map(mapRow);
}

// Fetch one active template by its exact name, bypassing audience filtering.
// Used for quick-action buttons that pre-fill a specific model (e.g. the NRP
// buttons for the Divers profile).
export async function getTemplateByName(name: string): Promise<MessageTemplate | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("message_templates")
    .select(SELECT)
    .eq("name", name)
    .eq("is_active", true)
    .maybeSingle<TemplateJoined>();
  if (error || !data) return null;
  return mapRow(data);
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
