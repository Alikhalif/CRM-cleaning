// Contrat de données du certificat de conformité — nettoyage de hotte pro.
// Un seul document A4. Le bloc établissement est prérempli depuis le dossier ;
// la planificatrice ne complète que les opérations, passages et observations.

// Liste FIGÉE des opérations contrôlées (ordre = ordre d'affichage). « Autre »
// est géré à part (libellé libre).
export const CERT_OPERATIONS = [
  "Nettoyage et dégraissage de la hotte",
  "Nettoyage des filtres",
  "Dégraissage des surfaces accessibles",
  "Nettoyage / dégraissage des conduits accessibles",
  "Nettoyage du moteur / turbine accessible",
  "Nettoyage de la tourelle d'extraction si concernée",
  "Nettoyage des éléments accessibles du système d'extraction",
  "Contrôle visuel après intervention",
  "Remise en fonctionnement / contrôle de fonctionnement",
] as const;

// État de chaque opération : Fait / Non concerné / Non réalisé.
export type OpState = "fait" | "nc" | "nr";
export const OP_LABEL: Record<OpState, string> = {
  fait: "Fait",
  nc: "Non concerné",
  nr: "Non réalisé",
};

export type CertClient = {
  etablissement: string; // seul champ réellement requis
  raisonSociale?: string;
  responsable?: string;
  adresse?: string;
  cp?: string;
  ville?: string;
  telephone?: string;
  email?: string;
};

export type CertHotte = {
  numero: string; // "CERT-HOTTE-2026-00001"
  dateEmission: string; // "JJ/MM/AAAA"
  client: CertClient;
  dossierRef?: string; // n° de dossier lisible (short_id du lead, ex. L-1087)
  factureNum?: string;
  dateIntervention: string; // "JJ/MM/AAAA"
  technicien?: string;
  societe?: string; // raison sociale émettrice
  // États alignés sur CERT_OPERATIONS (même longueur / même ordre).
  operations: OpState[];
  autre?: { label: string; state: OpState } | null;
  passages: 1 | 2;
  passage1?: string; // "JJ/MM/AAAA"
  passage2?: string; // n'apparaît que si passages === 2
  observations?: string;
  // Signature manuscrite éventuelle (data URL PNG) posée dans la case validation.
  signatureDataUrl?: string;
};

// Prestataire émetteur — identité OPTIMIVV NETTOYAGE (cohérente avec les devis).
// Constante hardcodée comme PRESTATAIRE_NETTOYAGE des devis (pas de lookup
// legal_entities dans ce flux autonome).
export const PRESTATAIRE_CERT = {
  enseigne: "OPTIMIVV NETTOYAGE",
  raisonSociale: "OPTIMIVV SAS",
  adresse: "2 rue Alfred Bruneau",
  ville: "75016 Paris",
  siret: "928 083 427 00023",
  telephone: "07 56 88 82 75",
  email: "devis@optimivv-nettoyage.com",
  site: "www.optimivv-nettoyage.com",
} as const;

// Entrée partielle envoyée par le formulaire (avant application des défauts).
export type CertHotteInput = Partial<Omit<CertHotte, "client">> & {
  client: CertClient;
};

// Date du jour au format français JJ/MM/AAAA (affichage Europe/Paris côté serveur).
export function todayFr(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Construit un certificat complet à partir d'une entrée partielle + un numéro.
export function buildCert(input: CertHotteInput, numero: string): CertHotte {
  const ops: OpState[] = CERT_OPERATIONS.map(
    (_, i) => (input.operations?.[i] ?? "fait") as OpState,
  );
  const passages: 1 | 2 = input.passages === 2 ? 2 : 1;
  return {
    numero,
    dateEmission: input.dateEmission || todayFr(),
    client: input.client,
    dossierRef: input.dossierRef,
    factureNum: input.factureNum,
    dateIntervention: input.dateIntervention || todayFr(),
    technicien: input.technicien,
    societe: input.societe || PRESTATAIRE_CERT.raisonSociale,
    operations: ops,
    autre: input.autre?.label?.trim()
      ? { label: input.autre.label.trim(), state: input.autre.state ?? "fait" }
      : null,
    passages,
    passage1: input.passage1 || input.dateIntervention || todayFr(),
    passage2: passages === 2 ? input.passage2 : undefined,
    observations: input.observations?.trim() || undefined,
    signatureDataUrl: input.signatureDataUrl,
  };
}
