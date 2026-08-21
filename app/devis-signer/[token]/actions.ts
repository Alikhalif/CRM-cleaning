"use server";

import { headers } from "next/headers";
import { verifySignToken } from "@/lib/devis/tracking";
import { recordDevisSignature } from "@/lib/devis/sign";

export type SignResult =
  | { ok: true; numero: string }
  | { ok: false; error: string };

// Enregistre la signature du client depuis la page publique. Le token signé
// (HMAC) fait office d'authentification — aucune session requise.
export async function submitDevisSignature(
  token: string,
  input: { nom: string; imageDataUrl?: string },
): Promise<SignResult> {
  const leadId = verifySignToken(token);
  if (!leadId) return { ok: false, error: "Lien de signature invalide." };
  if (!input.nom || !input.nom.trim()) {
    return { ok: false, error: "Merci d'indiquer votre nom." };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent") || null;

  return recordDevisSignature(leadId, {
    nom: input.nom.trim(),
    imageDataUrl: input.imageDataUrl,
    ip,
    ua,
  });
}
