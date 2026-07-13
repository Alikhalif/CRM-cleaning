// Message templates (call 2026-07-11). Pure builders — no I/O, safe to import
// anywhere. They return the subject/body the Brevo wrappers send verbatim, so
// copy lives in one place and can be tuned without touching the send logic.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Minimal, email-client-safe HTML shell with inline styles.
function shell(bodyHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a2e;max-width:560px;margin:0 auto;">${bodyHtml}</div>`;
}

export type EmailTemplate = { subject: string; htmlContent: string };

// ── Demande de photos (découverte → établir le devis) ────────────────
export function buildPhotoRequestEmail(input: {
  clientName: string;
  commercialName: string;
  entityName?: string;
}): EmailTemplate {
  const from = input.entityName ? ` de ${esc(input.entityName)}` : "";
  return {
    subject: "Vos photos pour établir votre devis",
    htmlContent: shell(
      `<p>Bonjour ${esc(input.clientName)},</p>
       <p>Afin d'établir un devis précis et adapté à votre besoin, pourriez-vous
       nous transmettre <strong>quelques photos</strong> de la zone concernée
       (vue d'ensemble + détails utiles) ?</p>
       <p>Vous pouvez simplement <strong>répondre à cet e-mail</strong> en y
       joignant vos photos, ou nous les envoyer par SMS/WhatsApp au numéro que
       ${esc(input.commercialName)} vous a communiqué.</p>
       <p>Dès réception, nous vous adressons votre devis dans les meilleurs délais.</p>
       <p>Bien cordialement,<br/>${esc(input.commercialName)}${from}</p>`,
    ),
  };
}

export function buildPhotoRequestSms(input: {
  clientName: string;
  commercialName: string;
}): string {
  return (
    `Bonjour ${input.clientName}, pour établir votre devis, ` +
    `merci de nous envoyer quelques photos de la zone concernée en réponse à ce SMS. ` +
    `Merci ! ${input.commercialName}`
  );
}

// ── Invitation d'accès au CRM ────────────────────────────────────────
export function buildInviteEmail(input: {
  inviteeName: string;
  actionLink: string;
  inviterName?: string;
}): EmailTemplate {
  const by = input.inviterName ? ` par ${esc(input.inviterName)}` : "";
  const link = esc(input.actionLink);
  return {
    subject: "Votre accès au CRM CGK",
    htmlContent: shell(
      `<p>Bonjour ${esc(input.inviteeName) || ""},</p>
       <p>Un accès au CRM CGK vient de vous être créé${by}. Pour activer votre
       compte et définir votre mot de passe, cliquez sur le bouton ci-dessous :</p>
       <p style="text-align:center;margin:24px 0;">
         <a href="${link}" style="display:inline-block;background:#5b4bcc;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Activer mon accès</a>
       </p>
       <p style="font-size:13px;color:#666;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>${link}</p>
       <p>À bientôt,<br/>L'équipe CGK</p>`,
    ),
  };
}

// ── Accompagnement de la facture finale ──────────────────────────────
// Plain-text variant for the SendEmailModal (which wraps the message into
// HTML and attaches the PDF itself). Editable by the commercial before send.
export function buildFinalInvoiceMessage(input: {
  clientName: string;
  docNum: string;
  entityName: string;
}): { subject: string; message: string } {
  return {
    subject: `Votre facture ${input.docNum} — ${input.entityName}`,
    message: `Bonjour ${input.clientName || ""},

Nous vous remercions de votre confiance. Veuillez trouver ci-joint votre facture ${input.docNum} correspondant à l'intervention réalisée.

Pour toute question relative à cette facture, vous pouvez répondre directement à cet e-mail.

En vous remerciant,
L'équipe ${input.entityName}`,
  };
}

export function buildFinalInvoiceEmail(input: {
  clientName: string;
  docNum: string;
  entityName: string;
}): EmailTemplate {
  return {
    subject: `Votre facture ${input.docNum}`,
    htmlContent: shell(
      `<p>Bonjour ${esc(input.clientName)},</p>
       <p>Nous vous remercions de votre confiance. Vous trouverez ci-joint votre
       <strong>facture ${esc(input.docNum)}</strong> correspondant à
       l'intervention réalisée.</p>
       <p>Pour toute question relative à cette facture, vous pouvez répondre
       directement à cet e-mail.</p>
       <p>En vous remerciant,<br/>L'équipe ${esc(input.entityName)}</p>`,
    ),
  };
}
