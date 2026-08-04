// Pure helpers for communication templates (email + SMS) — no I/O, safe to
// import from client components (the SMS compose modal, the settings editor).

import { SECTOR_LABEL, type Lead } from "./leads";
import {
  labelOf,
  ACCES,
  ENCOMBREMENT,
  OUI_NON,
  TYPE_BIEN,
  VOLUME_DEBARRAS,
  VOLUME_DEMENAGEMENT,
  type Option,
} from "./discovery-metier";

export type TemplateChannel = "email" | "sms";

// Catégories = RUBRIQUES du parcours métier (menu déroulant). Le canal
// (SMS/Email) est une dimension séparée — pas une catégorie.
export type TemplateCategory =
  // Commercial
  | "decouverte"
  | "devis"
  | "suivi_commercial"
  | "transmission"
  // Planificatrice → client
  | "planification"
  | "preparation"
  | "paiement"
  | "facture"
  | "cloture"
  // Planificatrice → intervenant (sous-traitant)
  | "consultation"
  | "affectation"
  | "avant_intervention"
  | "pendant_intervention"
  | "fin_intervention"
  // Transverses
  | "info"
  | "photos"
  | "confirmation"
  | "relance"
  | "administratif"
  | "autre";

export const TEMPLATE_CHANNELS: TemplateChannel[] = ["sms", "email"];
export const TEMPLATE_CHANNEL_LABEL: Record<TemplateChannel, string> = {
  sms: "SMS",
  email: "Email",
};

// Ordre = parcours métier (affiché ainsi dans le menu déroulant).
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "decouverte",
  "devis",
  "suivi_commercial",
  "transmission",
  "planification",
  "preparation",
  "consultation",
  "affectation",
  "avant_intervention",
  "pendant_intervention",
  "fin_intervention",
  "paiement",
  "facture",
  "cloture",
  "info",
  "photos",
  "confirmation",
  "relance",
  "administratif",
  "autre",
];
export const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = {
  decouverte: "Découverte",
  devis: "Devis",
  suivi_commercial: "Suivi commercial",
  transmission: "Transmission",
  planification: "Planification",
  preparation: "Préparation de l'intervention",
  consultation: "Consultation de l'intervenant",
  affectation: "Affectation / Mission",
  avant_intervention: "Avant intervention",
  pendant_intervention: "Suivi d'intervention",
  fin_intervention: "Fin d'intervention",
  paiement: "Paiement",
  facture: "Factures",
  cloture: "Clôture",
  info: "Demandes d'informations",
  photos: "Demandes de photos",
  confirmation: "Confirmations",
  relance: "Relances",
  administratif: "Administratif",
  autre: "Autre",
};

// ── Audiences (qui voit le template) ─────────────────────────────────────
// Chaque template porte 0..N audiences. Une liste VIDE = visible par tous
// (template global). Ces slugs mappent les profils commerciaux + rôles via
// userTemplateAudiences().
export type TemplateAudience =
  | "entrant"
  | "emission"
  | "divers"
  | "debarras"
  | "demenagement"
  | "diogene"
  | "planification"
  | "comptabilite";

export const TEMPLATE_AUDIENCES: TemplateAudience[] = [
  "entrant",
  "emission",
  "divers",
  "debarras",
  "demenagement",
  "diogene",
  "planification",
  "comptabilite",
];
export const TEMPLATE_AUDIENCE_LABEL: Record<TemplateAudience, string> = {
  entrant: "Appels entrants",
  emission: "Émission d'appels",
  divers: "Divers / Nettoyage",
  debarras: "Débarras",
  demenagement: "Déménagement",
  diogene: "Diogène",
  planification: "Planification",
  comptabilite: "Comptabilité",
};

// Traduit les rôles + profils commerciaux d'un utilisateur en audiences de
// templates. Décisions (spec 2026-08-02) :
//   • admin                → tout (voit toute la bibliothèque)
//   • rôle planification    → planification + comptabilité (gère la compta)
//   • profil appel_entrant  → entrant
//   • profil emission_appel → entrant + emission (relances RÉSERVÉES ici)
//   • profil divers         → divers
//   • profil débarras/dém.  → debarras + demenagement (profil combiné)
//   • profil diogène        → diogene
//   • profil performant     → tous les secteurs SAUF emission (relances exclues)
//   • profil en_attente     → entrant (minimal)
export function userTemplateAudiences(
  roles: string[],
  profiles: string[],
  isAdmin = false,
): TemplateAudience[] {
  if (isAdmin || roles.includes("admin")) return [...TEMPLATE_AUDIENCES];
  const out = new Set<TemplateAudience>();
  if (roles.includes("planification")) {
    out.add("planification");
    out.add("comptabilite");
  }
  const add = (...a: TemplateAudience[]) => a.forEach((x) => out.add(x));
  for (const p of profiles) {
    switch (p) {
      case "appel_entrant": add("entrant"); break;
      case "emission_appel": add("entrant", "emission"); break;
      case "divers": add("divers"); break;
      case "debarras_demenagement": add("debarras", "demenagement"); break;
      case "diogene": add("diogene"); break;
      case "performant": add("entrant", "divers", "debarras", "demenagement", "diogene"); break;
      case "en_attente": add("entrant"); break;
    }
  }
  return [...out];
}

// Un template est visible si sans audience (global) ou si au moins une de ses
// audiences est détenue par l'utilisateur.
export function templateVisibleTo(
  templateAudiences: string[],
  userAudiences: TemplateAudience[],
): boolean {
  if (!templateAudiences || templateAudiences.length === 0) return true;
  return templateAudiences.some((a) => (userAudiences as string[]).includes(a));
}

// ── Catégorie → groupe de rôle (décision client 2026-08-03) ──────────────
// En plus des audiences par template, chaque CATÉGORIE n'est visible que pour
// certains groupes de rôle :
//   • Devis / Infos / Photos / Relance → Commercial
//   • Confirmations / Planification    → Planificatrice
//   • Factures / Administratif         → Planificatrice + Comptabilité
export type RoleGroup = "commercial" | "planification" | "comptabilite";

export const CATEGORY_ROLE_GROUPS: Record<TemplateCategory, RoleGroup[]> = {
  // Commercial
  decouverte: ["commercial"],
  devis: ["commercial"],
  suivi_commercial: ["commercial"],
  transmission: ["commercial"],
  info: ["commercial"],
  photos: ["commercial"],
  relance: ["commercial"],
  // Planificatrice
  planification: ["planification"],
  preparation: ["planification"],
  confirmation: ["planification"],
  cloture: ["planification"],
  consultation: ["planification"],
  affectation: ["planification"],
  avant_intervention: ["planification"],
  pendant_intervention: ["planification"],
  fin_intervention: ["planification"],
  // Planificatrice + comptabilité
  paiement: ["planification", "comptabilite"],
  facture: ["planification", "comptabilite"],
  administratif: ["planification", "comptabilite"],
  // Transverse
  autre: ["commercial", "planification", "comptabilite"],
};

// Destinataire d'un template (parcours métier) : le client, l'intervenant
// (sous-traitant), ou interne (transmission au service planification).
export type Recipient = "client" | "intervenant" | "interne";
export const RECIPIENT_LABEL: Record<Recipient, string> = {
  client: "Client",
  intervenant: "Intervenant",
  interne: "Interne",
};

// Groupes de rôle d'un utilisateur. Admin = tous. Rôle planification couvre
// planification + comptabilité (pas de rôle comptable distinct). Tout porteur
// de profil commercial (ou rôle commercial) = groupe commercial.
export function userRoleGroups(
  roles: string[],
  profiles: string[],
  isAdmin = false,
): RoleGroup[] {
  if (isAdmin || roles.includes("admin")) return ["commercial", "planification", "comptabilite"];
  const out = new Set<RoleGroup>();
  if (roles.includes("planification")) {
    out.add("planification");
    out.add("comptabilite");
  }
  if (roles.includes("commercial") || profiles.length > 0) out.add("commercial");
  return [...out];
}

export function categoryVisibleTo(category: TemplateCategory, groups: RoleGroup[]): boolean {
  const allowed = CATEGORY_ROLE_GROUPS[category] ?? [];
  return allowed.some((g) => groups.includes(g));
}

// Variables insérables dans le corps (et le sujet). Interpolées à l'envoi.
export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "client.prenom", label: "Prénom du client" },
  { key: "client.nom", label: "Nom du client" },
  { key: "client.nom_complet", label: "Nom complet" },
  { key: "client.email", label: "Email" },
  { key: "client.telephone", label: "Téléphone" },
  { key: "client.adresse", label: "Adresse" },
  { key: "client.ville", label: "Ville" },
  { key: "lead.secteur", label: "Secteur / Activité" },
  { key: "lead.type_service", label: "Type d'intervention" },
  { key: "lead.numero", label: "N° du lead" },
  { key: "lead.surface", label: "Surface (m²)" },
  { key: "lead.volume", label: "Volume (débarras/déménagement)" },
  { key: "lead.type_bien", label: "Type de bien" },
  { key: "lead.etage", label: "Étage" },
  { key: "lead.ascenseur", label: "Ascenseur" },
  { key: "lead.acces", label: "Accès" },
  { key: "lead.encombrement", label: "Niveau d'encombrement" },
  { key: "lead.contexte", label: "Contexte de l'intervention" },
  { key: "devis.numero", label: "N° de devis" },
  { key: "facture.numero", label: "N° de facture" },
  { key: "intervention.date", label: "Date d'intervention" },
  { key: "intervention.heure", label: "Heure d'intervention" },
  { key: "intervention.creneau", label: "Créneau" },
  { key: "acompte.pct", label: "Acompte (%)" },
  { key: "montant.total", label: "Montant total TTC" },
  { key: "montant.acompte", label: "Montant de l'acompte" },
  { key: "montant.solde", label: "Solde restant" },
  { key: "lien.signature", label: "Lien de signature" },
  { key: "lien.paiement", label: "Lien de paiement" },
  { key: "commercial.nom", label: "Commercial" },
  { key: "commercial.email", label: "Email du commercial" },
  { key: "planificatrice.nom", label: "Planificatrice" },
  { key: "societe.nom", label: "Société" },
  { key: "societe.telephone", label: "Téléphone société" },
  { key: "societe.rib", label: "RIB / IBAN" },
];

// Remplace {cle} par la valeur fournie. Une clé inconnue est laissée telle
// quelle (utile pour repérer les fautes de frappe).
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-z0-9_.]+)\}/gi, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}

// Contexte optionnel (doc/entité/intervention) pour remplir les variables qui
// ne viennent pas du lead seul. Tout est facultatif — une valeur absente rend
// une chaîne vide (le message reste éditable avant envoi).
export type TemplateVarContext = {
  commercialName?: string;
  commercialEmail?: string;
  planificatriceName?: string;
  societeName?: string;
  societePhone?: string;
  societeRib?: string;
  clientAddress?: string;
  devisNum?: string;
  factureNum?: string;
  interventionDate?: string;
  interventionHeure?: string;
  interventionCreneau?: string;
  acomptePct?: string;
  montantTotal?: string;
  montantAcompte?: string;
  montantSolde?: string;
  lienSignature?: string;
  lienPaiement?: string;
};

// Construit la table de variables à partir d'un lead (+ contexte optionnel).
// labelOf renvoie « — » pour une valeur absente ; pour un email on préfère "".
function lblOrEmpty(options: Option[], value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const r = labelOf(options, value);
  return r === "—" ? "" : r;
}

export function leadTemplateVars(
  lead: Lead,
  opts?: TemplateVarContext,
): Record<string, string> {
  const firstFromName = (lead.client ?? "").trim().split(/\s+/)[0] ?? "";
  // Données opérationnelles (découverte métier, JSONB) — pour l'intervenant.
  const details = (lead.discoveryDetails ?? {}) as Record<string, unknown>;
  const volumeOpts = lead.sector === "demenagement" ? VOLUME_DEMENAGEMENT : VOLUME_DEBARRAS;
  return {
    "client.prenom": lead.firstName ?? firstFromName,
    "client.nom": lead.lastName ?? "",
    "client.nom_complet": lead.client ?? "",
    "client.email": lead.email ?? "",
    "client.telephone": lead.phone ?? "",
    "client.adresse": opts?.clientAddress ?? lead.city ?? "",
    "client.ville": lead.city ?? "",
    "lead.secteur": SECTOR_LABEL[lead.sector],
    "lead.type_service": lead.typeService ?? "",
    "lead.numero": lead.shortId ?? "",
    "lead.surface": lead.surfaceM2 ? `${lead.surfaceM2} m²` : "",
    "lead.volume": lblOrEmpty(volumeOpts, details.volume),
    "lead.type_bien": lblOrEmpty(TYPE_BIEN, details.typeBien),
    "lead.etage": details.etage != null && details.etage !== "" ? String(details.etage) : "",
    "lead.ascenseur": lblOrEmpty(OUI_NON, details.ascenseur),
    "lead.acces": lblOrEmpty(ACCES, details.acces),
    "lead.encombrement": lblOrEmpty(ENCOMBREMENT, details.encombrement),
    "lead.contexte": lead.contexteIntervention ?? "",
    "devis.numero": opts?.devisNum ?? "",
    "facture.numero": opts?.factureNum ?? "",
    "intervention.date": opts?.interventionDate ?? "",
    "intervention.heure": opts?.interventionHeure ?? "",
    "intervention.creneau": opts?.interventionCreneau ?? "",
    "acompte.pct": opts?.acomptePct ?? "",
    "montant.total": opts?.montantTotal ?? "",
    "montant.acompte": opts?.montantAcompte ?? "",
    "montant.solde": opts?.montantSolde ?? "",
    "lien.signature": opts?.lienSignature ?? "",
    "lien.paiement": opts?.lienPaiement ?? "",
    "commercial.nom": opts?.commercialName ?? "",
    "commercial.email": opts?.commercialEmail ?? "",
    "planificatrice.nom": opts?.planificatriceName ?? "",
    "societe.nom": opts?.societeName ?? lead.entityName ?? "",
    "societe.telephone": opts?.societePhone ?? "",
    "societe.rib": opts?.societeRib ?? "",
  };
}
