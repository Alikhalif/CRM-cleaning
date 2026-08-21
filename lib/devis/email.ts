import "server-only";
import nodemailer from "nodemailer";
import { euro } from "./layout";
import { PRESTATAIRE, type Devis } from "./types";
import { sendBrevoEmail } from "@/lib/brevo";

// Envoi du devis PDF au client. Deux canaux :
//   1. BREVO (par défaut si BREVO_API_KEY est présent) — cohérent avec le reste
//      du CRM, aucun secret supplémentaire à configurer.
//   2. SMTP (nodemailer) — repli si Brevo n'est pas configuré, ou forcé via
//      DEVIS_EMAIL_TRANSPORT=smtp. Secrets par variables d'environnement
//      UNIQUEMENT : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME,
//      SMTP_BCC.
//
// L'expéditeur « OPTIMIVV Déménagement » est surchargné via DEVIS_SENDER_EMAIL /
// DEVIS_SENDER_NAME (sinon défaut Brevo BREVO_SENDER_EMAIL, qui doit être un
// expéditeur vérifié).

const FROM_NAME_DEFAULT = "OPTIMIVV Déménagement";

function corpsTexte(v: {
  nom: string;
  numero: string;
  date_prevue: string;
  montant: string;
  validite: number | string;
  date_emission: string;
  signature: string;
  tel: string;
  email: string;
  site: string;
}): string {
  return `Bonjour ${v.nom},

Suite à votre demande, veuillez trouver ci-joint votre devis n° ${v.numero}
pour une intervention prévue le ${v.date_prevue}.

Montant : ${v.montant}
Validité de l'offre : ${v.validite} jours à compter du ${v.date_emission}.

Pour l'accepter, il vous suffit de nous retourner le devis signé avec la
mention « Bon pour accord », en réponse à cet e-mail.

Nous restons à votre disposition pour toute question ou ajustement.

Bien cordialement,

${v.signature}
${v.tel} — ${v.email}
${v.site}
`;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export async function envoyerDevisEmail(
  donnees: Devis,
  pdf: Buffer,
  opts?: {
    corps?: string;
    sujet?: string;
    trackPixelUrl?: string;
    signUrl?: string;
  },
): Promise<string> {
  const dest = donnees.client?.email;
  if (!dest) {
    throw new Error("Pas d'adresse e-mail client dans les données.");
  }

  const P = { ...PRESTATAIRE, ...(donnees.prestataire || {}) };
  const montant =
    donnees.montant_ht != null
      ? euro(donnees.montant_ht).replace(" €", " EUR HT")
      : "à confirmer";
  const kind = donnees.docType === "facture" ? "facture" : "devis";
  const sujet =
    opts?.sujet ||
    `Votre ${kind} n° ${donnees.numero} - OPTIMIVV Déménagement`;
  const texte =
    opts?.corps ||
    corpsTexte({
      nom: donnees.client?.nom || "Madame, Monsieur",
      numero: donnees.numero,
      date_prevue: donnees.date_prevue || "à convenir",
      montant,
      validite: donnees.validite_jours ?? 30,
      date_emission: donnees.date_emission || "",
      signature: P.enseigne || FROM_NAME_DEFAULT,
      tel: P.telephone || "01 84 80 41 15",
      email: P.email || "contact@optimivv.fr",
      site: P.site || "www.optimivv.fr",
    });

  const fromName = process.env.DEVIS_SENDER_NAME || process.env.SMTP_FROM_NAME || FROM_NAME_DEFAULT;
  const forceSmtp = process.env.DEVIS_EMAIL_TRANSPORT === "smtp";

  // Pixel de suivi d'ouverture (méthode maison, sans Brevo Pro) — chargé par le
  // client mail à l'ouverture → fait avancer le lead à « Devis ouvert ».
  const pixel = opts?.trackPixelUrl
    ? `<img src="${opts.trackPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0" />`
    : "";

  // Bouton « Signer votre devis » (signature en ligne → lead « Signé »).
  const signButton = opts?.signUrl
    ? `<div style="margin:20px 0 4px"><a href="${opts.signUrl}" style="display:inline-block;background:#0050c7;color:#fff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;padding:13px 26px;border-radius:8px">✍️ Signer votre devis en ligne</a></div>`
    : "";
  // Version texte du lien (repli lecteurs sans HTML).
  const texteBody = opts?.signUrl
    ? `${texte}\nPour signer votre devis en ligne : ${opts.signUrl}\n`
    : texte;

  // ── Canal 1 : Brevo (défaut) ──────────────────────────────────────────
  if (!forceSmtp && process.env.BREVO_API_KEY) {
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;white-space:pre-wrap;line-height:1.5">${escapeHtml(
      texte,
    )}</div>${signButton}${pixel}`;
    const res = await sendBrevoEmail({
      to: dest,
      toName: donnees.client?.nom || undefined,
      subject: sujet,
      htmlContent: html,
      senderEmail: process.env.DEVIS_SENDER_EMAIL || undefined,
      senderName: fromName,
      attachment: { name: `devis-${donnees.numero}.pdf`, bytes: pdf },
    });
    if (!res.ok) {
      throw new Error("Brevo : " + res.error);
    }
    return dest;
  }

  // ── Canal 2 : SMTP (repli) ────────────────────────────────────────────
  const HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
  const PORT = Number(process.env.SMTP_PORT || "465");
  const USER = process.env.SMTP_USER;
  const PASS = process.env.SMTP_PASS;
  const BCC = process.env.SMTP_BCC;
  if (!USER || !PASS) {
    throw new Error(
      "Aucun canal d'envoi configuré : ni BREVO_API_KEY, ni SMTP_USER/SMTP_PASS.",
    );
  }

  const transport = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
  });
  await transport.sendMail({
    from: `${fromName} <${USER}>`,
    to: dest,
    replyTo: P.email || USER,
    bcc: BCC || undefined,
    subject: sujet,
    text: texteBody,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;white-space:pre-wrap;line-height:1.5">${escapeHtml(
      texte,
    )}</div>${signButton}${pixel}`,
    attachments: [
      {
        filename: `devis-${donnees.numero}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
  return dest;
}
