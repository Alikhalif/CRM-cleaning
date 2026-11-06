"use server";

// Rédaction assistée du devis — les huit fonctions du §17 du master prompt.
//
// ── CE QUE CES ACTIONS NE FONT PAS ────────────────────────────────────
//
// ELLES N'ÉCRIVENT RIEN. Chacune RENVOIE une proposition de rédaction ; c'est
// l'éditeur qui l'applique à son brouillon local, et c'est le bouton
// « Enregistrer » existant qui écrit. Trois exigences du §17 en découlent
// directement :
//
//   • « ne jamais écraser silencieusement une modification humaine » — rien
//     n'est écrit sans que le commercial ait vu la proposition ;
//   • « prévoir une confirmation avant remplacement » — portée par l'éditeur,
//     qui compare le texte courant à la proposition ;
//   • « permettre la modification libre du contenu » — le champ reste un
//     simple textarea, la proposition n'est qu'une valeur de départ.
//
// ELLES N'ENVOIENT RIEN (interdiction 24) et NE TOUCHENT À AUCUN MONTANT
// (interdiction 17) : la charge utile renvoyée ne porte ni prix, ni ligne, ni
// statut.
//
// ── AUTORISATIONS ─────────────────────────────────────────────────────
//
// Aucune garde ajoutée, et c'est voulu : la lecture passe par la session, donc
// la RLS écarte déjà le devis d'un autre commercial. Ajouter un contrôle ici
// créerait une seconde source de vérité (cf. `devis-actions.ts`).

import { supabaseServer } from "@/lib/supabase/server";
import { getLeadDetail } from "@/lib/leads-server";
import { mentionProduitsPourEntite } from "@/lib/generation/mentions-produits-server";
import {
  MOTIF_LABEL,
  decouverteDepuisLead,
  genererDepuisLead,
  notesDevis,
} from "@/lib/generation/devis-depuis-decouverte";
import {
  analyser,
  construireReserves,
  construireTitre,
  corrigerRepetitions,
  rediger,
  type Niveau,
} from "@/lib/generation/devis-contenu";

/**
 * Ce que l'éditeur demande.
 *
 *   complet      — §17.1 et §17.7 : tout le contenu, au niveau déduit.
 *   developper   — §17.2 et §17.3 : tout le contenu, au niveau maximal.
 *   titre        — §17.5 : le titre seul.
 *   reserves     — §17.6 : les réserves seules.
 */
export type ModeRedaction = "complet" | "developper" | "titre" | "reserves";

export type RedactionResult =
  | {
      ok: true;
      mode: ModeRedaction;
      /** Titre proposé — vide si le mode ne le concerne pas. */
      designation: string;
      /** Texte complet des trois blocs — vide si le mode ne le concerne pas. */
      notes: string;
      /** Réserves seules, pour le mode `reserves`. */
      reserves: string;
      niveau: Niveau;
      famille: string;
      manquant: string[];
      alertes: string[];
    }
  | { ok: false; error: string };

/** Lead rattaché à un devis, lu à travers la session. */
async function leadDuDevis(devisId: string) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("documents")
    .select("id, lead_id, entity_id")
    .eq("id", devisId)
    .maybeSingle<{ id: string; lead_id: string | null; entity_id: string | null }>();
  if (error || !data) return { ok: false as const, error: "Devis introuvable." };
  if (!data.lead_id) {
    return {
      ok: false as const,
      error:
        "Ce devis n'est rattaché à aucun dossier : la rédaction assistée part "
        + "de la découverte, elle n'a donc rien à lire. Rédigez le texte à la main.",
    };
  }
  const detail = await getLeadDetail(data.lead_id);
  if (!detail) return { ok: false as const, error: "Dossier introuvable." };
  return { ok: true as const, lead: detail.lead, entityId: data.entity_id };
}

export async function redigerDevis(
  devisId: string,
  mode: ModeRedaction,
): Promise<RedactionResult> {
  if (!devisId) return { ok: false, error: "Devis introuvable." };

  const r = await leadDuDevis(devisId);
  if (!r.ok) return { ok: false, error: r.error };
  const lead = r.lead;

  const entree = {
    sector: lead.sector,
    surfaceM2: lead.surfaceM2 ?? null,
    etatSalete: lead.etatSalete ?? null,
    discoveryDetails: lead.discoveryDetails ?? null,
    discoveryDoneAt: lead.discoveryDoneAt ?? null,
    contexteIntervention: lead.contexteIntervention ?? null,
    // C1 — la mention suit la société émettrice DU DEVIS, pas une valeur
    // globale. Une régénération ne doit pas y réintroduire une affirmation
    // que cette société n'a pas déclarée.
    mentionProduits: await mentionProduitsPourEntite(r.entityId),
  };

  // Les deux refus possibles sont explicites : on ne produit jamais un texte
  // approximatif pour avoir quelque chose à afficher.
  const base = genererDepuisLead(entree);
  if (!base.ok) return { ok: false, error: MOTIF_LABEL[base.motif] };

  const a = analyser(decouverteDepuisLead(entree));
  if (!a) return { ok: false, error: MOTIF_LABEL.activite_hors_perimetre };

  // §10 : le niveau ne peut qu'être relevé. « Développer » ne peut donc pas
  // produire un texte plus pauvre que celui que l'analyse a jugé nécessaire.
  const contenu =
    mode === "developper" ? rediger({ ...a, niveau: 3 }) : base.contenu;

  switch (mode) {
    case "titre":
      return {
        ok: true, mode,
        designation: construireTitre(a),
        notes: "", reserves: "",
        niveau: contenu.niveau, famille: contenu.famille,
        manquant: contenu.manquant, alertes: base.alertes,
      };
    case "reserves":
      return {
        ok: true, mode,
        designation: "", notes: "",
        reserves: construireReserves(a),
        niveau: contenu.niveau, famille: contenu.famille,
        manquant: contenu.manquant, alertes: base.alertes,
      };
    default:
      return {
        ok: true, mode,
        designation: contenu.designation,
        notes: notesDevis(contenu),
        reserves: contenu.reserves,
        niveau: contenu.niveau, famille: contenu.famille,
        manquant: contenu.manquant, alertes: base.alertes,
      };
  }
}

/**
 * §17.4 — corriger les répétitions du texte courant.
 *
 * Transformation PURE du texte que le commercial a sous les yeux : elle ne
 * relit pas la découverte et ne régénère rien. C'est voulu — le texte peut
 * avoir été modifié à la main, et ces modifications doivent survivre.
 */
export async function corrigerRepetitionsDevis(
  texte: string,
): Promise<{ ok: true; texte: string; retirees: number }> {
  const r = corrigerRepetitions(texte ?? "");
  return { ok: true, ...r };
}
