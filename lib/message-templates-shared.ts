// Pure helpers for communication templates (email + SMS) — no I/O, safe to
// import from client components (the SMS compose modal, the settings editor).

import { SECTOR_LABEL, type Lead } from "./leads";

export type TemplateChannel = "email" | "sms";
export type TemplateCategory =
  | "relance"
  | "decouverte"
  | "planification"
  | "apres_vente"
  | "autre";

export const TEMPLATE_CHANNELS: TemplateChannel[] = ["sms", "email"];
export const TEMPLATE_CHANNEL_LABEL: Record<TemplateChannel, string> = {
  sms: "SMS",
  email: "Email",
};

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "relance",
  "decouverte",
  "planification",
  "apres_vente",
  "autre",
];
export const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = {
  relance: "Relance",
  decouverte: "Découverte / Photos",
  planification: "Planification / RDV",
  apres_vente: "Après-vente",
  autre: "Autre",
};

// Variables insérables dans le corps (et le sujet). Interpolées à l'envoi.
export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "client.prenom", label: "Prénom du client" },
  { key: "client.nom", label: "Nom du client" },
  { key: "client.nom_complet", label: "Nom complet" },
  { key: "client.email", label: "Email" },
  { key: "client.telephone", label: "Téléphone" },
  { key: "client.ville", label: "Ville" },
  { key: "lead.secteur", label: "Secteur" },
  { key: "lead.type_service", label: "Type de prestation" },
  { key: "lead.numero", label: "N° du lead" },
  { key: "commercial.nom", label: "Commercial" },
  { key: "societe.nom", label: "Société" },
];

// Remplace {cle} par la valeur fournie. Une clé inconnue est laissée telle
// quelle (utile pour repérer les fautes de frappe).
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-z0-9_.]+)\}/gi, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}

// Construit la table de variables à partir d'un lead (+ commercial / société).
export function leadTemplateVars(
  lead: Lead,
  opts?: { commercialName?: string; societeName?: string },
): Record<string, string> {
  const firstFromName = (lead.client ?? "").trim().split(/\s+/)[0] ?? "";
  return {
    "client.prenom": lead.firstName ?? firstFromName,
    "client.nom": lead.lastName ?? "",
    "client.nom_complet": lead.client ?? "",
    "client.email": lead.email ?? "",
    "client.telephone": lead.phone ?? "",
    "client.ville": lead.city ?? "",
    "lead.secteur": SECTOR_LABEL[lead.sector],
    "lead.type_service": lead.typeService ?? "",
    "lead.numero": lead.shortId ?? "",
    "commercial.nom": opts?.commercialName ?? "",
    "societe.nom": opts?.societeName ?? lead.entityName ?? "",
  };
}
