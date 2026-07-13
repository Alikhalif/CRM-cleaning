import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { resolveOwner } from "@/lib/routing";

// WF1 — Lead capture webhook (CDC §2.3).
//
// Landing pages POST here directly OR n8n forwards normalised payloads here.
// The endpoint is open (proxy.ts whitelists /api/* so no auth cookie), so
// authenticity is enforced by HMAC verification on every request when
// LEADS_INBOUND_SECRET is set. In dev the secret can be omitted — every
// request is accepted (logged warning) so you can curl-test without ceremony.
//
// Expected payload (JSON):
// {
//   "external_id": "lp_abc123",                // optional — for idempotency
//   "is_company": false,
//   "first_name": "Jean", "last_name": "Dupont",
//   "company_name": null,
//   "email": "jean@example.com",
//   "phone": "+33612345678",                   // E.164 expected
//   "address_line": "10 rue de la Paix",
//   "postal_code": "75002", "city": "Paris",
//   "activity_slug": "renovation",             // urgence|nettoyage|enr|renovation
//   "source_slug": "google_ads",               // google_ads|meta_ads|site_web|telephone|recommandation
//   "estimated_amount": 5000,
//   "surface_m2": 120,
//   "gclid": "Cj0KCQ...",                      // optional — Google offline conversions
//   "utm_source": "google", "utm_campaign": "renov-2026",
//   "notes": "Demande devis cuisine"
// }
//
// Idempotency: if `external_id` is supplied and matches an existing lead,
// the endpoint returns 200 with the existing lead id and does NOT create a
// duplicate. This is the deduplication contract n8n WF1 expects.
//
// Routing: owner is resolved by the routing engine (lib/routing.ts) — first
// rule whose conditions match wins. If no rule matches, falls back to the
// `assigned_to` field in the payload (optional), then to the first admin user.

export const runtime = "nodejs";

// CORS — landing pages on other domains (cgk-services.fr, etc.) need to POST
// here from the browser. The endpoint is HMAC-protected so opening CORS to
// "*" is safe (origin doesn't gate access — the signature does).
// Comma-separate multiple origins in LEADS_INBOUND_ALLOWED_ORIGINS if you
// want to lock it down to specific LP domains.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.LEADS_INBOUND_ALLOWED_ORIGINS ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Signature",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Small helper — every response from this endpoint must carry the CORS
// headers so browser callers (LP forms) can read the body. Wrap once here
// rather than thread the headers through every return statement.
function corsJson(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

const ALLOWED_ACTIVITIES = ["urgence", "nettoyage", "enr", "renovation", "debarras"] as const;
const ALLOWED_SOURCES = ["google_ads", "meta_ads", "site_web", "telephone", "recommandation"] as const;
type ActivitySlug = (typeof ALLOWED_ACTIVITIES)[number];
type SourceSlug = (typeof ALLOWED_SOURCES)[number];

type LeadPayload = {
  external_id?: string;
  is_company?: boolean;
  first_name?: string;
  last_name?: string;
  company_name?: string | null;
  email?: string;
  phone?: string;
  address_line?: string;
  postal_code?: string;
  city?: string;
  activity_slug?: string;
  source_slug?: string;
  estimated_amount?: number | null;
  surface_m2?: number | null;
  is_extreme?: boolean | null;
  gclid?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_medium?: string;
  utm_content?: string;
  notes?: string;
  // Optional override — used by n8n if a specific commercial is already known.
  // Routing rules still run first; this is only the fallback.
  assigned_to?: string;
};

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEADS_INBOUND_SECRET;
  if (!secret) {
    console.warn("[leads.inbound] no LEADS_INBOUND_SECRET set — accepting webhook without verification (dev mode)");
    return true;
  }
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function capitalize(name: string): string {
  return name
    .toLowerCase()
    .split(/(\s|-)/)
    .map((part) => (/^[a-zà-ÿ]/i.test(part) ? part[0].toUpperCase() + part.slice(1) : part))
    .join("");
}

function normalizePhone(phone: string): string {
  // Keep only digits and leading +. n8n's normalisation should already
  // produce E.164; this is belt-and-braces.
  const stripped = phone.replace(/[^\d+]/g, "");
  if (stripped.startsWith("0") && stripped.length === 10) {
    return "+33" + stripped.slice(1);
  }
  return stripped;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature");
  if (!verifySignature(rawBody, signature)) {
    return corsJson({ error: "invalid_signature" }, 401);
  }

  let payload: LeadPayload;
  try {
    payload = JSON.parse(rawBody) as LeadPayload;
  } catch {
    return corsJson({ error: "invalid_json" }, 400);
  }

  // ── Validate required fields ──────────────────────────────────────
  const isCompany = payload.is_company === true;
  if (isCompany && !normalize(payload.company_name ?? "")) {
    return corsJson({ error: "missing_company_name" }, 400);
  }
  if (!isCompany && !normalize(`${payload.first_name ?? ""} ${payload.last_name ?? ""}`)) {
    return corsJson({ error: "missing_contact_name" }, 400);
  }
  if (!normalize(payload.phone)) {
    return corsJson({ error: "missing_phone" }, 400);
  }
  if (!payload.activity_slug || !ALLOWED_ACTIVITIES.includes(payload.activity_slug as ActivitySlug)) {
    return corsJson({ error: "invalid_activity_slug" }, 400);
  }
  if (!payload.source_slug || !ALLOWED_SOURCES.includes(payload.source_slug as SourceSlug)) {
    return corsJson({ error: "invalid_source_slug" }, 400);
  }

  const supabase = await supabaseServiceRole();

  // ── Idempotency on external_id ────────────────────────────────────
  if (payload.external_id) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id, short_id")
      .eq("external_id", payload.external_id)
      .maybeSingle<{ id: string; short_id: string }>();
    if (existing) {
      return corsJson({
        ok: true,
        deduplicated: true,
        id: existing.id,
        short_id: existing.short_id,
      }, 200);
    }
  }

  // ── Resolve activity + source IDs ─────────────────────────────────
  const [{ data: activity }, { data: source }] = await Promise.all([
    supabase.from("activities").select("id").eq("slug", payload.activity_slug).maybeSingle<{ id: string }>(),
    supabase.from("lead_sources").select("id").eq("slug", payload.source_slug as SourceSlug).maybeSingle<{ id: string }>(),
  ]);
  if (!activity || !source) {
    return corsJson({ error: "unknown_activity_or_source" }, 400);
  }

  // ── Compute owner via routing rules, fallback to assigned_to, then admin ─
  const routingDecision = await resolveOwner({
    surfaceM2: payload.surface_m2 ?? null,
    sectorSlug: payload.activity_slug as ActivitySlug,
    sourceSlug: payload.source_slug,
    clientIsPremium: false, // no client yet at lead-creation time
    estimatedAmount: payload.estimated_amount ?? null,
    isExtreme: payload.is_extreme ?? false,
  });

  let ownerId: string | null = routingDecision?.ownerId ?? null;
  let ownerSource: "routing" | "payload" | "fallback_admin" | "fallback_first" = "routing";

  if (!ownerId && payload.assigned_to) {
    const { data: u } = await supabase
      .from("users")
      .select("id")
      .eq("id", payload.assigned_to)
      .eq("is_active", true)
      .maybeSingle<{ id: string }>();
    if (u) {
      ownerId = u.id;
      ownerSource = "payload";
    }
  }
  if (!ownerId) {
    // Fallback: first admin user
    const { data: admin } = await supabase
      .from("user_roles")
      .select("user_id, roles!inner(slug)")
      .eq("roles.slug", "admin")
      .limit(1)
      .maybeSingle<{ user_id: string }>();
    if (admin) {
      ownerId = admin.user_id;
      ownerSource = "fallback_admin";
    }
  }
  if (!ownerId) {
    // Last resort: any active user
    const { data: any } = await supabase
      .from("users")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (any) {
      ownerId = any.id;
      ownerSource = "fallback_first";
    }
  }
  if (!ownerId) {
    return corsJson({ error: "no_active_owner_available" }, 500);
  }

  // ── Compute next short_id ─────────────────────────────────────────
  const { data: maxRow } = await supabase
    .from("leads")
    .select("short_id")
    .ilike("short_id", "L-%")
    .order("short_id", { ascending: false })
    .limit(1)
    .maybeSingle<{ short_id: string }>();
  const lastN = maxRow ? parseInt(maxRow.short_id.replace(/^L-/, ""), 10) || 1000 : 1000;
  const shortId = `L-${lastN + 1}`;

  // ── Insert the lead ───────────────────────────────────────────────
  const insertPayload = {
    short_id: shortId,
    external_id: payload.external_id ?? null,
    is_company: isCompany,
    client_first_name: isCompany ? null : capitalize(normalize(payload.first_name)),
    client_last_name: isCompany ? null : capitalize(normalize(payload.last_name)).toUpperCase(),
    client_company: isCompany ? normalize(payload.company_name ?? "") : null,
    client_email: normalize(payload.email).toLowerCase() || null,
    client_phone: normalizePhone(normalize(payload.phone)),
    client_address: {
      line1: normalize(payload.address_line) || null,
      postal_code: normalize(payload.postal_code) || null,
      city: normalize(payload.city) || null,
    },
    activity_id: activity.id,
    source_id: source.id,
    owner_id: ownerId,
    estimated_amount: payload.estimated_amount ?? null,
    surface_m2: payload.surface_m2 ?? null,
    is_extreme: payload.is_extreme ?? false,
    status: "lead" as const,
    received_at: new Date().toISOString(),
    last_action_label: "Lead reçu via WF1",
    last_action_at: new Date().toISOString(),
    notes: normalize(payload.notes) || null,
    gclid: payload.gclid ?? null,
    utm_source: payload.utm_source ?? null,
    utm_campaign: payload.utm_campaign ?? null,
    utm_term: payload.utm_term ?? null,
    utm_medium: payload.utm_medium ?? null,
    utm_content: payload.utm_content ?? null,
  };

  const { data: inserted, error } = await supabase
    .from("leads")
    .insert(insertPayload as never)
    .select("id, short_id")
    .maybeSingle<{ id: string; short_id: string }>();

  if (error || !inserted) {
    return corsJson(
      { error: "insert_failed", detail: error?.message ?? "unknown" },
      500,
    );
  }

  // ── Audit + notify owner ──────────────────────────────────────────
  await auditLog({
    action: "lead.create.webhook",
    entityType: "lead",
    entityId: inserted.id,
    after: {
      shortId: inserted.short_id,
      ownerId,
      ownerSource,
      routingMatch: routingDecision?.matchedRuleName ?? null,
      source: payload.source_slug,
      activity: payload.activity_slug,
      external_id: payload.external_id ?? null,
    },
  });

  await notify({
    userId: ownerId,
    kind: "lead.assigned",
    entityType: "lead",
    entityId: inserted.id,
    title: `Nouveau lead — ${inserted.short_id}`,
    body: isCompany ? payload.company_name ?? "" : `${payload.first_name} ${payload.last_name}`,
    href: `/leads/${inserted.id}`,
  });

  return corsJson({
    ok: true,
    id: inserted.id,
    short_id: inserted.short_id,
    owner_id: ownerId,
    owner_source: ownerSource,
    routing_match: routingDecision?.matchedRuleName ?? null,
  }, 200);
}
