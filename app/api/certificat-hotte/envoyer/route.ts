import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { genererCertHotteBuffer } from "@/lib/cert-hotte/render";
import { archiveCertHotte, downloadCertHottePdf } from "@/lib/cert-hotte/archive";
import { allocateCertHotteNumero } from "@/lib/cert-hotte/numero";
import { envoyerCertHotteEmail } from "@/lib/cert-hotte/send";
import { buildCert, type CertHotte, type CertHotteInput } from "@/lib/cert-hotte/types";

export const runtime = "nodejs";

type Body = {
  data?: CertHotteInput;
  dossierId?: string | null;
  leadId?: string | null;
  joinFacture?: boolean;
};

// POST /api/certificat-hotte/envoyer — envoie le certificat au client.
// N'ALLOUE PAS un nouveau numéro si un certificat est déjà archivé pour le
// dossier (cas normal : « Valider et générer » d'abord, puis « Envoyer ») — il
// renvoie ce certificat-là. À défaut seulement, il en génère un. Option de
// joindre la facture.
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const svc = await supabaseServiceRole();

  // 1. Réutiliser le dernier certificat archivé du dossier (pas de nouveau n°).
  let cert: CertHotte | null = null;
  let pdf: Buffer | null = null;
  if (body.dossierId) {
    const { data: existing } = await svc
      .from("cert_hotte")
      .select("numero, pdf_path, data")
      .eq("dossier_id", body.dossierId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ numero: string; pdf_path: string; data: CertHotte }>();
    if (existing) {
      cert = existing.data;
      pdf = await downloadCertHottePdf(existing.pdf_path);
    }
  }

  // 2. Sinon, générer + archiver à la volée.
  if (!cert || !pdf) {
    const input = body.data;
    if (!input || !input.client?.etablissement) {
      return NextResponse.json({ ok: false, error: "etablissement_required" }, { status: 400 });
    }
    const numero = await allocateCertHotteNumero();
    cert = buildCert(input, numero);
    pdf = await genererCertHotteBuffer(cert);
    await archiveCertHotte({
      cert,
      pdf,
      leadId: body.leadId ?? null,
      dossierId: body.dossierId ?? null,
      createdBy: user.id,
      sentTo: cert.client.email,
    });
  }

  if (!cert.client?.email) {
    return NextResponse.json({ ok: false, error: "client_email_required" }, { status: 400 });
  }

  // 3. Facture (option) + BCC propriétaire du lead.
  let facture: { num: string; pdf: Buffer } | null = null;
  let ownerEmail: string | null = null;
  if (body.leadId) {
    if (body.joinFacture) {
      const { data: fac } = await svc
        .from("devis_optimivv")
        .select("numero, pdf_path")
        .eq("lead_id", body.leadId)
        .eq("doc_type", "facture")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ numero: string; pdf_path: string }>();
      if (fac?.pdf_path) {
        const facPdf = await downloadCertHottePdf(fac.pdf_path);
        if (facPdf) facture = { num: fac.numero, pdf: facPdf };
      }
    }
    const { data: lead } = await svc
      .from("leads")
      .select("owner:users!leads_owner_id_fkey(email)")
      .eq("id", body.leadId)
      .maybeSingle<{ owner: { email: string | null } | null }>();
    ownerEmail = lead?.owner?.email ?? null;
  }

  let envoyeA: string;
  try {
    envoyeA = await envoyerCertHotteEmail(cert, pdf, { facture, ownerEmail });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "email_failed", detail: (e as Error).message, numero: cert.numero },
      { status: 502 },
    );
  }

  // Marque l'archive comme envoyée.
  await svc
    .from("cert_hotte")
    .update({ sent_to: envoyeA, sent_at: new Date().toISOString() })
    .eq("numero", cert.numero);

  return NextResponse.json({
    ok: true,
    numero: cert.numero,
    envoye_a: envoyeA,
    facture_jointe: Boolean(facture),
  });
}
