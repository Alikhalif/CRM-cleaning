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
import { baseUrlPublique, verifierLien } from "@/lib/urls/base-publique-server";

// L'ancienne `baseUrl()` locale acceptait l'en-tête `host` SANS VALIDATION.
// La résolution vit maintenant dans `lib/urls/base-publique`, qui exige une
// liste blanche de domaines : un en-tête est fourni par l'appelant, et un lien
// public construit sur une donnée non vérifiée peut pointer n'importe où.

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

  // Secteur du lead → pilote le domaine des liens (devis) ET l'expéditeur
  // (devis + facture). Lecture lancée en parallèle de la génération du PDF.
  const sectorPromise = body.affaire
    ? supabase
        .from("leads")
        .select("activity:activities(slug)")
        .eq("id", body.affaire)
        .maybeSingle<{ activity: { slug: string } | null }>()
    : Promise.resolve({ data: null });

  const numero = await allocateNumero(docType);
  const devis = buildDevis({ ...input, docType }, numero);
  const [pdf, leadRes] = await Promise.all([
    genererDevisBuffer(devis),
    sectorPromise,
  ]);
  const sector: string | null = leadRes.data?.activity?.slug ?? null;

  // Le numéro n'existe qu'ICI : il est alloué juste au-dessus, après que le
  // commercial a composé son e-mail. Les variables {devis.numero} /
  // {facture.numero} laissées dans l'objet et le corps sont donc remplacées
  // côté serveur, au dernier moment, par le numéro RÉELLEMENT attribué au
  // document joint. Une seule source : le PDF et l'e-mail portent le même.
  const injecterNumero = (s: string): string =>
    s
      .replace(/\{\{?\s*devis\.numero\s*\}?\}/gi, numero)
      .replace(/\{\{?\s*facture\.numero\s*\}?\}/gi, numero);

  const sujet =
    typeof body.sujet === "string" && body.sujet.trim()
      ? injecterNumero(body.sujet.trim())
      : undefined;
  const corps =
    typeof body.corps === "string" && body.corps.trim()
      ? injecterNumero(body.corps)
      : undefined;

  // Base des URL client selon le secteur (liens + bannière), calculée une fois.
  //
  // `domainForSector` ne rend plus son domaine EN DUR hors production : c'est
  // par là que le lien de signature d'un devis de recette partait vers le site
  // réel. Hors production, on retombe donc ici sur la base validée.
  const resolution = await baseUrlPublique();
  const sectorBase = domainForSector(sector) ?? (resolution.ok ? resolution.base : null);
  if (!sectorBase) {
    return NextResponse.json(
      {
        error:
          "Lien client impossible à produire : " +
          (resolution.ok ? "aucune base disponible." : resolution.raison),
      },
      { status: 500 },
    );
  }

  let trackPixelUrl: string | undefined;
  let signUrl: string | undefined;
  if (docType === "devis" && body.affaire) {
    trackPixelUrl = `${sectorBase}/api/devis/track/${signOpenToken(body.affaire)}.gif`;
    // Lien de signature en ligne → à la signature, le lead passe à « Signé ».
    // Le jeton est lié au DEVIS précis (numero) + horodaté (P1-5).
    signUrl = `${sectorBase}/devis-signer/${signSignToken(body.affaire, numero)}`;

    // Dernier contrôle avant que le lien quitte le CRM. `sectorBase` peut
    // venir d'une surcharge d'environnement : la base validée ne suffit pas à
    // garantir le lien final.
    const lienOk = verifierLien(signUrl);
    if (!lienOk.ok) {
      return NextResponse.json(
        { error: `Lien de signature refusé : ${lienOk.raison}` },
        { status: 500 },
      );
    }
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
