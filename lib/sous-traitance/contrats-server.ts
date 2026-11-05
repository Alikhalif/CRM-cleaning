import "server-only";

// Lecture des données nécessaires à un contrat de sous-traitance.
//
// Objectif du cahier des charges : ZÉRO DOUBLE SAISIE. Tout ce qui est déjà
// dans le CRM est repris — le dossier d'intervention, le lead, le prestataire,
// l'entité émettrice, les prestations vendues. La planificatrice ne complète
// que ce que le CRM ignore réellement.
//
// ⚠️ DEUX RÈGLES DE CONFIDENTIALITÉ, STRUCTURELLES
//
// 1. Aucun prix client ne sort d'ici. Le devis n'est lu que pour ses LIBELLÉS
//    de lignes, afin d'en déduire les prestations à sous-traiter. Les colonnes
//    de prix du devis ne sont pas même sélectionnées : il n'existe donc aucun
//    chemin par lequel un montant client pourrait atteindre le contrat du
//    sous-traitant, pas même par erreur de rédaction ultérieure.
// 2. Aucune provenance marketing n'est lue. Un contrat de sous-traitance n'a
//    que faire de l'origine du lead.

import { supabaseServer } from "@/lib/supabase/server";
import { reprendreDevis, type LigneDevis } from "./reprise-devis";
import { descriptifVitrerie, estFamilleNettoyage } from "@/lib/discovery-nettoyage";
import {
  donneurOrdreDepuisEntite,
  resoudre,
  substituer,
  type Contexte,
  type EntiteEmettrice,
  type Resolution,
} from "./variables";
import {
  MODELE_LABEL, assembler, modeleContractuel, modeleLabelNumerote, modelePour,
  peutEtreEmis, type ModeleContrat,
} from "./clauses";
import { BLOC_SIGNATURES, PARTIES } from "./modele-nettoyage";
import { calculerTotaux, type SaisieMontants } from "./montants";
import {
  controlerEntite,
  type ContratResume,
  type DocumentAssemble,
  type DossierContrat,
  type EntiteChoisissable,
  type PrestataireChoisissable,
} from "./contrats-shared";

// Point d'entrée unique pour le code serveur : il n'a pas à savoir lequel des
// deux fichiers porte quoi.
export {
  controlerEntite,
  optionsModeles,
  estFige,
  STATUT_CONTRAT_LABEL,
  STATUTS_FIGES,
} from "./contrats-shared";
export type {
  ContratResume,
  DocumentAssemble,
  DossierContrat,
  EntiteChoisissable,
  OptionModele,
  PrestataireChoisissable,
} from "./contrats-shared";

// ══════════════════════════════════════════════════════════════════════
//  Entités juridiques émettrices (§5-A)
// ══════════════════════════════════════════════════════════════════════

type EntiteRow = {
  id: string;
  legal_name: string | null;
  trade_name: string | null;
  legal_form: string | null;
  siren: string | null;
  siret: string | null;
  vat_number: string | null;
  address: unknown;
  country: string | null;
  representative_name: string | null;
  representative_title: string | null;
  representative_company_name: string | null;
  is_active: boolean | null;
};

/**
 * Met à plat l'adresse `jsonb` des entités.
 *
 * Elle est stockée en objet (`street`/`postal_code`/`city`) mais le contrat
 * attend une ligne. Une chaîne déjà à plat est renvoyée telle quelle : les
 * entités les plus anciennes du CRM la portent sous cette forme.
 */
function adresseAPlat(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const part = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
    const ligne = [part("street") || part("address") || part("line1"), part("line2")]
      .filter(Boolean)
      .join(", ");
    const ville = [part("postal_code") || part("postalCode") || part("zip"), part("city")]
      .filter(Boolean)
      .join(" ");
    const pays = part("country");
    return [ligne, ville, pays].filter(Boolean).join(", ");
  }
  return "";
}

/**
 * Entités juridiques proposées à la planificatrice.
 *
 * Les entités incomplètes sont RENVOYÉES, pas filtrées : les masquer laisserait
 * croire qu'elles n'existent pas, alors qu'il suffit de les compléter dans les
 * réglages. L'interface les montre et dit ce qui manque.
 *
 * Les colonnes `siren`, `country`, `representative_*`, `trade_name` et
 * `is_active` viennent de la migration `20261031000002`. Si elle n'est pas
 * encore appliquée, la requête échoue : on retombe alors sur les colonnes
 * historiques, et l'absence de représentant rend simplement toute entité
 * « incomplète » — ce qui est la vérité, et bloque l'émission au lieu de
 * produire un contrat signé par « [à compléter] ».
 */
export async function getEntitesEmettrices(): Promise<EntiteChoisissable[]> {
  const supabase = await supabaseServer();

  const complet = await supabase
    .from("legal_entities")
    .select(
      "id, legal_name, trade_name, legal_form, siren, siret, vat_number, address, country, representative_name, representative_title, representative_company_name, is_active",
    )
    .is("deleted_at", null)
    .order("legal_name")
    .returns<EntiteRow[]>();

  let rows: EntiteRow[];
  if (complet.error) {
    const base = await supabase
      .from("legal_entities")
      .select("id, legal_name, legal_form, siret, vat_number, address")
      .is("deleted_at", null)
      .order("legal_name")
      .returns<
        Pick<EntiteRow, "id" | "legal_name" | "legal_form" | "siret" | "vat_number" | "address">[]
      >();
    rows = (base.data ?? []).map((r) => ({
      ...r,
      trade_name: null,
      siren: null,
      country: null,
      representative_name: null,
      representative_title: null,
      representative_company_name: null,
      is_active: true,
    }));
  } else {
    rows = complet.data ?? [];
  }

  return rows
    .filter((r) => r.is_active !== false)
    .map((r) => {
      const e: EntiteEmettrice = {
        id: r.id,
        legal_name: r.legal_name,
        trade_name: r.trade_name,
        legal_form: r.legal_form,
        siren: r.siren,
        siret: r.siret,
        vat_number: r.vat_number,
        address: adresseAPlat(r.address),
        country: r.country,
        representative_name: r.representative_name,
        representative_title: r.representative_title,
        representative_company_name: r.representative_company_name,
      };
      return { ...e, ...controlerEntite(e) };
    });
}

// ══════════════════════════════════════════════════════════════════════
//  Prestataires (§5-B)
// ══════════════════════════════════════════════════════════════════════

type PrestataireRow = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  is_active: boolean;
  // Donnees d'appariement DEJA PRESENTES sur `technicians`, et jusqu'ici
  // jamais lues par cet ecran : le menu de la planificatrice listait les
  // prestataires a plat, sans dire lequel couvre la prestation ni le secteur.
  sectors: string[] | null;
  service_departments: string[] | null;
  skills: string[] | null;
  base_postal_code: string | null;
  profil: {
    raison_sociale: string | null;
    nom_commercial: string | null;
    siren: string | null;
    siret: string | null;
    adresse: string | null;
    cp_ville: string | null;
    dirigeant: string | null;
    phone: string | null;
  } | null;
};

/**
 * Prestataires sélectionnables, avec leur fiche administrative.
 *
 * L'identité vient de `technicians` + `subcontractor_profiles` : c'est la
 * bibliothèque des sous-traitants déjà en service. Rien n'est dupliqué, et un
 * SIRET corrigé dans la fiche l'est pour les contrats suivants.
 *
 * `forme juridique` n'existe pas dans `subcontractor_profiles` : le contrat la
 * réclame (« {{subcontractor_legal_form}} »), elle ressort donc en manquante
 * et la planificatrice la saisit au moment du contrat. On ne la devine pas
 * depuis la raison sociale — « SARL » dans un nom commercial ne prouve rien.
 */
export async function getPrestataires(): Promise<PrestataireChoisissable[]> {
  const supabase = await supabaseServer();

  // Historique : nombre d'interventions déjà confiées. Il ne sert pas à
  // classer d'autorité — c'est à la planificatrice de juger — mais à ne plus
  // choisir à l'aveugle entre un prestataire éprouvé et un inconnu.
  const interventions = new Map<string, number>();
  const { data: passees } = await supabase
    .from("dossiers")
    .select("technician_id");
  // Cast explicite : la combinaison `.select()` restreint + `.returns<>()` fait
  // retomber l'inférence de postgrest-js sur `never` ici. Même frontière, même
  // convention que les `as never` du dépôt côté écriture.
  for (const d of (passees ?? []) as { technician_id: string | null }[]) {
    if (d.technician_id) {
      interventions.set(d.technician_id, (interventions.get(d.technician_id) ?? 0) + 1);
    }
  }

  // ⚠️ `technicians.sectors` contient les IDENTIFIANTS des activités, pas
  // leurs slugs — vérifié en production le 2026-11-04 : les quatre fiches
  // portent des UUID. Comparer directement au slug du dossier ne
  // correspondrait JAMAIS, et l'écran afficherait des UUID à la
  // planificatrice. On traduit donc ici, une fois.
  const slugParActivite = new Map<string, string>();
  const { data: activites } = await supabase.from("activities").select("id, slug");
  for (const a of (activites ?? []) as { id: string; slug: string | null }[]) {
    if (a.slug) slugParActivite.set(a.id, a.slug);
  }

  const { data } = await supabase
    .from("technicians")
    .select(
      "id, name, initials, email, is_active, sectors, service_departments, skills, base_postal_code, "
      + "profil:subcontractor_profiles(raison_sociale, nom_commercial, siren, siret, adresse, cp_ville, dirigeant, phone)",
    )
    .eq("is_active", true)
    .order("name")
    .returns<PrestataireRow[]>();

  return (data ?? []).map((r) => {
    const p = r.profil;
    const adresse = [p?.adresse, p?.cp_ville].filter(Boolean).join(", ") || null;
    const manquants: string[] = [];
    if (!p?.raison_sociale?.trim()) manquants.push("dénomination sociale");
    if (!p?.siret?.trim()) manquants.push("SIRET");
    if (!adresse) manquants.push("adresse du siège");
    if (!p?.dirigeant?.trim()) manquants.push("représentant légal");
    if (!r.email?.trim()) manquants.push("courriel (nécessaire à l'envoi en signature)");

    return {
      technicianId: r.id,
      nom: r.name,
      initiales: r.initials,
      email: r.email,
      telephone: p?.phone ?? null,
      raisonSociale: p?.raison_sociale ?? null,
      nomCommercial: p?.nom_commercial ?? null,
      formeJuridique: null,
      siren: p?.siren ?? null,
      siret: p?.siret ?? null,
      adresse,
      cpVille: p?.cp_ville ?? null,
      dirigeant: p?.dirigeant ?? null,
      // Traduits en slugs : lisibles à l'écran, et comparables au secteur du
      // dossier. Un identifiant sans activité correspondante est écarté
      // plutôt qu'affiché brut.
      secteurs: (r.sectors ?? [])
        .map((id) => slugParActivite.get(id) ?? "")
        .filter(Boolean),
      departements: r.service_departments ?? [],
      competences: r.skills ?? [],
      codePostalBase: r.base_postal_code ?? null,
      nbInterventions: interventions.get(r.id) ?? 0,
      manquants,
      utilisable: manquants.length === 0,
    };
  });
}

// ══════════════════════════════════════════════════════════════════════
//  Le dossier d'intervention (§5-C et §5-D)
// ══════════════════════════════════════════════════════════════════════

type DossierRow = {
  id: string;
  lead_id: string;
  status: string;
  technician_id: string | null;
  planned_at: string | null;
  duration_hours: number | null;
  notes: string | null;
  address: unknown;
  lead: {
    id: string;
    short_id: string;
    is_company: boolean;
    client_first_name: string | null;
    client_last_name: string | null;
    client_company: string | null;
    client_email: string | null;
    client_phone: string | null;
    client_address: unknown;
    country: string | null;
    surface_m2: number | null;
    type_service: string | null;
    notes: string | null;
    discovery_details: Record<string, unknown> | null;
    // Niveau de difficulte et creneau SOUHAITE par le client (jamais une
    // intervention confirmee) : la planificatrice en a besoin pour organiser.
    etat_salete: string | null;
    wanted_date: string | null;
    wanted_slot: string | null;
    activity: { slug: string; label: string } | null;
  } | null;
};

// Lecture tolerante de `discovery_details` : ce JSONB porte des chaines, des
// nombres ou rien du tout selon le champ et l'anciennete du dossier.
function texteDetail(d: Record<string, unknown> | null, k: string): string {
  const v = d?.[k];
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function nombreDetail(d: Record<string, unknown> | null, k: string): number | null {
  const v = d?.[k];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function partieAdresse(v: unknown): { rue: string; cp: string; ville: string; etage: string; acces: string } {
  if (typeof v === "string") return { rue: v.trim(), cp: "", ville: "", etage: "", acces: "" };
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const t = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
    return {
      rue: t("street") || t("address") || t("line1"),
      cp: t("postal_code") || t("postalCode") || t("zip"),
      ville: t("city"),
      etage: t("floor") || t("etage"),
      acces: t("access") || t("acces") || t("access_conditions"),
    };
  }
  return { rue: "", cp: "", ville: "", etage: "", acces: "" };
}

/**
 * Le dossier, son client, son chantier et les prestations vendues.
 *
 * Le devis est lu SANS ses prix : `label` et `quantity` seulement. C'est
 * volontaire et c'est la garantie du §6 — le prix facturé au client ne peut
 * pas atteindre le contrat du sous-traitant, puisqu'il n'est jamais chargé.
 */
export async function getDossierContrat(dossierId: string): Promise<DossierContrat | null> {
  const supabase = await supabaseServer();

  const { data: d, error } = await supabase
    .from("dossiers")
    .select(
      `id, lead_id, status, technician_id, planned_at, duration_hours, notes, address,
       lead:leads(
         id, short_id, is_company, client_first_name, client_last_name, client_company,
         client_email, client_phone, client_address, country, surface_m2, type_service, notes,
         discovery_details, etat_salete, wanted_date, wanted_slot,
         activity:activities(slug, label)
       )`,
    )
    .eq("id", dossierId)
    .maybeSingle<DossierRow>();

  // ⚠️ NE JAMAIS JETER L'ERREUR À LA POUBELLE ICI.
  //
  // Cette fonction retournait `null` indifféremment pour « le dossier n'existe
  // pas » et « la requête a échoué », et l'appelant
  // (app/(app)/planification/[id]/page.tsx) traduit `null` par `notFound()`.
  //
  // Le 2026-11-05, le select demandait `activities(slug, name)` alors que la
  // colonne s'appelle `label`. PostgREST répondait donc :
  //
  //   400 — {"code":"42703","message":"column activities_2.name does not exist"}
  //
  // L'erreur étant ignorée, un dossier parfaitement valide affichait « 404
  // This page could not be found » tandis que le serveur journalisait
  // « GET /planification/<id> 200 ». Aucune trace, nulle part, de la vraie
  // cause : il a fallu rejouer la requête à la main contre la base pour la
  // trouver. Ni `tsc`, ni ESLint, ni `npm run build` ne lisent l'intérieur
  // d'une chaîne `.select()` — c'est donc le seul filet possible.
  //
  // On continue de retourner `null` (le 404 reste préférable à un écran
  // d'erreur pour la planificatrice), mais la cause est désormais écrite dans
  // les logs du conteneur.
  if (error) {
    console.error(
      `[contrats] getDossierContrat(${dossierId}) : la requête a échoué — ` +
        `${error.code ?? "?"} ${error.message}. Le dossier existe peut-être : ` +
        `ce n'est PAS un 404 légitime.`,
    );
    return null;
  }

  if (!d || !d.lead) return null;
  const lead = d.lead;

  // Lignes du devis signé — libellés et quantités, jamais les prix.
  const { data: docs } = await supabase
    .from("documents")
    .select("id, type, status, issued_at")
    .eq("lead_id", lead.id)
    .eq("type", "devis")
    .order("issued_at", { ascending: false })
    .returns<{ id: string; type: string; status: string; issued_at: string }[]>();

  const devis = (docs ?? []).find((x) => x.status === "signe") ?? (docs ?? [])[0] ?? null;

  let lignes: LigneDevis[] = [];
  if (devis) {
    const { data: dl } = await supabase
      .from("document_lines")
      .select("label, quantity, order_index")
      .eq("document_id", devis.id)
      .order("order_index")
      .returns<{ label: string; quantity: number | null; order_index: number }[]>();
    lignes = (dl ?? []).map((l) => ({ label: l.label, quantite: l.quantity }));
  }

  const reprise = reprendreDevis(lignes);

  const chantier = partieAdresse(d.address);
  const facturation = partieAdresse(lead.client_address);
  // Règle du §10 : l'adresse de CHANTIER prime. Un sous-traitant envoyé à
  // l'adresse de facturation se déplace pour rien.
  const lieu = chantier.rue ? chantier : facturation;

  const nomClient = lead.is_company
    ? (lead.client_company ?? "")
    : `${lead.client_first_name ?? ""} ${lead.client_last_name ?? ""}`.trim();

  return {
    dossierId: d.id,
    leadId: lead.id,
    leadShortId: lead.short_id,
    statut: d.status,
    client: {
      nom: lead.is_company ? "" : (lead.client_last_name ?? ""),
      civilite: "",
      prenom: lead.is_company ? "" : (lead.client_first_name ?? ""),
      societe: lead.client_company ?? "",
      telephone: lead.client_phone ?? "",
      email: lead.client_email ?? "",
      adresse: [facturation.rue, facturation.cp, facturation.ville].filter(Boolean).join(", "),
      codePostal: facturation.cp,
      ville: facturation.ville,
      pays: lead.country ?? "",
    },
    mission: {
      reference: lead.short_id,
      type: lead.activity?.label ?? lead.activity?.slug ?? "",
      secteurSlug: lead.activity?.slug ?? "",
      date: d.planned_at ? d.planned_at.slice(0, 10) : "",
      heureDebut: d.planned_at ? d.planned_at.slice(11, 16) : "",
      dureeHeures: d.duration_hours == null ? null : Number(d.duration_hours),
      adresse: [lieu.rue, lieu.cp, lieu.ville].filter(Boolean).join(", "),
      codePostal: lieu.cp,
      ville: lieu.ville,
      etage: lieu.etage,
      acces: lieu.acces,
      consignes: lead.type_service ?? "",
      surfaceM2: lead.surface_m2 == null ? null : Number(lead.surface_m2),
      notes: [d.notes, lead.notes].filter(Boolean).join("\n"),
      // Champs repris de la découverte, jusqu'ici absents de la fiche de
      // mission alors qu'ils y étaient attendus : la planificatrice devait
      // ouvrir la fiche lead pour les lire.
      nbPieces: nombreDetail(lead.discovery_details, "nbPieces"),
      ascenseur: texteDetail(lead.discovery_details, "ascenseur"),
      volumeDebarras:
        texteDetail(lead.discovery_details, "debarrasVolume")
        || texteDetail(lead.discovery_details, "volume"),
      niveauDifficulte: (lead.etat_salete ?? "").trim(),
      dateSouhaitee: (lead.wanted_date ?? "").trim(),
      creneauSouhaite: (lead.wanted_slot ?? "").trim(),
    },
    technicianIdAffecte: d.technician_id,
    // Vitrerie : le texte exact que porte le devis, pour que la planificatrice
    // organise l'intervention sans ressaisir quoi que ce soit. Le garde-fou de
    // famille est celui du moteur tarifaire — un dossier reclassé en débarras
    // garde ses réponses dans `details`, elles ne doivent pas resurgir ici.
    vitrerie:
      lead.activity?.slug && estFamilleNettoyage(lead.activity.slug) && lead.discovery_details
        ? descriptifVitrerie(lead.discovery_details)
        : null,
    reprise,
    modeleSuggere: modelePour(reprise.codes),
    nomClientAffiche: nomClient || "Sans nom",
  };
}

// ══════════════════════════════════════════════════════════════════════
//  Assemblage du contexte de substitution
// ══════════════════════════════════════════════════════════════════════

export type SaisieComplements = {
  /** Forme juridique du prestataire, absente de sa fiche. */
  prestataireFormeJuridique?: string;
  prestataireQualiteRepresentant?: string;
  /** Variables de modèle complétées à la main (zones, produits, niveau…). */
  complements?: Record<string, string>;
};

/**
 * Construit le contexte de substitution des `{{variables}}`.
 *
 * Rien n'est inventé : une donnée absente reste vide et ressort dans
 * `manquantes`. C'est l'interface qui demande à la planificatrice de la
 * compléter, jamais le moteur qui devine.
 */
export function construireContexte(
  d: DossierContrat,
  p: PrestataireChoisissable,
  e: EntiteEmettrice,
  saisie: SaisieComplements = {},
): { contexte: Contexte; resolution: Resolution } {
  const contexte: Contexte = {
    client: {
      client_id: d.leadId,
      client_civility: d.client.civilite,
      client_firstname: d.client.prenom,
      client_lastname: d.client.nom,
      client_company: d.client.societe,
      client_phone: d.client.telephone,
      client_email: d.client.email,
      client_address: d.client.adresse,
      client_postal_code: d.client.codePostal,
      client_city: d.client.ville,
      client_country: d.client.pays,
      client_floor: d.mission.etage,
      client_access: d.mission.acces,
      client_special_instructions: d.mission.consignes,
    },
    mission: {
      mission_id: d.dossierId,
      mission_reference: d.mission.reference,
      mission_type: d.mission.type,
      mission_description: d.mission.notes,
      mission_address: d.mission.adresse,
      mission_postal_code: d.mission.codePostal,
      mission_city: d.mission.ville,
      mission_floor: d.mission.etage,
      mission_date: d.mission.date,
      mission_start_time: d.mission.heureDebut,
      mission_surface_m2: d.mission.surfaceM2,
      mission_access_conditions: d.mission.acces,
      mission_client_instructions: d.mission.consignes,
      mission_status: d.statut,
      // Repris de la découverte : le bon de mission les porte désormais, au
      // lieu d'obliger la planificatrice à rouvrir la fiche lead.
      mission_rooms: d.mission.nbPieces ?? "",
      mission_elevator: d.mission.ascenseur,
      mission_clearance_volume: d.mission.volumeDebarras,
      mission_difficulty: d.mission.niveauDifficulte,
      // Souhait du client, distinct de la date planifiée.
      mission_wanted_date: d.mission.dateSouhaitee,
      mission_wanted_slot: d.mission.creneauSouhaite,
      ...(saisie.complements ?? {}),
    },
    prestataire: {
      subcontractor_id: p.technicianId,
      subcontractor_legal_name: p.raisonSociale ?? p.nom,
      subcontractor_trade_name: p.nomCommercial ?? "",
      subcontractor_legal_form: saisie.prestataireFormeJuridique ?? "",
      subcontractor_siren: p.siren ?? "",
      subcontractor_siret: p.siret ?? "",
      subcontractor_address: p.adresse ?? "",
      subcontractor_representative: p.dirigeant ?? "",
      subcontractor_representative_title: saisie.prestataireQualiteRepresentant ?? "",
      subcontractor_email: p.email ?? "",
      subcontractor_phone: p.telephone ?? "",
    },
    donneur_ordre: donneurOrdreDepuisEntite(e),
  };

  // Aucun modèle de transport n'étant validé, `estTransport` reste faux : les
  // variables d'enlèvement et de livraison ne doivent pas apparaître comme
  // manquantes sur un contrat de nettoyage.
  return { contexte, resolution: resoudre(contexte, false) };
}

// ══════════════════════════════════════════════════════════════════════
//  Contrats déjà émis pour le dossier
// ══════════════════════════════════════════════════════════════════════

type ContratRow = {
  id: string;
  ref: string | null;
  modele: string;
  modele_version: string;
  statut: string;
  technician_id: string;
  entity_id: string | null;
  total_ht: number | null;
  taux_tva: number | null;
  total_ttc: number | null;
  envoye_a: string | null;
  envoye_le: string | null;
  consulte_le: string | null;
  signe_le: string | null;
  pdf_path: string | null;
  signed_pdf_path: string | null;
  created_at: string;
  technician: { name: string } | null;
};

export async function getContratsDuDossier(dossierId: string): Promise<ContratResume[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("subcontract_contracts")
    .select(
      `id, ref, modele, modele_version, statut, technician_id, entity_id,
       total_ht, taux_tva, total_ttc, envoye_a, envoye_le, consulte_le, signe_le,
       pdf_path, signed_pdf_path, created_at,
       technician:technicians(name)`,
    )
    .eq("dossier_id", dossierId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<ContratRow[]>();

  const rows = data ?? [];

  // Noms des entités, en une requête — la jointure sur `legal_entities` n'est
  // pas possible tant que `entity_id` n'existe pas en base (migration
  // 20261102000001), et la liste reste utilisable sans.
  const ids = [...new Set(rows.map((r) => r.entity_id).filter((x): x is string => !!x))];
  const noms = new Map<string, string>();
  if (ids.length > 0) {
    const { data: ents } = await supabase
      .from("legal_entities")
      .select("id, legal_name")
      .in("id", ids)
      .returns<{ id: string; legal_name: string | null }[]>();
    for (const e of ents ?? []) noms.set(e.id, e.legal_name ?? "");
  }

  return rows.map((r) => {
    const modele = r.modele as ModeleContrat;
    return {
      id: r.id,
      ref: r.ref,
      modele,
      modeleLabel: MODELE_LABEL[modele] ? modeleLabelNumerote(modele) : r.modele,
      modeleVersion: r.modele_version,
      statut: r.statut,
      technicianId: r.technician_id,
      technicianNom: r.technician?.name ?? null,
      entityId: r.entity_id,
      entityNom: r.entity_id ? (noms.get(r.entity_id) ?? null) : null,
      totalHt: r.total_ht == null ? null : Number(r.total_ht),
      tauxTva: r.taux_tva == null ? null : Number(r.taux_tva),
      totalTtc: r.total_ttc == null ? null : Number(r.total_ttc),
      envoyeA: r.envoye_a,
      envoyeLe: r.envoye_le,
      consulteLe: r.consulte_le,
      signeLe: r.signe_le,
      pdfPath: r.pdf_path,
      signedPdfPath: r.signed_pdf_path,
      createdAt: r.created_at,
    };
  });
}

// ══════════════════════════════════════════════════════════════════════
//  Assemblage du document complet
// ══════════════════════════════════════════════════════════════════════

type ContratPourAssemblage = {
  id: string;
  ref: string | null;
  modele: string;
  dossier_id: string | null;
  technician_id: string;
  entity_id: string | null;
  statut: string;
  contenu: {
    saisie?: { montants?: SaisieMontants; complements?: SaisieComplements };
  } | null;
};

/**
 * Assemble le document : en-tête, articles, rémunération, deux annexes.
 *
 * Sert à la prévisualisation, à l'émission ET au PDF — prévisualiser un
 * document différent de celui qui partira n'aurait aucun intérêt. La
 * prévisualisation ne consomme en revanche AUCUN numéro : un numéro de contrat
 * ne s'alloue qu'à l'émission réelle, la numérotation devant rester sans trou.
 */
export async function assemblerDocumentContrat(contratId: string): Promise<
  { ok: true; document: DocumentAssemble } | { ok: false; error: string }
> {
  const supabase = await supabaseServer();
  const { data: c } = await supabase
    .from("subcontract_contracts")
    .select("id, ref, modele, dossier_id, technician_id, entity_id, contenu, statut")
    .eq("id", contratId)
    .maybeSingle<ContratPourAssemblage>();

  if (!c) return { ok: false, error: "Contrat introuvable." };
  if (!c.dossier_id) return { ok: false, error: "Contrat non rattaché à un dossier." };

  const modele = c.modele as ModeleContrat;
  const emissible = peutEtreEmis(modele);
  if (!emissible.ok) return { ok: false, error: emissible.motif };

  const [dossier, prestataires, entites] = await Promise.all([
    getDossierContrat(c.dossier_id),
    getPrestataires(),
    getEntitesEmettrices(),
  ]);
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  const prestataire = prestataires.find((p) => p.technicianId === c.technician_id);
  if (!prestataire) return { ok: false, error: "Sous-traitant introuvable ou désactivé." };

  const entite = entites.find((e) => e.id === c.entity_id);
  if (!entite) {
    return { ok: false, error: "Entité juridique émettrice introuvable. Sélectionnez-la de nouveau." };
  }
  const ctrl = controlerEntite(entite);
  if (!ctrl.utilisable) {
    return {
      ok: false,
      error: `Entité « ${entite.legal_name ?? ""} » incomplète : il manque ${ctrl.manquants.join(", ")}. `
        + "À compléter dans Réglages › Sociétés avant d'émettre le contrat.",
    };
  }

  const saisie = c.contenu?.saisie ?? {};
  const montants: SaisieMontants = saisie.montants ?? {
    mode: "detaille", forfaitHt: null, lignes: [], frais: [], tauxTva: null,
  };

  const { resolution } = construireContexte(dossier, prestataire, entite, saisie.complements ?? {});
  const assemble = assembler(dossier.reprise.codes, modele);
  if (!assemble) return { ok: false, error: "Le modèle sélectionné n'a pas de texte contractuel." };

  const r = modeleContractuel(modele);
  const totaux = calculerTotaux(montants);

  // Les variables du document dépassent le catalogue : montants et consignes
  // se composent ici. Une variable non fournie reste VISIBLE dans le document,
  // et c'est voulu — un trou doit se voir plutôt que de passer pour un blanc.
  const euro = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2 });
  const v: Record<string, string> = {
    ...resolution.valeurs,
    montant_ht: `${euro(totaux.totalHt)} € HT`,
    tva_detail: totaux.tva == null
      ? "à déterminer"
      : `${montants.tauxTva} % — ${euro(totaux.tva)} €`,
    montant_ttc: totaux.totalTtc == null ? "à déterminer" : `${euro(totaux.totalTtc)} € TTC`,
    prestations_detaillees: montants.lignes.map((l) => `- ${l.label}`).join("\n"),
    securite_mission: assemble.securite.map((x) => `- ${x}`).join("\n"),
    consignes_particulieres: dossier.mission.consignes || dossier.mission.notes,
    ville_signature: (entite.address ?? "").split(",").pop()?.trim() ?? "",
    date_signature: new Date().toLocaleDateString("fr-FR"),
  };

  const ligneMontant = (l: SaisieMontants["lignes"][number]) =>
    l.prixUnitaireHt == null
      ? null
      : l.unite === "forfait"
        ? l.prixUnitaireHt
        : l.prixUnitaireHt * (l.quantite ?? 0);

  return {
    ok: true,
    document: {
      titre: r.titre,
      modele,
      modeleLabel: modeleLabelNumerote(modele),
      version: assemble.version,
      ref: c.ref,
      parties: {
        intro: PARTIES.intro,
        blocs: [PARTIES.donneurOrdre, PARTIES.sousTraitant].map((b) => ({
          titre: b.titre,
          corps: substituer(b.corps, v),
          mention: b.mention,
        })),
        cloture: PARTIES.cloture,
      },
      articles: assemble.articles.map((a, i) => ({
        numero: i + 1,
        titre: a.titre,
        corps: substituer(a.corps, v),
        reference: a.reference,
      })),
      bonMission: {
        titre: r.bonMission.titre,
        blocs: r.bonMission.blocs.map((b) => ({
          titre: b.titre,
          lignes: b.lignes.map((l) => substituer(l, v)),
        })),
        pied: r.bonMission.pied.map((l) => substituer(l, v)),
      },
      rapport: {
        titre: r.rapport.titre,
        entete: r.rapport.entete.map((x) => ({ titre: x.titre })),
        rubriques: r.rapport.rubriques.map((x) => ({
          numero: x.numero, titre: x.titre, origine: x.origine,
        })),
      },
      montants: {
        totalHt: totaux.totalHt,
        tauxTva: montants.tauxTva,
        tva: totaux.tva,
        totalTtc: totaux.totalTtc,
        lignes: montants.lignes.map((l) => ({
          label: l.label,
          quantite: l.quantite,
          unite: l.unite,
          prixUnitaireHt: l.prixUnitaireHt,
          montantHt: ligneMontant(l),
        })),
        frais: montants.frais.map((f) => ({ label: f.label, montantHt: f.montantHt })),
        incomplets: totaux.incomplets,
      },
      signatures: {
        lieu: v.ville_signature,
        donneurOrdre: BLOC_SIGNATURES.parties[0].lignes
          .map((l) => substituer(l, v)).filter(Boolean).join(" · "),
        sousTraitant: BLOC_SIGNATURES.parties[1].lignes
          .map((l) => substituer(l, v)).filter(Boolean).join(" · "),
      },
      manquantes: resolution.manquantes.map((m) => ({
        cle: m.cle, libelle: m.libelle, groupe: m.groupe,
      })),
    },
  };
}
