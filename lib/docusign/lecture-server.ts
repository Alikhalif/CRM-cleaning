import "server-only";

// Lecture de l'état des signatures, pour la fiche dossier.
//
// Ne renvoie QUE ce que l'écran doit montrer. Aucun jeton, aucun secret,
// aucune URL permanente : les pièces archivées sont désignées par leur chemin
// de stockage, et c'est une action serveur qui en mintera une URL signée au
// moment du clic.

import { supabaseServiceRole } from "@/lib/supabase/service";
import { etatConnexion, type EtatConnexion } from "./oauth-server";
import { piecesDuContrat } from "./archivage-server";
import type { SignataireAffiche, SignatureContrat } from "./vues";

export type { SignatureContrat, SignataireAffiche, PieceArchivee } from "./vues";
import { STATUT_LABEL, STATUT_TON, estTerminal, type StatutSignature } from "./statuts";

type EnveloppeRow = {
  envelope_id: string;
  contract_id: string | null;
  statut: StatutSignature;
  signataires: unknown;
  envoye_le: string | null;
  completed_at: string | null;
  synchronise_le: string | null;
  archive_le: string | null;
  archivage_erreur: string | null;
  created_at: string;
};

function lireSignataires(brut: unknown): SignataireAffiche[] {
  if (!Array.isArray(brut)) return [];
  const out: SignataireAffiche[] = [];
  for (const d of brut) {
    if (!d || typeof d !== "object") continue;
    const o = d as Record<string, unknown>;
    const email = typeof o.email === "string" ? o.email : "";
    if (!email) continue;
    out.push({
      email,
      nom: typeof o.nom === "string" ? o.nom : (typeof o.name === "string" ? o.name : null),
      role: typeof o.role === "string" ? o.role : null,
      statut: typeof o.statut === "string" ? o.statut : "sent",
      signeLe: typeof o.signeLe === "string" ? o.signeLe : null,
    });
  }
  return out;
}

/**
 * Signatures en cours ou achevées pour les contrats d'un dossier.
 *
 * Une enveloppe par contrat au plus — l'envoi refuse d'en créer une seconde
 * tant qu'une est active. On retient donc la plus récente, ce qui couvre le
 * cas d'un contrat annulé puis réémis.
 */
export async function getSignaturesDuDossier(
  contractIds: readonly string[],
): Promise<SignatureContrat[]> {
  if (contractIds.length === 0) return [];
  const sb = await supabaseServiceRole();

  const { data } = await sb
    .from("docusign_envelopes")
    .select(
      "envelope_id, contract_id, statut, signataires, envoye_le, completed_at, "
      + "synchronise_le, archive_le, archivage_erreur, created_at",
    )
    .in("contract_id", contractIds as string[])
    .order("created_at", { ascending: false })
    .returns<EnveloppeRow[]>();

  const parContrat = new Map<string, EnveloppeRow>();
  for (const e of data ?? []) {
    if (!e.contract_id) continue;
    // La requête est triée du plus récent au plus ancien : la première
    // rencontrée gagne.
    if (!parContrat.has(e.contract_id)) parContrat.set(e.contract_id, e);
  }

  const out: SignatureContrat[] = [];
  for (const [contractId, e] of parContrat) {
    out.push({
      contractId,
      envelopeId: e.envelope_id,
      statut: e.statut,
      statutLabel: STATUT_LABEL[e.statut] ?? e.statut,
      ton: STATUT_TON[e.statut] ?? "neutre",
      terminal: estTerminal(e.statut),
      signataires: lireSignataires(e.signataires),
      envoyeLe: e.envoye_le,
      completedAt: e.completed_at,
      synchroniseLe: e.synchronise_le,
      archiveLe: e.archive_le,
      archivageErreur: e.archivage_erreur,
      // Les pièces n'existent qu'après archivage : inutile de les chercher
      // avant.
      pieces: e.archive_le ? await piecesDuContrat(contractId) : [],
    });
  }
  return out;
}

/**
 * État du raccordement pour chaque entité proposée.
 *
 * L'interface en a besoin AVANT l'envoi : le bouton ne doit être actif que
 * si l'entité choisie est réellement raccordée (§6). Montrer un bouton qui
 * échouera est le défaut que cette lecture corrige.
 */
export async function getEtatsDocuSign(
  entityIds: readonly string[],
): Promise<Record<string, EtatConnexion>> {
  const out: Record<string, EtatConnexion> = {};
  // Séquentiel à dessein : la liste des entités est courte (une dizaine au
  // plus) et chaque appel peut déclencher un rafraîchissement de jeton. Les
  // lancer tous en parallèle multiplierait les rafraîchissements concurrents
  // sur la même ligne.
  for (const id of entityIds) {
    out[id] = await etatConnexion(id);
  }
  return out;
}

/** État global du connecteur, sans entité : configuration seule. */
export async function getConfigurationDocuSign(): Promise<EtatConnexion> {
  return etatConnexion(null);
}
