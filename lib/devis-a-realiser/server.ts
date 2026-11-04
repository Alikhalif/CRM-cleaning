import "server-only";

// « Devis à réaliser » — lecture des données. Aucune écriture, aucun statut
// posé, aucune tâche créée.
//
// PÉRIMÈTRE ET AUTORISATIONS (§10)
//
// Rien n'est ajouté aux permissions existantes, et c'est volontaire :
//
//   • la tenancy vient de la RLS Postgres. `getAllLeads()` ne porte aucun
//     filtre `owner_id` — un commercial ne reçoit que ses dossiers parce que
//     la base les lui restreint. Le superviseur et le Super Admin voient plus
//     large pour la même raison, sans code de branchement ;
//   • le filtre d'ACTIVITÉ est appliqué ici, côté serveur, exactement comme
//     dans `getSuiviData()` : les dossiers hors périmètre ne sont jamais
//     envoyés au navigateur ;
//   • aucune provenance marketing n'est lue. Cette vue n'en a pas besoin.
//
// La route `/devis-a-realiser` n'est volontairement PAS dans
// `RESTRICTED_MODULES` : c'est une vue de travail commerciale, en amont de la
// signature, donc ouverte au commercial — le cloisonnement après-signature
// n'a pas à bouger.

import { supabaseServer } from "../supabase/server";
import { supabaseServiceRole } from "../supabase/service";
import { selectEnLotsTolerant } from "../supabase/batch";
import { getAllCommerciaux, getAllLeads } from "../leads-server";
import { getCurrentUserProfile } from "../users-server";
import { SECTOR_LABEL, visibleSectorsForUser, type Lead, type Sector } from "../leads";
import { APP_SETTING_KEYS, getNumberSetting } from "../app-settings";
import {
  attendUnDevis, attendUnDevisDe, compter, heuresDepuis, seuilsValides,
  statutDevis, urgenceDe,
  type DevisARealiserData, type EtatDevis, type LigneDevis,
} from "./shared";

// Point d'entrée unique pour le code serveur.
export type { DevisARealiserData } from "./shared";

type DocRow = {
  id: string;
  lead_id: string | null;
  status: string;
  total_ttc: number | null;
  created_at: string;
};

type OptimivvRow = {
  lead_id: string | null;
  sent_at: string | null;
  created_at: string;
  montant_ht: number | null;
};

type ActionRow = { lead_id: string; type: string };

/**
 * État des devis de chaque dossier.
 *
 * ⚠️ Un devis OPTIMIVV sans `sent_at` n'est PAS parti. Le Suivi commercial
 * retient `sent_at ?? created_at` pour afficher une date d'envoi, ce qui
 * revient à présenter un devis jamais envoyé comme envoyé — écart signalé au
 * client, non corrigé ici pour ne pas toucher au module Suivi. Cette vue, dont
 * l'objet même est de ne rien laisser passer entre la découverte et l'envoi,
 * s'en tient à la date réelle.
 */
type EtatInterne = EtatDevis & { preparationLe: string | null; brouillonId: string | null };

async function etatDesDevis(leadIds: string[]): Promise<Map<string, EtatInterne>> {
  const out = new Map<string, EtatInterne>();
  if (leadIds.length === 0) return out;

  const lire = (id: string) => {
    const e = out.get(id);
    if (e) return e;
    const vide: EtatInterne = {
      brouillon: false, brouillonChiffre: false, optimivvNonEnvoye: false,
      photosEnAttente: false, preparationLe: null, brouillonId: null,
    };
    out.set(id, vide);
    return vide;
  };

  const sb = await supabaseServer();
  const [docs, opt] = await Promise.all([
    selectEnLotsTolerant(
      leadIds,
      (lot) => sb
        .from("documents")
        .select("id, lead_id, status, total_ttc, created_at")
        .in("lead_id", lot)
        .eq("type", "devis")
        .returns<DocRow[]>(),
      { table: "documents", filtre: "lead_id IN (…) AND type = devis" },
    ),
    selectEnLotsTolerant(
      leadIds,
      (lot) => sb
        .from("devis_optimivv")
        .select("lead_id, sent_at, created_at, montant_ht")
        .in("lead_id", lot)
        .returns<OptimivvRow[]>(),
      { table: "devis_optimivv", filtre: "lead_id IN (…)" },
    ),
  ]);

  for (const d of docs.rows) {
    if (!d.lead_id) continue;
    if (d.status !== "brouillon") continue;
    const e = lire(d.lead_id);
    e.brouillon = true;
    // Un brouillon chiffré est rédigé, pas seulement ouvert : c'est ce qui
    // distingue « en préparation » de « prêt à envoyer » (§5-2 et §5-4).
    if (d.total_ttc != null && Number(d.total_ttc) > 0) e.brouillonChiffre = true;
    // Début de préparation = création du PREMIER brouillon (§11). Le lien de
    // la liste pointe vers ce même brouillon : celui que le commercial a
    // commencé, pas un doublon plus récent.
    if (!e.preparationLe || d.created_at < e.preparationLe) {
      e.preparationLe = d.created_at;
      e.brouillonId = d.id;
    }
  }

  for (const d of opt.rows) {
    if (!d.lead_id) continue;
    if (d.sent_at) continue; // réellement parti : hors de cette vue
    const e = lire(d.lead_id);
    e.optimivvNonEnvoye = true;
    if (!e.preparationLe || d.created_at < e.preparationLe) e.preparationLe = d.created_at;
  }

  return out;
}

/**
 * Dossiers dont des photos sont attendues.
 *
 * Même source que le Suivi commercial — une action du moteur de type
 * `photos`, encore ouverte. On ne réinvente pas le signal : si les deux vues
 * le calculaient différemment, elles se contrediraient.
 */
async function photosEnAttente(leadIds: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (leadIds.length === 0) return set;
  // Service-role : il ne sert qu'à lire la table d'actions, jamais à élargir
  // le périmètre des dossiers — qui est déjà arrêté par `leadIds`.
  const sb = await supabaseServiceRole();
  const { rows } = await selectEnLotsTolerant(
    leadIds,
    (lot) => sb
      .from("commercial_actions")
      .select("lead_id, type")
      .in("lead_id", lot)
      .eq("type", "photos")
      .neq("status", "terminee")
      .returns<ActionRow[]>(),
    { table: "commercial_actions", filtre: "lead_id IN (…) AND type = photos" },
  );
  for (const r of rows) set.add(r.lead_id);
  return set;
}

export async function getDevisARealiser(): Promise<DevisARealiserData> {
  const [leads, me, tousCommerciaux, vertH, orangeH] = await Promise.all([
    getAllLeads(),
    getCurrentUserProfile(),
    getAllCommerciaux(),
    getNumberSetting(APP_SETTING_KEYS.devisSeuilVertH),
    getNumberSetting(APP_SETTING_KEYS.devisSeuilOrangeH),
  ]);

  const roles = (me?.roles ?? []).map((r) => r.slug);
  const isAdmin = roles.includes("admin");
  const isPlanner = roles.includes("planification");
  const isBackOffice = isAdmin || isPlanner;
  const sectorSet = new Set<string>(
    visibleSectorsForUser({ isAdmin, isPlanner, activities: me?.activities ?? [] }),
  );

  // Deux filtres, dans cet ordre : l'activité (périmètre serveur), puis la
  // règle d'appartenance à la liste.
  const candidats = leads.filter((l) => sectorSet.has(l.sector) && attendUnDevis(l));
  const ids = candidats.map((l) => l.id);

  const [devis, photos] = await Promise.all([etatDesDevis(ids), photosEnAttente(ids)]);

  const seuils = seuilsValides({ vertH, orangeH });
  const now = Date.now();
  const nomParId = new Map(tousCommerciaux.map((c) => [c.id, c.name]));

  const lignes: LigneDevis[] = candidats.map((l: Lead) => {
    const d = devis.get(l.id);
    const photosManquantes = photos.has(l.id);
    const etat: EtatDevis = {
      brouillon: d?.brouillon ?? false,
      brouillonChiffre: d?.brouillonChiffre ?? false,
      optimivvNonEnvoye: d?.optimivvNonEnvoye ?? false,
      photosEnAttente: photosManquantes,
    };
    const heures = heuresDepuis(l.discoveryDoneAt ?? null, now);

    return {
      leadId: l.id,
      shortId: l.shortId,
      client: l.client,
      phone: l.phone,
      adresse: l.address,
      codePostal: l.postalCode,
      ville: l.city,
      pays: l.country ?? null,
      prestation: SECTOR_LABEL[l.sector as Sector] ?? l.sector,
      prestationSlug: l.sector,
      societe: l.entityName ?? null,
      societeId: l.entityId ?? null,
      commercialId: l.ownerId || null,
      commercial: l.ownerId ? nomParId.get(l.ownerId) ?? null : null,
      arriveeLe: l.receivedAt,
      decouverteLe: l.discoveryDoneAt ?? null,
      preparationLe: d?.preparationLe ?? null,
      devisId: d?.brouillonId ?? null,
      heures,
      urgence: urgenceDe(heures, seuils),
      statut: statutDevis(etat),
      photosManquantes,
      photosDemandeesLe: l.photosRequestedAt ?? null,
      isUrgent: Boolean(l.isUrgent),
    };
  });

  // Les listes de filtres ne contiennent que ce qui est RÉELLEMENT présent :
  // un filtre proposant un commercial sans dossier dans la liste donnerait
  // toujours zéro résultat, et laisserait croire à un bug.
  const uniq = (
    cle: (l: LigneDevis) => string | null,
    val: (l: LigneDevis) => string,
  ): { id: string; name: string }[] => {
    const m = new Map<string, string>();
    for (const l of lignes) {
      const k = cle(l);
      if (k) m.set(k, val(l));
    }
    return [...m.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  };

  return {
    lignes,
    compteurs: compter(lignes),
    seuils,
    now,
    commerciaux: isBackOffice
      ? uniq((l) => l.commercialId, (l) => l.commercial ?? l.commercialId ?? "")
      : [],
    prestations: uniq((l) => l.prestationSlug, (l) => l.prestation)
      .map((x) => ({ slug: x.id, label: x.name })),
    societes: uniq((l) => l.societeId, (l) => l.societe ?? ""),
    pays: [...new Set(lignes.map((l) => l.pays).filter((p): p is string => !!p))].sort(),
    isBackOffice,
    isAdmin,
    meId: me?.id ?? null,
  };
}

type CompteRow = {
  discovery_done_at: string | null;
  status: string;
  activity: { slug: string } | null;
};

/**
 * Compteur seul, pour le bouton affiché ailleurs (§2 : tableau de bord, suivi
 * commercial, interfaces des responsables).
 *
 * REQUÊTE DÉDIÉE ET ÉTROITE, et c'est une correction délibérée. La première
 * version appelait `getDevisARealiser()`, en comptant sur la mémoïsation par
 * requête de `getAllLeads()`. Le raisonnement tenait pour /leads, qui charge
 * déjà les leads — mais pas pour /dashboard, qui ne lit `leads` que sur sept
 * colonnes. Le bouton y aurait ajouté une lecture d'une quarantaine de
 * colonnes (près de 900 Ko), plus les devis et les actions, sur une page dont
 * la cible est un affichage sous 2,5 s. C'était une régression.
 *
 * Ici on ne lit que les TROIS champs dont la règle a besoin. Le risque de voir
 * le compteur diverger de la liste est écarté autrement : les deux appellent
 * `attendUnDevisDe()`, la même fonction, et un test compare les deux chemins
 * sur un même jeu de données.
 *
 * `enRetard` suit le seuil configuré, comme la liste.
 */
export async function getDevisARealiserCount(): Promise<{ total: number; enRetard: number }> {
  const [me, orangeH] = await Promise.all([
    getCurrentUserProfile(),
    getNumberSetting(APP_SETTING_KEYS.devisSeuilOrangeH),
  ]);

  const roles = (me?.roles ?? []).map((r) => r.slug);
  const isAdmin = roles.includes("admin");
  const isPlanner = roles.includes("planification");
  const sectorSet = new Set<string>(
    visibleSectorsForUser({ isAdmin, isPlanner, activities: me?.activities ?? [] }),
  );

  const supabase = await supabaseServer();
  // La RLS restreint déjà les lignes au périmètre de l'utilisateur ; le filtre
  // d'activité s'applique par-dessus, comme partout ailleurs.
  const { data, error } = await supabase
    .from("leads")
    .select("discovery_done_at, status, activity:activities(slug)")
    // Pas de `.not("discovery_done_at", "is", null)` ici : cet opérateur fait
    // perdre son type au client Supabase (`data` ressort en `never`), et le
    // contourner par un cast masquerait les erreurs de colonne. Les lignes
    // sans découverte validée sont écartées juste en dessous par la règle
    // elle-même — trois colonnes sur l'ensemble des leads restent sans
    // commune mesure avec la lecture complète qu'on remplace.
    .returns<CompteRow[]>();

  // Un échec de lecture ne doit pas afficher « 0 devis à réaliser », qui se
  // lirait comme une bonne nouvelle : on masque le bouton.
  if (error || !data) return { total: 0, enRetard: 0 };

  const seuils = seuilsValides({ orangeH });
  const limite = Date.now() - seuils.orangeH * 3_600_000;

  let total = 0;
  let enRetard = 0;
  for (const r of data) {
    if (!r.activity?.slug || !sectorSet.has(r.activity.slug)) continue;
    if (!attendUnDevisDe(r.discovery_done_at, r.status)) continue;
    total++;
    const t = r.discovery_done_at ? Date.parse(r.discovery_done_at) : Number.NaN;
    if (Number.isFinite(t) && t <= limite) enRetard++;
  }
  return { total, enRetard };
}
