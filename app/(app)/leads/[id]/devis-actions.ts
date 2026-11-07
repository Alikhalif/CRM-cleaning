"use server";

// « Générer le devis » depuis la fiche découverte.
//
// CE QUE CETTE ACTION FAIT, ET CE QU'ELLE NE FAIT PAS.
//
// Elle relie trois pièces qui existaient déjà et ne se parlaient pas :
//   • la découverte enregistrée (`leads.discovery_details`, surface, état…) ;
//   • le moteur de rédaction `lib/generation/devis-contenu.ts`, écrit le
//     31 octobre et jamais appelé ;
//   • le modèle de devis générique (`documents` + `document_lines`), via la
//     MÊME action `createDevis` que l'éditeur manuel — rien n'est réécrit, les
//     totaux sont recalculés côté serveur et le numéro reste alloué par le
//     déclencheur Postgres.
//
// ELLE N'ENVOIE RIEN. Le devis est créé en `brouillon`. L'envoi au client
// reste un geste explicite du commercial, depuis la fiche du document.
//
// AUTORISATIONS : aucune garde ajoutée, et c'est voulu. `getLeadDetail` lit
// à travers la session, donc la RLS écarte déjà les dossiers d'un autre
// commercial ; `createDevis` applique ses propres règles d'écriture. Ajouter
// un contrôle ici créerait une seconde source de vérité.

import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { getLeadDetail } from "@/lib/leads-server";
import { montantRecommande } from "@/lib/devis/prefill";
import { ensureClientFromLead } from "@/app/(app)/clients/new/actions";
import {
  createDevis,
  updateDevisBrouillon,
  type DraftInput,
} from "@/app/(app)/devis/new/actions";
import { notesDevis } from "@/lib/generation/devis-depuis-decouverte";
import { redigerPourLead } from "@/lib/devis/redaction-pour-lead-server";
import { enregistrerVersion } from "@/lib/devis/versions-server";
import {
  DEFAULT_ACOMPTE_PCT,
  DEFAULT_PAYMENT_TERM,
  type Sector,
} from "@/lib/leads";

export type GenererDevisResult =
  | {
      ok: true;
      devisId: string;
      num: string;
      /** Un brouillon existait déjà : on l'a repris, pas dupliqué. */
      repris: boolean;
      /** Champs de la découverte réellement utilisés par la rédaction. */
      sources: string[];
      /** Informations utiles manquantes — le texte ne les a pas inventées. */
      manquant: string[];
      /** Formulations proscrites détectées dans le texte produit (§3.4). */
      alertes: string[];
    }
  | { ok: false; error: string };

const jour = (d: Date): string => d.toISOString().slice(0, 10);


/**
 * Prépare le devis d'un dossier à partir de sa découverte.
 *
 * IDEMPOTENT. Un deuxième clic ne crée pas un deuxième brouillon : le
 * brouillon existant est renvoyé tel quel. Pour écraser son contenu par une
 * rédaction fraîche — après avoir complété la découverte, typiquement — il
 * faut passer `regenerer: true`, ce que l'interface demande à confirmer.
 */
export async function genererDevisDepuisDecouverte(
  leadId: string,
  options?: { regenerer?: boolean },
): Promise<GenererDevisResult> {
  if (!leadId) return { ok: false, error: "Dossier introuvable." };

  const detail = await getLeadDetail(leadId);
  if (!detail) return { ok: false, error: "Dossier introuvable." };
  const lead = detail.lead;

  // ── 1. Un brouillon existe-t-il déjà ? ────────────────────────────
  const brouillon =
    detail.documents.find((d) => d.type === "devis" && d.status === "brouillon") ?? null;

  if (brouillon && !options?.regenerer) {
    return {
      ok: true,
      devisId: brouillon.id,
      num: brouillon.num,
      repris: true,
      sources: [],
      manquant: [],
      alertes: [],
    };
  }

  // ── 2 et 3. Société émettrice, puis rédaction ─────────────────────
  //
  // ⚠️ LE MÊME CODE QUE `/devis/nouveau` (Lot B). La résolution de la société,
  // la mention des produits selon son pays, la terminologie, la rédaction et
  // les signalements vivaient ici, donc l'autre écran ne pouvait pas les
  // employer : il recopiait les champs de la découverte, et le même dossier
  // produisait deux textes différents selon le bouton employé.
  //
  // Tout est passé dans `redigerPourLead` — même ordre, mêmes signalements,
  // même texte. La GARDE CROISÉE du Lot A y est comprise : un devis OPTIMIVV
  // déjà présent sur le dossier est signalé sans bloquer.
  const redaction = await redigerPourLead({
    id: leadId,
    sector: lead.sector,
    surfaceM2: lead.surfaceM2 ?? null,
    etatSalete: lead.etatSalete ?? null,
    discoveryDetails: lead.discoveryDetails ?? null,
    discoveryDoneAt: lead.discoveryDoneAt ?? null,
    contexteIntervention: lead.contexteIntervention ?? null,
  });
  if (!redaction.ok) return { ok: false, error: redaction.error };
  const { contenu, entite } = redaction;
  const gen = { contenu, alertes: redaction.alertes };
  gen.contenu.manquant.push(...redaction.signalements);

  const conv = await ensureClientFromLead(leadId);
  if (!conv.ok) return { ok: false, error: conv.error };

  // Montant HT issu du moteur tarifaire — jamais du texte généré, qui n'a pas
  // le droit de contenir un prix. `null` quand aucun barème ne s'applique ou
  // qu'il n'est pas ouvert au commercial : le brouillon part alors à 0 € et
  // s'affiche « En préparation » dans « Devis à réaliser », ce qui est
  // exactement l'état réel du dossier.
  const montantHt = await montantRecommande(detail);

  const aujourdHui = new Date();
  const dans30Jours = new Date(aujourdHui);
  dans30Jours.setDate(dans30Jours.getDate() + 30);

  const sector = lead.sector as Sector;
  const payload: DraftInput = {
    clientId: conv.clientId,
    entityId: entite.entityId,
    issuedAt: jour(aujourdHui),
    validUntil: jour(dans30Jours),
    paymentTermSlug: DEFAULT_PAYMENT_TERM[sector] ?? "30j",
    acomptePct: DEFAULT_ACOMPTE_PCT[sector] ?? 0,
    // Détail et réserves : le modèle générique n'a qu'un champ libre, rendu
    // tel quel dans le PDF.
    notes: notesDevis(gen.contenu),
    lines: [
      {
        // La DÉSIGNATION devient le libellé de la ligne de prestation.
        label: gen.contenu.designation,
        quantity: 1,
        unit: "forfait",
        unitPriceHt: montantHt ?? 0,
        vatRate: entite.vatRate,
        discountPct: 0,
      },
    ],
  };

  // ── 4. Écriture, par le chemin existant ───────────────────────────
  const res =
    brouillon && options?.regenerer
      ? await updateDevisBrouillon(brouillon.id, payload)
      : await createDevis(payload, "draft");
  if (!res.ok) return { ok: false, error: res.error };

  // M1 — la version telle que le MOTEUR l'a écrite, avant toute retouche.
  // C'est la référence qui permettra plus tard de distinguer ce que le
  // moteur a rédigé de ce qu'un commercial a réécrit. Meilleur effort : un
  // historique indisponible ne doit pas empêcher de préparer un devis.
  await enregistrerVersion({
    documentId: res.id,
    designation: gen.contenu.designation,
    notes: notesDevis(gen.contenu),
    origine: "moteur",
    note: options?.regenerer ? "régénération depuis la découverte" : undefined,
  });

  revalidatePath("/devis-a-realiser");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/comptabilite");

  await auditLog({
    action: "lead.devis.generate",
    entityType: "lead",
    entityId: leadId,
    after: {
      devisId: res.id,
      num: res.num,
      regenere: Boolean(brouillon && options?.regenerer),
      sector: lead.sector,
      montantHt: montantHt ?? 0,
      sources: gen.contenu.sources.length,
      manquant: gen.contenu.manquant,
      alertes: gen.alertes,
    },
  });

  return {
    ok: true,
    devisId: res.id,
    num: res.num,
    repris: false,
    sources: gen.contenu.sources,
    manquant: gen.contenu.manquant,
    alertes: gen.alertes,
  };
}
