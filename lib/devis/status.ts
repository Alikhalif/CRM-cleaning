import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";

// Fait avancer un lead « Devis envoyé » → « Devis ouvert » (stade 3).
// MONOTONE : n'agit que si le lead est encore `envoye` — donc naturellement
// idempotent (un 2e appel après passage à `ouvert` est un no-op) et sans recul.
// Service-role : appelé depuis des contextes sessionless (pixel de suivi,
// webhook Brevo).
export async function markLeadDevisOuvert(
  leadId: string,
  via: string,
): Promise<"advanced" | "noop" | "error"> {
  const sb = await supabaseServiceRole();
  const { data: lead } = await sb
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .maybeSingle<{ status: string }>();
  if (!lead || lead.status !== "envoye") return "noop";

  const { error } = await sb
    .from("leads")
    .update({
      status: "ouvert",
      sub_signature: null,
      last_action_label: "Devis ouvert",
      last_action_at: new Date().toISOString(),
    } as never)
    .eq("id", leadId);
  if (error) return "error";

  await auditLog({
    action: "lead.status.change",
    entityType: "lead",
    entityId: leadId,
    after: { status: "ouvert", via },
  });
  return "advanced";
}
