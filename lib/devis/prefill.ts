import { getGridBySlug } from "@/lib/pricing/grid-server";
import { computeGrid } from "@/lib/pricing/grid-compute";
import { buildGridInput } from "@/lib/pricing/grid-discovery";
import "server-only";
import { getLeadDetail, getLegalEntityPhone, type LeadDetail } from "@/lib/leads-server";
import { getTemplatesForUser, type MessageTemplate } from "@/lib/message-templates-server";
import { leadTemplateVars } from "@/lib/message-templates-shared";
import { getCurrentUserProfile } from "@/lib/users-server";
import { DEFAULT_ACOMPTE_PCT, formatEUR } from "@/lib/leads";
import {
  LOGEMENT_TYPE,
  VOLUME_DEMENAGEMENT,
  EMBALLAGE,
  OBJETS_SPECIFIQUES,
  type Option,
} from "@/lib/discovery-metier";

// Données de préremplissage du formulaire « nouveau devis » à partir d'une
// affaire (?affaire=<id|short_id>). Lecture RLS-scopée via getLeadDetail : un
// commercial ne peut préremplir que depuis SES leads.
export type DevisPrefill = {
  leadId: string;
  sector: string; // secteur du lead → choix du modèle graphique du PDF
  client: {
    nom: string;
    adresse?: string;
    adresse2?: string;
    telephone?: string;
    email?: string;
  };
  lieu_intervention?: string;
  description?: string;
  montant_ht?: number | null;
};

const labelOf = (options: Option[], value: string): string =>
  options.find((o) => o.value === value)?.label ?? value;

// Compose lieu + description à partir de la découverte déménagement
// (discovery_details). Renvoie {} si aucune donnée déménagement exploitable.
function demenagementFromDiscovery(
  d: Record<string, unknown>,
): { lieu?: string; description?: string } {
  const str = (k: string): string =>
    typeof d[k] === "string" ? (d[k] as string) : d[k] != null ? String(d[k]) : "";
  const objets = Array.isArray(d.objetsSpecifiques)
    ? (d.objetsSpecifiques as unknown[]).map(String)
    : [];

  const depart = str("adresseDepart").trim();
  const arrivee = str("adresseArrivee").trim();
  const lieu = depart && arrivee ? `${depart} » ${arrivee}` : undefined;

  const logement = str("logementDepart");
  const volume = str("volume");
  const distance = str("distanceKm");
  const emballage = str("emballage");
  const etD = str("etagesDepart");
  const etA = str("etagesArrivee");

  const parts: string[] = [];
  let l1 = "Déménagement";
  if (logement) l1 += ` — ${labelOf(LOGEMENT_TYPE, logement).toLowerCase()}`;
  if (volume) l1 += ` · volume estimé ${labelOf(VOLUME_DEMENAGEMENT, volume)}`;
  if (distance) l1 += ` · distance ${distance} km`;
  parts.push(l1 + ".");

  const acces: string[] = [];
  if (etD) acces.push(`départ étage ${etD}`);
  if (etA) acces.push(`arrivée étage ${etA}`);
  if (str("ascenseurDepart") === "non" || str("ascenseurArrivee") === "non") {
    acces.push("sans ascenseur");
  }
  if (str("monteMeubles") === "oui") acces.push("monte-meubles nécessaire");
  if (acces.length) parts.push("Accès : " + acces.join(", ") + ".");

  if (emballage && emballage !== "aucun") {
    parts.push(`Emballage : ${labelOf(EMBALLAGE, emballage).toLowerCase()}.`);
  }
  if (str("demontage") === "oui") {
    parts.push("Démontage et remontage du mobilier.");
  }
  if (objets.length) {
    parts.push(
      "Objets spécifiques : " +
        objets.map((o) => labelOf(OBJETS_SPECIFIQUES, o).toLowerCase()).join(", ") +
        ".",
    );
  }

  // Description utile seulement si on a au moins un élément concret.
  const hasSubstance = Boolean(logement || volume || depart || arrivee || objets.length);
  return {
    lieu,
    description: hasSubstance ? parts.join("\n") : undefined,
  };
}

function buildPrefill(detail: LeadDetail): DevisPrefill {
  const l = detail.lead;

  const nom =
    l.client ||
    [l.firstName, l.lastName].filter(Boolean).join(" ") ||
    l.company ||
    "";
  const adresse2 = [l.postalCode, l.city].filter(Boolean).join(" ").trim();

  // Enrichissement déménagement depuis la découverte métier (si présente).
  const dm =
    l.sector === "demenagement" && l.discoveryDetails
      ? demenagementFromDiscovery(l.discoveryDetails)
      : {};

  return {
    leadId: l.id,
    sector: l.sector,
    client: {
      nom,
      adresse: l.address || undefined,
      adresse2: adresse2 || undefined,
      telephone: l.phone || undefined,
      email: l.email || undefined,
    },
    lieu_intervention: dm.lieu || l.city || undefined,
    description: dm.description || l.typeService || undefined,
    // Rempli par getDevisPageData, qui seul a accès à la grille tarifaire.
    montant_ht: null,
  };
}

/**
 * Montant HT à proposer dans le devis.
 *
 * ⚠️ `announced_price` est VOLONTAIREMENT écarté : la découverte le saisit en
 * TTC (cf. libellé du champ) alors que le devis se rédige en HT. Les mélanger
 * produirait un devis faux de 20 %. Les deux sources retenues ci-dessous sont
 * l'une et l'autre du HT, issues du même moteur.
 *
 * Ordre : recommandation FIGÉE à l'enregistrement de la découverte, puis
 * recalcul courant. Rien n'est proposé si le moteur ne produit pas de prix —
 * un devis à 0 € vaut mieux qu'un devis faux.
 */
async function montantRecommande(detail: LeadDetail): Promise<number | null> {
  const l = detail.lead;
  if (l.priceRecommended != null && l.priceRecommended > 0) return l.priceRecommended;

  // getGridBySlug applique la règle de diffusion : un commercial à qui le
  // barème n'est pas ouvert ne reçoit aucun montant, ici comme ailleurs.
  const grille = await getGridBySlug(l.sector);
  if (!grille) return null;
  const { input } = buildGridInput({
    sector: l.sector,
    surfaceM2: l.surfaceM2 ?? null,
    details: l.discoveryDetails ?? {},
    delaiSouhaite: l.delaiSouhaite ?? null,
    isUrgent: Boolean(l.isUrgent),
    etatSalete: l.etatSalete ?? null,
  });
  const res = computeGrid(grille, input);
  return res.ok && res.conseille > 0 ? res.conseille : null;
}

// Données complètes de la page « nouveau devis » : préremplissage + modèles de
// relance e-mail (portée rôle/profil, filtrés au secteur du lead) + variables
// réelles du lead pour l'interpolation des modèles. Un seul getLeadDetail.
export type DevisPageData = {
  prefill: DevisPrefill | null;
  templates: MessageTemplate[];
  /** Pourquoi la liste de modeles est vide. Null si elle ne l est pas.
   *  « sans_profil » : aucun profil commercial sur le compte, donc aucune
   *  audience, donc aucun modele — cause de loin la plus frequente. */
  motifSansModele: "sans_profil" | "aucun_modele" | null;
  vars: Record<string, string>;
};

export async function getDevisPageData(
  affaire?: string | null,
): Promise<DevisPageData> {
  if (!affaire) return { prefill: null, templates: [], motifSansModele: null, vars: {} };
  const detail = await getLeadDetail(affaire);
  if (!detail) return { prefill: null, templates: [], motifSansModele: null, vars: {} };

  const prefill = buildPrefill(detail);
  prefill.montant_ht = await montantRecommande(detail);
  const [emailTemplates, me] = await Promise.all([
    getTemplatesForUser("email"),
    getCurrentUserProfile(),
  ]);

  const l = detail.lead;
  // Ne garder que les modèles globaux ou ciblant le secteur du lead.
  //
  // La catégorie "photos" est écartée : réclamer des photos appartient à la
  // phase CONTACT, sur la fiche lead. Ici on compose l'e-mail qui ACCOMPAGNE le
  // devis — une demande de photos n'y a pas sa place. C'est le symétrique du
  // filtre de la fiche lead, qui écarte à l'inverse les modèles "devis" :
  // chaque écran ne propose que les modèles de son moment du cycle.
  const templates = emailTemplates.filter(
    (t) =>
      (!t.activitySlug || t.activitySlug === l.sector) && t.category !== "photos",
  );

  // Pourquoi la liste est-elle vide ? Les modèles sont ciblés par AUDIENCE,
  // elle-même dérivée du profil commercial. Sans profil attribué, l'utilisateur
  // n'a aucune audience et aucun modèle ne passe — ce qui n'a rien à voir avec
  // un manque de modèles. On distingue les deux pour que le message soit juste.
  const motifSansModele: "sans_profil" | "aucun_modele" | null =
    templates.length > 0
      ? null
      : (me?.commercialProfiles ?? []).length === 0
        ? "sans_profil"
        : "aucun_modele";

  // Baseline montants/acompte depuis le dernier devis du lead ; à défaut,
  // acompte négocié puis défaut secteur, et montant estimé du lead. Ces valeurs
  // sont surchargées côté client par le montant/acompte réellement saisis dans
  // le formulaire de devis (cf. NouveauDevis.tsx).
  const docs = detail.documents ?? [];
  const devisForVars =
    docs.find((d) => d.type === "devis" && d.status !== "brouillon") ??
    docs.find((d) => d.type === "devis");
  const acomptePctNum =
    devisForVars?.acomptePct ?? l.acompteNegocie ?? DEFAULT_ACOMPTE_PCT[l.sector];
  const totalTtc = devisForVars?.totalTtc ?? l.amount ?? 0;
  const acompteAmt =
    devisForVars?.acompteAmount ??
    (totalTtc && acomptePctNum ? Math.round(totalTtc * acomptePctNum) / 100 : 0);
  const societePhone = l.entityId ? await getLegalEntityPhone(l.entityId) : "";

  const vars = leadTemplateVars(l, {
    commercialName: me?.displayName ?? "",
    commercialFirstName: me?.firstName ?? "",
    commercialEmail: me?.email ?? "",
    societeName: l.entityName ?? undefined,
    societePhone,
    devisNum: devisForVars?.num ?? "",
    acomptePct: acomptePctNum != null ? `${acomptePctNum} %` : "",
    montantTotal: totalTtc ? formatEUR(totalTtc) : "",
    montantAcompte: acompteAmt ? formatEUR(acompteAmt) : "",
    montantSolde: totalTtc && acompteAmt ? formatEUR(totalTtc - acompteAmt) : "",
  });

  return { prefill, templates, motifSansModele, vars };
}
