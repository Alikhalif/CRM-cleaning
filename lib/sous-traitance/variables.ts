// Variables dynamiques des contrats de sous-traitance — PUR, aucune I/O.
//
// Objectif du cahier des charges : ZÉRO DOUBLE SAISIE (§1). Tout ce que le
// CRM sait déjà est repris ; la planificatrice ne complète que ce qui manque
// réellement. D'où `resoudre()`, qui renvoie non seulement les valeurs mais
// aussi la liste de ce qui MANQUE — le système ne doit jamais inventer une
// donnée absente (§18).
//
// Deux précautions de confidentialité, structurelles :
//   • les prix facturés au client et les marges n'entrent JAMAIS dans ce
//     catalogue : il n'existe aucune variable pour les transporter ;
//   • les informations personnelles transmises au sous-traitant se limitent à
//     ce qui est nécessaire à l'exécution (§10).

/** Informations d'OPTIMIVV, centralisées une seule fois (§13). */
export const DONNEUR_ORDRE = {
  principal_company_name: "OPTIMIVV",
  principal_company_legal_form: "SASU",
  principal_company_siren: "928 083 427",
  principal_company_rcs: "Paris",
  principal_company_address: "2 rue Alfred Bruneau, 75016 Paris",
  principal_company_representative: "M. Rosalie DAVID",
  principal_company_representative_title: "Président",
  // Le capital social n'est volontairement PAS exposé (consigne §13).
} as const;

export type GroupeVariable = "client" | "mission" | "prestataire" | "donneur_ordre" | "transport";

export type DefinitionVariable = {
  cle: string;
  libelle: string;
  groupe: GroupeVariable;
  /** Le contrat ne peut pas être envoyé si elle manque. */
  obligatoire: boolean;
  /** Vraie seulement pour les missions de transport. */
  transportSeulement?: boolean;
};

export const VARIABLES: DefinitionVariable[] = [
  // ── Client (§10) ───────────────────────────────────────────────────
  { cle: "client_id", libelle: "Identifiant client", groupe: "client", obligatoire: false },
  { cle: "client_civility", libelle: "Civilité", groupe: "client", obligatoire: false },
  { cle: "client_firstname", libelle: "Prénom", groupe: "client", obligatoire: false },
  { cle: "client_lastname", libelle: "Nom", groupe: "client", obligatoire: false },
  { cle: "client_company", libelle: "Société", groupe: "client", obligatoire: false },
  { cle: "client_phone", libelle: "Téléphone du client", groupe: "client", obligatoire: false },
  { cle: "client_email", libelle: "Courriel du client", groupe: "client", obligatoire: false },
  { cle: "client_address", libelle: "Adresse du client", groupe: "client", obligatoire: false },
  { cle: "client_street", libelle: "Rue", groupe: "client", obligatoire: false },
  { cle: "client_postal_code", libelle: "Code postal", groupe: "client", obligatoire: false },
  { cle: "client_city", libelle: "Ville", groupe: "client", obligatoire: false },
  { cle: "client_country", libelle: "Pays", groupe: "client", obligatoire: false },
  { cle: "client_floor", libelle: "Étage", groupe: "client", obligatoire: false },
  { cle: "client_access", libelle: "Conditions d'accès", groupe: "client", obligatoire: false },
  { cle: "client_special_instructions", libelle: "Consignes particulières", groupe: "client", obligatoire: false },

  // ── Mission (§11) ──────────────────────────────────────────────────
  { cle: "mission_id", libelle: "Identifiant de mission", groupe: "mission", obligatoire: true },
  { cle: "mission_reference", libelle: "Référence de mission", groupe: "mission", obligatoire: true },
  { cle: "mission_type", libelle: "Type de mission", groupe: "mission", obligatoire: true },
  { cle: "mission_description", libelle: "Description", groupe: "mission", obligatoire: false },
  { cle: "mission_address", libelle: "Adresse du chantier", groupe: "mission", obligatoire: true },
  { cle: "mission_postal_code", libelle: "Code postal du chantier", groupe: "mission", obligatoire: false },
  { cle: "mission_city", libelle: "Ville du chantier", groupe: "mission", obligatoire: false },
  { cle: "mission_floor", libelle: "Étage du chantier", groupe: "mission", obligatoire: false },
  { cle: "mission_date", libelle: "Date d'intervention", groupe: "mission", obligatoire: true },
  { cle: "mission_start_time", libelle: "Heure de début", groupe: "mission", obligatoire: false },
  { cle: "mission_end_time", libelle: "Heure de fin", groupe: "mission", obligatoire: false },
  { cle: "mission_surface_m2", libelle: "Surface (m²)", groupe: "mission", obligatoire: false },
  { cle: "mission_volume_m3", libelle: "Volume (m³)", groupe: "mission", obligatoire: false },
  { cle: "mission_access_conditions", libelle: "Conditions d'accès au chantier", groupe: "mission", obligatoire: false },
  { cle: "mission_equipment_constraints", libelle: "Contraintes de matériel", groupe: "mission", obligatoire: false },
  { cle: "mission_client_instructions", libelle: "Instructions du client", groupe: "mission", obligatoire: false },
  { cle: "mission_technical_reservations", libelle: "Réserves techniques", groupe: "mission", obligatoire: false },
  { cle: "mission_photos", libelle: "Photographies du dossier", groupe: "mission", obligatoire: false },
  { cle: "mission_status", libelle: "Statut de la mission", groupe: "mission", obligatoire: false },

  // ── Prestataire (§12) ──────────────────────────────────────────────
  { cle: "subcontractor_id", libelle: "Identifiant prestataire", groupe: "prestataire", obligatoire: true },
  { cle: "subcontractor_legal_name", libelle: "Dénomination sociale", groupe: "prestataire", obligatoire: true },
  { cle: "subcontractor_trade_name", libelle: "Nom commercial", groupe: "prestataire", obligatoire: false },
  { cle: "subcontractor_legal_form", libelle: "Forme juridique", groupe: "prestataire", obligatoire: false },
  { cle: "subcontractor_siren", libelle: "SIREN", groupe: "prestataire", obligatoire: false },
  { cle: "subcontractor_siret", libelle: "SIRET", groupe: "prestataire", obligatoire: true },
  { cle: "subcontractor_rcs", libelle: "RCS", groupe: "prestataire", obligatoire: false },
  { cle: "subcontractor_address", libelle: "Adresse du prestataire", groupe: "prestataire", obligatoire: true },
  { cle: "subcontractor_representative", libelle: "Représentant légal", groupe: "prestataire", obligatoire: true },
  { cle: "subcontractor_email", libelle: "Courriel du prestataire", groupe: "prestataire", obligatoire: true },
  { cle: "subcontractor_phone", libelle: "Téléphone du prestataire", groupe: "prestataire", obligatoire: false },
  { cle: "subcontractor_activities", libelle: "Activités exercées", groupe: "prestataire", obligatoire: false },
  { cle: "subcontractor_insurance_status", libelle: "État des assurances", groupe: "prestataire", obligatoire: false },
  { cle: "subcontractor_qualifications", libelle: "Qualifications déclarées", groupe: "prestataire", obligatoire: false },
  { cle: "subcontractor_documents", libelle: "Documents au dossier", groupe: "prestataire", obligatoire: false },

  // ── Donneur d'ordre (§13) ──────────────────────────────────────────
  ...Object.keys(DONNEUR_ORDRE).map((cle) => ({
    cle, libelle: cle, groupe: "donneur_ordre" as GroupeVariable, obligatoire: false,
  })),

  // ── Transport (§18) ────────────────────────────────────────────────
  { cle: "pickup_address", libelle: "Adresse d'enlèvement", groupe: "transport", obligatoire: true, transportSeulement: true },
  { cle: "delivery_address", libelle: "Adresse de livraison", groupe: "transport", obligatoire: true, transportSeulement: true },
  { cle: "pickup_floor", libelle: "Étage à l'enlèvement", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "delivery_floor", libelle: "Étage à la livraison", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "pickup_elevator", libelle: "Ascenseur à l'enlèvement", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "delivery_elevator", libelle: "Ascenseur à la livraison", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "distance_km", libelle: "Distance (km)", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "transport_volume_m3", libelle: "Volume transporté (m³)", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "transport_weight_kg", libelle: "Poids (kg)", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "vehicle_type", libelle: "Type de véhicule", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "vehicle_registration", libelle: "Immatriculation", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "goods_description", libelle: "Description des biens", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "goods_inventory", libelle: "Inventaire", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "loading_conditions", libelle: "Conditions de chargement", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "unloading_conditions", libelle: "Conditions de déchargement", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "transport_insurance", libelle: "Assurance transport", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "declared_value", libelle: "Valeur déclarée", groupe: "transport", obligatoire: false, transportSeulement: true },
  { cle: "delivery_reservations", libelle: "Réserves à la livraison", groupe: "transport", obligatoire: false, transportSeulement: true },
];

/** Contexte brut, tel que le CRM le connaît. Toutes les clés sont optionnelles. */
export type Contexte = {
  client?: Record<string, unknown>;
  mission?: Record<string, unknown>;
  prestataire?: Record<string, unknown>;
  transport?: Record<string, unknown>;
};

export type Resolution = {
  /** Valeurs prêtes à être substituées dans le contrat. */
  valeurs: Record<string, string>;
  /** Variables obligatoires non renseignées — à compléter avant envoi. */
  manquantes: DefinitionVariable[];
  /** Variables renseignées, pour afficher ce qui a été repris automatiquement. */
  reprises: string[];
};

const texte = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (Array.isArray(v)) return v.map(texte).filter(Boolean).join(", ");
  return "";
};

/**
 * Résout toutes les variables à partir du contexte.
 *
 * Aucune valeur n'est inventée : une donnée absente reste vide et, si elle
 * est obligatoire, apparaît dans `manquantes`. C'est l'interface qui demandera
 * à la planificatrice de la compléter — pas le moteur qui devinera.
 */
export function resoudre(ctx: Contexte, estTransport: boolean): Resolution {
  const source: Record<GroupeVariable, Record<string, unknown>> = {
    client: ctx.client ?? {},
    mission: ctx.mission ?? {},
    prestataire: ctx.prestataire ?? {},
    transport: ctx.transport ?? {},
    donneur_ordre: DONNEUR_ORDRE as unknown as Record<string, unknown>,
  };

  const valeurs: Record<string, string> = {};
  const manquantes: DefinitionVariable[] = [];
  const reprises: string[] = [];

  for (const v of VARIABLES) {
    // Les variables de transport n'ont pas de sens hors mission de transport :
    // les réclamer ferait apparaître de faux manques.
    if (v.transportSeulement && !estTransport) continue;
    const brut = source[v.groupe][v.cle];
    const val = texte(brut);
    valeurs[v.cle] = val;
    if (val) reprises.push(v.cle);
    else if (v.obligatoire) manquantes.push(v);
  }

  return { valeurs, manquantes, reprises };
}

/**
 * Adresse à porter à l'ordre de mission.
 *
 * Règle du §10 : quand l'adresse de facturation diffère de celle du chantier,
 * c'est CELLE DU CHANTIER qui compte. Un sous-traitant envoyé à l'adresse de
 * facturation se déplace pour rien.
 */
export function adresseChantier(ctx: Contexte): { adresse: string; origine: "chantier" | "client" | "aucune" } {
  const mission = texte(ctx.mission?.mission_address);
  if (mission) return { adresse: mission, origine: "chantier" };
  const client = texte(ctx.client?.client_address);
  if (client) return { adresse: client, origine: "client" };
  return { adresse: "", origine: "aucune" };
}

/** Remplace les {{variables}} d'un texte. Une variable inconnue reste visible. */
export function substituer(modele: string, valeurs: Record<string, string>): string {
  return modele.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (brut, cle: string) => {
    const v = valeurs[cle];
    // Une variable vide laisse une marque explicite plutôt qu'un blanc : la
    // planificatrice doit VOIR ce qui n'a pas été repris.
    if (v === undefined) return brut;
    return v || "[à compléter]";
  });
}
