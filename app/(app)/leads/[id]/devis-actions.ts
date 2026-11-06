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
import { supabaseServer } from "@/lib/supabase/server";
import { getLeadDetail } from "@/lib/leads-server";
import { montantRecommande } from "@/lib/devis/prefill";
import { mentionProduitsPourEntite } from "@/lib/generation/mentions-produits-server";
import { ensureClientFromLead } from "@/app/(app)/clients/new/actions";
import {
  createDevis,
  updateDevisBrouillon,
  type DraftInput,
} from "@/app/(app)/devis/new/actions";
import {
  MOTIF_LABEL,
  genererDepuisLead,
  notesDevis,
} from "@/lib/generation/devis-depuis-decouverte";
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
 * Société émettrice du devis.
 *
 * Ordre : celle déjà portée par le dossier, puis celle déclarée par défaut
 * pour l'activité (`legal_entity_activities.is_default`, index unique partiel
 * qui garantit l'unicité), puis la première disponible. On ne demande rien au
 * commercial : il pourra changer dans l'éditeur.
 */
async function resoudreEntite(
  leadId: string,
): Promise<{ entityId: string; vatRate: number } | null> {
  const sb = await supabaseServer();

  const { data: lead } = await sb
    .from("leads")
    .select("entity_id, activity_id")
    .eq("id", leadId)
    .maybeSingle<{ entity_id: string | null; activity_id: string | null }>();

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
    if (e) return { entityId: e.id, vatRate: Number(e.default_vat_rate) };
  }

  const { data: premiere } = await sb
    .from("legal_entities")
    .select("id, default_vat_rate")
    .order("legal_name", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; default_vat_rate: number | string }>();
  if (!premiere) return null;
  return { entityId: premiere.id, vatRate: Number(premiere.default_vat_rate) };
}

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

  // ── 2. Société émettrice — AVANT la rédaction ─────────────────────
  //
  // Remontée ici le 2026-11-06 (C1) : c'est la société qui porte la mention
  // des produits d'entretien, et le moteur en a besoin pour rédiger. La
  // résolution est inchangée — `leads.entity_id`, à défaut l'entité par
  // défaut de l'activité.
  const entite = await resoudreEntite(leadId);
  if (!entite) {
    return {
      ok: false,
      error: "Aucune société émettrice n'est enregistrée : créez-en une dans Réglages › Sociétés émettrices.",
    };
  }

  // ── 3. Rédaction, à partir des seuls champs saisis ────────────────
  const gen = genererDepuisLead({
    sector: lead.sector,
    surfaceM2: lead.surfaceM2 ?? null,
    etatSalete: lead.etatSalete ?? null,
    discoveryDetails: lead.discoveryDetails ?? null,
    discoveryDoneAt: lead.discoveryDoneAt ?? null,
    contexteIntervention: lead.contexteIntervention ?? null,
    // `null` tant que la société n'a pas déclaré de mention : aucune
    // affirmation sur l'origine ou le caractère écologique des produits
    // n'est portée par défaut.
    mentionProduits: await mentionProduitsPourEntite(entite.entityId),
  });
  if (!gen.ok) return { ok: false, error: MOTIF_LABEL[gen.motif] };

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
