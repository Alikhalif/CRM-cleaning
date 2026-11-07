import "server-only";

// Garde contre la création involontaire d'un second devis — Lot A, 2026-11-07.
//
// ── LE DÉFAUT CORRIGÉ ───────────────────────────────────────────────
//
// Deux parcours créent des devis, et aucun ne savait ce que l'autre avait
// déjà produit :
//
//   • `genererDevisDepuisDecouverte` (table `documents`) était idempotent
//     SUR SA PROPRE TABLE : un second clic renvoie le brouillon existant.
//     Mais il ignorait `devis_optimivv`.
//   • `/api/devis` en mode « final » (table `devis_optimivv`) n'avait AUCUN
//     contrôle : chaque appel allouait un numéro et archivait un PDF. Un
//     double-clic produisait deux devis numérotés sur la même affaire, et
//     consommait deux numéros d'une séquence sans trou.
//
// ── CE QUE CETTE GARDE FAIT, ET CE QU'ELLE NE FAIT PAS ──────────────
//
// Elle REFUSE une création quand un devis existe déjà pour ce dossier et que
// l'appelant n'a pas dit explicitement qu'il en voulait un second.
//
// Elle N'INTERDIT PAS un devis rectificatif ni une nouvelle version : un
// `confirmerNouveau: true` passe outre. C'est une exigence du client — « elle
// ne doit pas empêcher la création volontaire ». La garde distingue donc
// l'involontaire du voulu, elle ne décide pas à la place du commercial.
//
// Elle NE SUPPRIME ET N'ÉCRASE JAMAIS RIEN. Un devis existant est nommé dans
// le refus, pas remplacé.
//
// ── POURQUOI PAS UNE FENÊTRE DE TEMPS ───────────────────────────────
//
// On pourrait ne refuser qu'un second devis créé dans les minutes qui
// suivent, en supposant qu'au-delà c'est délibéré. C'est une supposition de
// trop : un commercial qui rouvre un dossier trois jours plus tard et ne se
// souvient pas d'avoir déjà émis un devis commet la même erreur, en plus
// coûteuse. Le refus nomme le document existant — l'information est utile
// quel que soit le délai, et le `confirmerNouveau` lève l'obstacle en un
// geste.

import { supabaseServer } from "@/lib/supabase/server";

/** D'où vient un devis déjà présent sur le dossier. */
export type OrigineDevis = "documents" | "devis_optimivv";

export type DevisExistant = {
  origine: OrigineDevis;
  id: string;
  /** Numéro affiché au client. */
  numero: string;
  /** `brouillon`, `envoye`, `signe`… ; `emis` pour le parcours OPTIMIVV. */
  statut: string;
  creeLe: string | null;
};

/**
 * Devis déjà présents sur un dossier, les DEUX parcours confondus.
 *
 * Lecture par la session : la RLS écarte les dossiers d'un autre commercial,
 * et c'est la bonne frontière — un commercial ne doit pas apprendre qu'un
 * devis existe sur un dossier qu'il n'a pas le droit de voir.
 */
export async function devisExistantsPourLead(leadId: string): Promise<DevisExistant[]> {
  if (!leadId) return [];
  const sb = await supabaseServer();

  const [docs, optimivv] = await Promise.all([
    sb.from("documents")
      .select("id, num, status, created_at")
      .eq("lead_id", leadId)
      .eq("type", "devis")
      .is("deleted_at", null)
      .returns<{ id: string; num: string; status: string; created_at: string }[]>(),
    sb.from("devis_optimivv")
      .select("id, numero, created_at, sent_at")
      .eq("lead_id", leadId)
      .returns<{ id: string; numero: string; created_at: string; sent_at: string | null }[]>(),
  ]);

  const out: DevisExistant[] = [];
  for (const d of docs.data ?? []) {
    out.push({
      origine: "documents",
      id: d.id,
      numero: d.num,
      statut: d.status,
      creeLe: d.created_at,
    });
  }
  for (const d of optimivv.data ?? []) {
    out.push({
      origine: "devis_optimivv",
      id: d.id,
      numero: d.numero,
      // `devis_optimivv` ne porte pas de statut : un devis y est émis, et
      // `sent_at` dit s'il est parti. On ne lui invente pas d'état qu'il n'a
      // pas.
      statut: d.sent_at ? "envoye" : "emis",
      creeLe: d.created_at,
    });
  }

  // Du plus récent au plus ancien : c'est celui-là qu'on veut nommer.
  return out.sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? ""));
}

export type VerdictDoublon =
  | { autorise: true }
  | { autorise: false; motif: string; existants: DevisExistant[] };

/**
 * Peut-on créer un devis sur ce dossier ?
 *
 * `confirmerNouveau` est la sortie explicite : le commercial a vu le devis
 * existant et en veut un second. La garde s'efface alors — elle sert à
 * empêcher l'accident, pas à contrarier l'intention.
 */
export async function verifierAvantCreation(
  leadId: string,
  confirmerNouveau = false,
): Promise<VerdictDoublon> {
  if (confirmerNouveau) return { autorise: true };

  const existants = await devisExistantsPourLead(leadId);
  if (existants.length === 0) return { autorise: true };

  const d = existants[0];
  const ou = d.origine === "documents" ? "dans « Devis à réaliser »" : "par le générateur";
  return {
    autorise: false,
    motif:
      `Un devis existe déjà sur ce dossier : ${d.numero} (${LIBELLE_STATUT[d.statut] ?? d.statut}), `
      + `créé ${ou}. Ouvrez-le pour le modifier, ou confirmez que vous voulez `
      + `en établir un second.`,
    existants,
  };
}

/** Libellés des statuts, pour un message lisible par un commercial. */
const LIBELLE_STATUT: Record<string, string> = {
  brouillon: "brouillon",
  envoye: "envoyé",
  ouvert: "ouvert par le client",
  signe: "signé",
  refuse: "refusé",
  expire: "expiré",
  emis: "émis",
};
