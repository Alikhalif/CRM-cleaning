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
import { mentionPourEntite } from "@/lib/generation/mentions-produits-server";
import {
  MOTIF_LABEL,
  decouverteDepuisLead,
  genererDepuisLead,
  notesDevis,
} from "@/lib/generation/devis-depuis-decouverte";
import {
  analyser,
  construireReserves,
  construireSections,
  construireTitre,
  corrigerRepetitions,
  rediger,
  type Niveau,
} from "@/lib/generation/devis-contenu";
import {
  MOTIF_REMPLACEMENT_LABEL,
  normaliserTitre,
  pucesAilleurs,
  remplacerPucesSection,
} from "@/lib/generation/devis-sections";
import {
  reformuler, type ARevoir,
} from "@/lib/generation/devis-reformulation";

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
    // C1 — la mention suit le PAYS de la société émettrice DU DEVIS. Une
    // régénération ne doit pas y réintroduire l'allégation d'un autre pays,
    // ni la mention française sur une société étrangère.
    mentionProduits: (await mentionPourEntite(r.entityId)).mention,
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

// ══════════════════════════════════════════════════════════════════════
//  C4 — reprendre UNE section, sans toucher au reste
// ══════════════════════════════════════════════════════════════════════

export type SectionResult =
  | {
      ok: true;
      /** Descriptif complet, une seule section remplacée. */
      notes: string;
      titre: string;
      avant: string[];
      apres: string[];
      niveau: Niveau;
      /** Puces écartées parce qu'elles figurent déjà dans une autre section. */
      ecartees: number;
      manquant: string[];
      alertes: string[];
    }
  | { ok: false; error: string };

/**
 * §17 — reprend les lignes d'UNE section nommée, dans le texte courant.
 *
 * ── CE QUI DISTINGUE CETTE ACTION DE « RÉGÉNÉRER LE DEVIS » ──────────
 *
 * Elle part du texte que le commercial a sous les yeux (`texteCourant`), pas
 * d'une sortie neuve du moteur. Tout ce qui est hors de la section visée —
 * les autres sections, les phrases écrites à la main, la mention des produits,
 * les conditions d'accès, le bloc RÉSERVES — ressort identique.
 *
 * ── CE QU'ELLE REFUSE ───────────────────────────────────────────────
 *
 * Une section que la découverte ne valide pas. Un titre tapé à la main dans
 * le textarea n'autorise aucune prestation : c'est la règle arbitrée le
 * 2026-11-06, et la remplir ici reviendrait à faire écrire au moteur ce que
 * le client n'a jamais demandé. Le refus NOMME les sections disponibles.
 *
 * `plusDeDetail` relève le niveau de rédaction pour cette seule reprise (§10 :
 * le niveau ne peut qu'être relevé, jamais abaissé).
 */
export async function redigerSectionDevis(
  devisId: string,
  titreSection: string,
  texteCourant: string,
  plusDeDetail = false,
): Promise<SectionResult> {
  if (!devisId) return { ok: false, error: "Devis introuvable." };
  if (!titreSection?.trim()) {
    return { ok: false, error: "Aucune section sélectionnée." };
  }

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
    mentionProduits: (await mentionPourEntite(r.entityId)).mention,
  };

  const base = genererDepuisLead(entree);
  if (!base.ok) return { ok: false, error: MOTIF_LABEL[base.motif] };

  const analyse = analyser(decouverteDepuisLead(entree));
  if (!analyse) return { ok: false, error: MOTIF_LABEL.activite_hors_perimetre };

  const a = plusDeDetail ? { ...analyse, niveau: 3 as Niveau } : analyse;

  // Les sections sont reconstruites EN ENTIER, puis on en prend une : c'est
  // l'anti-répétition du moteur, qui n'a de sens qu'à l'échelle du devis.
  const cible = normaliserTitre(titreSection);
  const section = construireSections(a).find((x) => normaliserTitre(x.titre) === cible);
  if (!section) {
    const dispo = construireSections(a).map((x) => x.titre);
    return {
      ok: false,
      error:
        `La découverte ne valide aucune section « ${titreSection.trim()} » : le `
        + "moteur n'écrira donc rien pour elle. Complétez la découverte, ou "
        + "rédigez cette section à la main."
        + (dispo.length ? ` Sections validées : ${dispo.join(", ")}.` : ""),
    };
  }

  // Dernier filtre, contre le TEXTE RÉEL : une opération que le commercial a
  // déplacée dans une autre section ne doit pas revenir en double ici.
  const ailleurs = pucesAilleurs(texteCourant ?? "", section.titre);
  const retenues = section.operations.filter((op) => !ailleurs.has(normaliserTitre(op)));
  const ecartees = section.operations.length - retenues.length;

  const rempl = remplacerPucesSection(texteCourant ?? "", titreSection, retenues);
  if (!rempl.ok) {
    return { ok: false, error: MOTIF_REMPLACEMENT_LABEL[rempl.motif] };
  }

  return {
    ok: true,
    notes: rempl.texte,
    titre: rempl.titre,
    avant: rempl.avant,
    apres: rempl.apres,
    niveau: a.niveau,
    ecartees,
    manquant: base.contenu.manquant,
    alertes: base.alertes,
  };
}


// ══════════════════════════════════════════════════════════════════════
//  C5 — reformuler : corriger le mécanique, SIGNALER le contractuel
// ══════════════════════════════════════════════════════════════════════

/**
 * Reformule le texte courant.
 *
 * Transformation PURE, comme la correction des répétitions : elle ne relit pas
 * la découverte et ne régénère rien. C'est ce qui permet de l'appliquer à un
 * texte écrit à la main sans le perdre.
 *
 * Le rapport distingue ce qui a été CORRIGÉ (mécanique : typographie, unités,
 * mots doublés, vocabulaire du référentiel) de ce qui est seulement SIGNALÉ
 * (contractuel : promesses de résultat, garanties, délais, prix dans le
 * texte). Le second n'est jamais réécrit : décider à la place du commercial
 * sur le fond d'un devis masquerait le problème au lieu de le résoudre.
 */
export async function reformulerDevis(texte: string): Promise<{
  ok: true;
  texte: string;
  regles: string[];
  aRevoir: ARevoir[];
  bloquees: string[];
}> {
  const r = reformuler(texte ?? "");
  return {
    ok: true,
    texte: r.texte,
    regles: r.corrections.map((c) => c.regle),
    aRevoir: r.aRevoir,
    bloquees: r.bloquees.map((c) => c.regle),
  };
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
