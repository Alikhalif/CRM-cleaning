import "server-only";
import crypto from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { supabaseServer } from "./supabase/server";
import { supabaseServiceRole } from "./supabase/service";
import { getDocumentById } from "./documents-server";
import DocumentPdf from "./pdf/DocumentPdf";
import SignatureAttestationPdf from "./pdf/SignatureAttestationPdf";
import SignatureCertificatePdf from "./pdf/SignatureCertificatePdf";
import { markDocumentSigned } from "@/app/(app)/_shared/document-actions";
import { notify, notifyRole } from "./notifications";
import { sendBrevoEmail, PLANIF_SENDER } from "./brevo";
import { formatEUR } from "./leads";
import {
  DEFAULT_CONSENT_TEXT,
  SIGNATURE_DEFAULT_EXPIRY_DAYS,
  SIGNATURE_EVENT_LABEL,
  type SignatureEventType,
  type SignatureStatus,
  type SignatureType,
} from "./signature-shared";

const BUCKET = "signed-documents";
const SIGNED_URL_TTL = 3600;

// ── Primitives cryptographiques ──────────────────────────────────────────
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
export function generateSignatureToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}
export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function parseUserAgent(ua: string): { browser: string; os: string; device_type: string } {
  const u = ua || "";
  const browser = /Edg\//.test(u) ? "Edge" : /OPR\/|Opera/.test(u) ? "Opera" : /Chrome\//.test(u)
    ? "Chrome" : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "Autre";
  const os = /Windows/.test(u) ? "Windows" : /Mac OS X|Macintosh/.test(u) ? "macOS" : /Android/.test(u)
    ? "Android" : /iPhone|iPad|iPod/.test(u) ? "iOS" : /Linux/.test(u) ? "Linux" : "Autre";
  const device_type = /iPad|Tablet/.test(u) ? "tablette" : /Mobile|iPhone|Android/.test(u) ? "mobile" : "ordinateur";
  return { browser, os, device_type };
}

export type SignatureEventInput = {
  ip?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  documentSha256?: string | null;
  actor?: string | null;
  metadata?: Record<string, unknown> | null;
};

// Écrit un événement d'audit (append-only) via service-role. Best-effort.
export async function logSignatureEvent(
  signatureRequestId: string,
  eventType: SignatureEventType,
  opts?: SignatureEventInput,
): Promise<void> {
  try {
    const admin = await supabaseServiceRole();
    const ua = opts?.userAgent ?? null;
    const parsed = ua ? parseUserAgent(ua) : null;
    await admin.from("signature_events").insert({
      signature_request_id: signatureRequestId,
      event_type: eventType,
      ip_address: opts?.ip ?? null,
      user_agent: ua,
      browser: parsed?.browser ?? null,
      os: parsed?.os ?? null,
      device_type: parsed?.device_type ?? null,
      session_id: opts?.sessionId ?? null,
      document_sha256: opts?.documentSha256 ?? null,
      actor: opts?.actor ?? "system",
      metadata: (opts?.metadata ?? null) as never,
    } as never);
  } catch (e) {
    console.error("logSignatureEvent failed:", e);
  }
}

export async function signedUrlFor(path: string | null, ttl = SIGNED_URL_TTL): Promise<string | null> {
  if (!path) return null;
  const admin = await supabaseServiceRole();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}

async function mergePdfs(base: Buffer, extra: Buffer): Promise<Buffer> {
  const merged = await PDFDocument.load(base);
  const add = await PDFDocument.load(extra);
  const pages = await merged.copyPages(add, add.getPageIndices());
  pages.forEach((p) => merged.addPage(p));
  return Buffer.from(await merged.save());
}

// ── Création d'une demande depuis la fiche devis (appel authentifié) ──────
export type CreatedSignature = {
  id: string; ref: string; token: string;
  recipientEmail: string; recipientName: string;
  docNum: string; entityName: string; amountTtc: number; expiresAt: string;
};

export async function createSignatureRequest(
  documentId: string,
): Promise<{ ok: true; data: CreatedSignature } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  // Lecture RLS-scoped : garantit que l'appelant a accès au devis.
  const detail = await getDocumentById(documentId);
  if (!detail) return { ok: false, error: "Devis introuvable ou accès refusé." };
  if (detail.doc.type !== "devis") return { ok: false, error: "Seul un devis peut être envoyé pour signature." };
  if (!detail.lead.email) return { ok: false, error: "Le client n'a pas d'adresse e-mail enregistrée." };

  // Fige le PDF original + empreinte SHA-256.
  const buffer = Buffer.from(await renderToBuffer(DocumentPdf({ detail })));
  const originalSha = sha256(buffer);

  const admin = await supabaseServiceRole();
  const id = crypto.randomUUID();
  const originalPath = `${detail.doc.id}/${id}/original.pdf`;
  const up = await admin.storage.from(BUCKET).upload(originalPath, buffer, { contentType: "application/pdf", upsert: false });
  if (up.error) return { ok: false, error: `Stockage du PDF : ${up.error.message}` };

  const { token, tokenHash } = generateSignatureToken();
  const now = new Date();
  const ref = `SIG-${now.getFullYear()}-${id.slice(0, 8).toUpperCase()}`;
  const expiresAt = new Date(now.getTime() + SIGNATURE_DEFAULT_EXPIRY_DAYS * 86400000).toISOString();

  const { error: insErr } = await admin.from("signature_requests").insert({
    id, ref,
    document_id: detail.doc.id,
    lead_id: detail.doc.leadId,
    company_id: detail.entity.id,
    recipient_name: detail.lead.client,
    recipient_email: detail.lead.email,
    recipient_phone: detail.lead.phone || null,
    token_hash: tokenHash,
    status: "envoye",
    original_sha256: originalSha,
    original_pdf_path: originalPath,
    consent_text: DEFAULT_CONSENT_TEXT,
    expires_at: expiresAt,
    created_by: user.id,
    sent_at: now.toISOString(),
  } as never);
  if (insErr) {
    await admin.storage.from(BUCKET).remove([originalPath]);
    return { ok: false, error: `Création : ${insErr.message}` };
  }

  await admin.from("documents").update({ signature_request_id: id } as never).eq("id", detail.doc.id);
  await logSignatureEvent(id, "SIGNATURE_REQUEST_CREATED", { actor: user.id, documentSha256: originalSha });

  return {
    ok: true,
    data: {
      id, ref, token,
      recipientEmail: detail.lead.email,
      recipientName: detail.lead.client,
      docNum: detail.doc.num,
      entityName: detail.entity.legalName,
      amountTtc: detail.doc.totalTtc,
      expiresAt,
    },
  };
}

// ── Vue publique (parcours signataire, via token) ────────────────────────
type SignatureRow = {
  id: string; ref: string | null; document_id: string; lead_id: string | null; company_id: string | null;
  status: SignatureStatus; expires_at: string | null;
  recipient_name: string | null; recipient_email: string; recipient_phone: string | null;
  consent_text: string | null; original_sha256: string | null; original_pdf_path: string | null;
};

export type PublicSignatureView = {
  id: string; ref: string; status: SignatureStatus; expiresAt: string | null;
  recipientName: string | null; recipientEmail: string; consentText: string;
  docNum: string; entityName: string; amountTtc: number; acompteAmount: number | null; soldeDu: number | null;
  originalUrl: string | null; documentId: string;
  expired: boolean; terminal: boolean;
};

export async function getSignatureRequestByToken(token: string): Promise<PublicSignatureView | null> {
  const admin = await supabaseServiceRole();
  const { data: sr } = await admin.from("signature_requests")
    .select("id, ref, document_id, lead_id, company_id, status, expires_at, recipient_name, recipient_email, recipient_phone, consent_text, original_sha256, original_pdf_path")
    .eq("token_hash", hashToken(token))
    .maybeSingle<SignatureRow>();
  if (!sr) return null;

  const [{ data: doc }, { data: ent }] = await Promise.all([
    admin.from("documents").select("num, total_ttc, acompte_amount, solde_du").eq("id", sr.document_id).maybeSingle<{ num: string; total_ttc: number; acompte_amount: number | null; solde_du: number | null }>(),
    sr.company_id
      ? admin.from("legal_entities").select("legal_name").eq("id", sr.company_id).maybeSingle<{ legal_name: string }>()
      : Promise.resolve({ data: null as { legal_name: string } | null }),
  ]);

  const expired = !!sr.expires_at && new Date(sr.expires_at) < new Date();
  const terminal = ["signe", "refuse", "annule", "expire"].includes(sr.status);
  return {
    id: sr.id,
    ref: sr.ref ?? sr.id,
    status: sr.status,
    expiresAt: sr.expires_at,
    recipientName: sr.recipient_name,
    recipientEmail: sr.recipient_email,
    consentText: sr.consent_text ?? DEFAULT_CONSENT_TEXT,
    docNum: doc?.num ?? "",
    entityName: ent?.legal_name ?? "",
    amountTtc: Number(doc?.total_ttc ?? 0),
    acompteAmount: doc?.acompte_amount ?? null,
    soldeDu: doc?.solde_du ?? null,
    originalUrl: await signedUrlFor(sr.original_pdf_path),
    documentId: sr.document_id,
    expired,
    terminal,
  };
}

// Marque l'ouverture du lien / la consultation (idempotent-ish).
export async function recordSignatureOpen(
  token: string,
  eventType: "SIGNATURE_LINK_OPENED" | "DOCUMENT_VIEWED",
  ev: SignatureEventInput,
): Promise<void> {
  const admin = await supabaseServiceRole();
  const { data: sr } = await admin.from("signature_requests")
    .select("id, status")
    .eq("token_hash", hashToken(token))
    .maybeSingle<{ id: string; status: SignatureStatus }>();
  if (!sr) return;
  const patch: Record<string, unknown> = {};
  if (eventType === "SIGNATURE_LINK_OPENED" && ["envoye", "distribue"].includes(sr.status)) {
    patch.opened_at = new Date().toISOString();
    patch.status = "consulte";
  }
  if (Object.keys(patch).length) await admin.from("signature_requests").update(patch as never).eq("id", sr.id);
  await logSignatureEvent(sr.id, eventType, { ...ev, actor: "client" });
}

// ── Finalisation de la signature (parcours public, validé par token) ─────
export type FinalizeInput = {
  signatureType: SignatureType;
  typedName?: string;
  signatureImage?: string | null; // data URL PNG (tracé)
  consent: boolean;
  ip: string | null;
  userAgent: string | null;
  sessionId: string | null;
};

export async function finalizeSignature(
  token: string,
  input: FinalizeInput,
): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const admin = await supabaseServiceRole();
  const { data: sr } = await admin.from("signature_requests")
    .select("id, ref, document_id, lead_id, company_id, status, expires_at, recipient_name, recipient_email, recipient_phone, original_sha256, original_pdf_path")
    .eq("token_hash", hashToken(token))
    .maybeSingle<SignatureRow>();
  if (!sr) return { ok: false, error: "Lien de signature invalide." };
  if (sr.status === "signe") return { ok: false, error: "Ce document a déjà été signé." };
  if (["annule", "refuse", "expire"].includes(sr.status)) return { ok: false, error: "Cette demande n'est plus valide." };
  if (sr.expires_at && new Date(sr.expires_at) < new Date()) {
    await admin.from("signature_requests").update({ status: "expire" } as never).eq("id", sr.id);
    return { ok: false, error: "Le lien de signature a expiré." };
  }
  if (!input.consent) return { ok: false, error: "Le consentement est obligatoire." };
  if (input.signatureType === "typed" && !input.typedName?.trim()) return { ok: false, error: "Indiquez votre nom pour signer." };
  if (input.signatureType === "drawn" && !input.signatureImage) return { ok: false, error: "Veuillez tracer votre signature." };

  // Intégrité : re-télécharge l'original figé et vérifie son empreinte.
  if (!sr.original_pdf_path) return { ok: false, error: "Document original introuvable." };
  const dl = await admin.storage.from(BUCKET).download(sr.original_pdf_path);
  if (!dl.data) return { ok: false, error: "Document original introuvable." };
  const originalBuf = Buffer.from(await dl.data.arrayBuffer());
  if (sr.original_sha256 && sha256(originalBuf) !== sr.original_sha256) {
    return { ok: false, error: "Intégrité du document compromise — signature refusée." };
  }

  const now = new Date();
  const ev: SignatureEventInput = { ip: input.ip, userAgent: input.userAgent, sessionId: input.sessionId, actor: "client" };
  await logSignatureEvent(sr.id, "CONSENT_ACCEPTED", ev);
  await logSignatureEvent(sr.id, "SIGNATURE_STARTED", ev);

  const dateLabel = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(now);
  const timeLabel = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Paris" }).format(now);

  const [{ data: docRow }, { data: entRow }] = await Promise.all([
    admin.from("documents").select("num, total_ttc").eq("id", sr.document_id).maybeSingle<{ num: string; total_ttc: number }>(),
    sr.company_id
      ? admin.from("legal_entities").select("legal_name").eq("id", sr.company_id).maybeSingle<{ legal_name: string }>()
      : Promise.resolve({ data: null as { legal_name: string } | null }),
  ]);
  const docNum = docRow?.num ?? "";
  const entityName = entRow?.legal_name ?? "";

  // 1) Attestation « BON POUR ACCORD » → fusion après l'original → PDF signé.
  const attestationBuf = Buffer.from(await renderToBuffer(SignatureAttestationPdf({
    data: {
      ref: sr.ref ?? sr.id, docNum, entityName,
      signerName: sr.recipient_name ?? "", signerEmail: sr.recipient_email,
      dateLabel, timeLabel,
      signatureType: input.signatureType, typedName: input.typedName,
      signatureImage: input.signatureImage ?? null,
      originalSha256: sr.original_sha256 ?? "", requestId: sr.id,
    },
  })));
  const signedBuf = await mergePdfs(originalBuf, attestationBuf);
  const signedSha = sha256(signedBuf);
  const signedPath = `${sr.document_id}/${sr.id}/signe.pdf`;
  await admin.storage.from(BUCKET).upload(signedPath, signedBuf, { contentType: "application/pdf", upsert: true });
  await logSignatureEvent(sr.id, "DOCUMENT_SIGNED", { ...ev, documentSha256: signedSha });

  // 2) Marque la demande comme signée (preuve technique côté serveur).
  await admin.from("signature_requests").update({
    status: "signe",
    signature_type: input.signatureType,
    signer_typed_name: input.typedName ?? null,
    consent_accepted_at: now.toISOString(),
    signer_ip: input.ip,
    signer_user_agent: input.userAgent,
    signed_sha256: signedSha,
    signed_pdf_path: signedPath,
    signed_at: now.toISOString(),
    completed_at: now.toISOString(),
  } as never).eq("id", sr.id);

  // 3) Certificat de preuve (avec chronologie).
  const { data: eventsRows } = await admin.from("signature_events")
    .select("event_type, occurred_at")
    .eq("signature_request_id", sr.id)
    .order("occurred_at", { ascending: true })
    .returns<{ event_type: string; occurred_at: string }[]>();
  const evFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Paris" });
  const events = (eventsRows ?? []).map((e) => ({
    at: evFmt.format(new Date(e.occurred_at)),
    label: SIGNATURE_EVENT_LABEL[e.event_type as SignatureEventType] ?? e.event_type,
  }));
  const parsed = parseUserAgent(input.userAgent ?? "");
  const certBuf = Buffer.from(await renderToBuffer(SignatureCertificatePdf({
    data: {
      ref: sr.ref ?? sr.id, docNum, fileName: `${docNum}.pdf`, documentId: sr.document_id,
      originalSha256: sr.original_sha256 ?? "", signedSha256: signedSha,
      signerName: sr.recipient_name ?? "", signerEmail: sr.recipient_email, signerPhone: sr.recipient_phone,
      dateLabel, timeLabel, timezone: "Europe/Paris",
      signatureType: input.signatureType === "drawn" ? "Tracée au doigt/souris" : "Typographique",
      authMethod: "Lien sécurisé envoyé par e-mail",
      ip: input.ip ?? "—", userAgent: input.userAgent ?? "—", browser: parsed.browser,
      device: parsed.device_type, sessionId: input.sessionId ?? "—",
      events,
    },
  })));
  const certPath = `${sr.document_id}/${sr.id}/certificat.pdf`;
  await admin.storage.from(BUCKET).upload(certPath, certBuf, { contentType: "application/pdf", upsert: true });
  await admin.from("signature_requests").update({ certificate_pdf_path: certPath } as never).eq("id", sr.id);
  await logSignatureEvent(sr.id, "DOCUMENT_FINALIZED", { ...ev, documentSha256: signedSha });

  // 4) Retour CRM : cascade existante (statut signe → dossier → FA acompte).
  await markDocumentSigned(sr.document_id, "logiciel", true);

  // 5) Notifications internes + e-mail au client (best-effort).
  try {
    const { data: lead } = await admin.from("leads")
      .select("owner_id")
      .eq("id", sr.lead_id ?? "")
      .maybeSingle<{ owner_id: string | null }>();
    const notifBody = {
      kind: "quote.signed",
      entityType: "document",
      entityId: sr.document_id,
      title: `🎉 Devis signé par ${sr.recipient_name ?? "le client"}`,
      body: `${docNum} · ${formatEUR(Number(docRow?.total_ttc ?? 0))}`,
      href: `/signatures/${sr.id}`,
    };
    if (lead?.owner_id) await notify({ userId: lead.owner_id, ...notifBody });
    await notifyRole("planification", notifBody, lead?.owner_id ?? undefined);

    await sendBrevoEmail({
      to: sr.recipient_email,
      toName: sr.recipient_name ?? undefined,
      subject: "Votre devis signé",
      htmlContent:
        `Bonjour ${sr.recipient_name ?? ""},<br><br>` +
        `Votre signature a bien été enregistrée.<br>` +
        `Vous trouverez ci-joint votre devis signé.<br><br>` +
        `Référence de signature : <strong>${sr.ref ?? sr.id}</strong><br><br>` +
        `Merci pour votre confiance.<br><br>Cordialement,<br>${entityName}`,
      senderEmail: PLANIF_SENDER.email,
      senderName: entityName || PLANIF_SENDER.name,
      attachment: { name: `${docNum}-signe.pdf`, bytes: signedBuf },
    });
  } catch (e) {
    console.error("post-signature notify/email failed:", e);
  }

  return { ok: true, ref: sr.ref ?? sr.id };
}

// ── Annulation (commercial / admin) ──────────────────────────────────────
export async function cancelSignatureRequestById(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("signature_requests")
    .update({ status: "annule", cancelled_at: new Date().toISOString() } as never)
    .eq("id", id)
    .in("status", ["brouillon", "pret", "envoye", "distribue", "consulte", "en_attente_signature"]);
  if (error) return { ok: false, error: error.message };
  await logSignatureEvent(id, "SIGNATURE_REQUEST_CANCELLED", { actor: "system" });
  return { ok: true };
}

// ── Module CRM : liste + fiche ───────────────────────────────────────────
export type SignatureListRow = {
  id: string; ref: string; status: SignatureStatus;
  clientName: string; entityName: string; docNum: string;
  ownerName: string | null; amountTtc: number;
  sentAt: string | null; openedAt: string | null; signedAt: string | null; expiresAt: string | null;
};

type ListJoined = {
  id: string; ref: string | null; status: SignatureStatus; recipient_name: string | null;
  sent_at: string | null; opened_at: string | null; signed_at: string | null; expires_at: string | null;
  document: { num: string; total_ttc: number } | null;
  entity: { legal_name: string } | null;
  lead: { owner: { first_name: string | null; last_name: string | null } | null } | null;
};

export async function getSignatureRequests(): Promise<SignatureListRow[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("signature_requests")
    .select(
      "id, ref, status, recipient_name, sent_at, opened_at, signed_at, expires_at, " +
      "document:documents(num, total_ttc), entity:legal_entities(legal_name), " +
      "lead:leads(owner:users!leads_owner_id_fkey(first_name, last_name))",
    )
    .order("created_at", { ascending: false })
    .returns<ListJoined[]>();
  return (data ?? []).map((r) => ({
    id: r.id,
    ref: r.ref ?? r.id,
    status: r.status,
    clientName: r.recipient_name ?? "—",
    entityName: r.entity?.legal_name ?? "—",
    docNum: r.document?.num ?? "—",
    ownerName: r.lead?.owner ? `${r.lead.owner.first_name ?? ""} ${r.lead.owner.last_name ?? ""}`.trim() || null : null,
    amountTtc: Number(r.document?.total_ttc ?? 0),
    sentAt: r.sent_at,
    openedAt: r.opened_at,
    signedAt: r.signed_at,
    expiresAt: r.expires_at,
  }));
}

export type SignatureDetail = {
  row: SignatureListRow & {
    recipientEmail: string; recipientPhone: string | null; documentId: string;
    originalSha256: string | null; signedSha256: string | null;
    signerIp: string | null; signatureType: string | null;
  };
  events: { type: SignatureEventType | string; label: string; at: string; ip: string | null; device: string | null }[];
  originalUrl: string | null;
  signedUrl: string | null;
  certificateUrl: string | null;
};

export async function getSignatureRequestById(id: string): Promise<SignatureDetail | null> {
  const supabase = await supabaseServer();
  const { data: r } = await supabase.from("signature_requests")
    .select(
      "id, ref, status, recipient_name, recipient_email, recipient_phone, document_id, " +
      "sent_at, opened_at, signed_at, expires_at, original_sha256, signed_sha256, signer_ip, signature_type, " +
      "original_pdf_path, signed_pdf_path, certificate_pdf_path, " +
      "document:documents(num, total_ttc), entity:legal_entities(legal_name), " +
      "lead:leads(owner:users!leads_owner_id_fkey(first_name, last_name))",
    )
    .eq("id", id)
    .maybeSingle<ListJoined & {
      recipient_email: string; recipient_phone: string | null; document_id: string;
      original_sha256: string | null; signed_sha256: string | null; signer_ip: string | null; signature_type: string | null;
      original_pdf_path: string | null; signed_pdf_path: string | null; certificate_pdf_path: string | null;
    }>();
  if (!r) return null;

  const { data: evs } = await supabase.from("signature_events")
    .select("event_type, occurred_at, ip_address, device_type")
    .eq("signature_request_id", id)
    .order("occurred_at", { ascending: true })
    .returns<{ event_type: string; occurred_at: string; ip_address: string | null; device_type: string | null }[]>();

  const evFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Paris" });
  return {
    row: {
      id: r.id, ref: r.ref ?? r.id, status: r.status,
      clientName: r.recipient_name ?? "—", entityName: r.entity?.legal_name ?? "—", docNum: r.document?.num ?? "—",
      ownerName: r.lead?.owner ? `${r.lead.owner.first_name ?? ""} ${r.lead.owner.last_name ?? ""}`.trim() || null : null,
      amountTtc: Number(r.document?.total_ttc ?? 0),
      sentAt: r.sent_at, openedAt: r.opened_at, signedAt: r.signed_at, expiresAt: r.expires_at,
      recipientEmail: r.recipient_email, recipientPhone: r.recipient_phone, documentId: r.document_id,
      originalSha256: r.original_sha256, signedSha256: r.signed_sha256, signerIp: r.signer_ip, signatureType: r.signature_type,
    },
    events: (evs ?? []).map((e) => ({
      type: e.event_type,
      label: SIGNATURE_EVENT_LABEL[e.event_type as SignatureEventType] ?? e.event_type,
      at: evFmt.format(new Date(e.occurred_at)),
      ip: e.ip_address,
      device: e.device_type,
    })),
    originalUrl: await signedUrlFor(r.original_pdf_path),
    signedUrl: await signedUrlFor(r.signed_pdf_path),
    certificateUrl: await signedUrlFor(r.certificate_pdf_path),
  };
}
