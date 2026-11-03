import { NextResponse } from "next/server";
import { configDocuSign } from "@/lib/docusign/config";
import { cleEvenement, lireNotification, signatureValide } from "@/lib/docusign/webhook";
import { mettreEnFile, traiterNotification } from "@/lib/docusign/notifications-server";

// Webhook DocuSign Connect.
//
// ⚠️ CETTE URL EST PUBLIQUE. Le proxy du CRM laisse passer `/api/*` sans
// session, donc l'authentification se fait ICI et nulle part ailleurs : HMAC
// sur le CORPS BRUT, contre la clé partagée déclarée dans DocuSign Connect.
// Sans elle, n'importe qui pourrait déclarer un contrat « signé ».
//
// `request.text()` AVANT tout : la signature porte sur les octets reçus. Un
// `request.json()` suivi d'une re-sérialisation changerait les espaces et
// invaliderait la vérification.
export const runtime = "nodejs";
// Un webhook ne se met jamais en cache.
export const dynamic = "force-dynamic";

/** En-têtes où DocuSign place la signature, selon la génération de Connect. */
const ENTETES_SIGNATURE = [
  "x-docusign-signature-1",
  "x-docusign-signature-2",
  "x-docusign-signature-3",
];

export async function POST(request: Request) {
  const conf = configDocuSign();
  if (!conf.ok) {
    // On ne dit pas QUOI manque : la réponse est publique.
    console.error(`[docusign:webhook] configuration incomplète : ${conf.manquant.join(", ")}`);
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const corpsBrut = await request.text();
  if (!corpsBrut) return NextResponse.json({ error: "empty_body" }, { status: 400 });

  // DocuSign peut faire tourner plusieurs clés : on accepte si l'UNE des
  // signatures présentes est valide.
  const signatures = ENTETES_SIGNATURE
    .map((h) => request.headers.get(h))
    .filter((v): v is string => !!v);

  const valide = signatures.some(
    (sig) => signatureValide(corpsBrut, sig, conf.config.hmacSecret).ok,
  );
  if (!valide) {
    // 401 sans détail. Journalisé côté serveur, sans le corps : une
    // notification falsifiée pourrait contenir n'importe quoi.
    console.error("[docusign:webhook] signature HMAC invalide ou absente — notification refusée");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(corpsBrut);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const lue = lireNotification(payload);
  if (!lue.ok) {
    // 200 volontairement : le message est authentique mais inexploitable.
    // Un 4xx ferait réémettre DocuSign indéfiniment pour rien.
    console.error(`[docusign:webhook] notification illisible : ${lue.raison}`);
    return NextResponse.json({ ok: true, ignore: lue.raison });
  }

  const cle = cleEvenement({
    envelopeId: lue.notification.envelopeId,
    statut: lue.notification.statut,
    horodatage: lue.notification.horodatage,
  });

  // On encaisse d'abord. DocuSign réémet si la réponse tarde, et une
  // notification perdue vaut moins qu'une notification en file.
  const file = await mettreEnFile({
    eventKey: cle,
    envelopeId: lue.notification.envelopeId,
    statutRecu: lue.notification.statut,
    payload,
  });
  if (!file.ok) {
    console.error(`[docusign:webhook] mise en file impossible : ${file.error}`);
    return NextResponse.json({ error: "queue_failed" }, { status: 500 });
  }
  // Déjà vue : rejeu. 200 sans retraiter — c'est l'idempotence.
  if (!file.nouveau) {
    return NextResponse.json({ ok: true, deja_traite: true });
  }

  // Traitement immédiat, au mieux. Un échec n'est PAS une erreur de webhook :
  // la notification est en file et le cron la rejouera. Répondre 500
  // provoquerait des réémissions inutiles pour un travail déjà pris en charge.
  const r = await traiterNotification(lue.notification);
  if (!r.ok) {
    console.error(`[docusign:webhook] traitement différé (${lue.notification.envelopeId}) : ${r.error}`);
    await marquerEchec(cle, r.error);
    return NextResponse.json({ ok: true, differe: true });
  }

  await marquerTraite(cle, r.ignore ?? null);
  return NextResponse.json({
    ok: true,
    statut: r.statut,
    archive: r.archive,
    ...(r.ignore ? { ignore: r.ignore } : {}),
  });
}

// ── Suivi de la ligne de file ────────────────────────────────────────
// Importés tardivement pour garder la route lisible ; ce sont deux écritures
// de confort, dont l'échec ne doit pas faire échouer la réponse.

async function marquerTraite(eventKey: string, note: string | null): Promise<void> {
  try {
    const { supabaseServiceRole } = await import("@/lib/supabase/service");
    const sb = await supabaseServiceRole();
    await sb
      .from("docusign_webhook_queue")
      .update({
        etat: "traite",
        traite_le: new Date().toISOString(),
        derniere_erreur: note,
      } as never)
      .eq("event_key", eventKey);
  } catch (err) {
    console.error("[docusign:webhook] marquage « traité » impossible", err);
  }
}

async function marquerEchec(eventKey: string, raison: string): Promise<void> {
  try {
    const { supabaseServiceRole } = await import("@/lib/supabase/service");
    const { prochainEssai } = await import("@/lib/docusign/webhook");
    const sb = await supabaseServiceRole();
    const suivant = prochainEssai(1);
    await sb
      .from("docusign_webhook_queue")
      .update({
        etat: "echec",
        essais: 1,
        derniere_erreur: raison.slice(0, 500),
        prochain_essai_le: suivant ? suivant.toISOString() : null,
      } as never)
      .eq("event_key", eventKey);
  } catch (err) {
    console.error("[docusign:webhook] marquage « échec » impossible", err);
  }
}

/**
 * DocuSign Connect peut émettre un GET de vérification à l'enregistrement de
 * l'URL. On répond 200 sans rien faire : c'est un test de joignabilité, pas
 * une notification.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "docusign-connect" });
}
