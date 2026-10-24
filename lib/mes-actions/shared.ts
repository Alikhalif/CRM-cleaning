// Logique PURE du module « Mes actions » — aucune I/O, importable côté client.
//
// Le module réunit DEUX sources sans jamais les dupliquer :
//   • `commercial_actions` — ce que le moteur de relances a matérialisé à
//     partir du Suivi commercial. Lecture seule depuis ici.
//   • `commercial_tasks`   — ce que le commercial a saisi à la main.
//
// Une tâche n'existe que dans l'une des deux. `Item` est la forme commune
// qu'elles prennent à l'affichage ; `source` dit toujours d'où elle vient,
// ce qui permet d'adresser la bonne table au moment d'agir.

import {
  effectiveDue, priorityOf, TYPE_LABEL, TYPE_VERB,
  type ActionPriority, type CommercialAction,
} from "@/lib/commercial-actions/shared";

export type Source = "moteur" | "manuelle";

/** Niveaux de priorité d'une tâche saisie à la main (§8). */
export type Priorite = "normale" | "importante" | "urgente";

export const PRIORITE_LABEL: Record<Priorite, string> = {
  normale: "Normale",
  importante: "Importante",
  urgente: "Urgente",
};

/** Types proposés à la création manuelle (§8). */
export const TYPES_MANUELS = [
  { value: "appel", label: "Appel téléphonique", telephone: true },
  { value: "rappel", label: "Rappel client", telephone: true },
  { value: "relance", label: "Relance commerciale", telephone: true },
  { value: "documents", label: "Envoi de documents", telephone: false },
  { value: "photos", label: "Demande de photos", telephone: false },
  { value: "verification", label: "Vérification d'informations", telephone: false },
  { value: "rdv_tel", label: "Rendez-vous téléphonique", telephone: true },
  { value: "admin", label: "Tâche administrative", telephone: false },
  { value: "autre", label: "Autre action", telephone: false },
] as const;

export const TYPE_MANUEL_LABEL: Record<string, string> =
  Object.fromEntries(TYPES_MANUELS.map((t) => [t.value, t.label]));

/** Les types qui se règlent au téléphone — décide du bouton « Appeler ». */
const TYPES_TELEPHONE = new Set<string>([
  ...TYPES_MANUELS.filter((t) => t.telephone).map((t) => t.value),
  // Côté moteur : une prise en charge et une relance se font par téléphone.
  "prise_en_charge", "relance",
]);

export type Item = {
  id: string;
  source: Source;
  /** Dossier lié, s'il existe. Une tâche d'organisation n'en a pas (§15). */
  leadId: string | null;
  leadRef: string | null;
  clientName: string | null;
  /** Activité du dossier, pour la lecture en liste. */
  activite: string | null;
  ownerId: string | null;
  ownerName: string | null;
  type: string;
  typeLabel: string;
  title: string;
  description: string | null;
  /** Échéance effective : report compris. */
  dueAt: string;
  /** false = « dans la journée », sans heure précise. */
  hasTime: boolean;
  priorite: Priorite;
  termine: boolean;
  closedAt: string | null;
  result: string | null;
  reportCount: number;
  /** Téléphone du client, pour le bouton « Appeler ». */
  phone: string | null;
};

// ── Catégories (§6) ────────────────────────────────────────────────────
// Une tâche n'apparaît QU'UNE fois dans la liste, dans sa catégorie la plus
// prioritaire. L'ordre de ce tableau EST l'ordre d'affichage.
export type Categorie = "en_retard" | "urgente" | "maintenant" | "aujourdhui" | "a_venir" | "terminee";

export const CATEGORIE_LABEL: Record<Categorie, string> = {
  en_retard: "En retard",
  urgente: "Urgentes",
  maintenant: "À faire maintenant",
  aujourdhui: "Aujourd'hui",
  a_venir: "À venir",
  terminee: "Terminées",
};

export const ORDRE_CATEGORIES: Categorie[] = [
  "en_retard", "urgente", "maintenant", "aujourdhui", "a_venir",
];

/** Bornes du jour en heure de Paris, à partir d'un instant quelconque. */
export function bornesDuJour(now: number): { debut: number; fin: number } {
  const f = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const jour = f.format(new Date(now)); // AAAA-MM-JJ
  // Décalage de Paris déduit, jamais codé en dur : il change deux fois par an.
  const sonde = new Date(`${jour}T12:00:00Z`).getTime();
  const vuDeParis = new Date(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date(sonde)).replace(" ", "T") + "Z",
  ).getTime();
  const decalage = vuDeParis - sonde;
  const debut = new Date(`${jour}T00:00:00Z`).getTime() - decalage;
  return { debut, fin: debut + 86_400_000 - 1 };
}

/**
 * Une tâche est-elle en retard ?
 *
 * Sans heure précise, elle ne l'est qu'APRÈS la fin de son jour d'échéance
 * (§6) : afficher « en retard » dès 8 h du matin pour une tâche prévue
 * « aujourd'hui » serait faux et décourageant.
 */
export function estEnRetard(it: Item, now: number): boolean {
  if (it.termine) return false;
  const due = new Date(it.dueAt).getTime();
  if (!Number.isFinite(due)) return false;
  if (it.hasTime) return due < now;
  return bornesDuJour(due).fin < now;
}

export function categorieDe(it: Item, now: number): Categorie {
  if (it.termine) return "terminee";
  if (estEnRetard(it, now)) return "en_retard";
  if (it.priorite === "urgente") return "urgente";

  const due = new Date(it.dueAt).getTime();
  const { debut, fin } = bornesDuJour(now);
  if (!Number.isFinite(due)) return "a_venir";
  // L'heure est arrivée mais l'échéance n'est pas encore dépassée.
  if (it.hasTime && due <= now) return "maintenant";
  if (due >= debut && due <= fin) return "aujourdhui";
  return due < debut ? "en_retard" : "a_venir";
}

/** Appels et rappels téléphoniques restant à passer (§4). */
export function estAppel(it: Item): boolean {
  return TYPES_TELEPHONE.has(it.type) && !!it.phone;
}

/**
 * Classement de la liste centrale.
 *
 * Catégorie d'abord — c'est la hiérarchie demandée au §6 — puis échéance
 * croissante : à importance égale, le plus pressé passe devant. Départage
 * par identifiant pour que la liste ne se réorganise pas d'un rendu à
 * l'autre.
 */
export function comparerItems(a: Item, b: Item, now: number): number {
  const ra = ORDRE_CATEGORIES.indexOf(categorieDe(a, now));
  const rb = ORDRE_CATEGORIES.indexOf(categorieDe(b, now));
  if (ra !== rb) return ra - rb;
  const da = new Date(a.dueAt).getTime();
  const db = new Date(b.dueAt).getTime();
  const va = Number.isFinite(da) ? da : Number.POSITIVE_INFINITY;
  const vb = Number.isFinite(db) ? db : Number.POSITIVE_INFINITY;
  if (va !== vb) return va - vb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ── Les six compteurs du bandeau (§4) ──────────────────────────────────
//
// ⚠️ Ils se CHEVAUCHENT volontairement : un rappel urgent prévu aujourd'hui
// compte dans « urgentes », « aujourd'hui » ET « appels ». Les additionner
// n'a donc aucun sens, et l'interface ne le fait nulle part.
export type Compteurs = {
  en_retard: number;
  urgentes: number;
  aujourdhui: number;
  appels: number;
  a_venir: number;
  terminees: number;
};

export type CleCompteur = keyof Compteurs;

export function compteurs(items: Item[], now: number): Compteurs {
  const { debut, fin } = bornesDuJour(now);
  const actifs = items.filter((i) => !i.termine);
  const dans = (i: Item) => {
    const d = new Date(i.dueAt).getTime();
    return Number.isFinite(d) && d >= debut && d <= fin;
  };
  return {
    en_retard: actifs.filter((i) => estEnRetard(i, now)).length,
    urgentes: actifs.filter((i) => i.priorite === "urgente").length,
    aujourdhui: actifs.filter((i) => dans(i)).length,
    appels: actifs.filter(estAppel).length,
    // « À venir » = après aujourd'hui. Volontairement disjoint d'« aujourd'hui ».
    a_venir: actifs.filter((i) => {
      const d = new Date(i.dueAt).getTime();
      return Number.isFinite(d) && d > fin;
    }).length,
    // Terminées AUJOURD'HUI seulement : c'est une mesure de la journée.
    terminees: items.filter((i) => {
      if (!i.termine || !i.closedAt) return false;
      const c = new Date(i.closedAt).getTime();
      return Number.isFinite(c) && c >= debut && c <= fin;
    }).length,
  };
}

/** Le filtre retenu garde-t-il cette tâche ? */
export function passeFiltre(it: Item, cle: CleCompteur | "toutes", now: number): boolean {
  const { debut, fin } = bornesDuJour(now);
  const d = new Date(it.dueAt).getTime();
  switch (cle) {
    case "toutes": return !it.termine;
    case "en_retard": return !it.termine && estEnRetard(it, now);
    case "urgentes": return !it.termine && it.priorite === "urgente";
    case "aujourdhui": return !it.termine && Number.isFinite(d) && d >= debut && d <= fin;
    case "appels": return !it.termine && estAppel(it);
    case "a_venir": return !it.termine && Number.isFinite(d) && d > fin;
    case "terminees": {
      if (!it.termine || !it.closedAt) return false;
      const c = new Date(it.closedAt).getTime();
      return Number.isFinite(c) && c >= debut && c <= fin;
    }
  }
}

/** Recherche libre : client, type, activité, date (§14). */
export function passeRecherche(it: Item, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(it.dueAt));
  const foin = [
    it.clientName, it.leadRef, it.typeLabel, it.activite, it.title, it.description, date,
  ].filter(Boolean).join(" ").toLowerCase();
  return foin.includes(t);
}

/**
 * Progression du jour (§13).
 *
 * Dénominateur : les tâches dont l'échéance tombe aujourd'hui, plus celles
 * terminées aujourd'hui quelle qu'ait été leur échéance — sans quoi solder
 * un retard de la veille ferait DESCENDRE la barre. Une tâche reportée à
 * demain sort des deux, elle n'est ni due ni faite.
 */
export function progression(items: Item[], now: number): { faites: number; total: number; pct: number } {
  const { debut, fin } = bornesDuJour(now);
  const vues = new Set<string>();
  let faites = 0, total = 0;
  for (const it of items) {
    const cle = `${it.source}:${it.id}`;
    if (vues.has(cle)) continue;
    const c = it.closedAt ? new Date(it.closedAt).getTime() : NaN;
    const termineeAujourdhui = it.termine && Number.isFinite(c) && c >= debut && c <= fin;
    const d = new Date(it.dueAt).getTime();
    const dueAujourdhui = !it.termine && Number.isFinite(d) && d <= fin;
    if (!termineeAujourdhui && !dueAujourdhui) continue;
    vues.add(cle);
    total += 1;
    if (termineeAujourdhui) faites += 1;
  }
  return { faites, total, pct: total > 0 ? Math.round((faites / total) * 100) : 0 };
}

// ── Conversion depuis le moteur de relances ────────────────────────────
//
// LECTURE SEULE. On ne modifie jamais `commercial_actions` depuis ici : on
// la traduit dans la forme commune.
export function depuisAction(
  a: CommercialAction,
  urgentAfterHours: number,
  now: number,
  extra: { activite: string | null; phone: string | null },
): Item {
  const p: ActionPriority = priorityOf(a, urgentAfterHours, now);
  return {
    id: a.id,
    source: "moteur",
    leadId: a.leadId,
    leadRef: a.leadRef,
    clientName: a.leadName,
    activite: extra.activite,
    ownerId: a.ownerId,
    ownerName: a.ownerName,
    type: a.type,
    typeLabel: TYPE_LABEL[a.type] ?? a.type,
    title: a.title || TYPE_VERB[a.type] || a.type,
    description: a.reason,
    // L'échéance effective tient compte du report : c'est elle qui classe.
    dueAt: new Date(effectiveDue(a)).toISOString(),
    // Le moteur pose toujours une heure précise.
    hasTime: true,
    priorite: p === "urgent" ? "urgente" : "normale",
    termine: a.status === "terminee",
    closedAt: a.closedAt,
    result: a.result,
    reportCount: a.reportCount,
    phone: extra.phone,
  };
}
