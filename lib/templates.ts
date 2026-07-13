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

// ── Accompagnement de la facture finale ──────────────────────────────
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
