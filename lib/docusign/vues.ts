// Formes de données destinées à l'INTERFACE — PUR, aucune I/O.
//
// Elles vivent ici et non dans `oauth-server.ts` ou `lecture-server.ts`, qui
// portent `import "server-only"` : un composant client qui importerait depuis
// ces modules, même un simple type, risquerait de les entraîner dans le
// bundle navigateur. La convention du dépôt sépare `-server` (I/O) et le pur.
//
// Aucune de ces structures ne contient de jeton, de secret ni d'URL
// permanente. C'est délibéré : ce sont exactement les données qui traversent
// la frontière serveur → navigateur.

import type { Environnement } from "./config";
import type { StatutSignature } from "./statuts";

/** Ce que l'écran doit savoir du raccordement, et rien de plus. */
export type EtatConnexion = {
  configure: boolean;
  /** Variables d'environnement manquantes, s'il en manque. */
  manquant: string[];
  environnement: Environnement;
  chiffrementActif: boolean;
  connecte: boolean;
  compte: string | null;
  connecteLe: string | null;
  /** Jours restants avant réautorisation obligatoire. */
  joursAvantReautorisation: number | null;
  /** Dernière erreur rencontrée, déjà réduite à un message sûr. */
  derniereErreur: string | null;
};

export type SignataireAffiche = {
  nom: string | null;
  email: string;
  role: string | null;
  statut: string;
  signeLe: string | null;
};

export type PieceArchivee = {
  id: string;
  documentType: string;
  title: string;
  /** Chemin interne. L'URL signée est mintée à la demande, jamais ici. */
  storagePath: string;
  sizeBytes: number | null;
  sha256: string | null;
  createdAt: string;
};

export type SignatureContrat = {
  contractId: string;
  envelopeId: string;
  statut: StatutSignature;
  statutLabel: string;
  ton: "neutre" | "attente" | "ok" | "alerte" | "erreur";
  terminal: boolean;
  signataires: SignataireAffiche[];
  envoyeLe: string | null;
  completedAt: string | null;
  synchroniseLe: string | null;
  archiveLe: string | null;
  archivageErreur: string | null;
  pieces: PieceArchivee[];
};
