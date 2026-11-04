// Résumé horizontal du pipeline commercial — PUR, aucune I/O.
//
// Quatre étapes, quatre chiffres, lus en moins de cinq secondes :
//
//   LEADS REÇUS → DÉCOUVERTE EFFECTUÉE → DEVIS ENVOYÉS → DEVIS SIGNÉS
//
// ─────────────────────────────────────────────────────────────────────
//  CE QUE CE MODULE N'EST PAS
// ─────────────────────────────────────────────────────────────────────
//
// Ce n'est PAS le Suivi commercial (`lib/suivi-shared.ts`), qui classe chaque
// dossier en neuf étapes et trois catégories. Celui-ci ne classe rien : il
// compte. Les deux coexistent et ne doivent pas être confondus — le Suivi
// n'est pas touché.
//
// Ce ne sont pas non plus les colonnes du Kanban (`PIPELINE_COLUMNS`, sept
// colonnes dont « Acompte encaissé » et « Perdu »). Le résumé est une lecture
// transverse, le Kanban reste inchangé.
//
// ─────────────────────────────────────────────────────────────────────
//  LE MÊME LOT DE DOSSIERS AUX QUATRE ÉTAPES
// ─────────────────────────────────────────────────────────────────────
//
// Les quatre chiffres portent sur le MÊME ensemble de leads — celui que
// l'écran affiche, après la restriction d'activité. Chaque étape répond à
// « combien d'entre eux ont atteint ce point ? », pas « combien sont ici en
// ce moment ». Un dossier signé compte donc dans les quatre.
//
// ─────────────────────────────────────────────────────────────────────
//  POURQUOI LES DOCUMENTS, ET PAS SEULEMENT LE STATUT
// ─────────────────────────────────────────────────────────────────────
//
// Le statut d'un lead est monotone et `perdu` est une sortie : un dossier qui
// a reçu un devis puis a été perdu porte `perdu`, et disparaîtrait de
// « Devis envoyés » si on ne lisait que le statut. On lit donc AUSSI les
// documents rattachés, que `getAllLeads()` fournit déjà — sans requête
// supplémentaire.

/** Ce dont le calcul a besoin. Volontairement structural, pas le type `Lead`. */
export type LeadPourResume = {
  status: string;
  discoveryDoneAt?: string | null;
  documents?: { type: "devis" | "acompte" | "finale"; status: string }[];
};

export type CleEtape = "recus" | "decouverte" | "devis_envoyes" | "devis_signes";

export type DefinitionEtape = {
  cle: CleEtape;
  /** Intitulé exact, en capitales, utilisé partout dans le pipeline (§5). */
  libelle: string;
  /** Jeton de couleur. Une étape n'est pas une activité : teintes dédiées. */
  token: string;
};

/**
 * Les quatre étapes, dans l'ordre.
 *
 * L'intitulé « DÉCOUVERTE EFFECTUÉE » est fixé ici et nulle part ailleurs :
 * c'est ce qui garantit l'uniformité demandée entre les blocs, les
 * indicateurs et les résumés.
 */
export const ETAPES_RESUME: DefinitionEtape[] = [
  { cle: "recus",         libelle: "LEADS REÇUS",          token: "--pipeline-recus" },
  { cle: "decouverte",    libelle: "DÉCOUVERTE EFFECTUÉE", token: "--pipeline-decouverte" },
  { cle: "devis_envoyes", libelle: "DEVIS ENVOYÉS",        token: "--pipeline-devis" },
  { cle: "devis_signes",  libelle: "DEVIS SIGNÉS",         token: "--pipeline-signes" },
];

// Statuts de devis qui prouvent qu'un devis EST PARTI. « refuse » et
// « expire » en font partie : le client l'a bien reçu, c'est sa réponse qui a
// clos l'affaire. Les exclure sous-estimerait le travail commercial accompli.
const DEVIS_PARTI = new Set(["envoye", "ouvert", "signe", "refuse", "expire"]);

/** Statuts de lead à partir desquels un devis est nécessairement parti. */
const LEAD_APRES_ENVOI = new Set(["envoye", "ouvert", "signe", "encaisse"]);

/** Statuts de lead qui valent signature. */
const LEAD_SIGNE = new Set(["signe", "encaisse"]);

export function aDecouverteEffectuee(l: LeadPourResume): boolean {
  return Boolean((l.discoveryDoneAt ?? "").trim());
}

export function aDevisEnvoye(l: LeadPourResume): boolean {
  if (LEAD_APRES_ENVOI.has(l.status)) return true;
  return (l.documents ?? []).some(
    (d) => d.type === "devis" && DEVIS_PARTI.has(d.status),
  );
}

export function aDevisSigne(l: LeadPourResume): boolean {
  if (LEAD_SIGNE.has(l.status)) return true;
  const docs = l.documents ?? [];
  if (docs.some((d) => d.type === "devis" && d.status === "signe")) return true;
  // Une facture d'acompte ou finale PAYÉE ne peut pas exister sans signature.
  return docs.some(
    (d) => (d.type === "acompte" || d.type === "finale") && d.status === "paye",
  );
}

export type EtapeResume = DefinitionEtape & {
  /** Nombre de dossiers ayant atteint cette étape. */
  nombre: number;
  /**
   * Conversion depuis l'étape précédente, en pourcentage arrondi.
   *
   * `null` sur la première étape : il n'y a rien avant elle, et afficher
   * « 100 % » laisserait croire à une conversion mesurée.
   */
  conversion: number | null;
  /**
   * L'étape compte-t-elle PLUS de dossiers que la précédente ?
   *
   * Cela arrive réellement : 18 dossiers de production portent un devis parti
   * sans découverte enregistrée. Ce n'est pas un défaut de calcul, c'est une
   * information — et l'interface la signale au lieu d'afficher un « 129 % »
   * qui passerait pour un bug.
   */
  depassePrecedente: boolean;
};

export type ResumePipeline = {
  etapes: EtapeResume[];
  /** Conversion de bout en bout : signés / reçus. */
  conversionGlobale: number | null;
};

const pourcent = (a: number, b: number): number | null =>
  b > 0 ? Math.round((a / b) * 100) : null;

/**
 * Compte les quatre étapes sur l'ensemble fourni.
 *
 * L'ensemble reçu est déjà filtré par l'appelant (restriction d'activité) :
 * ce module ne filtre rien, pour que le résumé dise toujours la même chose
 * que la liste affichée au-dessous.
 */
export function resumePipeline(leads: readonly LeadPourResume[]): ResumePipeline {
  const nombres: Record<CleEtape, number> = {
    recus: leads.length,
    decouverte: 0,
    devis_envoyes: 0,
    devis_signes: 0,
  };
  for (const l of leads) {
    if (aDecouverteEffectuee(l)) nombres.decouverte += 1;
    if (aDevisEnvoye(l)) nombres.devis_envoyes += 1;
    if (aDevisSigne(l)) nombres.devis_signes += 1;
  }

  const etapes: EtapeResume[] = ETAPES_RESUME.map((def, i) => {
    const nombre = nombres[def.cle];
    const precedent = i === 0 ? null : nombres[ETAPES_RESUME[i - 1].cle];
    return {
      ...def,
      nombre,
      conversion: precedent === null ? null : pourcent(nombre, precedent),
      depassePrecedente: precedent !== null && nombre > precedent,
    };
  });

  return {
    etapes,
    conversionGlobale: pourcent(nombres.devis_signes, nombres.recus),
  };
}
