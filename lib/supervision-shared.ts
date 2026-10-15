// Agrégation de la supervision — PURE, aucune I/O. Le serveur fournit les
// faits par dossier, ce module en tire les indicateurs, les blocs et les
// alertes. Une seule implémentation, utilisée au premier rendu comme à chaque
// changement de filtre : les chiffres ne peuvent pas diverger.

export type Periode = "today" | "yesterday" | "7d" | "30d" | "mtd";

export const PERIODE_LABEL: Record<Periode, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  mtd: "Mois en cours",
};

export const PERIODES: Periode[] = ["today", "yesterday", "7d", "30d", "mtd"];

// Un fait par dossier, déjà restreint au périmètre autorisé et à la période.
export type SupRow = {
  leadId: string;
  ownerId: string | null;
  ownerName: string;
  country: string | null;
  countryLabel: string;
  devise: string;
  activityId: string | null;
  activityLabel: string;
  // Reçu dans la période.
  recu: boolean;
  traite: boolean;
  decouverte: boolean;
  devisEnvoye: boolean;
  signe: boolean;
  montantSigne: number;
  enRetard: number;
  // Délai de première prise en charge, en minutes. null = non mesurable.
  delaiPriseEnChargeMin: number | null;
  // Découverte terminée mais aucun devis parti — sert à l'alerte dédiée.
  decouverteSansDevis: boolean;
};

export type Filtres = { pays: string; activite: string; commercial: string };

export const FILTRES_VIDES: Filtres = { pays: "", activite: "", commercial: "" };

export function appliquerFiltres(rows: SupRow[], f: Filtres): SupRow[] {
  return rows.filter(
    (r) =>
      (!f.pays || r.country === f.pays) &&
      (!f.activite || r.activityId === f.activite) &&
      (!f.commercial || r.ownerId === f.commercial),
  );
}

export type Kpi = {
  leads: number;
  traites: number;
  enAttente: number;
  decouvertes: number;
  devisEnvoyes: number;
  signes: number;
  caSigne: number;
  // null quand la donnée ne permet pas un calcul honnête.
  tauxConversion: number | null;
  reactiviteMin: number | null;
  // null si le périmètre mélange plusieurs devises : on n'additionne jamais
  // des euros et des francs suisses sans taux daté.
  devise: string | null;
};

export function calculerKpi(rows: SupRow[]): Kpi {
  const recus = rows.filter((r) => r.recu);
  const traites = recus.filter((r) => r.traite).length;
  const envoyes = rows.filter((r) => r.devisEnvoye).length;
  const signes = rows.filter((r) => r.signe);

  const devises = new Set(rows.map((r) => r.devise));
  const devise = devises.size <= 1 ? ([...devises][0] ?? "EUR") : null;
  // Devises mélangées → on ne totalise que la part en euros, et l'interface
  // renvoie vers le détail par pays.
  const caSigne = signes
    .filter((r) => devise !== null || r.devise === "EUR")
    .reduce((s, r) => s + r.montantSigne, 0);

  const delais = rows.map((r) => r.delaiPriseEnChargeMin).filter((d): d is number => d != null);

  return {
    leads: recus.length,
    traites,
    enAttente: recus.length - traites,
    decouvertes: rows.filter((r) => r.decouverte).length,
    devisEnvoyes: envoyes,
    signes: signes.length,
    caSigne,
    // Signés / envoyés : le seul rapport dont les deux termes sont vérifiables
    // sur la période. Sans devis envoyé, le taux n'a pas de sens — null.
    tauxConversion: envoyes > 0 ? Math.round((signes.length / envoyes) * 1000) / 10 : null,
    reactiviteMin: delais.length ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null,
    devise,
  };
}

export type Bloc = {
  key: string;
  label: string;
  devise: string;
  leads: number;
  traites: number;
  decouvertes: number;
  devisEnvoyes: number;
  signes: number;
  caSigne: number;
  enRetard: number;
  tauxConversion: number | null;
};

function agrege(
  rows: SupRow[],
  cle: (r: SupRow) => string | null,
  label: (r: SupRow) => string,
  devise: (r: SupRow) => string,
): Bloc[] {
  const map = new Map<string, Bloc>();
  for (const r of rows) {
    const k = cle(r);
    if (!k) continue;
    let b = map.get(k);
    if (!b) {
      b = { key: k, label: label(r), devise: devise(r), leads: 0, traites: 0, decouvertes: 0, devisEnvoyes: 0, signes: 0, caSigne: 0, enRetard: 0, tauxConversion: null };
      map.set(k, b);
    }
    if (r.recu) {
      b.leads += 1;
      if (r.traite) b.traites += 1;
    }
    if (r.decouverte) b.decouvertes += 1;
    if (r.devisEnvoye) b.devisEnvoyes += 1;
    if (r.signe) { b.signes += 1; b.caSigne += r.montantSigne; }
    b.enRetard += r.enRetard;
  }
  for (const b of map.values()) {
    b.tauxConversion = b.devisEnvoyes > 0 ? Math.round((b.signes / b.devisEnvoyes) * 1000) / 10 : null;
  }
  return [...map.values()].sort((a, b) => b.leads - a.leads || b.signes - a.signes);
}

export const parCommercial = (rows: SupRow[]) =>
  agrege(rows, (r) => r.ownerId, (r) => r.ownerName, () => "EUR");
export const parPays = (rows: SupRow[]) =>
  agrege(rows, (r) => r.country, (r) => r.countryLabel, (r) => r.devise);
export const parActivite = (rows: SupRow[]) =>
  agrege(rows, (r) => r.activityId, (r) => r.activityLabel, () => "EUR");

// Situation d'un commercial — déduite de FAITS (retards, dossiers non traités),
// jamais d'une absence de connexion : un commercial en repos n'est pas en faute.
export type Statut = "normal" | "attention" | "urgent";

export function statutDe(b: Bloc): Statut {
  const nonTraites = b.leads - b.traites;
  if (b.enRetard >= 5 || nonTraites >= 5) return "urgent";
  if (b.enRetard >= 2 || nonTraites >= 2) return "attention";
  return "normal";
}

export type Alerte = {
  key: string;
  priorite: 1 | 2 | 3;
  titre: string;
  detail: string;
  href?: string;
};

// Uniquement les anomalies. Pas de notification pour ce qui va bien.
export function calculerAlertes(rows: SupRow[]): Alerte[] {
  const out: Alerte[] = [];
  const kpi = calculerKpi(rows);
  const pluriel = (n: number) => (n > 1 ? "s" : "");

  if (kpi.enAttente > 0) {
    out.push({
      key: "non_traites", priorite: 1,
      titre: `${kpi.enAttente} lead${pluriel(kpi.enAttente)} en attente de prise en charge`,
      detail: "Reçus sur la période, aucune trace de traitement.",
    });
  }

  const retards = rows.reduce((s, r) => s + r.enRetard, 0);
  if (retards > 0) {
    out.push({
      key: "retards", priorite: 1,
      titre: `${retards} action${pluriel(retards)} commerciale${pluriel(retards)} en retard`,
      detail: "Échéance dépassée dans le moteur d'actions.",
      href: "/ma-journee",
    });
  }

  const sansDevis = rows.filter((r) => r.decouverteSansDevis).length;
  if (sansDevis > 0) {
    out.push({
      key: "sans_devis", priorite: 2,
      titre: `${sansDevis} découverte${pluriel(sansDevis)} terminée${pluriel(sansDevis)} sans devis`,
      detail: "Le dossier est prêt à être chiffré, rien n'est parti.",
    });
  }

  for (const b of parCommercial(rows)) {
    if (statutDe(b) !== "urgent") continue;
    const nonTraites = b.leads - b.traites;
    out.push({
      key: `com_${b.key}`, priorite: 2,
      titre: `${b.label} — ${b.enRetard} retard${pluriel(b.enRetard)}, ${nonTraites} non traité${pluriel(nonTraites)}`,
      detail: "Situation à regarder de près.",
    });
  }

  return out.sort((a, b) => a.priorite - b.priorite);
}

export const money = (n: number, devise: string) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: devise, maximumFractionDigits: 0 });
