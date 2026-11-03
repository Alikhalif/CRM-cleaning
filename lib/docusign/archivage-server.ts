import "server-only";

// Archivage d'une enveloppe signée.
//
// L'ARCHIVAGE N'EST TERMINÉ QUE QUAND LE FICHIER EST EN PLACE
//
// DocuSign peut confirmer une signature alors que le téléchargement échoue.
// Marquer le contrat « signé » et s'arrêter là laisserait une preuve qui
// n'existe que chez DocuSign. Ici, chaque étape est reprise tant qu'elle n'a
// pas abouti : `archivage_essais` compte les tentatives, `archivage_erreur`
// garde la raison, et la file de reprise rejoue l'opération.
//
// DEUX FICHIERS, PAS UN
//
// Le PDF signé prouve ce qui a été signé. Le CERTIFICAT de réalisation prouve
// qui a signé, quand, depuis quelle adresse, et avec quelle empreinte de
// document. L'un sans l'autre prouve beaucoup moins — les deux sont archivés.
//
// CONFIDENTIALITÉ
//
// Ces documents portent le prix d'achat du sous-traitant. Le bucket est
// privé, la table `document_archive` n'est lisible que par le back-office
// (RLS `is_admin() or is_planificateur()`), et aucune URL permanente n'est
// jamais produite : l'accès passe par une URL signée de courte durée.

import { createHash } from "node:crypto";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import { telechargerCertificat, telechargerDocumentSigne } from "./client";
import { dateConservation, type TypeDocument } from "./archivage";
import type { PieceArchivee } from "./vues";

export type { PieceArchivee } from "./vues";

export const BUCKET_ARCHIVE = "document-archive";

export type ResultatArchivage =
  | { ok: true; documents: number; dejaFait: boolean }
  | { ok: false; error: string };

type EnveloppeRow = {
  id: string;
  envelope_id: string;
  entity_id: string;
  contract_id: string | null;
  document_type: string;
  statut: string;
  signataires: unknown;
  completed_at: string | null;
  archive_le: string | null;
  archivage_essais: number;
};

type ContratRow = {
  id: string;
  ref: string | null;
  technician_id: string;
  dossier_id: string | null;
  lead_id: string | null;
  entity_id: string | null;
};

/** Chemin de stockage. Rangé par entité puis par enveloppe : lisible et isolé. */
function chemin(entityId: string, envelopeId: string, quoi: "contrat" | "certificat"): string {
  return `${entityId}/${envelopeId}/${quoi}.pdf`;
}

async function noterEchec(id: string, essais: number, raison: string): Promise<void> {
  const sb = await supabaseServiceRole();
  await sb
    .from("docusign_envelopes")
    .update({
      archivage_essais: essais + 1,
      archivage_erreur: raison.slice(0, 500),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
}

/**
 * Télécharge et archive les pièces d'une enveloppe signée.
 *
 * Idempotent : une enveloppe déjà archivée ressort `dejaFait` sans rien
 * refaire. C'est ce qui permet de rejouer une notification sans créer un
 * second exemplaire — l'index unique
 * `uq_docarch_envelope (docusign_envelope_id, document_type)` le garantit
 * aussi côté base, en dernier recours.
 */
export async function archiverEnveloppe(envelopeId: string): Promise<ResultatArchivage> {
  const sb = await supabaseServiceRole();

  const { data: env } = await sb
    .from("docusign_envelopes")
    .select(
      "id, envelope_id, entity_id, contract_id, document_type, statut, signataires, "
      + "completed_at, archive_le, archivage_essais",
    )
    .eq("envelope_id", envelopeId)
    .maybeSingle<EnveloppeRow>();
  if (!env) return { ok: false, error: "Enveloppe inconnue du CRM." };

  if (env.archive_le) return { ok: true, documents: 0, dejaFait: true };
  if (env.statut !== "signe_toutes_parties") {
    return {
      ok: false,
      error: `L'enveloppe n'est pas signée par toutes les parties (statut : ${env.statut}).`,
    };
  }

  // Contrat de référence : il porte les rattachements qui classeront les
  // pièces dans les bonnes bibliothèques.
  let contrat: ContratRow | null = null;
  if (env.contract_id) {
    const { data } = await sb
      .from("subcontract_contracts")
      .select("id, ref, technician_id, dossier_id, lead_id, entity_id")
      .eq("id", env.contract_id)
      .maybeSingle<ContratRow>();
    contrat = data ?? null;
  }

  // ── 1. Téléchargements ──────────────────────────────────────────────
  const signe = await telechargerDocumentSigne({ entityId: env.entity_id, envelopeId });
  if (!signe.ok) {
    await noterEchec(env.id, env.archivage_essais, signe.error);
    return { ok: false, error: signe.error };
  }

  // Le certificat est important mais ne doit pas bloquer l'archivage du
  // contrat : on l'archive s'il arrive, et son absence reste signalée.
  const certificat = await telechargerCertificat({ entityId: env.entity_id, envelopeId });

  // ── 2. Dépôt dans le bucket privé ───────────────────────────────────
  const depose: { type: TypeDocument; path: string; octets: Buffer; titre: string }[] = [];
  const cheminContrat = chemin(env.entity_id, envelopeId, "contrat");
  const up1 = await sb.storage.from(BUCKET_ARCHIVE).upload(cheminContrat, signe.octets, {
    contentType: "application/pdf",
    // `upsert` : rejouer l'archivage remplace le même fichier au lieu
    // d'échouer. Le fichier est identique — c'est le même document signé.
    upsert: true,
  });
  if (up1.error) {
    await noterEchec(env.id, env.archivage_essais, `dépôt du contrat : ${up1.error.message}`);
    return { ok: false, error: `Dépôt du contrat signé impossible : ${up1.error.message}` };
  }
  depose.push({
    type: "contrat_sous_traitance",
    path: cheminContrat,
    octets: signe.octets,
    titre: `Contrat de sous-traitance ${contrat?.ref ?? envelopeId} — signé`,
  });

  if (certificat.ok) {
    const cheminCert = chemin(env.entity_id, envelopeId, "certificat");
    const up2 = await sb.storage.from(BUCKET_ARCHIVE).upload(cheminCert, certificat.octets, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (!up2.error) {
      depose.push({
        type: "certificat_signature",
        path: cheminCert,
        octets: certificat.octets,
        titre: `Certificat de signature ${contrat?.ref ?? envelopeId}`,
      });
    } else {
      console.error("[docusign] dépôt du certificat impossible", up2.error.message);
    }
  }

  // ── 3. Lignes du dépôt documentaire ─────────────────────────────────
  const maintenant = new Date();
  const { data: regles } = await sb
    .from("document_retention_rules")
    .select("document_type, annees")
    .returns<{ document_type: string; annees: number }[]>();
  const bareme: Partial<Record<TypeDocument, number>> = {};
  for (const r of regles ?? []) bareme[r.document_type as TypeDocument] = r.annees;

  let ecrits = 0;
  for (const d of depose) {
    const ligne = {
      entity_id: env.entity_id,
      subcontractor_id: contrat?.technician_id ?? null,
      intervention_id: contrat?.dossier_id ?? null,
      contract_id: env.contract_id,
      document_type: d.type,
      title: d.titre,
      storage_bucket: BUCKET_ARCHIVE,
      storage_path: d.path,
      file_name: `${d.path.split("/").pop()}`,
      mime_type: "application/pdf",
      size_bytes: d.octets.length,
      // Empreinte : elle permet de prouver que le fichier archivé est bien
      // celui que DocuSign a renvoyé, et qu'il n'a pas changé depuis.
      sha256: createHash("sha256").update(d.octets).digest("hex"),
      signature_status: "signe_toutes_parties",
      docusign_envelope_id: envelopeId,
      completed_at: env.completed_at,
      signataires: env.signataires ?? [],
      is_final: true,
      retention_until: dateConservation(d.type, maintenant, bareme).toISOString().slice(0, 10),
      source: "docusign",
    };
    // `upsert` sur la contrainte unique (enveloppe, type) : rejouer
    // l'archivage ne crée pas de doublon.
    const { error } = await sb
      .from("document_archive")
      .upsert(ligne as never, { onConflict: "docusign_envelope_id,document_type" });
    if (error) {
      await noterEchec(env.id, env.archivage_essais, `dépôt documentaire : ${error.message}`);
      return { ok: false, error: `Enregistrement au dépôt documentaire impossible : ${error.message}` };
    }
    ecrits++;
  }

  // ── 4. Statuts ──────────────────────────────────────────────────────
  await sb
    .from("docusign_envelopes")
    .update({
      archive_le: maintenant.toISOString(),
      archivage_erreur: null,
      updated_at: maintenant.toISOString(),
    } as never)
    .eq("id", env.id);

  if (contrat) {
    await sb
      .from("subcontract_contracts")
      .update({
        statut: "signe",
        signe_le: env.completed_at ?? maintenant.toISOString(),
        signed_pdf_path: cheminContrat,
        // Éléments de preuve : un booléen « signé » ne prouverait rien.
        signature_preuve: {
          fournisseur: "docusign",
          envelope_id: envelopeId,
          signataires: env.signataires ?? [],
          completed_at: env.completed_at,
          sha256_contrat: createHash("sha256").update(signe.octets).digest("hex"),
          certificat_archive: certificat.ok,
        },
        updated_at: maintenant.toISOString(),
      } as never)
      .eq("id", contrat.id);

    await sb.from("subcontract_events").insert({
      contract_id: contrat.id,
      kind: "signe_et_archive",
      detail: { envelope_id: envelopeId, documents: ecrits, certificat: certificat.ok },
    } as never);

    await auditLog({
      action: "subcontract.contract.signed",
      entityType: "subcontract_contract",
      entityId: contrat.id,
      after: { envelope_id: envelopeId, documents: ecrits, certificat_archive: certificat.ok },
    });
  }

  if (!certificat.ok) {
    console.error(`[docusign] certificat non archivé pour ${envelopeId} : ${certificat.error}`);
  }

  return { ok: true, documents: ecrits, dejaFait: false };
}

// ══════════════════════════════════════════════════════════════════════
//  Accès aux pièces archivées
// ══════════════════════════════════════════════════════════════════════

/**
 * URL signée d'une pièce archivée, valable une heure au plus.
 *
 * Jamais d'URL permanente : ces documents portent le prix d'achat. La durée
 * suit la règle du CRM pour tous les documents privés — soixante minutes
 * maximum.
 */
export async function urlSigneeArchive(
  storagePath: string,
  secondes = 3600,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const sb = await supabaseServiceRole();
  const { data, error } = await sb.storage
    .from(BUCKET_ARCHIVE)
    .createSignedUrl(storagePath, Math.min(secondes, 3600));
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "URL signée indisponible." };
  }
  return { ok: true, url: data.signedUrl };
}

/** Pièces archivées d'un contrat, pour l'affichage côté planificatrice. */
export async function piecesDuContrat(contractId: string): Promise<PieceArchivee[]> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("document_archive")
    .select("id, document_type, title, storage_path, size_bytes, sha256, created_at")
    .eq("contract_id", contractId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<{
      id: string; document_type: string; title: string; storage_path: string;
      size_bytes: number | null; sha256: string | null; created_at: string;
    }[]>();
  return (data ?? []).map((d) => ({
    id: d.id,
    documentType: d.document_type,
    title: d.title,
    storagePath: d.storage_path,
    sizeBytes: d.size_bytes,
    sha256: d.sha256,
    createdAt: d.created_at,
  }));
}
