import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { MEDIA_BUCKET } from "@/lib/media-server";

// Pièce jointe entrante (format Brevo inbound parsing).
type InboundAttachment = { Name?: string; ContentType?: string; DownloadToken?: string };

// Enregistre les photos/vidéos jointes dans le dossier (lead_media) via le
// service role — best-effort. Télécharge chaque pièce via le token Brevo.
async function ingestAttachments(leadId: string, attachments: InboundAttachment[]): Promise<number> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return 0;
  const admin = await supabaseServiceRole();
  let saved = 0;
  for (const att of attachments) {
    const mime = att.ContentType ?? "";
    const kind = mime.startsWith("image/") ? "photo" : mime.startsWith("video/") ? "video" : null;
    if (!kind || !att.DownloadToken) continue;
    try {
      const r = await fetch(`https://api.brevo.com/v3/inbound/attachments/${att.DownloadToken}`, {
        headers: { "api-key": apiKey },
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const ext = (att.Name?.includes(".") ? att.Name.split(".").pop()! : mime.split("/")[1] ?? "bin").toLowerCase();
      const path = `${leadId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage.from(MEDIA_BUCKET).upload(path, buf, { contentType: mime, upsert: false });
      if (upErr) continue;
      await admin.from("lead_media").insert({
        lead_id: leadId,
        storage_path: path,
        file_name: att.Name ?? `piece.${ext}`,
        mime_type: mime,
        kind,
        size_bytes: buf.length,
        uploaded_by: null,
      } as never);
      saved++;
    } catch {
      // best-effort — une pièce jointe qui échoue ne bloque pas les autres
    }
  }
  return saved;
}

// Brevo inbound-parsing webhook. When a client replies to a transactional
// email sent via Brevo (e.g., the devis or facture they received), Brevo
// catches the reply on a configured subdomain and POSTs it here as JSON.
//
// Configure in Brevo dashboard → Inbound parsing:
//   1. Add a domain like inbound.cgkcrm.fr with the MX records Brevo provides
//   2. Configure the catch-all route to forward to:
//        https://<your-domain>/api/webhooks/brevo/inbound
//   3. Set BREVO_INBOUND_SECRET in env; configure same value in Brevo's
//      webhook secret field. We check it via the X-Brevo-Secret header.
//
// Matching strategy: parse the document number (DEV-2026-0042, FAC-XXXX,
// FA-XXXX) from the subject line. That document tells us the lead. If no
// match, the email is still logged on the global audit trail without a
// lead binding so it isn't silently dropped.

export const runtime = "nodejs";

// Tolerant match — works on French + English subjects ("Re: Devis DEV-...",
// "RE: Facture FAC-2026-0009 — CGK", etc.).
const DOC_NUM_REGEX = /\b((?:DEV|FA|FAC)-\d{4}-\d{4})\b/i;

type BrevoInboundPayload = {
  // Brevo's shape varies a bit by feature; we read defensively.
  From?: { Address?: string; Name?: string };
  To?: { Address?: string }[];
  Subject?: string;
  ReplyTo?: { Address?: string };
  RawHtmlBody?: string;
  RawTextBody?: string;
  ExtractedMarkdownMessage?: string;
  Attachments?: InboundAttachment[];
};

export async function POST(request: Request) {
  const secret = process.env.BREVO_INBOUND_SECRET;
  if (!secret) {
    // Fail-closed en production (ingestion via service-role). Dev only sinon.
    if (process.env.NODE_ENV === "production") {
      console.error("[brevo.inbound] BREVO_INBOUND_SECRET manquant en production — requête refusée");
      return NextResponse.json({ error: "not_configured" }, { status: 401 });
    }
  } else {
    const got = request.headers.get("X-Brevo-Secret") ?? "";
    // Comparaison en temps constant (évite le canal auxiliaire de timing).
    const a = Buffer.from(got, "utf8");
    const b = Buffer.from(secret, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "invalid_secret" }, { status: 401 });
    }
  }

  let payload: BrevoInboundPayload;
  try {
    payload = (await request.json()) as BrevoInboundPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const from = payload.From?.Address ?? payload.ReplyTo?.Address ?? "";
  const subject = payload.Subject ?? "";
  const bodyPreview =
    (payload.ExtractedMarkdownMessage ?? payload.RawTextBody ?? "").slice(0, 500);

  // Try to bind the reply to a known lead via the document number in the
  // subject. Service-role bypass on the read so the webhook can match
  // even without an authenticated session.
  let leadId: string | null = null;
  let docNum: string | null = null;
  let ownerId: string | null = null;
  const match = subject.match(DOC_NUM_REGEX);
  if (match) {
    docNum = match[1].toUpperCase();
    const supabase = await supabaseServiceRole();
    const { data: doc } = await supabase
      .from("documents")
      .select("lead_id, leads(owner_id, client_first_name, client_last_name, client_company, is_company)")
      .eq("num", docNum)
      .maybeSingle<{
        lead_id: string | null;
        leads: {
          owner_id: string | null;
          client_first_name: string | null;
          client_last_name: string | null;
          client_company: string | null;
          is_company: boolean;
        } | null;
      }>();
    leadId = doc?.lead_id ?? null;
    ownerId = doc?.leads?.owner_id ?? null;

    // Push a notification to the lead's owner so the bell badge updates
    // and they don't miss the reply. Best-effort — failure is logged.
    if (leadId && ownerId) {
      const clientLabel = doc?.leads?.is_company
        ? (doc.leads.client_company ?? "(client)")
        : `${doc?.leads?.client_first_name ?? ""} ${doc?.leads?.client_last_name ?? ""}`.trim() || "(client)";
      await notify({
        userId: ownerId,
        kind: "email.reply",
        entityType: "lead",
        entityId: leadId,
        title: `Réponse de ${clientLabel}`,
        body: subject,
        href: `/leads/${leadId}`,
      });
    }
  }

  // Fallback : pas de n° de doc dans le sujet → matcher par l'email de
  // l'expéditeur. Permet d'attacher les photos même sur une réponse « libre ».
  if (!leadId && from) {
    const supabase = await supabaseServiceRole();
    const { data: lead } = await supabase
      .from("leads")
      .select("id, owner_id")
      .ilike("client_email", from)
      .is("deleted_at", null)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; owner_id: string | null }>();
    if (lead) { leadId = lead.id; ownerId = lead.owner_id; }
  }

  // Ingestion automatique des photos/vidéos jointes dans le dossier du client.
  let mediaSaved = 0;
  if (leadId && Array.isArray(payload.Attachments) && payload.Attachments.length > 0) {
    mediaSaved = await ingestAttachments(leadId, payload.Attachments);
    if (mediaSaved > 0 && ownerId) {
      await notify({
        userId: ownerId,
        kind: "email.reply",
        entityType: "lead",
        entityId: leadId,
        title: `${mediaSaved} média(s) reçu(s) par email`,
        body: subject,
        href: `/leads/${leadId}?tab=media`,
      });
    }
  }

  await auditLog({
    action: leadId ? "lead.email.reply" : "email.reply.unmatched",
    entityType: leadId ? "lead" : "user",
    entityId: leadId,
    after: {
      from,
      subject,
      matchedDocNum: docNum,
      bodyPreview,
      mediaSaved,
    },
  });

  return NextResponse.json({ ok: true, matched: Boolean(leadId), leadId, mediaSaved });
}
