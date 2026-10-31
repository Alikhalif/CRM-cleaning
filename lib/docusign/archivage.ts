// Règles d'archivage et d'isolation entre entités — PURES, aucune I/O.
//
// Deux garanties que ce fichier porte seul, et qu'un test vérifie :
//
//   • UN SEUL EXEMPLAIRE (§3). Le document est stocké une fois dans
//     `document_archive`. Les bibliothèques ne le COPIENT pas : elles le
//     retrouvent par leurs clés. `bibliothequesDe()` dit lesquelles le
//     verront, sans jamais dupliquer quoi que ce soit.
//
//   • AUCUN MÉLANGE ENTRE SOCIÉTÉS (§5, §9). Un document appartient à une
//     entité juridique et à une seule, identifiée par son IDENTIFIANT — jamais
//     déduite du nom du client ou du sous-traitant (§11).

export type TypeDocument =
  | "contrat_cadre"
  | "contrat_sous_traitance"
  | "ordre_mission"
  | "avenant"
  | "rapport_intervention"
  | "certificat_signature"
  | "facture_sous_traitant"
  | "piece_administrative"
  | "autre";

export const TYPE_DOCUMENT_LABEL: Record<TypeDocument, string> = {
  contrat_cadre: "Contrat-cadre",
  contrat_sous_traitance: "Contrat de sous-traitance",
  ordre_mission: "Ordre de mission",
  avenant: "Avenant",
  rapport_intervention: "Rapport d'intervention",
  certificat_signature: "Certificat de signature",
  facture_sous_traitant: "Facture du sous-traitant",
  piece_administrative: "Pièce administrative",
  autre: "Autre document",
};

/** Les quatre bibliothèques du §3. */
export type Bibliotheque = "sous_traitant" | "intervention" | "client" | "entite";

export const BIBLIOTHEQUE_LABEL: Record<Bibliotheque, string> = {
  sous_traitant: "Bibliothèque sous-traitants",
  intervention: "Espace planificatrice — intervention",
  client: "Fiche client",
  entite: "Bibliothèque de l'entité juridique",
};

/** Rubrique d'accueil dans la fiche du sous-traitant (§3.A). */
export const RUBRIQUE_SOUS_TRAITANT: Record<TypeDocument, string> = {
  contrat_cadre: "Contrats de sous-traitance",
  contrat_sous_traitance: "Contrats de sous-traitance",
  ordre_mission: "Ordres de mission",
  avenant: "Contrats de sous-traitance",
  rapport_intervention: "Rapports d'intervention",
  certificat_signature: "Contrats de sous-traitance",
  facture_sous_traitant: "Factures",
  piece_administrative: "Documents administratifs",
  autre: "Documents administratifs",
};

/** Rattachements d'un document archivé — la liste du §5. */
export type Rattachements = {
  entityId: string | null;
  subcontractorId: string | null;
  clientId: string | null;
  interventionId: string | null;
  documentType: TypeDocument;
};

/**
 * Bibliothèques depuis lesquelles le document est consultable.
 *
 * Aucune copie : la liste dit simplement OÙ le même enregistrement
 * apparaîtra. L'entité est toujours présente — c'est elle qui classe.
 */
export function bibliothequesDe(r: Rattachements): Bibliotheque[] {
  const out: Bibliotheque[] = [];
  if (r.entityId) out.push("entite");
  if (r.subcontractorId) out.push("sous_traitant");
  if (r.interventionId) out.push("intervention");
  // La fiche client ne reçoit pas les pièces propres au prestataire : ses
  // factures et ses attestations ne concernent pas le client.
  if (r.clientId && VISIBLE_CLIENT.has(r.documentType)) out.push("client");
  return out;
}

// Ce que le client peut légitimement voir dans sa fiche (§3.C, selon droits).
const VISIBLE_CLIENT = new Set<TypeDocument>([
  "rapport_intervention", "ordre_mission", "autre",
]);

// ── Contrôle avant archivage ──────────────────────────────────────────

export type VerificationArchivage =
  | { ok: true }
  | { ok: false; raisons: string[] };

/**
 * Un document est-il archivable en l'état ?
 *
 * L'entité juridique est la condition absolue : sans elle, le document est
 * inclassable et le §4 interdit de l'émettre. Un contrat ou un ordre de
 * mission sans sous-traitant n'aurait pas d'objet ; un ordre de mission sans
 * intervention non plus.
 */
export function verifierAvantArchivage(r: Rattachements): VerificationArchivage {
  const raisons: string[] = [];
  if (!r.entityId) raisons.push("entité juridique non renseignée");

  const exigeSousTraitant: TypeDocument[] = [
    "contrat_cadre", "contrat_sous_traitance", "ordre_mission", "avenant",
    "rapport_intervention", "facture_sous_traitant",
  ];
  if (exigeSousTraitant.includes(r.documentType) && !r.subcontractorId) {
    raisons.push("sous-traitant non renseigné");
  }

  const exigeIntervention: TypeDocument[] = ["ordre_mission", "rapport_intervention"];
  if (exigeIntervention.includes(r.documentType) && !r.interventionId) {
    raisons.push("intervention non renseignée");
  }

  return raisons.length === 0 ? { ok: true } : { ok: false, raisons };
}

// ── Isolation entre entités (§9) ──────────────────────────────────────

export type Peripherique = {
  /** Super Admin : accès à toutes les entités. */
  isAdmin: boolean;
  /** Entités du périmètre de l'utilisateur. Vide = aucune. */
  entitesAutorisees: readonly string[];
};

/**
 * L'utilisateur a-t-il le droit de voir ce document ?
 *
 * La comparaison porte sur l'IDENTIFIANT de l'entité, jamais sur un nom : le
 * §11 l'exige, et deux sociétés peuvent parfaitement avoir des raisons
 * sociales voisines.
 *
 * Un périmètre vide ne donne accès à RIEN. C'est volontairement l'inverse du
 * réflexe habituel « aucune restriction = tout voir » : sur des documents
 * contractuels de sociétés distinctes, le défaut doit être fermé.
 */
export function peutVoir(doc: { entityId: string | null }, p: Peripherique): boolean {
  if (p.isAdmin) return true;
  if (!doc.entityId) return false;
  return p.entitesAutorisees.includes(doc.entityId);
}

/** Filtre une liste de documents sur le périmètre. À appliquer CÔTÉ SERVEUR. */
export function filtrerParPerimetre<T extends { entityId: string | null }>(
  docs: readonly T[],
  p: Peripherique,
): T[] {
  return docs.filter((d) => peutVoir(d, p));
}

// ── Instantané juridique (§11) ────────────────────────────────────────

export type EntiteJuridique = {
  id: string;
  legalName: string;
  tradeName?: string | null;
  legalForm?: string | null;
  siren?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  address?: string | null;
  country?: string | null;
  representativeName?: string | null;
  representativeTitle?: string | null;
  contactEmail?: string | null;
};

/**
 * Figure les informations de l'entité au moment de l'envoi.
 *
 * Sans cet instantané, changer l'adresse du siège réécrirait tous les
 * contrats passés — y compris ceux déjà signés. L'instantané porte aussi la
 * date, pour savoir à quoi il correspond.
 */
export function instantanerEntite(e: EntiteJuridique, le = new Date()): Record<string, string> {
  const v = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
  return {
    entity_id: e.id,
    legal_name: v(e.legalName),
    trade_name: v(e.tradeName),
    legal_form: v(e.legalForm),
    siren: v(e.siren),
    siret: v(e.siret),
    vat_number: v(e.vatNumber),
    address: v(e.address),
    country: v(e.country) || "FR",
    representative_name: v(e.representativeName),
    representative_title: v(e.representativeTitle),
    contact_email: v(e.contactEmail),
    fige_le: le.toISOString(),
  };
}

/** Informations qu'une entité doit porter pour émettre un contrat (§4). */
export function entiteComplete(e: EntiteJuridique): { ok: boolean; manquant: string[] } {
  const manquant: string[] = [];
  if (!e.legalName?.trim()) manquant.push("raison sociale");
  if (!e.siret?.trim()) manquant.push("SIRET");
  if (!e.address?.trim()) manquant.push("adresse du siège");
  if (!e.representativeName?.trim()) manquant.push("représentant légal");
  if (!e.representativeTitle?.trim()) manquant.push("fonction du représentant");
  return { ok: manquant.length === 0, manquant };
}

// ── Versions (§7) ─────────────────────────────────────────────────────

/**
 * Un document final peut-il être remplacé par celui-ci ?
 *
 * Jamais directement : une nouvelle version est un NOUVEAU document qui
 * pointe sur l'ancien. Cette fonction dit comment la créer, pas comment
 * écraser. Le déclencheur en base refuse d'ailleurs l'écrasement.
 */
export function nouvelleVersion(
  ancien: { id: string; version: number; isFinal: boolean },
): { supersedesId: string; version: number } {
  return { supersedesId: ancien.id, version: ancien.version + 1 };
}

// ── Conservation (§7) ─────────────────────────────────────────────────

/** Durées par défaut, en années. Paramétrables en base par le Super Admin. */
export const CONSERVATION_DEFAUT: Record<TypeDocument, number> = {
  contrat_cadre: 10,
  contrat_sous_traitance: 10,
  ordre_mission: 10,
  avenant: 10,
  rapport_intervention: 5,
  certificat_signature: 10,
  facture_sous_traitant: 10,
  piece_administrative: 5,
  autre: 5,
};

export function dateConservation(
  type: TypeDocument,
  depuis: Date,
  regles: Partial<Record<TypeDocument, number>> = {},
): Date {
  const annees = regles[type] ?? CONSERVATION_DEFAUT[type];
  const d = new Date(depuis);
  d.setFullYear(d.getFullYear() + annees);
  return d;
}

// ── Dossier documentaire pour contrôle (§7) ───────────────────────────

export type FiltresControle = {
  entityId?: string | null;
  subcontractorId?: string | null;
  clientId?: string | null;
  interventionId?: string | null;
  documentType?: TypeDocument | null;
  signeDu?: string | null;
  signeAu?: string | null;
  signatureStatus?: string | null;
};

export type DocumentArchive = {
  id: string;
  ref: string | null;
  entityId: string | null;
  subcontractorId: string | null;
  clientId: string | null;
  interventionId: string | null;
  documentType: TypeDocument;
  title: string;
  signatureStatus: string;
  completedAt: string | null;
  docusignEnvelopeId: string | null;
};

/**
 * Applique les filtres du dossier de contrôle.
 *
 * ⚠️ À appeler APRÈS `filtrerParPerimetre`, jamais à la place : un filtre
 * d'affichage n'est pas un contrôle d'accès. L'ordre compte, et le test le
 * vérifie.
 */
export function appliquerFiltres(
  docs: readonly DocumentArchive[],
  f: FiltresControle,
): DocumentArchive[] {
  const dans = (iso: string | null, du?: string | null, au?: string | null): boolean => {
    if (!du && !au) return true;
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return false;
    if (du && t < new Date(`${du}T00:00:00Z`).getTime()) return false;
    if (au && t > new Date(`${au}T23:59:59Z`).getTime()) return false;
    return true;
  };

  return docs.filter((d) => {
    if (f.entityId && d.entityId !== f.entityId) return false;
    if (f.subcontractorId && d.subcontractorId !== f.subcontractorId) return false;
    if (f.clientId && d.clientId !== f.clientId) return false;
    if (f.interventionId && d.interventionId !== f.interventionId) return false;
    if (f.documentType && d.documentType !== f.documentType) return false;
    if (f.signatureStatus && d.signatureStatus !== f.signatureStatus) return false;
    if (!dans(d.completedAt, f.signeDu, f.signeAu)) return false;
    return true;
  });
}

/**
 * Récapitulatif joint à l'export ZIP (§7).
 *
 * Il liste ce que l'archive contient : sans lui, un dossier de cinquante
 * PDF est inexploitable lors d'un contrôle.
 */
export function recapitulatif(docs: readonly DocumentArchive[]): string {
  const lignes = [
    "Référence;Type;Titre;Entité;Sous-traitant;Intervention;Statut de signature;Finalisé le;Enveloppe DocuSign",
    ...docs.map((d) => [
      d.ref ?? "", TYPE_DOCUMENT_LABEL[d.documentType], d.title,
      d.entityId ?? "", d.subcontractorId ?? "", d.interventionId ?? "",
      d.signatureStatus, d.completedAt ?? "", d.docusignEnvelopeId ?? "",
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")),
  ];
  return lignes.join("\n");
}
