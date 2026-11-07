import "server-only";

// Comment ce document doit-il être rendu, et la société a-t-elle le droit de
// l'émettre ?
//
// C'est le point de jonction du Lot B : il réunit la résolution du gabarit
// (`gabarits.ts`), l'identité de la société émettrice (`entite-emettrice.ts`),
// la garde à trois crans (`garde-identite.ts`) et l'adaptateur vers les
// gabarits au pixel (`adaptateur-documents.ts`).
//
// Il est le SEUL endroit où ces quatre décisions se prennent ensemble. Un
// appelant qui en reproduirait une partie ferait diverger les deux parcours —
// ce que le Lot B existe pour supprimer.

import { getBooleanSetting, APP_SETTING_KEYS } from "@/lib/app-settings";
import { lireReglageGabarits } from "./reglage-gabarits-server";
import type { DocumentDetail } from "@/lib/documents-shared";
import { supabaseServer } from "@/lib/supabase/server";
import {
  GABARITS,
  resoudreGabarit,
  type GabaritId,
  type ResolutionGabarit,
} from "./gabarits";
import { identitePourEntite, versPrestataire } from "./entite-emettrice";
import { controlerIdentitePourDevis, type VerdictIdentite } from "./garde-identite";
import { versDevisInput } from "./adaptateur-documents";
import type { DevisInput } from "./types";
import { genererDevisBuffer } from "./render";
import { renderToBuffer } from "@react-pdf/renderer";
import DocumentPdf from "@/lib/pdf/DocumentPdf";

export type PlanDeRendu = {
  gabarit: GabaritId;
  resolution: ResolutionGabarit;
  /** Moteur à employer : react-pdf (existant) ou les gabarits au pixel. */
  moteur: "react-pdf" | "pdfkit" | "pdf-lib";
  /** Verdict de la garde d'identité. `null` si la société n'a pas pu être lue. */
  verdict: VerdictIdentite | null;
  /** Prêt à passer à `genererDevisBuffer`. Absent si le moteur est react-pdf. */
  entree?: DevisInput;
  /** Ce qui empêche d'émettre, en clair. Vide = rien n'empêche. */
  refus: string;
};

/**
 * Établit le plan de rendu d'un document.
 *
 * ── Ce qui se passe quand rien n'est réglé ───────────────────────────
 *
 * `resoudreGabarit` rend `cgk_nettoyage` ou `cgk_standard`, donc le moteur
 * `react-pdf`, donc le rendu actuel, sans adaptation ni injection. La garde
 * est quand même exécutée : elle signale, elle ne bloque pas.
 */
export async function planifierRendu(detail: DocumentDetail): Promise<PlanDeRendu> {
  const { doc, lead, entity } = detail;
  const type = doc.type === "devis" ? "devis" : "facture";

  const [reglages, stricte] = await Promise.all([
    lireReglageGabarits(),
    getBooleanSetting(APP_SETTING_KEYS.devisGardeIdentiteStricte),
  ]);

  const resolution = resoudreGabarit({
    entityId: entity.id ?? null,
    secteur: lead.sector,
    type,
    reglages,
  });
  const g = GABARITS[resolution.gabarit];

  const identite = await identitePourEntite(entity.id, lead.sector);
  const verdict = identite
    ? controlerIdentitePourDevis(identite.entite, { stricte })
    : null;

  // Une société illisible n'est PAS « conforme par défaut ». On refuse, parce
  // qu'un devis dont l'émetteur n'a pas pu être lu n'est pas vérifiable.
  if (!identite) {
    return {
      gabarit: resolution.gabarit,
      resolution,
      moteur: g.moteur,
      verdict: null,
      refus:
        "Émission refusée : la société émettrice du document n'a pas pu être lue. "
        + "Vérifiez la fiche dans Réglages › Sociétés.",
    };
  }

  if (verdict && !verdict.emissionAutorisee) {
    return {
      gabarit: resolution.gabarit,
      resolution,
      moteur: g.moteur,
      verdict,
      refus:
        "Émission refusée : la société émettrice ne porte pas les mentions "
        + "obligatoires du devis — "
        + verdict.bloquants.map((b) => b.libelle).join(" · ")
        + ". À compléter dans Réglages › Sociétés.",
    };
  }

  if (g.moteur === "react-pdf") {
    return { gabarit: resolution.gabarit, resolution, moteur: "react-pdf", verdict, refus: "" };
  }

  // ── Gabarits au pixel : on adapte, et on injecte l'identité ────────
  //
  // `identiteDynamique` est TOUJOURS vrai ici. Atteindre ces gabarits depuis
  // le parcours `documents` suppose une société résolue ; laisser le gabarit
  // afficher son identité d'origine produirait un devis au nom d'OPTIMIVV
  // pour une autre société.
  const { prestataire, marque } = versPrestataire(identite);
  const entree = versDevisInput(detail, {
    prestataire,
    marque,
    identiteDynamique: true,
    logoPath: null, // cf. `logoLocalDeLEntite` — aucune société n'a de logo
    template: resolution.gabarit === "optimivv_nettoyage" ? "nettoyage" : "demenagement",
    franchiseEnBase: await franchiseEnBase(entity.id),
    mentionsLegales: entity.legalMentions,
  });

  return {
    gabarit: resolution.gabarit,
    resolution,
    moteur: g.moteur,
    verdict,
    entree,
    refus: "",
  };
}

/**
 * La société est-elle en franchise en base de TVA ?
 *
 * Décide la mention de l'article 293 B. On la lit, on ne la déduit pas d'un
 * taux à zéro : un taux à zéro peut aussi être une exonération sectorielle,
 * et la mention serait alors fausse.
 */
async function franchiseEnBase(entityId: string): Promise<boolean> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("legal_entities")
      .select("is_vat_exempt")
      .eq("id", entityId)
      .maybeSingle<{ is_vat_exempt: boolean | null }>();
    if (error || !data) return false;
    return data.is_vat_exempt === true;
  } catch {
    return false;
  }
}

/**
 * Rend le PDF d'un document, selon le plan.
 *
 * ── Pourquoi un seul point de rendu ─────────────────────────────────
 *
 * Avant le Lot B, TROIS endroits appelaient `renderToBuffer(DocumentPdf(...))`
 * chacun de son côté : la route d'aperçu, l'envoi par courriel, et la
 * génération de la facture d'acompte. Un réglage de gabarit appliqué à un
 * seul des trois aurait produit un aperçu qui ne ressemble pas à la pièce
 * jointe reçue par le client. C'est la divergence que le client a interdite.
 *
 * `bloquant` distingue les deux usages : AFFICHER un document déjà créé ne
 * doit jamais être refusé — les dix-huit devis existants doivent rester
 * consultables. ÉMETTRE, si.
 */
export async function rendreDocument(
  detail: DocumentDetail,
  options: { bloquant?: boolean } = {},
): Promise<
  | { ok: true; buffer: Buffer; plan: PlanDeRendu }
  | { ok: false; error: string; plan: PlanDeRendu }
> {
  const plan = await planifierRendu(detail);

  if (options.bloquant === true && plan.refus) {
    return { ok: false, error: plan.refus, plan };
  }

  if (plan.moteur !== "react-pdf" && plan.entree) {
    const buffer = await genererDevisBuffer(plan.entree);
    return { ok: true, buffer, plan };
  }

  // react-pdf — le rendu en place, inchangé. `DocumentPdf` est appelé comme
  // une fonction : il renvoie directement l'élément <Document> attendu par
  // `renderToBuffer`, et passer par `React.createElement` perdrait le type.
  const buffer = await renderToBuffer(DocumentPdf({ detail }));
  return { ok: true, buffer, plan };
}
