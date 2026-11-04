import "server-only";

// Leads entrants pas encore pris en charge — « NOUVEAU LEAD — À RAPPELER ».
//
// POURQUOI CE MODULE EXISTE. `lib/nav.ts` déclarait depuis l'origine un badge
// `leadsUntreated` sur « Suivi commercial ». Le type et l'entrée étaient là,
// mais AUCUN code ne les consommait : la navigation n'a jamais affiché ce
// compteur. C'est l'anomalie relevée le 2026-11-04 ; ce fichier la comble.
//
// ─────────────────────────────────────────────────────────────────────
//  CE QUI COMPTE COMME « PRIS EN CHARGE »
// ─────────────────────────────────────────────────────────────────────
//
// On réutilise `TREAT_ACTIONS` (lib/presence/taxonomy.ts), la liste déjà en
// place des actions qui valent travail réel : appel sortant, SMS, e-mail de
// relance, découverte enregistrée, NRP, changement de statut, demande de
// photos, création de devis…
//
// ⚠️ ON N'UTILISE DÉLIBÉRÉMENT PAS `QUALIFYING_LEAD_ACTIONS`, qui est
// `TREAT_ACTIONS` + `lead.open`. Avec elle, OUVRIR la fiche suffirait à faire
// disparaître le lead du compteur — exactement ce que le client refuse
// (consigne du 2026-11-04 : « la notification ne doit pas disparaître
// uniquement parce que le commercial ouvre le dossier »).
//
// La règle d'alerte de présence (`ruleLeadUntreated`, lib/presence/
// alerts-server.ts) garde SA définition, plus permissive, et n'est pas
// touchée : elle alimente les alertes du Super Admin depuis des mois, et
// modifier son périmètre changerait le volume d'alertes d'une automatisation
// validée. Les deux lectures coexistent, chacune avec son seuil assumé.
//
// ─────────────────────────────────────────────────────────────────────
//  PÉRIMÈTRE
// ─────────────────────────────────────────────────────────────────────
//
// Les leads sont lus à travers la SESSION : la RLS fait le cloisonnement. Un
// commercial compte ses dossiers, un Super Admin voit large — sans aucune
// branche de rôle ici. Le service-role ne sert qu'à lire `audit_logs` (table
// que la session ne peut pas interroger), jamais à élargir l'ensemble des
// dossiers, déjà arrêté par `ids`. C'est le même procédé que
// `photosEnAttente()` dans lib/devis-a-realiser/server.ts.

import { cache } from "react";
import { supabaseServer } from "./supabase/server";
import { supabaseServiceRole } from "./supabase/service";
import { selectEnLotsTolerant } from "./supabase/batch";
import { TREAT_ACTIONS } from "./presence/taxonomy";

export type LeadsNonTraites = {
  /** Nombre de leads entrants sans aucune action de traitement. */
  total: number;
  /** Arrivée du plus ancien — permet d'écrire « depuis 3 jours ». */
  plusAncienLe: string | null;
  /**
   * La lecture a-t-elle été dégradée ?
   *
   * Si `audit_logs` répond mal, on préfère afficher 0 plutôt qu'un compteur
   * faux qui alarmerait sans raison. Le drapeau le dit explicitement au lieu
   * de laisser croire à une boîte vide.
   */
  degrade: boolean;
};

const VIDE: LeadsNonTraites = { total: 0, plusAncienLe: null, degrade: false };

type LeadRow = { id: string; received_at: string };

/**
 * Compteur des leads entrants à rappeler.
 *
 * Enveloppé dans `cache()` : le layout authentifié et le tableau de bord le
 * demandent dans le même rendu, et une seule paire de requêtes suffit.
 */
export const getLeadsNonTraites = cache(async (): Promise<LeadsNonTraites> => {
  const sb = await supabaseServer();

  // `status = 'lead'` est l'état d'entrée du pipeline (orthographe CDC). Un
  // dossier qui a bougé n'est plus « à rappeler », même sans action tracée.
  const { data, error } = await sb
    .from("leads")
    .select("id, received_at")
    .eq("status", "lead")
    .order("received_at", { ascending: true })
    .returns<LeadRow[]>();

  if (error) {
    console.error("getLeadsNonTraites — lecture des leads échouée :", error.message);
    return { ...VIDE, degrade: true };
  }
  const leads = data ?? [];
  if (leads.length === 0) return VIDE;

  const sbService = await supabaseServiceRole();
  const { rows, degrade } = await selectEnLotsTolerant(
    leads.map((l) => l.id),
    (lot) => sbService
      .from("audit_logs")
      .select("entity_id")
      .eq("entity_type", "lead")
      .in("entity_id", lot)
      .in("action", TREAT_ACTIONS)
      .returns<{ entity_id: string | null }[]>(),
    { table: "audit_logs", filtre: "entity_id IN (…) AND action IN (actions de traitement)" },
  );

  if (degrade) return { ...VIDE, degrade: true };

  const traites = new Set(rows.map((r) => r.entity_id).filter((v): v is string => Boolean(v)));
  const attente = leads.filter((l) => !traites.has(l.id));

  return {
    total: attente.length,
    // La liste est triée par date d'arrivée croissante : le premier élément
    // restant est le plus ancien.
    plusAncienLe: attente[0]?.received_at ?? null,
    degrade: false,
  };
});
