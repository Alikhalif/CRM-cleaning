import "server-only";

// Traitement des notifications DocuSign Connect, et rattrapage.
//
// CE QUI FAIT FOI
//
// La notification signale un changement ; c'est l'API DocuSign qui dit l'état
// réel. Sur un statut terminal — signé, refusé, annulé, expiré — on RELIT
// l'enveloppe chez DocuSign avant d'agir. Trois raisons :
//
//   • les notifications arrivent dans le désordre : une ancienne peut suivre
//     une récente, et « partiellement signé » ne doit pas succéder à
//     « signé » ;
//   • le format Connect varie selon la génération, et les destinataires n'y
//     figurent pas toujours — or « partiellement signé » s'en déduit ;
//   • archiver sur la seule foi d'un message HTTP reviendrait à faire
//     confiance à un appelant que l'on ne contrôle pas.
//
// La vérification HMAC protège déjà l'authenticité ; la relecture protège
// l'exactitude. Les deux sont nécessaires.

import { supabaseServiceRole } from "@/lib/supabase/service";
import { lireEnveloppe } from "./client";
import { archiverEnveloppe } from "./archivage-server";
import {
  aTraiterMaintenant, alerteNecessaire, lireNotification, prochainEssai,
} from "./webhook";
import {
  appliquer, doitEtreArchive, estTerminal, statutDepuisDocuSign,
  type StatutSignature,
} from "./statuts";
import type { NotificationLue } from "./webhook";

export type ResultatTraitement =
  | { ok: true; statut: StatutSignature; archive: boolean; ignore?: string }
  | { ok: false; error: string; reessayer: boolean };

type EnveloppeRow = {
  id: string;
  envelope_id: string;
  entity_id: string;
  contract_id: string | null;
  statut: StatutSignature;
};

type FileRow = {
  id: string;
  event_key: string;
  envelope_id: string;
  payload: unknown;
  etat: "en_attente" | "en_cours" | "traite" | "echec";
  essais: number;
  prochain_essai_le: string | null;
};

/**
 * Enregistre une notification en file, sans la traiter.
 *
 * Le webhook doit répondre vite : DocuSign réémet si la réponse tarde. On
 * encaisse donc d'abord, on traite ensuite. L'unicité de `event_key` fait
 * l'idempotence — une notification rejouée ne crée pas de seconde ligne.
 */
export async function mettreEnFile(input: {
  eventKey: string;
  envelopeId: string;
  statutRecu: string;
  payload: unknown;
}): Promise<{ ok: true; nouveau: boolean; id: string | null } | { ok: false; error: string }> {
  const sb = await supabaseServiceRole();
  const { data, error } = await sb
    .from("docusign_webhook_queue")
    .insert({
      event_key: input.eventKey,
      envelope_id: input.envelopeId,
      statut_recu: input.statutRecu,
      payload: input.payload as never,
    } as never)
    .select("id")
    .returns<{ id: string }[]>();

  // 23505 = violation d'unicité : la notification est déjà connue. C'est le
  // cas NORMAL d'un rejeu, et il se répond 200 — même convention que les
  // autres webhooks du CRM (`lib/webhook-dedup.ts`).
  if (error) {
    if (error.code === "23505") return { ok: true, nouveau: false, id: null };
    return { ok: false, error: error.message };
  }
  return { ok: true, nouveau: true, id: data?.[0]?.id ?? null };
}

/**
 * Traite une notification : relit l'état réel, applique la transition,
 * archive si la signature est complète.
 */
export async function traiterNotification(
  notification: NotificationLue,
): Promise<ResultatTraitement> {
  const sb = await supabaseServiceRole();

  const { data: env } = await sb
    .from("docusign_envelopes")
    .select("id, envelope_id, entity_id, contract_id, statut")
    .eq("envelope_id", notification.envelopeId)
    .maybeSingle<EnveloppeRow>();

  // Une enveloppe inconnue n'est pas une erreur à réessayer : elle n'a pas
  // été créée par ce CRM, ou a été créée par un autre environnement
  // (Sandbox contre Production). On l'ignore en le disant.
  if (!env) {
    return {
      ok: true,
      statut: "erreur_synchronisation",
      archive: false,
      ignore: "enveloppe inconnue du CRM (autre environnement ou autre application)",
    };
  }

  // ── 1. L'état réel, chez DocuSign ───────────────────────────────────
  let statutCible: StatutSignature;
  let completedAt: string | null = notification.completedAt;
  let destinataires = notification.destinataires;

  const reel = await lireEnveloppe({
    entityId: env.entity_id,
    envelopeId: notification.envelopeId,
  });
  if (reel.ok) {
    statutCible = statutDepuisDocuSign({
      statut: reel.statut,
      destinataires: reel.destinataires,
      motifAnnulation: reel.motifAnnulation,
      completedAt: reel.completedAt,
    });
    completedAt = reel.completedAt ?? completedAt;
    destinataires = reel.destinataires.length > 0 ? reel.destinataires : destinataires;
  } else {
    // DocuSign injoignable. Sur un statut NON terminal on se contente de la
    // notification : le risque est faible et l'information reste utile. Sur
    // un terminal — donc un archivage — on refuse d'avancer sans
    // confirmation, et on réessaiera.
    const provisoire = statutDepuisDocuSign({
      statut: notification.statut,
      destinataires: notification.destinataires,
      motifAnnulation: notification.motifAnnulation,
      completedAt: notification.completedAt,
    });
    if (estTerminal(provisoire)) {
      return {
        ok: false,
        error: `État terminal annoncé mais non vérifiable : ${reel.error}`,
        reessayer: true,
      };
    }
    statutCible = provisoire;
  }

  // ── 2. Transition, ou refus motivé ──────────────────────────────────
  const transition = appliquer(env.statut, statutCible);
  if (!transition.ok) {
    // Notification en retard : on la journalise et on s'arrête là. Rien à
    // réessayer — l'état courant est plus avancé, donc plus juste.
    await sb.from("docusign_envelope_events").insert({
      envelope_id: env.envelope_id,
      statut: statutCible,
      origine: "webhook",
      detail: { refuse: transition.raison, statut_courant: env.statut },
    } as never);
    return {
      ok: true,
      statut: env.statut,
      archive: false,
      ignore: transition.raison,
    };
  }

  const maintenant = new Date().toISOString();
  if (transition.statut !== env.statut) {
    await sb
      .from("docusign_envelopes")
      .update({
        statut: transition.statut,
        signataires: destinataires as never,
        completed_at: completedAt,
        synchronise_le: maintenant,
        updated_at: maintenant,
      } as never)
      .eq("id", env.id);

    await sb.from("docusign_envelope_events").insert({
      envelope_id: env.envelope_id,
      statut: transition.statut,
      origine: reel.ok ? "webhook" : "rattrapage",
      detail: { destinataires: destinataires.length, verifie_api: reel.ok },
    } as never);

    // Le contrat suit, sauf pour la signature : c'est l'archivage qui le
    // passera à « signé », une fois les pièces réellement en place.
    if (env.contract_id && !doitEtreArchive(transition.statut)) {
      const corresp: Partial<Record<StatutSignature, string>> = {
        envoye_signature: "envoye",
        en_attente_signature: "consulte",
        partiellement_signe: "en_attente_signature",
        refuse: "refuse",
        annule: "annule",
        expire: "expire",
      };
      const statutContrat = corresp[transition.statut];
      if (statutContrat) {
        await sb
          .from("subcontract_contracts")
          .update({
            statut: statutContrat,
            ...(transition.statut === "en_attente_signature" ? { consulte_le: maintenant } : {}),
            updated_at: maintenant,
          } as never)
          .eq("id", env.contract_id);
      }
    }
  } else {
    await sb
      .from("docusign_envelopes")
      .update({ synchronise_le: maintenant, updated_at: maintenant } as never)
      .eq("id", env.id);
  }

  // ── 3. Archivage ────────────────────────────────────────────────────
  if (!doitEtreArchive(transition.statut)) {
    return { ok: true, statut: transition.statut, archive: false };
  }

  const arch = await archiverEnveloppe(env.envelope_id);
  if (!arch.ok) {
    // La signature est acquise, l'archivage non : l'événement reste en file
    // et sera rejoué. On ne prétend pas avoir terminé.
    return { ok: false, error: arch.error, reessayer: true };
  }
  return { ok: true, statut: transition.statut, archive: !arch.dejaFait };
}

// ══════════════════════════════════════════════════════════════════════
//  File de reprise
// ══════════════════════════════════════════════════════════════════════

/**
 * Rejoue les notifications en attente ou en échec.
 *
 * Appelée par le cron. Traite un lot borné : une file engorgée ne doit pas
 * faire expirer la requête, et le prochain passage reprendra la suite.
 */
export async function rejouerFile(limite = 20): Promise<{
  traites: number;
  echecs: number;
  abandons: number;
}> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("docusign_webhook_queue")
    .select("id, event_key, envelope_id, payload, etat, essais, prochain_essai_le")
    .in("etat", ["en_attente", "echec"])
    .order("recu_le", { ascending: true })
    .limit(limite)
    .returns<FileRow[]>();

  let traites = 0;
  let echecs = 0;
  let abandons = 0;

  for (const ligne of data ?? []) {
    if (!aTraiterMaintenant({ etat: ligne.etat, prochainEssaiLe: ligne.prochain_essai_le })) {
      continue;
    }

    // Verrou coopératif : on ne prend la ligne que si elle est encore libre.
    // Deux passages de cron qui se chevauchent ne la traiteraient pas deux fois.
    const { data: pris } = await sb
      .from("docusign_webhook_queue")
      .update({ etat: "en_cours" } as never)
      .eq("id", ligne.id)
      .in("etat", ["en_attente", "echec"])
      .select("id")
      .returns<{ id: string }[]>();
    if (!pris || pris.length === 0) continue;

    const lue = lireNotification(ligne.payload);
    if (!lue.ok) {
      // Un corps illisible ne se répare pas en réessayant : on abandonne.
      await sb
        .from("docusign_webhook_queue")
        .update({
          etat: "echec",
          essais: ligne.essais + 1,
          derniere_erreur: lue.raison,
          prochain_essai_le: null,
        } as never)
        .eq("id", ligne.id);
      abandons++;
      continue;
    }

    const r = await traiterNotification(lue.notification);
    if (r.ok) {
      await sb
        .from("docusign_webhook_queue")
        .update({
          etat: "traite",
          traite_le: new Date().toISOString(),
          derniere_erreur: r.ignore ?? null,
          prochain_essai_le: null,
        } as never)
        .eq("id", ligne.id);
      traites++;
      continue;
    }

    const essais = ligne.essais + 1;
    const suivant = r.reessayer ? prochainEssai(essais) : null;
    await sb
      .from("docusign_webhook_queue")
      .update({
        etat: "echec",
        essais,
        derniere_erreur: r.error.slice(0, 500),
        prochain_essai_le: suivant ? suivant.toISOString() : null,
      } as never)
      .eq("id", ligne.id);
    if (alerteNecessaire(essais)) {
      console.error(
        `[docusign] abandon après ${essais} tentatives sur ${ligne.envelope_id} : ${r.error}`,
      );
      abandons++;
    } else {
      echecs++;
    }
  }

  return { traites, echecs, abandons };
}

/**
 * Rattrapage des enveloppes signées mais non archivées.
 *
 * Deuxième filet, indépendant de la file : si une notification n'est JAMAIS
 * arrivée — Connect mal configuré, panne réseau durable — l'enveloppe reste
 * signée et non archivée. Cet index existe en base précisément pour cela
 * (`idx_dse_a_archiver`).
 */
export async function rattraperArchivages(limite = 10): Promise<{ archives: number; echecs: number }> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("docusign_envelopes")
    .select("envelope_id, archivage_essais")
    .eq("statut", "signe_toutes_parties")
    .is("archive_le", null)
    .order("completed_at", { ascending: true })
    .limit(limite)
    .returns<{ envelope_id: string; archivage_essais: number }[]>();

  let archives = 0;
  let echecs = 0;
  for (const e of data ?? []) {
    // Au-delà du plafond on arrête : inutile de marteler un échec permanent,
    // l'erreur est déjà enregistrée et visible.
    if (e.archivage_essais >= 6) continue;
    const r = await archiverEnveloppe(e.envelope_id);
    if (r.ok) archives++;
    else echecs++;
  }
  return { archives, echecs };
}

/**
 * Resynchronisation d'une enveloppe, à la demande.
 *
 * Sert au bouton « Actualiser » de la fiche : la planificatrice n'a pas à
 * attendre le cron pour savoir où en est une signature.
 */
export async function resynchroniser(envelopeId: string): Promise<ResultatTraitement> {
  const sb = await supabaseServiceRole();
  const { data: env } = await sb
    .from("docusign_envelopes")
    .select("envelope_id, entity_id")
    .eq("envelope_id", envelopeId)
    .maybeSingle<{ envelope_id: string; entity_id: string }>();
  if (!env) return { ok: false, error: "Enveloppe inconnue du CRM.", reessayer: false };

  const reel = await lireEnveloppe({ entityId: env.entity_id, envelopeId });
  if (!reel.ok) return { ok: false, error: reel.error, reessayer: true };

  return traiterNotification({
    envelopeId,
    statut: reel.statut,
    horodatage: reel.horodatage,
    destinataires: reel.destinataires,
    motifAnnulation: reel.motifAnnulation,
    completedAt: reel.completedAt,
  });
}
