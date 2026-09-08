import "server-only";
import { sendBrevoEmail } from "@/lib/brevo";
import {
  senderForSector,
  domainForSector,
  signatureBannerFile,
  signatureBannerHtml,
} from "@/lib/devis/sender";
import { PRESTATAIRE_CERT, type CertHotte } from "./types";

// Envoie le certificat au client (secteur nettoyage), avec option de joindre la
// facture. Best-effort — la génération/l'archivage restent valides même si
// l'e-mail échoue. Renvoie l'adresse destinataire.
export async function envoyerCertHotteEmail(
  cert: CertHotte,
  pdf: Buffer,
  opts?: {
    facture?: { num: string; pdf: Buffer } | null;
    ownerEmail?: string | null;
  },
): Promise<string> {
  const dest = cert.client?.email;
  if (!dest) throw new Error("Pas d'adresse e-mail client sur le certificat.");

  const sender = senderForSector("nettoyage");
  const base =
    domainForSector("nettoyage") ??
    (process.env.SIGNATURE_BASE_URL || "https://crmoptimum.com").replace(/\/$/, "");
  const sigFile = signatureBannerFile("nettoyage");
  const banner = sigFile ? signatureBannerHtml(`${base}/email-signatures/${sigFile}`) : "";

  const nom = cert.client.responsable || cert.client.etablissement;
  const withFac = opts?.facture ? ` ainsi que la facture <strong>${opts.facture.num}</strong>` : "";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.55">
    Bonjour ${nom},<br /><br />
    Suite à notre intervention de <strong>nettoyage de votre hotte professionnelle</strong> réalisée le
    ${cert.dateIntervention}, veuillez trouver ci-joint votre <strong>certificat de conformité n° ${cert.numero}</strong>${withFac}.<br /><br />
    Ce document atteste de l'entretien réalisé et peut être présenté à votre assurance ou conservé dans votre
    dossier d'entretien (prévention incendie / hygiène).<br /><br />
    Nous restons à votre disposition pour toute question.<br /><br />
    Bien cordialement,<br />${sender.name}<br />
    ${PRESTATAIRE_CERT.telephone} — ${PRESTATAIRE_CERT.email}
  </div>${banner}`;

  const attachments = [
    { name: `certificat-hotte-${cert.numero}.pdf`, bytes: pdf },
    ...(opts?.facture ? [{ name: `facture-${opts.facture.num}.pdf`, bytes: opts.facture.pdf }] : []),
  ];

  const res = await sendBrevoEmail({
    to: dest,
    toName: nom,
    subject: `Certificat de conformité — nettoyage de hotte n° ${cert.numero}`,
    htmlContent: html,
    senderEmail: sender.email,
    senderName: sender.name,
    attachments,
    bcc: opts?.ownerEmail ?? undefined,
  });
  if (!res.ok) throw new Error("Brevo : " + res.error);
  return dest;
}
