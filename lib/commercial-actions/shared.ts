// Helpers PURS (aucune I/O) du module « Actions & Relances commerciales ».
// Importable depuis des composants client. Le module observe le pipeline
// existant et matérialise des actions à mener ; il ne crée aucun événement métier.

export type ActionType = "decouverte" | "photos" | "devis" | "relance";
export type ActionStatus = "a_faire" | "reportee" | "terminee";
// Sous-type (photos) : 'attente' = aucune photo reçue ; 'a_verifier' = le client
// a répondu mais rien n'est rattaché au dossier (rattachement à vérifier).
export type PhotoSubtype = "attente" | "a_verifier";
// Bucket = onglet effectif (dérivé de l'échéance, pas stocké).
export type ActionBucket = "a_faire" | "en_retard" | "reportee" | "terminee";
export type ActionPriority = "normale" | "retard" | "urgent";

export type CommercialAction = {
  id: string;
  leadId: string;
  leadRef: string | null; // short_id (L-xxxx)
  leadName: string | null; // libellé client
  ownerId: string | null;
  ownerName: string | null;
  type: ActionType;
  title: string;
  reason: string | null;
  status: ActionStatus;
  createdAt: string;
  dueAt: string;
  snoozedUntil: string | null;
  reportCount: number;
  closedAt: string | null;
  closedReason: string | null;
  result: string | null;
  subtype: PhotoSubtype | null;
};

export const TYPE_LABEL: Record<ActionType, string> = {
  decouverte: "Découverte",
  photos: "Photos",
  devis: "Devis",
  relance: "Relance",
};

export const TYPE_VERB: Record<ActionType, string> = {
  decouverte: "Compléter la découverte",
  photos: "Relancer le client pour obtenir les photos",
  devis: "Envoyer le devis",
  relance: "Relancer le client",
};

// Libellé du statut « photos » d'un dossier en attente.
export const PHOTO_SUBTYPE_LABEL: Record<PhotoSubtype, string> = {
  attente: "En attente de photos",
  a_verifier: "Photos reçues — rattachement à vérifier",
};

export const BUCKET_LABEL: Record<ActionBucket, string> = {
  a_faire: "À faire",
  en_retard: "En retard",
  reportee: "Reportées",
  terminee: "Terminées",
};

export const PRIORITY_LABEL: Record<ActionPriority, string> = {
  normale: "À faire",
  retard: "En retard",
  urgent: "Urgent",
};

// Échéance effective : la date de report prime sur l'échéance initiale.
export function effectiveDue(a: Pick<CommercialAction, "dueAt" | "snoozedUntil">): number {
  const due = new Date(a.dueAt).getTime();
  const snz = a.snoozedUntil ? new Date(a.snoozedUntil).getTime() : 0;
  return Math.max(due, snz);
}

// Onglet effectif d'une action, à un instant donné.
export function bucketOf(a: CommercialAction, now = Date.now()): ActionBucket {
  if (a.status === "terminee") return "terminee";
  if (a.status === "reportee" && a.snoozedUntil && new Date(a.snoozedUntil).getTime() > now) return "reportee";
  return effectiveDue(a) < now ? "en_retard" : "a_faire";
}

// Priorité (dérivée). urgentAfterHours : seuil au-delà duquel un retard devient urgent.
export function priorityOf(a: CommercialAction, urgentAfterHours = 48, now = Date.now()): ActionPriority {
  if (a.status === "terminee") return "normale";
  const overdueMs = now - effectiveDue(a);
  if (overdueMs < 0) return "normale";
  return overdueMs >= urgentAfterHours * 3_600_000 ? "urgent" : "retard";
}

// Compteur « à traiter » (badge nav / Ma journée) = actions actives dont
// l'échéance est atteinte (à faire maintenant ou en retard).
export function isActionable(a: Pick<CommercialAction, "dueAt" | "snoozedUntil" | "status">, now = Date.now()): boolean {
  if (a.status === "terminee") return false;
  if (a.status === "reportee" && a.snoozedUntil && new Date(a.snoozedUntil).getTime() > now) return false;
  return effectiveDue(a) <= now;
}

// « il y a 12 min », « dans 2 h », « en retard de 3 h »… (relatif, FR).
export function relativeFr(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now; // >0 futur
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  let qty: string;
  if (mins < 60) qty = `${Math.max(1, mins)} min`;
  else if (hours < 24) qty = `${hours} h`;
  else qty = `${days} j`;
  if (diff >= 0) return mins < 1 ? "maintenant" : `dans ${qty}`;
  return `il y a ${qty}`;
}
