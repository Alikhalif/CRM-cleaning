import "server-only";
import { sendBrevoEmail } from "@/lib/brevo";
import { SECTOR_LABEL, type Sector } from "@/lib/leads";

// Centralisation email des leads (chaîne d'arrivée §10-13).
//
// À l'arrivée de CHAQUE lead, une copie complète est envoyée à une boîte de
// centralisation Super Admin, selon la classification déjà existante :
//   • Déménagement            → LEAD_CENTRAL_EMAIL_DEMENAGEMENT (déf. lead.dem360@gmail.com)
//   • Nettoyage (au sens large: nettoyage/nettoyage_difficile/diogène/débarras)
//                             → LEAD_CENTRAL_EMAIL_NETTOYAGE  (déf. leadnettoyage360@gmail.com)
//   • Autres secteurs (urgence/enr/renovation) → non centralisés (hors périmètre
//     de cette mission ; aucune adresse dédiée n'est définie par le cahier).
//
// Envoi via la couche Brevo existante, en BEST-EFFORT : toute erreur est loguée
// et n'interrompt JAMAIS la création du lead (le lead est déjà en base quand on
// arrive ici). L'email est un outil de contrôle Super Admin : il PEUT contenir
// la provenance stratégique complète (§13) — il ne part que vers ces boîtes de
// pilotage, jamais vers un commercial.

const DEFAULT_NETTOYAGE = "leadnettoyage360@gmail.com";
const DEFAULT_DEMENAGEMENT = "lead.dem360@gmail.com";

const NETTOYAGE_SECTORS = new Set<string>([
  "nettoyage",
  "nettoyage_difficile",
  "diogene",
  "debarras",
]);
const DEMENAGEMENT_SECTORS = new Set<string>(["demenagement"]);

function centralAddressFor(sector: string): string | null {
  if (DEMENAGEMENT_SECTORS.has(sector)) {
    return process.env.LEAD_CENTRAL_EMAIL_DEMENAGEMENT || DEFAULT_DEMENAGEMENT;
  }
  if (NETTOYAGE_SECTORS.has(sector)) {
    return process.env.LEAD_CENTRAL_EMAIL_NETTOYAGE || DEFAULT_NETTOYAGE;
  }
  return null;
}

export type CentralizationInput = {
  leadId: string;
  shortId: string;
  sector: string;
  // Nom du site / landing page d'origine (ou canal si pas de LP) — sert d'objet.
  provenance: string;
  clientName: string;
  isCompany: boolean;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  typeService?: string | null;
  message?: string | null;
  // Provenance marketing (EN CLAIR — avant chiffrement DB) réservée au pilotage.
  sourceSlug?: string | null;
  sourceUrl?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  gclid?: string | null;
  receivedAt: string; // ISO
};

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string | null | undefined): string {
  const v = (value ?? "").toString().trim();
  if (!v) return "";
  return `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:4px 0;color:#111827">${esc(v)}</td></tr>`;
}

function buildHtml(input: CentralizationInput, activityLabel: string): string {
  const dt = new Date(input.receivedAt);
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dt);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);

  const rows = [
    row("Activité", activityLabel),
    row("Provenance", input.provenance),
    row("Réf.", input.shortId),
    row(input.isCompany ? "Société" : "Prospect", input.isCompany ? input.company : input.clientName),
    !input.isCompany ? "" : row("Contact", input.clientName),
    row("Téléphone", input.phone),
    row("Email", input.email),
    row("Adresse", input.address),
    row("Code postal", input.postalCode),
    row("Ville", input.city),
    row("Pays", input.country),
    row("Type de service", input.typeService),
    row("Message", input.message),
    row("Date", date),
    row("Heure", heure),
    // ── Acquisition (pilotage Super Admin) ──
    row("Canal", input.sourceSlug),
    row("Site / URL d'origine", input.sourceUrl),
    row("utm_source", input.utmSource),
    row("utm_medium", input.utmMedium),
    row("utm_campaign", input.utmCampaign),
    row("utm_term", input.utmTerm),
    row("utm_content", input.utmContent),
    row("gclid", input.gclid),
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="padding:16px 20px;background:#111827;color:#ffffff">
        <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#9ca3af">Nouveau lead entrant</div>
        <div style="font-size:18px;font-weight:700;margin-top:2px">${esc(activityLabel)} — ${esc(input.provenance)}</div>
      </div>
      <div style="padding:16px 20px">
        <table style="border-collapse:collapse;font-size:14px;width:100%">${rows}</table>
      </div>
      <div style="padding:12px 20px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
        Copie automatique de centralisation — pilotage Super Admin uniquement.
      </div>
    </div>
  </body></html>`;
}

export async function sendLeadCentralizationEmail(input: CentralizationInput): Promise<void> {
  try {
    const to = centralAddressFor(input.sector);
    if (!to) return; // secteur hors périmètre de centralisation
    const activityLabel = SECTOR_LABEL[input.sector as Sector] ?? input.sector;
    const subject = `NOUVEAU LEAD — ${input.provenance}`;
    const res = await sendBrevoEmail({
      to,
      subject,
      htmlContent: buildHtml(input, activityLabel),
    });
    if (!res.ok) console.error("sendLeadCentralizationEmail: Brevo error:", res.error);
  } catch (err) {
    console.error("sendLeadCentralizationEmail failed:", err);
  }
}
