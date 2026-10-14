// Helpers PURS du module « Suivi commercial » (aucune I/O) — importables depuis
// un composant client. Le module ne crée AUCUNE tâche : le moteur d'actions
// commerciales (lib/commercial-actions) reste la seule source des échéances et
// des relances. Ici on ne fait que lire, situer et ordonner.

import type { ActionType, CommercialAction } from "./commercial-actions/shared";

// ── Situation du dossier ────────────────────────────────────────────────
// Dérivée du statut du lead + de la découverte + des photos. C'est une LECTURE
// de l'état réel, jamais un statut stocké en double.
export type Situation =
  | "nouveau"
  | "decouverte_encours"
  | "decouverte_faite"
  | "attente_client"
  | "devis_envoye"
  | "devis_ouvert"
  | "signe"
  | "perdu";

export const SITUATION_LABEL: Record<Situation, string> = {
  nouveau: "Nouveau prospect",
  decouverte_encours: "Découverte en cours",
  decouverte_faite: "Découverte terminée",
  attente_client: "En attente client",
  devis_envoye: "Devis envoyé",
  devis_ouvert: "Devis ouvert",
  signe: "Devis signé",
  perdu: "Perdu",
};

// Une seule alerte par ligne (§13 : ne pas empiler les badges). L'ordre de ce
// tableau EST l'ordre de priorité d'affichage.
export type AlertKind = "retard" | "relance" | "photos" | "decouverte" | "signe" | null;

export const ALERT_LABEL: Record<Exclude<AlertKind, null>, string> = {
  retard: "En retard",
  relance: "À relancer",
  photos: "Photos en attente",
  decouverte: "Découverte incomplète",
  signe: "Signé",
};

// ── Prochaine action ────────────────────────────────────────────────────
// Quand le moteur a matérialisé une action, c'est ELLE qui fait foi (libellé +
// échéance). Sinon on propose l'étape logique suivante, sans créer de tâche :
// un lead qui vient d'arriver n'a pas encore d'action en base, mais le
// commercial doit quand même lire « Appeler le prospect ».
export const SUGGESTED_ACTION: Record<Situation, string> = {
  nouveau: "Appeler le prospect",
  decouverte_encours: "Compléter la découverte",
  decouverte_faite: "Préparer le devis",
  attente_client: "Relancer les photos",
  devis_envoye: "Relancer le client",
  devis_ouvert: "Relancer le client",
  signe: "Transmettre à la planification",
  perdu: "—",
};

// Libellé du bouton principal de la ligne.
export type RowActionKind = "appeler" | "devis" | "relancer" | "ouvrir";

export const ROW_ACTION_LABEL: Record<RowActionKind, string> = {
  appeler: "Appeler",
  devis: "Préparer le devis",
  relancer: "Relancer",
  ouvrir: "Ouvrir le dossier",
};

export function rowActionFor(situation: Situation): RowActionKind {
  switch (situation) {
    case "nouveau": return "appeler";
    case "decouverte_faite": return "devis";
    case "attente_client":
    case "devis_envoye":
    case "devis_ouvert": return "relancer";
    default: return "ouvrir";
  }
}

// ── Ligne du tableau ────────────────────────────────────────────────────
export type SuiviRow = {
  leadId: string;
  shortId: string;
  client: string;
  phone: string;
  sector: string;
  sectorLabel: string;
  // Montant du devis quand il existe ; à défaut le montant estimé du lead.
  // null = « — » (jamais 0 € par défaut, cf. §16).
  amount: number | null;
  amountIsEstimate: boolean;
  situation: Situation;
  // Échéance effective de l'action du moteur (ISO), null si aucune action.
  dueAt: string | null;
  overdue: boolean;
  // Libellé de la prochaine action : celui du moteur s'il existe, sinon la
  // suggestion dérivée de la situation.
  nextAction: string;
  // Type d'action du moteur, null si la ligne n'en porte aucune.
  actionType: ActionType | null;
  alert: AlertKind;
  ownerId: string | null;
  ownerName: string | null;
  isUrgent: boolean;
  // NRP = « ne répond pas ». Conservé depuis l'ancienne interface : c'est le
  // CAS 7 du moteur (client injoignable).
  isNrp: boolean;
  societe: string | null;
  receivedAt: string;
  // Provenance — CONFIDENTIEL : renseigné UNIQUEMENT pour admin/planification
  // (même règle que partout ailleurs, cf. lib/leads.ts). null côté commercial.
  origin: "form" | "phone" | null;
};

// ── Onglets (filtres internes d'un même tableau, §7) ────────────────────
export type Tab = "tous" | "nouveaux" | "devis" | "relances" | "signes" | "perdus";

export const TAB_LABEL: Record<Tab, string> = {
  tous: "Tous les dossiers",
  nouveaux: "Nouveaux leads",
  devis: "Devis",
  relances: "Relances",
  signes: "Signés",
  perdus: "Perdus",
};

export const TABS: Tab[] = ["tous", "nouveaux", "devis", "relances", "signes", "perdus"];

export function matchesTab(row: SuiviRow, tab: Tab): boolean {
  switch (tab) {
    case "tous": return row.situation !== "perdu";
    case "nouveaux": return row.situation === "nouveau" || row.situation === "decouverte_encours";
    case "devis": return ["decouverte_faite", "devis_envoye", "devis_ouvert"].includes(row.situation);
    case "relances": return isRelancable(row);
    case "signes": return row.situation === "signe";
    case "perdus": return row.situation === "perdu";
  }
}

// Un dossier « à relancer » : devis parti, ni signé ni perdu. Un devis signé
// n'apparaît JAMAIS ici (§10, §16).
export function isRelancable(row: SuiviRow): boolean {
  return row.situation === "devis_envoye" || row.situation === "devis_ouvert";
}

// ── Filtres rapides (§12) ───────────────────────────────────────────────
export type QuickFilter = "aujourdhui" | "retard" | "urgents" | "sans_action" | "attente_client";

export const QUICK_LABEL: Record<QuickFilter, string> = {
  aujourdhui: "Aujourd'hui",
  retard: "En retard",
  urgents: "Urgents",
  sans_action: "Sans action",
  attente_client: "En attente client",
};

export const QUICK_FILTERS: QuickFilter[] = [
  "aujourdhui", "retard", "urgents", "sans_action", "attente_client",
];

export function matchesQuick(row: SuiviRow, q: QuickFilter, now = Date.now()): boolean {
  switch (q) {
    case "aujourdhui": return row.dueAt != null && sameDay(new Date(row.dueAt), new Date(now));
    case "retard": return row.overdue;
    case "urgents": return row.isUrgent;
    // « Sans action » = aucune tâche matérialisée par le moteur, et le dossier
    // n'est ni signé ni perdu : typiquement les oubliés.
    case "sans_action": return row.dueAt == null && row.situation !== "signe" && row.situation !== "perdu";
    case "attente_client": return row.situation === "attente_client";
  }
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── « Mes priorités » (§11) ─────────────────────────────────────────────
// Classement : retard d'abord, puis prospects non contactés, relances,
// découvertes sans devis, photos. À rang égal, l'échéance la plus ancienne —
// puis le dossier le plus ancien. Le MONTANT n'entre volontairement pas dans
// le classement (§11 : un gros devis n'est pas d'office plus urgent qu'un
// nouveau lead).
export function priorityRank(row: SuiviRow): number {
  if (row.situation === "signe" || row.situation === "perdu") return 99;
  if (row.overdue) return 1;
  if (row.situation === "nouveau") return 2;
  if (isRelancable(row)) return 3;
  if (row.situation === "decouverte_faite") return 4;
  if (row.situation === "attente_client") return 5;
  if (row.situation === "decouverte_encours") return 6;
  return 50;
}

export function comparePriority(a: SuiviRow, b: SuiviRow): number {
  const ra = priorityRank(a);
  const rb = priorityRank(b);
  if (ra !== rb) return ra - rb;
  const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
}

// ── Échéance lisible ────────────────────────────────────────────────────
export function dueLabel(row: SuiviRow, now = Date.now()): string {
  if (!row.dueAt) return "—";
  const d = new Date(row.dueAt);
  if (row.overdue) return "En retard";
  const today = new Date(now);
  if (sameDay(d, today)) return "Aujourd'hui";
  const tomorrow = new Date(now + 86_400_000);
  if (sameDay(d, tomorrow)) return "Demain";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

// ── Alerte prioritaire d'une ligne ──────────────────────────────────────
export function alertFor(row: Omit<SuiviRow, "alert">): AlertKind {
  if (row.situation === "signe") return "signe";
  if (row.situation === "perdu") return null;
  if (row.overdue) return "retard";
  if (row.situation === "attente_client") return "photos";
  if (row.situation === "devis_envoye" || row.situation === "devis_ouvert") return "relance";
  if (row.situation === "decouverte_encours") return "decouverte";
  return null;
}

// Libellé de la prochaine action : le moteur prime, sinon la suggestion.
export function nextActionLabel(situation: Situation, action: CommercialAction | null): string {
  if (!action) return SUGGESTED_ACTION[situation];
  return action.title || SUGGESTED_ACTION[situation];
}
