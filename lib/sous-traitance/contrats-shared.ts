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
  /** « 77400 Lagny-sur-Marne » tel que saisi sur la fiche sous-traitant. */
  cpVille: string | null;
  dirigeant: string | null;
  /** Activités couvertes — `technicians.sectors`. */
  secteurs: string[];
  /** Départements d'intervention — `technicians.service_departments`. */
  departements: string[];
  /** Compétences déclarées — `technicians.skills`. */
  competences: string[];
  /** Code postal de rattachement — `technicians.base_postal_code`. */
  codePostalBase: string | null;
  /** Nombre d'interventions déjà confiées. 0 = jamais travaillé avec nous. */
  nbInterventions: number;
  /** Champs exigés par l'en-tête du contrat et encore vides. */
  manquants: string[];
  utilisable: boolean;
};

// ── Appariement prestataire ↔ mission ─────────────────────────────────
//
// CE QUE CETTE RECHERCHE FAIT, ET CE QU'ELLE NE FAIT PAS.
//
// Elle croise ce qui est RÉELLEMENT en base : l'activité (`sectors`), le
// département d'intervention (`service_departments`), les compétences
// (`skills`), le rattachement géographique (`base_postal_code`) et
// l'historique (nombre de dossiers déjà confiés).
//
// ⚠️ ELLE NE DIT RIEN DE LA DISPONIBILITÉ. Le CRM ne porte aucun calendrier
// de sous-traitant : ni congés, ni charge, ni créneaux. Afficher « disponible »
// serait une invention, et la consigne l'interdit expressément. La
// planificatrice confirme la disponibilité par téléphone, comme aujourd'hui.

export type CritereMission = {
  /** Secteur de la prestation (slug d'activité). */
  secteur?: string | null;
  /** Code postal du chantier — son département en est déduit. */
  codePostal?: string | null;
};

/** Département français depuis un code postal. Gère la Corse (2A/2B exclue). */
export function departementDe(codePostal: string | null | undefined): string | null {
  const cp = (codePostal ?? "").replace(/\s/g, "");
  if (!/^\d{5}$/.test(cp)) return null;
  // 97x / 98x : outre-mer, sur trois chiffres.
  if (cp.startsWith("97") || cp.startsWith("98")) return cp.slice(0, 3);
  return cp.slice(0, 2);
}

export type Correspondance = {
  /** L'activité de la mission figure parmi celles du prestataire. */
  secteurCouvert: boolean;
  /** Le département du chantier figure parmi ses départements. */
  departementCouvert: boolean;
  /** Les deux à la fois : c'est ce qui le fait remonter en tête. */
  correspond: boolean;
  /** Ce qui explique le classement, affiché tel quel à la planificatrice. */
  motifs: string[];
};

/**
 * Le prestataire correspond-il à la mission ?
 *
 * Un critère non renseignable (secteur inconnu, chantier sans code postal,
 * prestataire sans département déclaré) n'est JAMAIS compté comme un échec :
 * on ne masque pas un prestataire parce qu'une donnée manque, on dit
 * seulement qu'on n'a pas pu vérifier.
 */
export function correspondanceMission(
  p: PrestataireChoisissable,
  c: CritereMission,
): Correspondance {
  const motifs: string[] = [];

  const secteur = (c.secteur ?? "").trim();
  const secteurCouvert = secteur !== "" && p.secteurs.includes(secteur);
  if (secteurCouvert) motifs.push("activité couverte");
  else if (secteur && p.secteurs.length > 0) motifs.push("activité non déclarée");

  const dep = departementDe(c.codePostal);
  const depPrestataire = departementDe(p.codePostalBase);
  const departementCouvert =
    dep !== null
    && (p.departements.includes(dep) || (depPrestataire !== null && depPrestataire === dep));
  if (departementCouvert) motifs.push(`département ${dep}`);
  else if (dep && p.departements.length > 0) motifs.push(`hors zone (${dep})`);

  if (p.nbInterventions > 0) {
    motifs.push(`${p.nbInterventions} intervention${p.nbInterventions > 1 ? "s" : ""}`);
  }

  return { secteurCouvert, departementCouvert, correspond: secteurCouvert && departementCouvert, motifs };
}

/**
 * Classe les prestataires pour la mission : ceux qui correspondent d'abord.
 *
 * AUCUN prestataire n'est retiré de la liste. Masquer un prestataire sur un
 * critère incomplet ferait croire qu'il n'existe pas, alors qu'il suffit
 * souvent de compléter sa fiche. On trie, on explique, on ne cache pas.
 */
export function classerPrestataires(
  prestataires: readonly PrestataireChoisissable[],
  c: CritereMission,
): { prestataire: PrestataireChoisissable; corr: Correspondance }[] {
  return prestataires
    .map((prestataire) => ({ prestataire, corr: correspondanceMission(prestataire, c) }))
    .sort((a, b) => {
      // 1. correspondance complète, 2. activité seule, 3. zone seule,
      // 4. dossier administratif complet, 5. historique, 6. nom.
      const score = (x: { corr: Correspondance; prestataire: PrestataireChoisissable }) =>
        (x.corr.correspond ? 8 : 0)
        + (x.corr.secteurCouvert ? 4 : 0)
        + (x.corr.departementCouvert ? 2 : 0)
        + (x.prestataire.utilisable ? 1 : 0);
      const d = score(b) - score(a);
      if (d !== 0) return d;
      const h = b.prestataire.nbInterventions - a.prestataire.nbInterventions;
      if (h !== 0) return h;
      return a.prestataire.nom.localeCompare(b.prestataire.nom, "fr");
    });
}

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
    /** Libellé de l'activité, tel qu'il s'affiche. */
    type: string;
    /**
     * Slug de l'activité — `nettoyage`, `debarras`, `demenagement`…
     *
     * Distinct de `type`, qui est le LIBELLÉ. L'appariement prestataire se
     * fait sur le slug, parce que `technicians.sectors` en contient.
     */
    secteurSlug: string;
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
    /** Nombre de pièces concernées, repris de la découverte. */
    nbPieces: number | null;
    /** Ascenseur : « oui » / « non », ou vide si non renseigné. */
    ascenseur: string;
    /** Volume de débarras estimé, repris de la découverte. */
    volumeDebarras: string;
    /** Niveau de difficulté — l'état général relevé (`etat_salete`). */
    niveauDifficulte: string;
    /**
     * Date SOUHAITÉE par le client, et son créneau.
     *
     * ⚠️ À ne pas confondre avec `date`, qui est la date PLANIFIÉE. Un souhait
     * n'est pas une intervention confirmée, et la fiche de mission doit
     * montrer les deux sans les mélanger.
     */
    dateSouhaitee: string;
    creneauSouhaite: string;
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
