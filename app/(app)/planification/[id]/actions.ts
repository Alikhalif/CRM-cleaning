"use server";

// Actions du bloc « Contrat de sous-traitance » du dossier d'intervention.
//
// TROIS INVARIANTS, vérifiés CÔTÉ SERVEUR et pas seulement dans l'interface.
// Griser un bouton ne protège de rien : une action serveur est appelable
// directement, et c'est ici que la règle doit tenir.
//
//   1. Aucun prix client n'entre dans un contrat de sous-traitance. Le montant
//      est saisi à la main par la planificatrice. Aucune de ces fonctions ne
//      lit le total d'un devis, et aucune n'applique de pourcentage à l'un.
//   2. Un contrat sans texte validé ne s'émet pas (contrats 8 et 9).
//   3. Un contrat envoyé ou signé ne se réécrit pas — il s'annule ou prend un
//      avenant. L'instantané `contenu` fait foi.

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import {
  modeleContractuel,
  peutEtreEmis,
  MODELES_CLIENT,
  type ModeleContrat,
} from "@/lib/sous-traitance/clauses";
import { calculerTotaux, type SaisieMontants } from "@/lib/sous-traitance/montants";
import {
  assemblerDocumentContrat,
  getDossierContrat,
  type SaisieComplements,
} from "@/lib/sous-traitance/contrats-server";
import { envoyerContratEnSignature } from "@/lib/docusign/envoi-server";
import { resynchroniser } from "@/lib/docusign/notifications-server";
import { urlSigneeArchive } from "@/lib/docusign/archivage-server";
import { STATUT_LABEL as STATUT_SIGNATURE_LABEL } from "@/lib/docusign/statuts";
import type { DocumentAssemble } from "@/lib/sous-traitance/contrats-shared";

export type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Traduit les échecs de schéma en consigne exploitable.
 *
 * Trois migrations conditionnent ce module, et tant qu'elles ne sont pas
 * appliquées Postgres répond par des messages bruts : « column entity_id does
 * not exist » (42703), « new row violates check constraint » (23514) pour un
 * modèle hors des quatre d'origine, ou zéro ligne affectée si les politiques
 * RLS d'écriture manquent. Les laisser remonter tels quels enverrait la
 * planificatrice chercher un bug applicatif là où il n'y en a pas.
 */
function messageSchema(err: { code?: string; message: string }): string {
  if (err.code === "42703") {
    return "Base de données en retard sur le code : la colonne « entité juridique » n'existe "
      + "pas encore. Appliquez les migrations 20261031000002 et 20261102000001 "
      + "(npx supabase db push), puis régénérez les types.";
  }
  if (err.code === "23514") {
    return "Base de données en retard sur le code : ce modèle de contrat est refusé par la "
      + "contrainte de la table, qui n'en accepte encore que quatre. Appliquez la migration "
      + "20261102000001 (npx supabase db push).";
  }
  if (err.code === "42501" || err.code === "PGRST301") {
    return "Écriture refusée par la sécurité de la base. Les politiques RLS d'écriture du "
      + "module arrivent avec la migration 20261102000001 — appliquez-la.";
  }
  return err.message;
}

/** Statuts à partir desquels le document est figé (§29). */
const FIGES = new Set([
  "envoye", "consulte", "en_attente_signature", "signe",
  "remplace_par_avenant", "archive",
]);

// Garde back-office, en plus de la RLS. Défense en profondeur : la RLS est la
// vraie frontière, celle-ci donne un message d'erreur utilisable.
async function ensurePlanner(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const { data: roles } = await supabase
    .from("user_roles").select("roles(slug)").eq("user_id", user.id)
    .returns<{ roles: { slug: string } | null }[]>();
  const ok = (roles ?? []).some(
    (r) => r.roles?.slug === "admin" || r.roles?.slug === "planification",
  );
  if (!ok) return { ok: false, error: "Réservé à la planification / l'administration." };
  return { ok: true, userId: user.id };
}

export type EntreeContrat = {
  dossierId: string;
  technicianId: string;
  entityId: string;
  modele: ModeleContrat;
  montants: SaisieMontants;
  complements?: SaisieComplements;
  notes?: string;
};

// ══════════════════════════════════════════════════════════════════════
//  Enregistrer le brouillon (sous-traitant, entité, modèle, tarif)
// ══════════════════════════════════════════════════════════════════════

/**
 * Crée ou met à jour le brouillon de contrat du dossier.
 *
 * Le tarif est enregistré DÈS CETTE ÉTAPE, avant toute génération : le
 * cahier des charges veut que l'accord tarifaire soit tracé au moment où il
 * est obtenu, pas au moment où le document part.
 */
export async function enregistrerContrat(entree: EntreeContrat): Promise<Result> {
  const guard = await ensurePlanner();
  if (!guard.ok) return guard;

  if (!UUID_RE.test(entree.dossierId)) return { ok: false, error: "Dossier invalide." };
  if (!UUID_RE.test(entree.technicianId)) return { ok: false, error: "Sous-traitant non sélectionné." };
  if (!UUID_RE.test(entree.entityId)) {
    return { ok: false, error: "Entité juridique émettrice non sélectionnée — elle est obligatoire." };
  }
  if (!MODELES_CLIENT.includes(entree.modele)) {
    return { ok: false, error: "Modèle de contrat inconnu." };
  }
  // Griser l'option dans le menu ne suffit pas : cette action est appelable
  // directement, et c'est ici que la règle doit tenir.
  const emissible = peutEtreEmis(entree.modele);
  if (!emissible.ok) return { ok: false, error: emissible.motif };

  const supabase = await supabaseServer();
  const totaux = calculerTotaux(entree.montants);

  // Un contrat déjà figé ne se réécrit pas : on refuse plutôt que de créer
  // un second brouillon silencieux pour le même dossier.
  const { data: existants } = await supabase
    .from("subcontract_contracts")
    .select("id, statut")
    .eq("dossier_id", entree.dossierId)
    .is("deleted_at", null)
    .returns<{ id: string; statut: string }[]>();

  const brouillon = (existants ?? []).find((c) => !FIGES.has(c.statut));
  const fige = (existants ?? []).find((c) => FIGES.has(c.statut));
  if (!brouillon && fige) {
    return {
      ok: false,
      error: "Un contrat est déjà engagé sur ce dossier. Passez par un avenant plutôt que par un second contrat.",
    };
  }

  const dossier = await getDossierContrat(entree.dossierId);
  if (!dossier) return { ok: false, error: "Dossier introuvable." };

  const charge = {
    technician_id: entree.technicianId,
    entity_id: entree.entityId,
    dossier_id: entree.dossierId,
    lead_id: dossier.leadId,
    modele: entree.modele,
    modele_version: modeleContractuel(entree.modele).version,
    mode_prix: entree.montants.mode,
    total_ht: totaux.totalHt || null,
    taux_tva: entree.montants.tauxTva,
    total_ttc: totaux.totalTtc,
    date_debut: dossier.mission.date || null,
    notes: entree.notes?.trim() || null,
    // L'instantané n'est écrit qu'à la génération : un brouillon garde les
    // seules données de saisie, pour que `contenu` ne désigne jamais qu'un
    // document réellement assemblé.
    contenu: { saisie: { montants: entree.montants, complements: entree.complements ?? {} } },
    updated_at: new Date().toISOString(),
  };

  let id: string;
  if (brouillon) {
    const { error } = await supabase
      .from("subcontract_contracts")
      .update(charge as never)
      .eq("id", brouillon.id);
    if (error) return { ok: false, error: `Enregistrement impossible : ${messageSchema(error)}` };
    id = brouillon.id;
  } else {
    const { data, error } = await supabase
      .from("subcontract_contracts")
      .insert({ ...charge, statut: "brouillon", created_by: guard.userId } as never)
      .select("id")
      .single<{ id: string }>();
    if (error || !data) {
      return {
        ok: false,
        error: `Création impossible : ${error ? messageSchema(error) : "aucune ligne créée"}`,
      };
    }
    id = data.id;
  }

  await remplacerLignes(id, entree.montants);

  await auditLog({
    action: brouillon ? "subcontract.contract.updated" : "subcontract.contract.created",
    entityType: "subcontract_contract",
    entityId: id,
    after: {
      dossier_id: entree.dossierId,
      modele: entree.modele,
      entity_id: entree.entityId,
      technician_id: entree.technicianId,
      total_ht: totaux.totalHt,
    },
  });

  revalidatePath(`/planification/${entree.dossierId}`);
  return { ok: true, id };
}

/** Réécrit les lignes du chiffrage. Les anciennes sont supprimées, pas fusionnées. */
async function remplacerLignes(contractId: string, m: SaisieMontants): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.from("subcontract_lines").delete().eq("contract_id", contractId);

  const lignes = m.lignes.map((l, i) => ({
    contract_id: contractId,
    code: l.code,
    label: l.label,
    descriptif: l.descriptif ?? null,
    quantite: l.quantite,
    unite: l.unite,
    prix_unitaire_ht: l.prixUnitaireHt,
    montant_ht:
      l.prixUnitaireHt == null
        ? null
        : l.unite === "forfait"
          ? l.prixUnitaireHt
          : l.prixUnitaireHt * (l.quantite ?? 0),
    fournitures_incluses: l.fournituresIncluses,
    materiel_inclus: l.materielInclus,
    a_verifier: l.aVerifier ?? false,
    genre: "prestation",
    observations: l.observations ?? null,
    position: i,
  }));

  const frais = m.frais.map((f, i) => ({
    contract_id: contractId,
    code: null,
    label: f.label,
    descriptif: null,
    quantite: null,
    unite: "forfait",
    prix_unitaire_ht: f.montantHt,
    montant_ht: f.montantHt,
    fournitures_incluses: false,
    materiel_inclus: false,
    a_verifier: false,
    genre: "frais",
    observations: f.observations ?? null,
    position: lignes.length + i,
  }));

  const toutes = [...lignes, ...frais];
  if (toutes.length > 0) await supabase.from("subcontract_lines").insert(toutes as never);
}

// ══════════════════════════════════════════════════════════════════════
//  Générer le document
// ══════════════════════════════════════════════════════════════════════

/**
 * Assemble le document pour la prévisualisation.
 *
 * L'assemblage lui-même vit dans `contrats-server.ts` : la route PDF en a
 * besoin aussi, et prévisualiser un document différent de celui qui s'imprime
 * n'aurait aucun intérêt. Ici on ne garde que la vérification d'accès.
 */
export async function assemblerDocument(contratId: string): Promise<
  { ok: true; document: DocumentAssemble } | { ok: false; error: string }
> {
  const guard = await ensurePlanner();
  if (!guard.ok) return guard;
  if (!UUID_RE.test(contratId)) return { ok: false, error: "Contrat invalide." };
  return assemblerDocumentContrat(contratId);
}

/**
 * Émet le contrat : alloue son numéro et figure son instantané.
 *
 * Le numéro vient de `allocate_subcontract_ref`, SECURITY DEFINER avec verrou
 * de ligne : deux planificatrices qui émettent au même instant n'obtiennent
 * pas le même. Il n'est consommé qu'ICI, jamais à la prévisualisation.
 */
export async function emettreContrat(contratId: string): Promise<Result> {
  const guard = await ensurePlanner();
  if (!guard.ok) return guard;

  const assemblage = await assemblerDocument(contratId);
  if (!assemblage.ok) return { ok: false, error: assemblage.error };
  const doc = assemblage.document;

  if (doc.manquantes.length > 0) {
    return {
      ok: false,
      error: "Informations obligatoires manquantes : "
        + doc.manquantes.map((m) => m.libelle).join(", ") + ".",
    };
  }
  if (doc.montants.incomplets.length > 0) {
    return {
      ok: false,
      error: "Le tarif du sous-traitant est incomplet : " + doc.montants.incomplets.join(" · "),
    };
  }
  if (doc.montants.totalHt <= 0) {
    return { ok: false, error: "Le montant du sous-traitant doit être renseigné avant l'émission." };
  }

  const supabase = await supabaseServer();
  const { data: c } = await supabase
    .from("subcontract_contracts")
    .select("id, ref, statut, dossier_id")
    .eq("id", contratId)
    .maybeSingle<{ id: string; ref: string | null; statut: string; dossier_id: string | null }>();
  if (!c) return { ok: false, error: "Contrat introuvable." };
  if (FIGES.has(c.statut)) {
    return { ok: false, error: "Ce contrat est déjà engagé : il ne peut plus être réécrit." };
  }

  let ref = c.ref;
  if (!ref) {
    const { data: alloc, error: errRef } = await supabase
      .rpc("allocate_subcontract_ref" as never, { p_kind: "contrat", p_prefix: "ST" } as never)
      .returns<string>();
    if (errRef || !alloc) {
      return {
        ok: false,
        error: `Numérotation impossible : ${errRef ? messageSchema(errRef) : "aucun numéro alloué"}`,
      };
    }
    ref = alloc;
  }

  const { error } = await supabase
    .from("subcontract_contracts")
    .update({
      ref,
      statut: "pret_a_envoyer",
      // L'instantané complet : c'est lui qui fait foi, même si un modèle
      // évolue ensuite.
      contenu: { ...doc, emisLe: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", contratId);
  if (error) return { ok: false, error: `Émission impossible : ${messageSchema(error)}` };

  await supabase.from("subcontract_events").insert({
    contract_id: contratId,
    kind: "emis",
    by_user: guard.userId,
    detail: { ref, modele: doc.modele, version: doc.version, total_ht: doc.montants.totalHt },
  } as never);

  await auditLog({
    action: "subcontract.contract.generated",
    entityType: "subcontract_contract",
    entityId: contratId,
    after: { ref, modele: doc.modele, version: doc.version },
  });

  if (c.dossier_id) revalidatePath(`/planification/${c.dossier_id}`);
  return { ok: true, id: contratId, message: `Contrat ${ref} généré.` };
}

// ══════════════════════════════════════════════════════════════════════
//  Envoi en signature
// ══════════════════════════════════════════════════════════════════════

/**
 * Envoi du contrat à la signature électronique DocuSign.
 *
 * Le refus systématique d'avant est remplacé par un véritable appel — mais
 * UNIQUEMENT quand le connecteur est configuré ET que l'entité est autorisée.
 * Toutes les vérifications, l'appel et l'enregistrement vivent dans
 * `lib/docusign/envoi-server.ts` ; ici on ne garde que le contrôle d'accès.
 *
 * ⚠️ Rien n'est annoncé « envoyé » avant la confirmation de DocuSign. Si
 * l'appel échoue, le contrat reste dans son état réel et le message dit
 * pourquoi.
 */
export async function envoyerEnSignature(contratId: string): Promise<Result> {
  const guard = await ensurePlanner();
  if (!guard.ok) return guard;
  if (!UUID_RE.test(contratId)) return { ok: false, error: "Contrat invalide." };

  const r = await envoyerContratEnSignature({ contratId, userId: guard.userId });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath("/planification");
  return { ok: true, id: contratId, message: r.message };
}

/**
 * Relit l'état d'une signature chez DocuSign.
 *
 * Bouton « Actualiser » de la fiche : la planificatrice n'a pas à attendre le
 * passage du cron pour savoir où en est une signature. DocuSign fait foi.
 */
export async function resynchroniserSignature(envelopeId: string): Promise<Result> {
  const guard = await ensurePlanner();
  if (!guard.ok) return guard;
  if (!envelopeId.trim()) return { ok: false, error: "Enveloppe invalide." };

  const r = await resynchroniser(envelopeId.trim());
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath("/planification");
  return {
    ok: true,
    message: r.ignore
      ? `État confirmé : ${STATUT_SIGNATURE_LABEL[r.statut]} (${r.ignore}).`
      : `État mis à jour : ${STATUT_SIGNATURE_LABEL[r.statut]}.`
      + (r.archive ? " Documents signés archivés." : ""),
  };
}

/**
 * URL de téléchargement d'une pièce archivée, valable une heure.
 *
 * Jamais d'URL permanente : ces documents portent le prix d'achat convenu
 * avec le sous-traitant. Le rôle est vérifié ici, et le bucket est privé.
 */
export async function urlPieceArchivee(storagePath: string): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const guard = await ensurePlanner();
  if (!guard.ok) return guard;
  // On n'accepte qu'un chemin interne au dépôt : pas de remontée de dossier,
  // pas de chemin absolu.
  if (!storagePath || storagePath.includes("..") || storagePath.startsWith("/")) {
    return { ok: false, error: "Chemin de document invalide." };
  }
  return urlSigneeArchive(storagePath);
}

// ══════════════════════════════════════════════════════════════════════
//  Annulation
// ══════════════════════════════════════════════════════════════════════

export async function annulerContrat(contratId: string, motif: string): Promise<Result> {
  const guard = await ensurePlanner();
  if (!guard.ok) return guard;
  if (!UUID_RE.test(contratId)) return { ok: false, error: "Contrat invalide." };
  if (!motif.trim()) return { ok: false, error: "Un motif d'annulation est requis." };

  const supabase = await supabaseServer();
  const { data: c } = await supabase
    .from("subcontract_contracts")
    .select("id, statut, dossier_id")
    .eq("id", contratId)
    .maybeSingle<{ id: string; statut: string; dossier_id: string | null }>();
  if (!c) return { ok: false, error: "Contrat introuvable." };
  if (c.statut === "signe") {
    return {
      ok: false,
      error: "Un contrat signé ne s'annule pas : il se résilie par avenant, et sa trace est conservée.",
    };
  }

  const { error } = await supabase
    .from("subcontract_contracts")
    .update({ statut: "annule", notes: motif.trim(), updated_at: new Date().toISOString() } as never)
    .eq("id", contratId);
  if (error) return { ok: false, error: `Annulation impossible : ${messageSchema(error)}` };

  await supabase.from("subcontract_events").insert({
    contract_id: contratId, kind: "annule", by_user: guard.userId, detail: { motif },
  } as never);
  await auditLog({
    action: "subcontract.contract.cancelled",
    entityType: "subcontract_contract",
    entityId: contratId,
    after: { motif },
  });

  if (c.dossier_id) revalidatePath(`/planification/${c.dossier_id}`);
  return { ok: true, id: contratId };
}
