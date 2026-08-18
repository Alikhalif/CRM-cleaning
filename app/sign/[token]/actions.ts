"use server";

import { headers } from "next/headers";
import { recordSignatureOpen, finalizeSignature } from "@/lib/signature-server";
import type { SignatureType } from "@/lib/signature-shared";

async function clientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent") || null;
  return { ip, userAgent };
}

// Consultation du document (§6 DOCUMENT_VIEWED) — IP/UA capturés CÔTÉ SERVEUR.
export async function recordDocumentView(token: string, sessionId: string): Promise<void> {
  const { ip, userAgent } = await clientMeta();
  await recordSignatureOpen(token, "DOCUMENT_VIEWED", { ip, userAgent, sessionId });
}

export async function submitSignature(
  token: string,
  input: {
    signatureType: SignatureType;
    typedName?: string;
    signatureImage?: string | null;
    consent: boolean;
    sessionId: string;
  },
): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const { ip, userAgent } = await clientMeta();
  return finalizeSignature(token, {
    signatureType: input.signatureType,
    typedName: input.typedName,
    signatureImage: input.signatureImage,
    consent: input.consent,
    sessionId: input.sessionId,
    ip,
    userAgent,
  });
}
