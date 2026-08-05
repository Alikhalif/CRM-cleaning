"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { sendBrevoEmail, PLANIF_SENDER } from "@/lib/brevo";
import { auditLog } from "@/lib/audit";

export type Result = { ok: true } | { ok: false; error: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Relance d'un intervenant en un clic : renvoie le mail « Relance de chiffrage »
// et incrémente le compteur de relances.
export async function relanceConsultation(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: c } = await supabase
    .from("intervenant_consultations")
    .select("intervenant_email, lead_id, relances")
    .eq("id", id)
    .maybeSingle<{ intervenant_email: string; lead_id: string; relances: number }>();
  if (!c) return { ok: false, error: "Consultation introuvable." };

  const { data: tpl } = await supabase
    .from("message_templates")
    .select("subject, body")
    .eq("name", "Intervenant — Relance de chiffrage")
    .maybeSingle<{ subject: string | null; body: string }>();

  const subject = tpl?.subject ?? "Relance — demande de chiffrage";
  const body = tpl?.body ?? "Bonjour,\n\nJe me permets de revenir vers vous concernant notre demande de chiffrage. Auriez-vous eu l'occasion de l'étudier ?\n\nBien professionnellement,\nLa planificatrice";
  const res = await sendBrevoEmail({
    to: c.intervenant_email,
    subject,
    htmlContent: esc(body).replace(/\n/g, "<br>"),
    senderEmail: PLANIF_SENDER.email,
    senderName: PLANIF_SENDER.name,
  });
  if (!res.ok) return { ok: false, error: `Envoi : ${res.error}` };

  await supabase
    .from("intervenant_consultations")
    .update({ relances: (c.relances ?? 0) + 1, last_relance_at: new Date().toISOString() } as never)
    .eq("id", id);

  revalidatePath("/chiffrage");
  await auditLog({ action: "consultation.relance", entityType: "lead", entityId: c.lead_id, after: { consultationId: id } });
  return { ok: true };
}

// Attribue la mission à l'intervenant retenu : statut « retenue » + date, et
// assigne l'intervenant au dossier du lead.
export async function attributeConsultation(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: c } = await supabase
    .from("intervenant_consultations")
    .select("lead_id, intervenant_id")
    .eq("id", id)
    .maybeSingle<{ lead_id: string; intervenant_id: string | null }>();
  if (!c) return { ok: false, error: "Consultation introuvable." };

  const { error } = await supabase
    .from("intervenant_consultations")
    .update({ status: "retenue", attributed_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Assigne l'intervenant au dossier (si connu).
  if (c.intervenant_id) {
    await supabase.from("dossiers").update({ technician_id: c.intervenant_id } as never).eq("lead_id", c.lead_id);
  }

  revalidatePath("/chiffrage");
  revalidatePath("/planification");
  await auditLog({ action: "consultation.attribute", entityType: "lead", entityId: c.lead_id, after: { consultationId: id } });
  return { ok: true };
}

// Clôture / change le statut d'une consultation (refusée, expirée…).
export async function closeConsultation(id: string, status: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("intervenant_consultations")
    .update({ status } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chiffrage");
  return { ok: true };
}
