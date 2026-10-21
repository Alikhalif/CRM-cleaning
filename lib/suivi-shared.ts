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
  | "devis_preparation"
  | "devis_envoye"
  | "devis_ouvert"
  | "signe"
  | "perdu";

export const SITUATION_LABEL: Record<Situation, string> = {
  nouveau: "Nouveau prospect",
  decouverte_encours: "Découverte en cours",
  decouverte_faite: "Découverte terminée",
  attente_client: "En attente client",
  devis_preparation: "Devis en préparation",
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
  devis_preparation: "Finaliser et envoyer le devis",
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
    case "decouverte_faite":
    case "devis_preparation": return "devis";
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
  // Dernière action enregistrée sur le dossier — demandée sur la carte du
  // Suivi : le commercial doit savoir ce qu'il a déjà fait avant de décider
  // de la suite.
  lastActionLabel: string;
  lastActionAt: string;
  // Date d'envoi du devis, et date de signature. Affichées dans les cases
  // correspondantes du Pipeline.
  devisSentAt: string | null;
  signedAt: string | null;
  isUrgent: boolean;
  // NRP = « ne répond pas ». Conservé depuis l'ancienne interface : c'est le
  // CAS 7 du moteur (client injoignable).
  isNrp: boolean;
  societe: string | null;
  // Pays du dossier. Sert au filtre visuel ; le cloisonnement, lui, est déjà
  // appliqué côté serveur dans getAllLeads.
  country: string | null;
  receivedAt: string;
  // Date de CRÉATION de la ligne, et clé du classement chronologique :
  // la découverte si elle existe, l'arrivée du dossier sinon. Rouvrir une
  // vieille découverte ne la change pas (déclencheur en base).
  creeLe: string;
  // Dernière modification de la découverte. Affichée, jamais utilisée pour
  // trier — sans quoi un simple coup d'œil remonterait le dossier en tête.
  modifieLe: string | null;
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
    case "devis": return ["decouverte_faite", "devis_preparation", "devis_envoye", "devis_ouvert"].includes(row.situation);
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

// ── Horodatage (Europe/Paris) ───────────────────────────────────────────
// Le fuseau est FIXÉ, jamais celui de la machine : le serveur tourne en UTC
// alors que le commercial est à Paris. Sans ce paramètre, le HTML rendu côté
// serveur affiche une heure et l'hydratation une autre — et, à 1 h du matin,
// un dossier « aujourd'hui » basculerait à « demain ».
const F_HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
});
const F_JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit", month: "2-digit", timeZone: "Europe/Paris",
});
const F_COMPLET = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris",
});
// « 2026-10-18 » — clé de comparaison de jour, à Paris.
const F_CLE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

function sameDay(a: Date, b: Date): boolean {
  return F_CLE.format(a) === F_CLE.format(b);
}

/** « 14:32 » le jour même, « hier 14:32 », sinon « 18/10 14:32 ». */
export function momentCourt(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  if (sameDay(d, new Date(now))) return F_HEURE.format(d);
  if (sameDay(d, new Date(now - 86_400_000))) return `hier ${F_HEURE.format(d)}`;
  return `${F_JOUR.format(d)} ${F_HEURE.format(d)}`;
}

/** « samedi 18 octobre 2026 à 14:32 » — pour une infobulle ou un export. */
export function momentComplet(iso: string): string {
  return F_COMPLET.format(new Date(iso));
}

// ── Classement chronologique (demande client du 2026-10-21) ────────────

/**
 * Ordre par défaut du Suivi : du plus récent au plus ancien.
 *
 * La clé est la date de CRÉATION, jamais celle de modification — rouvrir un
 * vieux dossier ne doit pas le propulser en tête de liste. Le déclencheur
 * `leads_discovery_timestamps` garantit cette immuabilité côté base.
 *
 * Le critère secondaire est l'identifiant : deux dossiers créés dans la même
 * seconde (import, double saisie) sortent toujours dans le même ordre, si
 * bien que la liste ne se réorganise pas d'un affichage à l'autre.
 */
export function compareChronologique(a: SuiviRow, b: SuiviRow): number {
  const ta = new Date(a.creeLe).getTime();
  const tb = new Date(b.creeLe).getTime();
  // Une date illisible part en fin de liste plutôt que de désordonner le reste.
  const va = Number.isFinite(ta) ? ta : Number.NEGATIVE_INFINITY;
  const vb = Number.isFinite(tb) ? tb : Number.NEGATIVE_INFINITY;
  if (va !== vb) return vb - va;
  return a.leadId < b.leadId ? -1 : a.leadId > b.leadId ? 1 : 0;
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
  if (row.situation === "decouverte_faite" || row.situation === "devis_preparation") return 4;
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
  // À rang ET échéance égaux, on retombe sur la règle générale : le plus
  // récent d'abord. Le rang et l'échéance restent prioritaires — c'est tout
  // l'objet de cette vue.
  return compareChronologique(a, b);
}

// ── Échéance lisible ────────────────────────────────────────────────────
export function dueLabel(row: SuiviRow, now = Date.now()): string {
  if (!row.dueAt) return "—";
  const d = new Date(row.dueAt);
  // L'HEURE compte autant que le jour : « à relancer aujourd'hui » n'oriente
  // pas une journée, « aujourd'hui 16:00 » si.
  const h = F_HEURE.format(d);
  if (row.overdue) return `En retard · ${momentCourt(row.dueAt, now)}`;
  const today = new Date(now);
  if (sameDay(d, today)) return `Aujourd'hui ${h}`;
  const tomorrow = new Date(now + 86_400_000);
  if (sameDay(d, tomorrow)) return `Demain ${h}`;
  return `${F_JOUR.format(d)} ${h}`;
}

// ── Filtre par période (calendrier du Suivi commercial) ─────────────────
//
// Les bornes sont calculées dans le fuseau Europe/Paris, comme tout le reste
// du module : « aujourd'hui » doit vouloir dire la journée du commercial, pas
// celle du serveur.

export type PeriodePreset =
  | "tout" | "aujourdhui" | "hier" | "semaine" | "7j" | "mois" | "30j" | "perso";

export const PERIODE_PRESETS: PeriodePreset[] = [
  "tout", "aujourdhui", "hier", "semaine", "7j", "mois", "30j", "perso",
];

export const PERIODE_PRESET_LABEL: Record<PeriodePreset, string> = {
  tout: "Toutes les dates",
  aujourdhui: "Aujourd'hui",
  hier: "Hier",
  semaine: "Cette semaine",
  "7j": "7 derniers jours",
  mois: "Ce mois-ci",
  "30j": "30 derniers jours",
  perso: "Période personnalisée",
};

/** Sur quelle date porte le filtre. */
export type TypeDate = "creation" | "action";

export const TYPE_DATE_LABEL: Record<TypeDate, string> = {
  creation: "Date de création",
  action: "Dernière action",
};

export type Bornes = { debut: number; fin: number } | null;

/** « 2026-10-21 » dans le fuseau de travail. */
function jourParis(d: Date): string {
  return F_CLE.format(d);
}

/** Minuit (début) et 23:59:59,999 (fin) d'un jour « AAAA-MM-JJ », à Paris. */
function bornesDuJour(cle: string): { debut: number; fin: number } {
  // L'offset de Paris varie (heure d'été). On le déduit en comparant la date
  // formatée à Paris et la même date en UTC, plutôt que de le coder en dur.
  const minuitUtc = Date.parse(`${cle}T00:00:00Z`);
  const sonde = new Date(minuitUtc);
  const heureParis = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Paris" })
      .format(sonde),
  );
  // Si à minuit UTC il est 2 h à Paris, Paris est en avance de 2 h : minuit
  // parisien tombe 2 h plus tôt en temps absolu.
  const offsetMs = (heureParis % 24) * 3_600_000;
  const debut = minuitUtc - offsetMs;
  return { debut, fin: debut + 86_400_000 - 1 };
}

/**
 * Bornes absolues d'un preset. `null` = aucune restriction de date.
 * `debutPerso` / `finPerso` sont des « AAAA-MM-JJ » (champs date HTML).
 */
export function bornesPeriode(
  preset: PeriodePreset,
  now = Date.now(),
  debutPerso?: string,
  finPerso?: string,
): Bornes {
  const aujourdhui = jourParis(new Date(now));
  const jourDecale = (n: number) => jourParis(new Date(now + n * 86_400_000));

  switch (preset) {
    case "tout":
      return null;
    case "aujourdhui":
      return bornesDuJour(aujourdhui);
    case "hier":
      return bornesDuJour(jourDecale(-1));
    case "semaine": {
      // Semaine ISO : du lundi au dimanche. getDay() 0 = dimanche.
      const d = new Date(`${aujourdhui}T12:00:00Z`);
      const jour = (d.getUTCDay() + 6) % 7; // 0 = lundi
      const lundi = jourParis(new Date(now - jour * 86_400_000));
      return { debut: bornesDuJour(lundi).debut, fin: bornesDuJour(aujourdhui).fin };
    }
    case "7j":
      return { debut: bornesDuJour(jourDecale(-6)).debut, fin: bornesDuJour(aujourdhui).fin };
    case "mois": {
      const premier = `${aujourdhui.slice(0, 7)}-01`;
      return { debut: bornesDuJour(premier).debut, fin: bornesDuJour(aujourdhui).fin };
    }
    case "30j":
      return { debut: bornesDuJour(jourDecale(-29)).debut, fin: bornesDuJour(aujourdhui).fin };
    case "perso": {
      // Une seule borne suffit : « depuis le… » ou « jusqu'au… » sont des
      // demandes légitimes.
      if (!debutPerso && !finPerso) return null;
      const debut = debutPerso ? bornesDuJour(debutPerso).debut : Number.NEGATIVE_INFINITY;
      const fin = finPerso ? bornesDuJour(finPerso).fin : Number.POSITIVE_INFINITY;
      // Bornes inversées par mégarde : on les remet dans l'ordre plutôt que de
      // ne rien renvoyer.
      return debut <= fin ? { debut, fin } : { debut: fin, fin: debut };
    }
  }
}

/** La ligne tombe-t-elle dans la période, selon la date choisie ? */
export function dansPeriode(row: SuiviRow, bornes: Bornes, type: TypeDate): boolean {
  if (!bornes) return true;
  const iso = type === "creation" ? row.creeLe : row.lastActionAt;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= bornes.debut && t <= bornes.fin;
}

/** « Du 01/10/2026 au 21/10/2026 » — libellé de la période active. */
export function libellePeriode(bornes: Bornes): string {
  if (!bornes) return "";
  const f = (ms: number) =>
    Number.isFinite(ms)
      ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(ms))
      : null;
  const d = f(bornes.debut);
  const fn = f(bornes.fin);
  if (d && fn) return d === fn ? `Le ${d}` : `Du ${d} au ${fn}`;
  if (d) return `Depuis le ${d}`;
  if (fn) return `Jusqu'au ${fn}`;
  return "";
}

// ── Alerte prioritaire d'une ligne ──────────────────────────────────────
export function alertFor(row: Omit<SuiviRow, "alert">): AlertKind {
  if (row.situation === "signe") return "signe";
  if (row.situation === "perdu") return null;
  if (row.overdue) return "retard";
  if (row.situation === "attente_client") return "photos";
  if (row.situation === "devis_envoye" || row.situation === "devis_ouvert") return "relance";
  if (row.situation === "devis_preparation") return "decouverte";
  if (row.situation === "decouverte_encours") return "decouverte";
  return null;
}

// Libellé de la prochaine action : le moteur prime, sinon la suggestion.
export function nextActionLabel(situation: Situation, action: CommercialAction | null): string {
  if (!action) return SUGGESTED_ACTION[situation];
  return action.title || SUGGESTED_ACTION[situation];
}


// ── Étapes commerciales (Suivi commercial) ──────────────────────────────
// Ordre de parcours d'un dossier, de l'arrivée à la signature. Sert à GROUPER
// les cartes : le commercial lit son travail par étape, pas par colonne de
// tableau.
export const ETAPES: Situation[] = [
  "nouveau",
  "decouverte_encours",
  "attente_client",
  "decouverte_faite",
  "devis_preparation",
  "devis_envoye",
  "devis_ouvert",
  "signe",
  "perdu",
];

// Trois couleurs seulement (consigne client) : rouge = nouveau non traité,
// bleu = dossier en cours, vert = signé, gris = clos. Les étapes se
// distinguent par leur LIBELLÉ, pas par une quatrième teinte.
export type Tone = "rouge" | "bleu" | "vert" | "gris";

export const SITUATION_TONE: Record<Situation, Tone> = {
  nouveau: "rouge",
  decouverte_encours: "bleu",
  attente_client: "bleu",
  decouverte_faite: "bleu",
  devis_preparation: "bleu",
  devis_envoye: "bleu",
  devis_ouvert: "bleu",
  signe: "vert",
  perdu: "gris",
};

// ── Trois catégories du Suivi commercial ────────────────────────────────
//
// Le commercial lit d'abord « où en sont mes dossiers », pas le détail des
// neuf étapes. Un dossier appartient à UNE seule catégorie principale ; son
// étape précise reste affichée en sous-titre, rien n'est perdu.
//
// Attention : « terminé » qualifie le travail COMMERCIAL. Un devis signé est
// commercialement terminé alors que l'intervention n'a pas commencé — les deux
// processus ne doivent pas être confondus.
export type Categorie = "nouveaux" | "en_cours" | "termines";

export const CATEGORIES: Categorie[] = ["nouveaux", "en_cours", "termines"];

export const CATEGORIE_LABEL: Record<Categorie, string> = {
  nouveaux: "Nouveaux prospects",
  en_cours: "En cours",
  termines: "Terminés",
};

export const CATEGORIE_AIDE: Record<Categorie, string> = {
  nouveaux: "Entrants pas encore traités",
  en_cours: "De la découverte à la signature",
  termines: "Travail commercial achevé — l'intervention, elle, reste à faire",
};

export const CATEGORIE_TONE: Record<Categorie, Tone> = {
  nouveaux: "rouge",
  en_cours: "bleu",
  termines: "vert",
};

export function categorieDe(situation: Situation): Categorie {
  switch (situation) {
    case "nouveau":
      return "nouveaux";
    case "signe":
    case "perdu":
      return "termines";
    default:
      return "en_cours";
  }
}

// ── Catégories du Pipeline ──────────────────────────────────────────────
// Le Pipeline ne montre que QUATRE cases : c'est une vue de lecture rapide,
// pas un second outil de gestion. Plusieurs étapes du Suivi y sont regroupées.
export type PipelineCat = "nouveaux" | "decouverte" | "devis_envoyes" | "signes";

export const PIPELINE_CAT_LABEL: Record<PipelineCat, string> = {
  nouveaux: "Nouveaux",
  decouverte: "Découverte",
  devis_envoyes: "Devis envoyés",
  signes: "Signés",
};

export const PIPELINE_CATS: PipelineCat[] = ["nouveaux", "decouverte", "devis_envoyes", "signes"];

export const PIPELINE_CAT_TONE: Record<PipelineCat, Tone> = {
  nouveaux: "rouge",
  decouverte: "bleu",
  devis_envoyes: "bleu",
  signes: "vert",
};

// Un dossier perdu n'appartient à aucune des quatre cases : il sort du
// Pipeline, qui ne montre que ce qui avance.
export function pipelineCatOf(situation: Situation): PipelineCat | null {
  switch (situation) {
    case "nouveau": return "nouveaux";
    case "decouverte_encours":
    case "attente_client":
    case "decouverte_faite":
    case "devis_preparation": return "decouverte";
    case "devis_envoye":
    case "devis_ouvert": return "devis_envoyes";
    case "signe": return "signes";
    case "perdu": return null;
  }
}
