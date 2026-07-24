import "server-only";
import { supabaseServer } from "./supabase/server";

// Current-user lookup for the Topbar (user menu + Vue selector). Returns
// null when there's no session — the layout's proxy already redirects
// unauthenticated traffic to /login, so this is defensive.

export type UserRole = { slug: string; label: string };

export type CurrentUserProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  // Display-friendly composed name with sensible fallback to email local-part.
  displayName: string;
  // Two-letter avatar initials (uppercased).
  initials: string;
  // Per-user accent colour for the avatar — falls back to brand if not set.
  color: string;
  roles: UserRole[];
};

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  color: string | null;
};

type RoleJoinRow = { roles: { slug: string; label: string } | null };

function deriveInitials(first: string | null, last: string | null, email: string): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (f || l) {
    return ((f[0] ?? "") + (l[0] ?? "")).toUpperCase() || "??";
  }
  // Fallback: first two characters of the email's local part.
  return email.slice(0, 2).toUpperCase();
}

function deriveDisplayName(first: string | null, last: string | null, email: string): string {
  const composed = `${first ?? ""} ${last ?? ""}`.trim();
  if (composed) return composed;
  // Strip the @domain so a user without a name still sees something usable.
  return email.split("@")[0];
}

// ── Admin: Utilisateurs settings page ────────────────────────────────
export type RoleOption = { id: string; slug: string; label: string };

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string;
  isPremium: boolean;
  isExtreme: boolean;
  ringoverAgentId: string;
  roleSlugs: string[];
};

type AdminUserRaw = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_premium: boolean | null;
  is_extreme: boolean | null;
  ringover_agent_id: string | null;
};

// All users + their roles for the admin Utilisateurs page. RLS restricts the
// underlying tables to admins, so a non-admin session simply gets nothing.
export async function getAllUsersForAdmin(): Promise<AdminUserRow[]> {
  const supabase = await supabaseServer();
  const [usersRes, urRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, first_name, last_name, is_premium, is_extreme, ringover_agent_id")
      .order("first_name", { ascending: true })
      .returns<AdminUserRaw[]>(),
    supabase
      .from("user_roles")
      .select("user_id, roles(slug)")
      .returns<{ user_id: string; roles: { slug: string } | null }[]>(),
  ]);

  const rolesByUser = new Map<string, string[]>();
  for (const r of urRes.data ?? []) {
    if (!r.roles) continue;
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.roles.slug);
    rolesByUser.set(r.user_id, arr);
  }

  return (usersRes.data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    displayName: deriveDisplayName(u.first_name, u.last_name, u.email),
    isPremium: Boolean(u.is_premium),
    isExtreme: Boolean(u.is_extreme),
    ringoverAgentId: u.ringover_agent_id ?? "",
    roleSlugs: rolesByUser.get(u.id) ?? [],
  }));
}

export async function getAllRoles(): Promise<RoleOption[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("roles")
    .select("id, slug, label")
    .order("slug", { ascending: true })
    .returns<RoleOption[]>();
  return data ?? [];
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Two queries in parallel — users + user_roles+roles join.
  const [profileRes, rolesRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, first_name, last_name, color")
      .eq("id", user.id)
      .maybeSingle<UserRow>(),
    supabase
      .from("user_roles")
      .select("roles(slug, label)")
      .eq("user_id", user.id)
      .returns<RoleJoinRow[]>(),
  ]);

  // If the public.users row hasn't been provisioned yet (e.g., fresh signup
  // before the auth trigger inserts it), fall back to the auth.user data so
  // the topbar still renders something usable.
  const fallbackEmail = user.email ?? "";
  const profile = profileRes.data;
  const email = profile?.email ?? fallbackEmail;
  const first = profile?.first_name ?? null;
  const last = profile?.last_name ?? null;

  return {
    id: user.id,
    email,
    firstName: first,
    lastName: last,
    displayName: deriveDisplayName(first, last, email),
    initials: deriveInitials(first, last, email),
    color: profile?.color ?? "var(--color-brand-500)",
    roles: (rolesRes.data ?? [])
      .map((r) => r.roles)
      .filter((r): r is { slug: string; label: string } => r !== null),
  };
}
