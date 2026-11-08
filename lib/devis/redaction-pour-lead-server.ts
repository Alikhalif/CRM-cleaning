import "server-only";

// La rédaction d'un devis à partir d'un dossier — UN SEUL endroit.
//
// ── CE QUE CE MODULE UNIFIE ──────────────────────────────────────────
//
// Deux écrans créent un devis, et ils ne rédigeaient pas de la même façon :
//
//   Fiche lead → « Générer le devis »   appelait le moteur de rédaction :
//                                       101 opérations, structure PRESTATION /
//                                       DÉTAIL / RÉSERVES, mention des
//                                       produits selon le pays, terminologie.
//
//   /devis/nouveau                      recopiait les champs de la découverte
//                                       par `demenagementFromDiscovery` —
//                                       quelques phrases, aucune réserve,
//                                       aucune mention, aucune structure.
//
// Le même dossier produisait donc deux textes différents selon le bouton
// employé. Ce module est la règle unique : les deux écrans l'appellent, et
// obtiennent le même texte pour le même dossier.
//
// ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────
//
// Il n'écrit rien. Ni document, ni ligne, ni journal : il RÉDIGE, et rend le
// résultat à l'appelant, qui décide d'en faire un brouillon, un aperçu ou
// rien du tout. C'est ce qui permet à `/devis/nouveau` de l'employer pour un
// simple préremplissage sans créer quoi que ce soit.

import {
  MOTIF_LABEL,
  genererDepuisLead,
  notesDevis,
  type LeadPourGeneration,
} from "@/lib/generation/devis-depuis-decouverte";
import type { ContenuDevis } from "@/lib/generation/devis-contenu";
import { mentionPourEntite } from "@/lib/generation/mentions-produits-server";
import { terminologiePourEntite } from "@/lib/generation/terminologie-server";
import { devisExistantsPourLead } from "./garde-doublon";
import { resoudreEntiteDuLead } from "./entite-emettrice";

export type RedactionPourLead =
  | {
      ok: true;
      contenu: ContenuDevis;
      /** Texte prêt à poser dans les notes du document ou dans le formulaire. */
      notes: string;
      entite: { entityId: string; vatRate: number };
      /** Ce qui manque ou mérite l'attention du commercial, dans l'ordre. */
      signalements: string[];
      /**
       * Formulations proscrites relevées dans le texte produit (§3.4).
       *
       * Distinctes des signalements : une alerte porte sur ce que le moteur A
       * ÉCRIT, un signalement sur ce qui lui a manqué pour écrire.
       */
      alertes: string[];
    }
  | { ok: false; error: string };

/** Ce que l'appelant doit fournir du dossier. Structural : testable sans base. */
export type DossierARediger = LeadPourGeneration & { id: string };

/**
 * Rédige le devis d'un dossier.
 *
 * L'ordre des opérations est celui arrêté le 2026-11-06 : la société
 * émettrice D'ABORD, parce que c'est son PAYS qui décide de la mention des
 * produits et de la terminologie, dont le moteur a besoin pour rédiger.
 */
export async function redigerPourLead(
  dossier: DossierARediger,
): Promise<RedactionPourLead> {
  // ── 1. Société émettrice ──────────────────────────────────────────
  const entite = await resoudreEntiteDuLead(dossier.id);
  if (!entite) {
    return {
      ok: false,
      error:
        "Aucune société émettrice n'est enregistrée : créez-en une dans "
        + "Réglages › Sociétés émettrices.",
    };
  }

  // Les deux résolutions lisent le pays de la MÊME société émettrice, et
  // c'est voulu : la mention des produits et le nom du document sont deux
  // conséquences du même fait juridique — qui signe.
  const [resolutionMention, resolutionTermino, autres] = await Promise.all([
    mentionPourEntite(entite.entityId),
    terminologiePourEntite(entite.entityId),
    devisExistantsPourLead(dossier.id),
  ]);

  // ── 2. Rédaction, à partir des seuls champs saisis ────────────────
  const gen = genererDepuisLead({
    sector: dossier.sector,
    surfaceM2: dossier.surfaceM2 ?? null,
    etatSalete: dossier.etatSalete ?? null,
    discoveryDetails: dossier.discoveryDetails ?? null,
    discoveryDoneAt: dossier.discoveryDoneAt ?? null,
    contexteIntervention: dossier.contexteIntervention ?? null,
    mentionProduits: resolutionMention.mention,
    terminologie: resolutionTermino.terminologie,
  });
  if (!gen.ok) return { ok: false, error: MOTIF_LABEL[gen.motif] };

  // ── 3. Signalements — on signale, on n'invente pas ────────────────
  const signalements: string[] = [];
  if (resolutionMention.mention === null && resolutionMention.motif === "pays_inconnu") {
    signalements.push(
      "pays de la société émettrice : aucune mention de produits ne peut être "
      + "portée au devis (à renseigner dans Réglages › Sociétés émettrices)");
  }
  // ── Les deux cas nés de l'activation PAR SOCIÉTÉ (2026-11-08) ─────
  //
  // Sans ces deux signalements, l'absence de mention et une mention héritée
  // se lisent tous deux comme « rien à signaler » — alors que le premier cas
  // prive le devis d'une mention attendue, et que le second fait porter à
  // cette société une allégation qu'elle n'a pas explicitement assumée.
  if (resolutionMention.mention === null && resolutionMention.motif === "societe_non_activee") {
    signalements.push(
      "cette société émettrice n'a pas assumé la mention des produits pour son "
      + "pays : le devis partira sans elle (à cocher dans Réglages › Intégrations)");
  }
  if (resolutionMention.mention !== null && resolutionMention.origine === "pays_herite") {
    signalements.push(
      "la mention des produits vient du réglage PAR PAYS, pas de cette société : "
      + "elle porte donc une allégation qu'elle n'a pas explicitement assumée "
      + "(à confirmer société par société dans Réglages › Intégrations)");
  }
  const optimivv = autres.filter((d) => d.origine === "devis_optimivv");
  if (optimivv.length > 0) {
    signalements.push(
      `attention : un devis ${optimivv[0].numero} existe déjà sur ce dossier, établi par `
      + "le générateur. Vérifiez lequel des deux doit partir au client.");
  }
  if (!resolutionTermino.paysReconnu) {
    signalements.push(
      "terminologie : le document est rédigé selon l'usage français, faute de "
      + "pays exploitable sur la société émettrice");
  }

  return {
    ok: true,
    contenu: gen.contenu,
    notes: notesDevis(gen.contenu),
    entite,
    signalements,
    alertes: gen.alertes,
  };
}
