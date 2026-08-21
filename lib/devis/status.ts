import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { notify, notifyRole } from "@/lib/notifications";

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

// Signature du devis OPTIMIVV par le client → lead → « Signé » (stade 4).
// MONOTONE : avance depuis lead/envoye/ouvert ; no-op si déjà signe/encaisse/perdu.
// Notifie le commercial + la planification.
export async function markLeadDevisSigne(
  leadId: string,
  subSignature: "avec" | "sans",
): Promise<"advanced" | "noop" | "error"> {
  const sb = await supabaseServiceRole();
  const { data: lead } = await sb
    .from("leads")
    .select("status, owner_id, client_first_name, client_last_name, client_company")
    .eq("id", leadId)
    .maybeSingle<{
      status: string;
      owner_id: string | null;
      client_first_name: string | null;
      client_last_name: string | null;
      client_company: string | null;
    }>();
  if (!lead) return "noop";
  if (["signe", "encaisse", "perdu"].includes(lead.status)) return "noop";

  const { error } = await sb
    .from("leads")
    .update({
      status: "signe",
      sub_signature: subSignature,
      last_action_label: "Devis signé",
      last_action_at: new Date().toISOString(),
    } as never)
    .eq("id", leadId);
  if (error) return "error";

  await auditLog({
    action: "lead.status.change",
    entityType: "lead",
    entityId: leadId,
    after: { status: "signe", subSignature, via: "devis_optimivv_sign" },
  });

  const who =
    [lead.client_first_name, lead.client_last_name].filter(Boolean).join(" ") ||
    lead.client_company ||
    "le client";
  const notifBody = {
    kind: "quote.signed",
    entityType: "lead",
    entityId: leadId,
    title: `🎉 Devis signé par ${who}`,
    body: "Devis OPTIMIVV signé en ligne (Bon pour accord).",
    href: `/leads/${leadId}`,
  };
  if (lead.owner_id) await notify({ userId: lead.owner_id, ...notifBody });
  await notifyRole("planification", notifBody, lead.owner_id ?? undefined);

  return "advanced";
}
