"use server";

import { revalidatePath } from "next/cache";
import { baseUrlPublique, verifierLien } from "@/lib/urls/base-publique-server";
import {
  createSignatureRequest,
  cancelSignatureRequestById,
  logSignatureEvent,
} from "@/lib/signature-server";
import { sendBrevoEmail, PLANIF_SENDER } from "@/lib/brevo";
import { auditLog } from "@/lib/audit";
import { formatEUR } from "@/lib/leads";

export type Result = { ok: true } | { ok: false; error: string };

// L'URL de base vient désormais de `lib/urls/base-publique`, qui valide
// l'en-tête `host` contre une liste blanche de domaines. L'ancienne version
// l'acceptait sans contrôle : un en-tête est fourni par l'appelant, et un
// lien public construit sur une donnée non vérifiée peut pointer n'importe où.

// « Envoyer pour signature » depuis la fiche devis : crée la demande, fige le
// PDF, puis envoie au client le lien /sign/{token}.
export async function sendForSignature(documentId: string): Promise<Result> {
  // L'URL est résolue AVANT de créer la demande : si la configuration ne
  // permet pas de produire un lien sûr, rien n'est créé. L'ordre inverse
  // laissait une demande de signature orpheline, sans e-mail.
  const base = await baseUrlPublique();
  if (!base.ok) {
    return {
      ok: false,
      error: `Lien de signature impossible à produire : ${base.raison}`,
    };
  }

  const created = await createSignatureRequest(documentId);
  if (!created.ok) return created;
  const { id, token, recipientEmail, recipientName, docNum, entityName, amountTtc } = created.data;

  const link = `${base.base}/sign/${token}`;

  // Dernier contrôle avant que le lien quitte le CRM.
  const lienOk = verifierLien(link);
  if (!lienOk.ok) {
    return { ok: false, error: `Lien de signature refusé : ${lienOk.raison}` };
  }
  const html =
    `Bonjour ${recipientName ?? ""},<br><br>` +
    `Vous avez reçu le devis <strong>${docNum}</strong> (${formatEUR(amountTtc)}) à signer.<br><br>` +
    `Merci de cliquer sur le lien sécurisé ci-dessous pour le consulter et le signer en ligne :<br><br>` +
    `<a href="${link}" style="display:inline-block;padding:12px 22px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Consulter et signer le devis</a><br><br>` +
    `Ou copiez ce lien : ${link}<br><br>` +
    `Ce lien est personnel et valable 30 jours.<br><br>Cordialement,<br>${entityName}`;

  const res = await sendBrevoEmail({
    to: recipientEmail,
    toName: recipientName ?? undefined,
    subject: `Signature de votre devis ${docNum}`,
    htmlContent: html,
    senderEmail: PLANIF_SENDER.email,
    senderName: entityName || PLANIF_SENDER.name,
  });
  if (!res.ok) {
    return { ok: false, error: `Demande créée, mais l'e-mail n'a pas pu partir : ${res.error}` };
  }

  await logSignatureEvent(id, "EMAIL_SENT", { actor: "system", metadata: { to: recipientEmail } });
  await auditLog({ action: "document.signature.sent", entityType: "document", entityId: documentId, after: { signatureRequestId: id, docNum } });
  revalidatePath(`/devis/${documentId}`);
  revalidatePath("/signatures");
  return { ok: true };
}

// Renvoyer le lien = régénère une nouvelle demande (l'ancien lien est révoqué,
// on ne stocke jamais le token en clair pour le rejouer).
export async function resendSignature(documentId: string): Promise<Result> {
  return sendForSignature(documentId);
}

export async function cancelSignature(id: string): Promise<Result> {
  const r = await cancelSignatureRequestById(id);
  if (!r.ok) return r;
  await auditLog({ action: "document.signature.cancelled", entityType: "document", entityId: id });
  revalidatePath("/signatures");
  revalidatePath(`/signatures/${id}`);
  return { ok: true };
}
