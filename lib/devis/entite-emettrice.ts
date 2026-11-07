import "server-only";

// Société émettrice d'un devis : qui l'émet, et comment son identité arrive
// jusqu'au gabarit.
//
// ── CE QUE CE MODULE CORRIGE ──────────────────────────────────────────
//
// 1. La RÉSOLUTION était écrite dans `app/(app)/leads/[id]/devis-actions.ts`,
//    donc inaccessible à `/api/devis`. Les deux parcours ne pouvaient pas
//    répondre la même chose à « quelle société émet ce devis ? ». Elle est
//    remontée ici, et le serveur d'actions l'importe : une seule règle.
//
// 2. L'IDENTITÉ n'arrivait jamais aux gabarits pdfkit / pdf-lib. Le devis
//    OPTIMIVV portait la constante `PRESTATAIRE`, quelle que soit la société
//    émettrice. Les 22 devis déjà émis le sont tous sous OPTIMIVV, donc aucun
//    document existant n'est faux — mais la seconde société à émettre aurait
//    produit un devis au nom de la première.
//
// 3. `/api/devis` acceptait un `prestataire` VENU DU NAVIGATEUR et l'imprimait
//    sur un document numéroté puis archivé. N'importe quel appel authentifié
//    pouvait émettre au nom d'une société inventée. La route ignore désormais
//    ce que le client envoie et ne retient que ce que la base dit.
//
// Lecture via la session (`supabaseServer`) : la RLS s'applique.

import { supabaseServer } from "@/lib/supabase/server";
import { IDENTIFIANT_LEGAL, type Country, type Sector } from "@/lib/leads";
import type { Marque, Prestataire } from "./types";
import { paysDeLEntite, type EntitePourDevis } from "./garde-identite";

/** Ce qu'une émission de devis a besoin de savoir d'une société. */
export type IdentiteEmettrice = {
  entityId: string;
  /** Ligne brute, réduite — c'est elle que la garde contrôle. */
  entite: EntitePourDevis;
  /** Nom commercial affiché en grand. À défaut, la raison sociale. */
  enseigne: string;
  raisonSociale: string;
  adresse: string;
  /** « 75016 Paris » — code postal et ville réunis, comme l'attend le gabarit. */
  ville: string;
  /** Libellé de l'identifiant légal selon le pays : SIRET, IDE, BCE, RCS, NEQ. */
  identifiantLabel: string;
  identifiantValeur: string;
  numeroTva: string;
  telephone: string;
  email: string;
  site: string;
  pays: Country | null;
  vatRate: number;
  logoUrl: string;
  secteur: Sector | null;
};

const t = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Adresse `jsonb` → une ligne de rue et une ligne « CP ville ». */
function decouperAdresse(a: unknown): { rue: string; ville: string } {
  if (!a || typeof a !== "object") return { rue: "", ville: "" };
  const o = a as Record<string, unknown>;
  const cp = t(o.postal_code);
  const v = t(o.city);
  return { rue: t(o.line1), ville: [cp, v].filter(Boolean).join(" ") };
}

/** Adresse sur une seule ligne — forme attendue par les contrôles légaux. */
function adresseUneLigne(a: unknown): string | null {
  const { rue, ville } = decouperAdresse(a);
  const s = [rue, ville].filter(Boolean).join(", ");
  return s || null;
}

/**
 * Raison sociale débarrassée de sa forme juridique terminale.
 *
 * « OPTIMIVV SAS » → « OPTIMIVV ». Sert d'enseigne quand `trade_name` est
 * vide, parce qu'un en-tête de devis affiche une marque, pas une immatriculation.
 */
export function enseigneDepuisRaisonSociale(raison: string): string {
  return raison.replace(/\s+(SAS|SARL|EURL|SASU|EI|SCI)\s*$/i, "").trim() || raison;
}

/** Colonnes lues. Déclarées une fois : un oubli ici se voit partout. */
const COLONNES =
  "id, legal_name, trade_name, legal_form, siren, siret, vat_number, address, "
  + "country, contact_email, contact_phone, website, logo_url, default_vat_rate, "
  + "is_vat_exempt";

type LigneEntite = {
  id: string;
  legal_name: string | null;
  trade_name: string | null;
  legal_form: string | null;
  siren: string | null;
  siret: string | null;
  vat_number: string | null;
  address: unknown;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  logo_url: string | null;
  default_vat_rate: number | string | null;
  is_vat_exempt: boolean | null;
};

function composer(row: LigneEntite, secteur: Sector | null): IdentiteEmettrice {
  const { rue, ville } = decouperAdresse(row.address);
  const raison = t(row.legal_name);
  const entite: EntitePourDevis = {
    id: row.id,
    legal_name: row.legal_name,
    trade_name: row.trade_name,
    legal_form: row.legal_form,
    siren: row.siren,
    siret: row.siret,
    vat_number: row.vat_number,
    address: adresseUneLigne(row.address),
    country: row.country,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    is_vat_exempt: row.is_vat_exempt,
  };
  const pays = paysDeLEntite(entite);

  // Le SIRET désigne un établissement, le SIREN l'entité juridique. Un devis
  // français porte traditionnellement le SIRET ; hors de France, l'identifiant
  // national est dans `siren`, à défaut dans `vat_number`. On ne fabrique
  // rien : si les trois sont vides, la valeur est vide et la garde le dit.
  const valeur =
    pays === "FR"
      ? t(row.siret) || t(row.siren)
      : t(row.siren) || t(row.siret) || t(row.vat_number);

  return {
    entityId: row.id,
    entite,
    enseigne: t(row.trade_name) || enseigneDepuisRaisonSociale(raison),
    raisonSociale: raison,
    adresse: rue,
    ville,
    identifiantLabel: pays === "FR" ? "SIRET" : IDENTIFIANT_LEGAL[pays ?? "FR"].label,
    identifiantValeur: valeur,
    numeroTva: t(row.vat_number),
    telephone: t(row.contact_phone),
    email: t(row.contact_email),
    site: t(row.website),
    pays,
    vatRate: Number(row.default_vat_rate ?? 0),
    logoUrl: t(row.logo_url),
    secteur,
  };
}

/**
 * Société émettrice d'un dossier.
 *
 * Ordre : celle déjà portée par le dossier, puis celle déclarée par défaut
 * pour l'activité (`legal_entity_activities.is_default`, index unique partiel
 * qui garantit l'unicité), puis la première disponible par ordre alphabétique.
 * On ne demande rien au commercial : il pourra changer dans l'éditeur.
 *
 * ⚠️ Cette fonction était `resoudreEntite` dans `devis-actions.ts`. Elle est
 * remontée telle quelle — même ordre, mêmes replis — pour que les deux
 * parcours ne puissent pas répondre différemment.
 */
export async function resoudreEntiteDuLead(
  leadId: string,
): Promise<{ entityId: string; vatRate: number; secteur: Sector | null } | null> {
  const sb = await supabaseServer();

  const { data: lead } = await sb
    .from("leads")
    .select("entity_id, activity_id, activity:activities(slug)")
    .eq("id", leadId)
    .maybeSingle<{
      entity_id: string | null;
      activity_id: string | null;
      activity: { slug: string } | null;
    }>();

  const secteur = (lead?.activity?.slug ?? null) as Sector | null;
  let entityId = lead?.entity_id ?? null;

  if (!entityId && lead?.activity_id) {
    const { data: map } = await sb
      .from("legal_entity_activities")
      .select("legal_entity_id")
      .eq("activity_id", lead.activity_id)
      .eq("is_default", true)
      .maybeSingle<{ legal_entity_id: string }>();
    entityId = map?.legal_entity_id ?? null;
  }

  if (entityId) {
    const { data: e } = await sb
      .from("legal_entities")
      .select("id, default_vat_rate")
      .eq("id", entityId)
      .maybeSingle<{ id: string; default_vat_rate: number | string }>();
    if (e) return { entityId: e.id, vatRate: Number(e.default_vat_rate), secteur };
  }

  const { data: premiere } = await sb
    .from("legal_entities")
    .select("id, default_vat_rate")
    .order("legal_name", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; default_vat_rate: number | string }>();
  if (!premiere) return null;
  return { entityId: premiere.id, vatRate: Number(premiere.default_vat_rate), secteur };
}

/** Identité complète d'une société, par son identifiant. */
export async function identitePourEntite(
  entityId: string,
  secteur: Sector | null = null,
): Promise<IdentiteEmettrice | null> {
  if (!entityId) return null;
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("legal_entities")
    .select(COLONNES)
    .eq("id", entityId)
    .maybeSingle<LigneEntite>();
  // On teste `error` : une requête en échec renvoie `data: null`, exactement
  // comme une ligne absente. Les confondre ferait passer une panne pour une
  // société inexistante.
  if (error || !data) return null;
  return composer(data, secteur);
}

/** Identité de la société émettrice d'un dossier, résolution comprise. */
export async function identitePourLead(leadId: string): Promise<IdentiteEmettrice | null> {
  const r = await resoudreEntiteDuLead(leadId);
  if (!r) return null;
  return identitePourEntite(r.entityId, r.secteur);
}

/**
 * Identité → `prestataire` et `marque` du contrat de données du générateur.
 *
 * Aucun repli sur OPTIMIVV : ce qui est vide reste vide. Un gabarit qui
 * afficherait la constante par défaut à la place d'un champ manquant
 * produirait un document au nom de la mauvaise société — exactement ce que ce
 * module existe pour empêcher.
 */
export function versPrestataire(id: IdentiteEmettrice): {
  prestataire: Prestataire;
  marque: Marque;
} {
  return {
    prestataire: {
      enseigne: id.enseigne,
      raison_sociale: id.raisonSociale,
      adresse: id.adresse,
      ville: id.ville,
      siret: id.identifiantValeur,
      tva: id.numeroTva,
      telephone: id.telephone,
      email: id.email,
      site: id.site,
      identifiant_label: id.identifiantLabel,
    },
    marque: {
      nom: id.enseigne,
      // L'activité affichée suit le secteur du dossier, pas la société : une
      // même société émet pour plusieurs activités.
      activite: id.secteur ? LIBELLE_ACTIVITE[id.secteur] : "",
      // Aucune colonne ne porte de slogan. Mieux vaut n'en afficher aucun que
      // d'imprimer celui d'une autre société.
      slogan: "",
    },
  };
}

/** Libellé affiché sous la marque, par secteur. */
const LIBELLE_ACTIVITE: Record<Sector, string> = {
  urgence: "DÉPANNAGE D'URGENCE",
  nettoyage: "NETTOYAGE",
  nettoyage_difficile: "NETTOYAGE DIFFICILE",
  enr: "ÉNERGIES RENOUVELABLES",
  renovation: "RÉNOVATION",
  debarras: "DÉBARRAS",
  demenagement: "DÉMÉNAGEMENT",
  transport: "TRANSPORT",
  diogene: "NETTOYAGE EXTRÊME",
};
