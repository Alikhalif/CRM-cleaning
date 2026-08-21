import "server-only";
import { supabaseServiceRole } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/database.types";
import { genererDevisBuffer } from "./render";
import { todayFr, type Devis } from "./types";
import { markLeadDevisSigne } from "./status";
import { signedDevisUrl } from "./archive";
import { sendBrevoEmail } from "@/lib/brevo";
import { senderForSector } from "./sender";

const BUCKET = "devis-optimivv";

type Row = { numero: string; data: unknown; pdf_path: string };

async function latestDevisRow(leadId: string): Promise<Row | null> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("devis_optimivv")
    .select("numero, data, pdf_path")
    .eq("lead_id", leadId)
    .eq("doc_type", "devis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Row>();
  return data ?? null;
}

// Méta du dernier devis OPTIMIVV d'un lead (pour afficher le bouton « Voir le
// devis signé » sur la fiche). `signed` = le pdf_path pointe sur la version signée.
export async function getLeadOptimivvDevisMeta(
  leadId: string,
): Promise<{ numero: string; signed: boolean } | null> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("devis_optimivv")
    .select("numero, pdf_path")
    .eq("lead_id", leadId)
    .eq("doc_type", "devis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ numero: string; pdf_path: string }>();
  if (!data) return null;
  return { numero: data.numero, signed: (data.pdf_path || "").includes("/signed-") };
}

export type SignContext = {
  numero: string;
  clientNom: string;
  pdfUrl: string | null;
  alreadySigned: boolean;
};

// Contexte pour la page publique de signature : le devis à signer + son PDF
// (URL signée temporaire) + un drapeau « déjà signé ».
export async function getDevisForSigning(
  leadId: string,
): Promise<SignContext | null> {
  const row = await latestDevisRow(leadId);
  if (!row) return null;
  const devis = row.data as Devis;

  const sb = await supabaseServiceRole();
  const { data: lead } = await sb
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .maybeSingle<{ status: string }>();
  const alreadySigned = !!lead && ["signe", "encaisse"].includes(lead.status);

  return {
    numero: row.numero,
    clientNom: devis?.client?.nom ?? "",
    pdfUrl: await signedDevisUrl(row.pdf_path, 3600),
    alreadySigned,
  };
}

// Enregistre la signature : re-génère le PDF avec la signature dans la case
// « Bon pour accord », archive la version signée, puis fait avancer le lead à
// « Signé ». Idempotent (markLeadDevisSigne ne signe pas deux fois).
export async function recordDevisSignature(
  leadId: string,
  input: { nom: string; imageDataUrl?: string; ip?: string | null; ua?: string | null },
): Promise<{ ok: true; numero: string } | { ok: false; error: string }> {
  const row = await latestDevisRow(leadId);
  if (!row) return { ok: false, error: "Devis introuvable." };
  const devis = row.data as Devis;

  const signedDevis: Devis = {
    ...devis,
    signature: { nom: input.nom, date: todayFr(), imageDataUrl: input.imageDataUrl },
  };
  const pdf = await genererDevisBuffer(signedDevis);

  const sb = await supabaseServiceRole();
  const year = new Date().getFullYear();
  const signedPath = `${year}/signed-devis-${row.numero}.pdf`;
  const up = await sb.storage
    .from(BUCKET)
    .upload(signedPath, pdf, { contentType: "application/pdf", upsert: true });
  if (up.error) {
    return { ok: false, error: "Archivage du PDF signé échoué : " + up.error.message };
  }

  const dataWithMeta = {
    ...signedDevis,
    _signature_meta: {
      signedAt: new Date().toISOString(),
      ip: input.ip ?? null,
      ua: input.ua ?? null,
    },
  };
  await sb
    .from("devis_optimivv")
    .update({ data: dataWithMeta as unknown as Json, pdf_path: signedPath } as never)
    .eq("numero", row.numero);

  const sub = (devis?.acompte_pct ?? 0) > 0 ? "avec" : "sans";
  const r = await markLeadDevisSigne(leadId, sub);
  if (r === "error") return { ok: false, error: "Mise à jour du statut échouée." };

  // Envoi du PDF signé au client (+ copie commercial en BCC) — best-effort.
  const clientEmail = devis?.client?.email;
  if (process.env.BREVO_API_KEY && clientEmail) {
    try {
      const { data: lead } = await sb
        .from("leads")
        .select("owner:users!leads_owner_id_fkey(email), activity:activities(slug)")
        .eq("id", leadId)
        .maybeSingle<{
          owner: { email: string | null } | null;
          activity: { slug: string } | null;
        }>();
      const ownerEmail = lead?.owner?.email ?? undefined;
      const sender = senderForSector(lead?.activity?.slug ?? null);
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5">
        Bonjour ${input.nom},<br /><br />
        Merci — votre devis <strong>${row.numero}</strong> a bien été signé « Bon pour accord ».<br />
        Vous trouverez l'exemplaire signé en pièce jointe.<br /><br />
        Bien cordialement,<br />OPTIMIVV Déménagement
      </div>`;
      await sendBrevoEmail({
        to: clientEmail,
        toName: input.nom,
        subject: `Votre devis signé n° ${row.numero} — OPTIMIVV Déménagement`,
        htmlContent: html,
        senderEmail: sender.email,
        senderName: sender.name,
        attachment: { name: `devis-signe-${row.numero}.pdf`, bytes: pdf },
        bcc: ownerEmail,
      });
    } catch {
      /* best-effort — la signature reste enregistrée même si l'e-mail échoue */
    }
  }

  return { ok: true, numero: row.numero };
}
