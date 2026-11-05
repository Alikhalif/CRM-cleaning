import "server-only";

// Envoi d'un contrat de sous-traitance à la signature.
//
// L'ORDRE DES OPÉRATIONS EST LA GARANTIE PRINCIPALE
//
// On n'écrit « envoyé » qu'APRÈS la confirmation de DocuSign (§6 : ne jamais
// annoncer un envoi réussi avant confirmation de l'API). Avant cela, le
// contrat passe par `en_attente_envoi` : si l'appel échoue, le CRM montre un
// état exact — prêt mais pas parti — et non un contrat fantôme en attente
// d'une signature que personne n'a demandée.
//
// IDEMPOTENCE À DEUX NIVEAUX
//
//   1. Côté CRM : une enveloppe active sur ce contrat interdit un second
//      envoi. C'est ce qui protège d'un double clic et d'un rejeu d'action.
//   2. Côté DocuSign : l'en-tête `X-DocuSign-Idempotency-Key`, construit sur
//      la référence du contrat. Si notre premier appel a abouti mais que la
//      réponse s'est perdue, le second renvoie LA MÊME enveloppe au lieu d'en
//      créer une seconde.

import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { auditLog } from "@/lib/audit";
import SousTraitancePdf from "@/lib/pdf/SousTraitancePdf";
import {
  assemblerDocumentContrat, getEntitesEmettrices, getPrestataires,
} from "@/lib/sous-traitance/contrats-server";
import { modeleLabelNumerote, type ModeleContrat } from "@/lib/sous-traitance/clauses";
import { creerEnveloppe, type Signataire } from "./client";
import { etatConnexion } from "./oauth-server";
import { instantanerEntite, type EntiteJuridique } from "./archivage";
import { statutDepuisDocuSign, type StatutSignature } from "./statuts";

export type Resultat =
  | { ok: true; envelopeId: string; statut: StatutSignature; message: string }
  | { ok: false; error: string };

/** Statuts d'enveloppe qui bloquent un nouvel envoi sur le même contrat. */
const ENVELOPPES_ACTIVES = [
  "en_attente_envoi", "envoye_signature", "en_attente_signature",
  "partiellement_signe", "signe_toutes_parties",
];

type ContratRow = {
  id: string;
  ref: string | null;
  statut: string;
  modele: string;
  modele_version: string;
  technician_id: string;
  entity_id: string | null;
  dossier_id: string | null;
  lead_id: string | null;
};

type EnveloppeRow = { envelope_id: string; statut: string };

/**
 * Envoie le contrat à la signature.
 *
 * `userId` est fourni par l'action appelante, qui a déjà vérifié le rôle.
 * Cette fonction ne refait pas le contrôle d'accès — elle n'est jamais
 * appelée depuis le navigateur, c'est `import "server-only"` qui le garantit.
 */
export async function envoyerContratEnSignature(input: {
  contratId: string;
  userId: string;
}): Promise<Resultat> {
  const sb = await supabaseServiceRole();

  const { data: c } = await sb
    .from("subcontract_contracts")
    .select("id, ref, statut, modele, modele_version, technician_id, entity_id, dossier_id, lead_id")
    .eq("id", input.contratId)
    .maybeSingle<ContratRow>();
  if (!c) return { ok: false, error: "Contrat introuvable." };

  // ── 1. Le contrat doit être émis ────────────────────────────────────
  if (c.statut === "brouillon") {
    return { ok: false, error: "Générez d'abord le contrat : il n'a pas encore de numéro." };
  }
  if (!c.ref) {
    return { ok: false, error: "Ce contrat n'a pas de numéro. Générez-le avant l'envoi." };
  }
  if (c.statut === "signe") {
    return { ok: false, error: "Ce contrat est déjà signé." };
  }
  if (c.statut === "annule") {
    return { ok: false, error: "Ce contrat est annulé. Générez-en un nouveau." };
  }
  if (!c.entity_id) {
    return { ok: false, error: "Aucune entité juridique rattachée : impossible de déterminer le compte DocuSign." };
  }

  // ── 2. Idempotence côté CRM ─────────────────────────────────────────
  const { data: dejaLa } = await sb
    .from("docusign_envelopes")
    .select("envelope_id, statut")
    .eq("contract_id", c.id)
    .in("statut", ENVELOPPES_ACTIVES)
    .returns<EnveloppeRow[]>();
  const active = (dejaLa ?? [])[0];
  if (active) {
    return {
      ok: false,
      error: `Ce contrat a déjà une enveloppe de signature en cours (${active.envelope_id}). `
        + "Annulez-la avant d'en envoyer une autre.",
    };
  }

  // ── 3. Le raccordement doit être opérationnel ───────────────────────
  const etat = await etatConnexion(c.entity_id);
  if (!etat.configure) {
    return {
      ok: false,
      error: `Connecteur DocuSign non configuré : il manque ${etat.manquant.join(", ")}.`,
    };
  }
  if (!etat.chiffrementActif) {
    return { ok: false, error: "FIELD_ENCRYPTION_KEY absente : le raccordement DocuSign est refusé." };
  }
  if (!etat.connecte) {
    return {
      ok: false,
      error: "Cette entité juridique n'est pas raccordée à DocuSign, ou son autorisation a expiré. "
        + "Un Super Admin doit l'autoriser depuis Réglages › Sociétés.",
    };
  }

  // ── 4. Les signataires ──────────────────────────────────────────────
  const [prestataires, entites] = await Promise.all([getPrestataires(), getEntitesEmettrices()]);
  const p = prestataires.find((x) => x.technicianId === c.technician_id);
  if (!p) return { ok: false, error: "Sous-traitant introuvable ou désactivé." };
  if (!p.email) {
    return {
      ok: false,
      error: "Le sous-traitant n'a pas d'adresse de courriel : renseignez-la dans sa fiche avant l'envoi.",
    };
  }
  const e = entites.find((x) => x.id === c.entity_id);
  if (!e) return { ok: false, error: "Entité juridique introuvable." };
  if (!e.utilisable) {
    return {
      ok: false,
      error: `L'entité « ${e.legal_name ?? ""} » est incomplète : il manque ${e.manquants.join(", ")}.`,
    };
  }

  // Le signataire côté donneur d'ordre est le représentant légal de l'entité.
  // Son adresse vient de `contact_email` : sans elle, personne ne peut signer
  // pour la société, et DocuSign refuserait un destinataire sans courriel.
  const { data: contact } = await sb
    .from("legal_entities")
    .select("contact_email")
    .eq("id", c.entity_id)
    .maybeSingle<{ contact_email: string | null }>();
  const emailEntite = (contact?.contact_email ?? "").trim();
  if (!emailEntite) {
    return {
      ok: false,
      error: `L'entité « ${e.legal_name ?? ""} » n'a pas d'adresse de courriel de contact. `
        + "C'est elle qui recevra la demande de signature côté donneur d'ordre : "
        + "renseignez-la dans Réglages › Sociétés.",
    };
  }

  // ── 5. Le document ──────────────────────────────────────────────────
  // On régénère depuis l'instantané figé à l'émission : c'est bien le document
  // numéroté qui part, pas un recalcul qui pourrait avoir changé.
  const assemblage = await assemblerDocumentContrat(c.id);
  if (!assemblage.ok) return { ok: false, error: assemblage.error };
  const doc = assemblage.document;

  let pdf: Buffer;
  try {
    pdf = await renderToBuffer(
      SousTraitancePdf({
        titre: doc.titre,
        numero: doc.ref,
        dateFr: new Date().toLocaleDateString("fr-FR"),
        modeleLabel: doc.modeleLabel,
        version: doc.version,
        parties: doc.parties,
        articles: doc.articles,
        montants: doc.montants,
        bonMission: doc.bonMission,
        rapport: doc.rapport,
        signatures: doc.signatures,
      }),
    );
  } catch (err) {
    console.error("[docusign] génération du PDF impossible", err);
    return { ok: false, error: "Le PDF du contrat n'a pas pu être généré." };
  }

  const signataires: Signataire[] = [
    {
      email: emailEntite,
      nom: e.representative_name ?? e.legal_name ?? "Donneur d'ordre",
      role: "donneur_ordre",
    },
    {
      email: p.email,
      nom: p.dirigeant ?? p.raisonSociale ?? p.nom,
      role: "sous_traitant",
    },
  ];

  // ── 6. État intermédiaire EXACT avant l'appel ───────────────────────
  // Si DocuSign échoue, le contrat restera ici : « en attente d'envoi », ce
  // qui est la vérité. Jamais « envoyé ».
  const instantane = instantanerEntite({
    id: e.id,
    legalName: e.legal_name ?? "",
    tradeName: e.trade_name,
    legalForm: e.legal_form,
    siren: e.siren,
    siret: e.siret,
    vatNumber: e.vat_number,
    address: e.address,
    country: e.country,
    representativeName: e.representative_name,
    representativeTitle: e.representative_title,
    contactEmail: emailEntite,
  } satisfies EntiteJuridique);

  // ── 7. L'appel ──────────────────────────────────────────────────────
  const envoi = await creerEnveloppe({
    entityId: c.entity_id,
    pdf,
    nomFichier: `${c.ref}.pdf`,
    objet: `Contrat de sous-traitance ${c.ref} — ${e.legal_name ?? ""}`,
    message:
      `Bonjour,\n\nVeuillez trouver le contrat de sous-traitance ${c.ref} `
      + `(${modeleLabelNumerote(c.modele as ModeleContrat)}) à signer électroniquement.\n\n`
      + `Il comprend le contrat, le bon de mission et le rapport de fin d'intervention.\n\n`
      + `${e.legal_name ?? ""}`,
    // La référence du contrat EST la clé d'idempotence : un même contrat ne
    // peut produire qu'une enveloppe, côté DocuSign comme côté CRM.
    idempotence: `contrat-st-${c.ref}`,
    signataires,
  });

  if (!envoi.ok) {
    // Trace de l'échec, sans rien de sensible, et statut inchangé.
    await sb.from("subcontract_events").insert({
      contract_id: c.id,
      kind: "envoi_signature_echec",
      by_user: input.userId,
      detail: {
        statut_http: envoi.statutHttp ?? null,
        code_docusign: envoi.codeDocuSign ?? null,
      },
    } as never);
    return { ok: false, error: envoi.error };
  }

  // ── 8. Confirmation reçue : on enregistre ───────────────────────────
  const statut = statutDepuisDocuSign({ statut: envoi.statut, destinataires: [] });
  const maintenant = new Date().toISOString();

  const { error: errEnv } = await sb.from("docusign_envelopes").insert({
    envelope_id: envoi.envelopeId,
    entity_id: c.entity_id,
    contract_id: c.id,
    document_type: "contrat_sous_traitance",
    statut,
    signataires: signataires.map((s) => ({
      email: s.email, nom: s.nom, role: s.role, statut: "sent",
    })),
    envoye_le: maintenant,
    envoye_par: input.userId,
    synchronise_le: maintenant,
  } as never);
  if (errEnv) {
    // L'enveloppe EXISTE chez DocuSign : on ne peut pas prétendre le
    // contraire. On le dit, avec l'identifiant, pour que le rattrapage ou un
    // humain puisse reprendre la main.
    console.error("[docusign] enveloppe créée mais non enregistrée", errEnv.message);
    return {
      ok: false,
      error: `L'enveloppe a été créée chez DocuSign (${envoi.envelopeId}) mais le CRM n'a pas pu `
        + `l'enregistrer : ${errEnv.message}. Signalez cet identifiant à un administrateur.`,
    };
  }

  await sb.from("docusign_envelope_events").insert({
    envelope_id: envoi.envelopeId,
    statut,
    origine: "manuel",
    detail: { contrat: c.ref, entite: instantane.legal_name, signataires: signataires.length },
  } as never);

  await sb
    .from("subcontract_contracts")
    .update({
      statut: "envoye",
      envoye_a: signataires.map((s) => s.email).join(", "),
      envoye_le: maintenant,
      envoye_par: input.userId,
      updated_at: maintenant,
    } as never)
    .eq("id", c.id);

  await sb.from("subcontract_events").insert({
    contract_id: c.id,
    kind: "envoye_signature",
    by_user: input.userId,
    detail: { envelope_id: envoi.envelopeId, statut },
  } as never);

  await auditLog({
    action: "subcontract.contract.sent",
    entityType: "subcontract_contract",
    entityId: c.id,
    after: { envelope_id: envoi.envelopeId, ref: c.ref, statut, destinataires: signataires.length },
  });

  return {
    ok: true,
    envelopeId: envoi.envelopeId,
    statut,
    message: `Contrat ${c.ref} envoyé à la signature (${signataires.length} signataires).`,
  };
}
