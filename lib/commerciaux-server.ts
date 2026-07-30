import "server-only";
import { supabaseServer } from "./supabase/server";

// Per-commercial performance aggregates for the /commerciaux leaderboard.
// CDC §4.3: Super Admin only — page enforces the role gate, this fetcher
// is RLS-scoped (admin sees everything via the existing leads/docs policies).
//
// All metrics are computed in-memory from three parallel queries. At
// 1k leads + 5k documents (5-year horizon) this is a sub-100ms operation.
// Once we hit 10× that, swap to a Postgres materialised view per CDC §10
// Phase 3.

export type CommercialStats = {
  commercial: {
    id: string;
    name: string;
    initials: string;
    color: string;
    email: string;
  };
  leadsCount: number;
  devisSentCount: number; // devis with status >= envoye (envoye / ouvert / signe / refuse / expire)
  devisSignedCount: number;
  conversionRate: number; // signed / sent in [0, 1]
  caSigned: number; // sum of total_ttc on signed devis
  caEncaisse: number; // sum of total_ttc on paid acomptes + finales
  panierMoyen: number; // caSigned / devisSignedCount (0 if no signed)
  sparkline30d: number[]; // 30 buckets, oldest-first, of daily caSigned €
};

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  color: string | null;
};

type LeadOwnerRow = { id: string; owner_id: string | null };

type DocStatRow = {
  type: "devis" | "acompte" | "finale";
  status: string;
  total_ttc: number;
  signed_at: string | null;
  paid_at: string | null;
  lead_id: string | null;
};

function initialsOf(first: string | null, last: string | null, email: string): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (f || l) return ((f[0] ?? "") + (l[0] ?? "")).toUpperCase() || "??";
  return email.slice(0, 2).toUpperCase();
}

function displayNameOf(first: string | null, last: string | null, email: string): string {
  const composed = `${first ?? ""} ${last ?? ""}`.trim();
  return composed || email.split("@")[0];
}

// Full profile of a single commercial, for the admin detail page.
export type CommercialDetail = {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  color: string;
  isActive: boolean;
  isPremium: boolean;
  isExtreme: boolean;
  ringoverAgentId: string | null;
  commercialProfiles: string[];
  countries: string[];
  entityName: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  roles: string[];
};

type DetailRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  color: string | null;
  is_active: boolean | null;
  is_premium: boolean | null;
  is_extreme: boolean | null;
  ringover_agent_id: string | null;
  commercial_profiles: string[] | null;
  countries: string[] | null;
  created_at: string | null;
  last_login_at: string | null;
  entity: { legal_name: string } | null;
};

export async function getCommercialDetail(id: string): Promise<CommercialDetail | null> {
  const supabase = await supabaseServer();
  const [uRes, rRes] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, email, first_name, last_name, color, is_active, is_premium, is_extreme, " +
        "ringover_agent_id, commercial_profiles, countries, created_at, last_login_at, " +
        "entity:legal_entities(legal_name)",
      )
      .eq("id", id)
      .maybeSingle<DetailRow>(),
    supabase
      .from("user_roles")
      .select("roles(slug)")
      .eq("user_id", id)
      .returns<{ roles: { slug: string } | null }[]>(),
  ]);
  const u = uRes.data;
  if (!u) return null;

  return {
    id: u.id,
    email: u.email,
    displayName: displayNameOf(u.first_name, u.last_name, u.email),
    initials: initialsOf(u.first_name, u.last_name, u.email),
    color: u.color ?? "#5b4bcc",
    isActive: Boolean(u.is_active),
    isPremium: Boolean(u.is_premium),
    isExtreme: Boolean(u.is_extreme),
    ringoverAgentId: u.ringover_agent_id,
    commercialProfiles: u.commercial_profiles ?? [],
    countries: u.countries ?? [],
    entityName: u.entity?.legal_name ?? null,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
    roles: (rRes.data ?? []).map((r) => r.roles?.slug).filter((s): s is string => Boolean(s)),
  };
}

export async function getCommerciauxStats(): Promise<CommercialStats[]> {
  const supabase = await supabaseServer();

  const [usersRes, leadsRes, docsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, first_name, last_name, color")
      .returns<UserRow[]>(),
    supabase
      .from("leads")
      .select("id, owner_id")
      .is("deleted_at", null)
      .returns<LeadOwnerRow[]>(),
    supabase
      .from("documents")
      .select("type, status, total_ttc, signed_at, paid_at, lead_id")
      .is("deleted_at", null)
      .returns<DocStatRow[]>(),
  ]);
  if (usersRes.error || !usersRes.data) return [];

  // Build leadId → ownerId lookup once so we don't pay per-doc joins.
  const ownerByLead = new Map<string, string>();
  for (const l of leadsRes.data ?? []) {
    if (l.owner_id) ownerByLead.set(l.id, l.owner_id);
  }

  // Per-owner aggregation buckets, plus the sparkline 30-day grid.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - 29); // 30 buckets total: startDay..today inclusive
  const startMs = +startDay;

  type Bucket = Omit<CommercialStats, "commercial" | "conversionRate" | "panierMoyen">;
  const buckets = new Map<string, Bucket>();
  const ensure = (ownerId: string): Bucket => {
    let b = buckets.get(ownerId);
    if (!b) {
      b = {
        leadsCount: 0,
        devisSentCount: 0,
        devisSignedCount: 0,
        caSigned: 0,
        caEncaisse: 0,
        sparkline30d: new Array<number>(30).fill(0),
      };
      buckets.set(ownerId, b);
    }
    return b;
  };

  // Leads count: every lead the commercial owns, regardless of status.
  for (const l of leadsRes.data ?? []) {
    if (l.owner_id) ensure(l.owner_id).leadsCount++;
  }

  // Document-derived metrics.
  for (const d of docsRes.data ?? []) {
    if (!d.lead_id) continue;
    const ownerId = ownerByLead.get(d.lead_id);
    if (!ownerId) continue;
    const b = ensure(ownerId);
    const amount = Number(d.total_ttc);

    if (d.type === "devis") {
      // "Envoyé" = status reached at least envoye (i.e. anything past brouillon).
      if (d.status !== "brouillon") b.devisSentCount++;
      if (d.status === "signe") {
        b.devisSignedCount++;
        b.caSigned += amount;
        // Sparkline: bucket by signed_at day. Use issued_at as fallback if
        // signed_at is somehow null (defensive — shouldn't happen).
        const at = d.signed_at ?? null;
        if (at) {
          const t = +new Date(at);
          if (t >= startMs && t <= +today + 86400000) {
            const dayIdx = Math.floor((t - startMs) / 86400000);
            if (dayIdx >= 0 && dayIdx < 30) b.sparkline30d[dayIdx] += amount;
          }
        }
      }
    } else if ((d.type === "acompte" || d.type === "finale") && d.status === "paye") {
      b.caEncaisse += amount;
    }
  }

  // Assemble final shape, including users with zero activity (still
  // useful — managers want to see who's underperforming).
  const stats: CommercialStats[] = usersRes.data.map((u) => {
    const b = buckets.get(u.id) ?? {
      leadsCount: 0,
      devisSentCount: 0,
      devisSignedCount: 0,
      caSigned: 0,
      caEncaisse: 0,
      sparkline30d: new Array<number>(30).fill(0),
    };
    return {
      commercial: {
        id: u.id,
        name: displayNameOf(u.first_name, u.last_name, u.email),
        initials: initialsOf(u.first_name, u.last_name, u.email),
        color: u.color ?? "#5b4bcc",
        email: u.email,
      },
      leadsCount: b.leadsCount,
      devisSentCount: b.devisSentCount,
      devisSignedCount: b.devisSignedCount,
      conversionRate: b.devisSentCount > 0 ? b.devisSignedCount / b.devisSentCount : 0,
      caSigned: Math.round(b.caSigned * 100) / 100,
      caEncaisse: Math.round(b.caEncaisse * 100) / 100,
      panierMoyen:
        b.devisSignedCount > 0 ? Math.round(b.caSigned / b.devisSignedCount) : 0,
      sparkline30d: b.sparkline30d,
    };
  });

  // Default sort: CA signé desc. The page lets the user resort by clicking
  // column headers (search params).
  stats.sort((a, b) => b.caSigned - a.caSigned);
  return stats;
}
