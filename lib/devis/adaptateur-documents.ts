// Adaptateur : un document du CRM rendu par les gabarits pdfkit / pdf-lib.
//
// ── LE PROBLÈME ───────────────────────────────────────────────────────
//
// Le CRM porte deux parcours de devis qui ne se parlent pas :
//
//   `documents`       le moteur de rédaction (101 opérations), l'identité de
//                     la société, les garde-fous, la numérotation partagée.
//                     Rendu par react-pdf.
//   `devis_optimivv`  les gabarits au pixel — la maquette déménagement et le
//                     design nettoyage fourni par le client. Rendu par
//                     pdfkit / pdf-lib, depuis un formulaire de saisie libre.
//
// Tout ce que le second apporte, c'est sa PRÉSENTATION. Ce module la rend
// accessible au premier, en traduisant un `DocumentDetail` vers le contrat de
// données du générateur (`DevisInput`).
//
// ── CE QU'IL NE FAIT PAS ──────────────────────────────────────────────
//
// Il ne déplace aucune donnée, ne touche pas à `devis_optimivv` et ne
// renomme rien. Les 22 devis déjà émis par l'ancien parcours restent lisibles
// et leurs treize modules dépendants continuent de fonctionner. C'est une
// bascule de RENDU, pas une migration.
//
// Pur, sans I/O : l'identité et le gabarit sont résolus par l'appelant.

import type { DocumentDetail } from "@/lib/documents-shared";
import type { DevisInput, Marque, Prestataire } from "./types";

/** Date ISO → « JJ/MM/AAAA », dans le fuseau d'affichage du CRM. */
const PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function dateFr(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : PARIS.format(d);
}

/**
 * Lignes du document → description imprimée sur le gabarit.
 *
 * ── Pourquoi les notes passent AVANT les lignes ──────────────────────
 *
 * Quand le moteur de rédaction a travaillé, le texte contractuel complet —
 * prestation, détail, réserves — est dans `doc.notes`. Les lignes ne sont
 * alors que le découpage tarifaire, et les réimprimer dirait deux fois la
 * même chose en moins bien.
 *
 * Sans notes (document saisi à la main), on compose depuis les lignes. Les
 * PRIX n'y figurent pas : le gabarit a sa propre case de montant, et les
 * répéter dans le descriptif a déjà produit des devis contradictoires.
 */
export function descriptionDepuisDocument(doc: DocumentDetail["doc"]): string {
  const notes = (doc.notes ?? "").trim();
  if (notes) return notes;
  return doc.lines
    .map((l) => {
      const q = l.quantity && l.quantity !== 1 ? `${l.quantity} ${l.unit} — ` : "";
      return `- ${q}${l.label}`.trim();
    })
    .filter((s) => s !== "-")
    .join("\n");
}

/**
 * Mention de TVA imprimée en bas du gabarit.
 *
 * Une société en franchise en base DOIT porter l'article 293 B ; une société
 * assujettie ne doit PAS le porter, sous peine d'une mention fausse. On ne
 * devine pas : la fiche société porte l'information.
 */
export function mentionTva(args: {
  franchiseEnBase: boolean;
  mentionsLegales?: string;
}): string {
  const perso = (args.mentionsLegales ?? "").trim();
  if (perso) return perso;
  return args.franchiseEnBase
    ? "TVA non applicable, article 293 B du Code Général des Impôts (CGI)."
    : "";
}

/**
 * Ce qui figure en face de « LIEU D'INTERVENTION » sur le gabarit.
 *
 * ── Pourquoi un déménagement est un cas à part ──────────────────────
 *
 * Un déménagement n'a pas UN lieu, il a un TRAJET. Imprimer l'adresse du
 * client y est faux : c'est l'une des deux extrémités, et rien ne dit
 * laquelle. L'ancien parcours OPTIMIVV composait déjà « Paris » Lyon » ; le
 * perdre en basculant sur `documents` aurait dégradé le document.
 *
 * Les villes viennent des colonnes du lead, renseignées par le formulaire du
 * site déménagement. Si l'une manque, on ne fabrique pas de trajet : on
 * retombe sur l'adresse, qui est au moins vraie.
 */
export function lieuIntervention(lead: DocumentDetail["lead"]): string {
  const depart = (lead.moveFromCity ?? "").trim();
  const arrivee = (lead.moveToCity ?? "").trim();
  if (lead.sector === "demenagement" && depart && arrivee) {
    return `${depart} » ${arrivee}`;
  }
  return [lead.address, [lead.postalCode, lead.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

export type ContexteAdaptation = {
  /** Identité résolue de la société émettrice — jamais devinée. */
  prestataire: Prestataire;
  marque: Marque;
  /** Vrai si le gabarit doit dessiner l'identité (voie 0 / injection). */
  identiteDynamique: boolean;
  /** Emblème de la société sur disque, ou null. */
  logoPath?: string | null;
  /** Modèle graphique : « nettoyage » (design fourni) ou « demenagement ». */
  template: "nettoyage" | "demenagement";
  franchiseEnBase: boolean;
  mentionsLegales?: string;
};

/**
 * `DocumentDetail` → `DevisInput`.
 *
 * Le numéro vient du document : il a DÉJÀ été alloué par la séquence sans
 * trou. Ce chemin ne doit jamais en consommer un second — un rendu n'est pas
 * une émission.
 */
export function versDevisInput(
  detail: DocumentDetail,
  ctx: ContexteAdaptation,
): DevisInput {
  const { doc, lead } = detail;
  const lieu = lieuIntervention(lead);

  return {
    docType: doc.type === "devis" ? "devis" : "facture",
    template: ctx.template,
    numero: doc.num,
    date_emission: dateFr(doc.issuedAt),
    validite_jours: 30,
    acompte_pct: doc.acomptePct ?? 0,
    mention_tva: mentionTva({
      franchiseEnBase: ctx.franchiseEnBase,
      mentionsLegales: ctx.mentionsLegales,
    }),
    client: {
      nom: lead.client,
      adresse: lead.address || undefined,
      adresse2: [lead.postalCode, lead.city].filter(Boolean).join(" ") || undefined,
      telephone: lead.phone || undefined,
      email: lead.email || undefined,
    },
    lieu_intervention: lieu || undefined,
    description: descriptionDepuisDocument(doc),
    // Le HT stocké est exact, TVA mixte comprise. On ne le recalcule pas
    // depuis les lignes : un arrondi de recalcul produirait un montant qui
    // diffère du document enregistré.
    montant_ht: doc.totalHt ?? null,
    prestataire: ctx.prestataire,
    marque: ctx.marque,
    identiteDynamique: ctx.identiteDynamique,
    logoPath: ctx.logoPath ?? null,
  };
}
