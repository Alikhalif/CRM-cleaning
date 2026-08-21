import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { genererDevisBuffer } from "@/lib/devis/render";
import { buildDevis, type DevisInput, type DocType } from "@/lib/devis/types";
import { allocateNumero } from "@/lib/devis/numero";
import { archiveDevis } from "@/lib/devis/archive";
import { envoyerDevisEmail } from "@/lib/devis/email";
import { markDevisSentToClient } from "@/app/(app)/pipeline/actions";
import { signOpenToken, signSignToken } from "@/lib/devis/tracking";
import { senderForSector, domainForSector, signatureBannerFile } from "@/lib/devis/sender";
import { headers } from "next/headers";

async function baseUrl(): Promise<string> {
  const env = process.env.SIGNATURE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const runtime = "nodejs";

type Body = {
  data?: DevisInput;
  affaire?: string | null;
  docType?: DocType;
  // Objet + corps du mail (modèle de relance interpolé côté client). Facultatifs :
  // à défaut, envoyerDevisEmail utilise son corps standard.
  sujet?: string;
  corps?: string;
};

// POST /api/devis/envoyer — génère un numéro, archive le PDF exact, puis
// l'envoie au client par e-mail. Renvoie du JSON. Un devis part chez un vrai
// client : la confirmation (relecture du destinataire) est faite côté UI.
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

  const input = body.data;
  if (!input || !input.client || !input.client.nom) {
    return NextResponse.json(
      { ok: false, error: "client_nom_required" },
      { status: 400 },
    );
  }
  if (!input.client.email) {
    return NextResponse.json(
      { ok: false, error: "client_email_required" },
      { status: 400 },
    );
  }

  const docType: DocType =
    body.docType === "facture" || input.docType === "facture" ? "facture" : "devis";
  const numero = await allocateNumero(docType);
  const devis = buildDevis({ ...input, docType }, numero);
  const pdf = await genererDevisBuffer(devis);

  const sujet = typeof body.sujet === "string" && body.sujet.trim() ? body.sujet.trim() : undefined;
  const corps = typeof body.corps === "string" && body.corps.trim() ? body.corps : undefined;

  // Pixel de suivi d'ouverture (méthode gratuite, sans Brevo Pro) : seulement
  // pour un DEVIS lié à une affaire → à l'ouverture de l'e-mail, le lead passe
  // « envoyé » → « ouvert ».
  // Secteur du lead → pilote le domaine des liens (devis) ET l'expéditeur
  // (devis + facture).
  let sector: string | null = null;
  if (body.affaire) {
    const { data: leadRow } = await supabase
      .from("leads")
      .select("activity:activities(slug)")
      .eq("id", body.affaire)
      .maybeSingle<{ activity: { slug: string } | null }>();
    sector = leadRow?.activity?.slug ?? null;
  }

  // Base des URL client selon le secteur (liens + bannière), calculée une fois.
  const sectorBase = domainForSector(sector) ?? (await baseUrl());

  let trackPixelUrl: string | undefined;
  let signUrl: string | undefined;
  if (docType === "devis" && body.affaire) {
    trackPixelUrl = `${sectorBase}/api/devis/track/${signOpenToken(body.affaire)}.gif`;
    // Lien de signature en ligne → à la signature, le lead passe à « Signé ».
    signUrl = `${sectorBase}/devis-signer/${signSignToken(body.affaire)}`;
  }

  // Bannière de signature e-mail selon le secteur (déménagement / nettoyage).
  const sigFile = signatureBannerFile(sector);
  const signatureImgUrl = sigFile ? `${sectorBase}/email-signatures/${sigFile}` : undefined;

  const sender = senderForSector(sector);

  let envoyeA: string;
  try {
    envoyeA = await envoyerDevisEmail(devis, pdf, {
      sujet,
      corps,
      trackPixelUrl,
      signUrl,
      senderEmail: sender.email,
      senderName: sender.name,
      signatureImgUrl,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "email_failed", detail: (e as Error).message, numero },
      { status: 502 },
    );
  }

  await archiveDevis({
    devis,
    pdf,
    leadId: body.affaire ?? null,
    createdBy: user.id,
    sentTo: envoyeA,
  });

  // À l'envoi d'un DEVIS : avancer le lead à « Devis envoyé · Mano » (monotone,
  // best-effort — n'affecte pas la réussite de l'envoi). Pas pour une facture.
  let statut: string | undefined;
  if (docType === "devis" && body.affaire) {
    try {
      const r = await markDevisSentToClient(body.affaire);
      if (r.ok) statut = "envoye";
    } catch {
      /* best-effort — l'e-mail est déjà parti */
    }
  }

  return NextResponse.json({ ok: true, numero, envoye_a: envoyeA, statut });
}
