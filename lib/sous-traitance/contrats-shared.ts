// Types et helpers PURS du contrat de sous-traitance — aucune I/O.
//
// Pourquoi ce fichier séparé : `contrats-server.ts` commence par
// `import "server-only"`. Un composant client qui en importerait ne serait-ce
// qu'un type risque d'entraîner le module dans le bundle navigateur — et donc
// de faire échouer la compilation, voire d'y exposer du code serveur. La
// convention du dépôt sépare `-server` (I/O) et `-shared` (pur) : les formes
// de données que l'interface manipule appartiennent ici.

import {
  MODELE_NUMERO,
  MODELES_CLIENT,
  modeleContractuel,
  modeleLabelNumerote,
  peutEtreEmis,
  type ModeleContrat,
} from "./clauses";
import type { Reprise } from "./reprise-devis";
import type { EntiteEmettrice } from "./variables";

// ── Entité juridique émettrice ────────────────────────────────────────

export type EntiteChoisissable = EntiteEmettrice & {
  /** Champs obligatoires du bloc « ENTRE LES SOUSSIGNÉS » encore vides. */
  manquants: string[];
  /** Une entité incomplète ne peut pas signer : le contrat ne serait pas opposable. */
  utilisable: boolean;
};

/** Libellés des champs d'entité exigés par l'en-tête du contrat. */
const CHAMPS_ENTITE: { lire: (e: EntiteEmettrice) => string | null | undefined; libelle: string }[] = [
  { lire: (e) => e.legal_name, libelle: "dénomination sociale" },
  { lire: (e) => e.legal_form, libelle: "forme juridique" },
  { lire: (e) => e.siren ?? e.siret ?? e.vat_number, libelle: "identifiant légal (SIREN, SIRET ou TVA)" },
  { lire: (e) => e.address, libelle: "adresse du siège" },
  { lire: (e) => e.representative_name, libelle: "représentant légal" },
  { lire: (e) => e.representative_title, libelle: "qualité du représentant" },
];

export function controlerEntite(e: EntiteEmettrice): { manquants: string[]; utilisable: boolean } {
  const manquants = CHAMPS_ENTITE
    .filter((c) => !String(c.lire(e) ?? "").trim())
    .map((c) => c.libelle);
  return { manquants, utilisable: manquants.length === 0 };
}

// ── Prestataire ───────────────────────────────────────────────────────

export type PrestataireChoisissable = {
  technicianId: string;
  nom: string;
  initiales: string;
  email: string | null;
  telephone: string | null;
  raisonSociale: string | null;
  nomCommercial: string | null;
  formeJuridique: string | null;
  siren: string | null;
  siret: string | null;
  adresse: string | null;
  dirigeant: string | null;
  /** Champs exigés par l'en-tête du contrat et encore vides. */
  manquants: string[];
  utilisable: boolean;
};

// ── Dossier d'intervention ────────────────────────────────────────────

export type DossierContrat = {
  dossierId: string;
  leadId: string;
  leadShortId: string;
  statut: string;
  /** Nom tel qu'il s'affiche en tête du dossier (personne ou société). */
  nomClientAffiche: string;
  /** Client final — strictement ce que l'exécution exige. */
  client: {
    nom: string;
    civilite: string;
    prenom: string;
    societe: string;
    telephone: string;
    email: string;
    adresse: string;
    codePostal: string;
    ville: string;
    pays: string;
  };
  /** Intervention. L'adresse de chantier prime sur celle de facturation. */
  mission: {
    reference: string;
    type: string;
    date: string;
    heureDebut: string;
    dureeHeures: number | null;
    adresse: string;
    codePostal: string;
    ville: string;
    etage: string;
    acces: string;
    consignes: string;
    surfaceM2: number | null;
    notes: string;
  };
  technicianIdAffecte: string | null;
  /** Descriptif des prestations de vitrerie, ou null si aucune. */
  vitrerie: string | null;
  /** Prestations déduites du devis signé, et les lignes non reconnues. */
  reprise: Reprise;
  /** Modèle suggéré par le moteur. La planificatrice garde la main. */
  modeleSuggere: ModeleContrat | null;
};

// ── Contrats déjà émis ────────────────────────────────────────────────

export type ContratResume = {
  id: string;
  ref: string | null;
  modele: ModeleContrat;
  modeleLabel: string;
  modeleVersion: string;
  statut: string;
  technicianId: string;
  technicianNom: string | null;
  entityId: string | null;
  entityNom: string | null;
  totalHt: number | null;
  tauxTva: number | null;
  totalTtc: number | null;
  envoyeA: string | null;
  envoyeLe: string | null;
  consulteLe: string | null;
  signeLe: string | null;
  pdfPath: string | null;
  signedPdfPath: string | null;
  createdAt: string;
};

// ── Le menu des neuf modèles ──────────────────────────────────────────

export type OptionModele = {
  valeur: ModeleContrat;
  numero: number;
  label: string;
  titreDocument: string;
  nbArticles: number;
  /** Faux = texte non fourni : l'option est montrée mais non sélectionnable. */
  emissible: boolean;
  motifBlocage: string | null;
};

/**
 * Les neuf contrats, dans l'ordre de la liste client.
 *
 * Les deux sans texte y figurent — c'est la demande — mais sortent
 * `emissible: false` avec le motif exact. Les masquer donnerait à croire que
 * la liste n'en compte que sept ; les proposer sans avertissement ferait
 * signer un document vide.
 */
export function optionsModeles(): OptionModele[] {
  return MODELES_CLIENT.map((m) => {
    const r = modeleContractuel(m);
    const e = peutEtreEmis(m);
    return {
      valeur: m,
      numero: MODELE_NUMERO[m] as number,
      label: modeleLabelNumerote(m),
      titreDocument: r.titre,
      nbArticles: r.socle.length,
      emissible: e.ok,
      motifBlocage: e.ok ? null : e.motif,
    };
  });
}

export const STATUT_CONTRAT_LABEL: Record<string, string> = {
  brouillon: "Brouillon",
  a_completer: "À compléter",
  en_attente_validation: "En attente de validation",
  pret_a_envoyer: "Prêt à envoyer",
  envoye: "Envoyé",
  consulte: "Consulté par le prestataire",
  en_attente_signature: "En attente de signature",
  signe: "Signé",
  refuse: "Refusé",
  expire: "Expiré",
  annule: "Annulé",
  remplace_par_avenant: "Remplacé par un avenant",
  archive: "Archivé",
};

/** Statuts à partir desquels le document est figé : ni réécriture, ni second contrat. */
export const STATUTS_FIGES = [
  "envoye", "consulte", "en_attente_signature", "signe",
  "remplace_par_avenant", "archive",
] as const;

export function estFige(statut: string): boolean {
  return (STATUTS_FIGES as readonly string[]).includes(statut);
}

// ── Document assemblé ─────────────────────────────────────────────────
// Forme du contrat prêt à afficher ou à imprimer. Pure : l'assemblage lui-même
// est côté serveur, mais sa FORME est partagée — l'aperçu de la planificatrice
// et le PDF doivent montrer exactement la même chose.

export type DocumentAssemble = {
  titre: string;
  modele: ModeleContrat;
  modeleLabel: string;
  version: string;
  ref: string | null;
  /** En-tête « ENTRE LES SOUSSIGNÉS », variables substituées. */
  parties: { intro: string; blocs: { titre: string; corps: string; mention: string }[]; cloture: string };
  articles: { numero: number; titre: string; corps: string; reference?: string }[];
  bonMission: { titre: string; blocs: { titre: string; lignes: string[] }[]; pied: string[] };
  rapport: {
    titre: string;
    entete: { titre: string }[];
    rubriques: { numero: number | null; titre: string; origine: string }[];
  };
  montants: {
    totalHt: number;
    tauxTva: number | null;
    tva: number | null;
    totalTtc: number | null;
    lignes: { label: string; quantite: number | null; unite: string; prixUnitaireHt: number | null; montantHt: number | null }[];
    frais: { label: string; montantHt: number | null }[];
    incomplets: string[];
  };
  signatures: { lieu: string; donneurOrdre: string; sousTraitant: string };
  /** Variables obligatoires encore vides — l'émission est bloquée. */
  manquantes: { cle: string; libelle: string; groupe: string }[];
};
