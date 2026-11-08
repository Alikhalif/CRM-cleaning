import { NextResponse } from "next/server";
import { evaluate } from "@/lib/presence/alerts-server";
import { evaluateCommercialActions } from "@/lib/commercial-actions/engine-server";
import { evaluateDocumentAlerts } from "@/lib/documents/alerts-server";
import { evaluerActionsBackOffice } from "@/lib/actions-back-office/engine-server";
import { isCurrentUserAdmin } from "@/lib/presence/guard";
import { rattraperArchivages, rejouerFile } from "@/lib/docusign/notifications-server";
import { purgerEtatsOAuth } from "@/lib/docusign/oauth-server";
import { modeCourant } from "@/lib/env/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST/GET /api/presence/evaluate — moteur d'alertes + agrégat journalier.
// Déclenché par un cron (toutes les 1–2 min) via l'en-tête X-Cron-Secret =
// PRESENCE_CRON_SECRET, OU manuellement par un Super Admin connecté (bouton
// « Rafraîchir »). Requêtes bornées → aucun impact sur le CRM.
async function run(request: Request) {
  const secret = process.env.PRESENCE_CRON_SECRET;
  const parEntete = request.headers.get("x-cron-secret");
  const parUrl = new URL(request.url).searchParams.get("secret");

  // ── Le secret dans l'URL ────────────────────────────────────────────
  //
  // Un secret passé en paramètre d'URL se retrouve dans les journaux du
  // reverse-proxy, dans l'historique du shell et dans les traces. L'en-tête
  // est la seule forme saine.
  //
  // ⚠️ On ne le COUPE PAS en production sans savoir comment le planificateur
  // du VPS appelle cette route : si c'est par l'URL, le moteur d'alertes et de
  // relances s'arrêterait en silence — et il porte `/ma-journee`, les photos,
  // la présence et l'expiration des contrats.
  //
  // Donc : refusé hors production, et toléré-mais-journalisé en production
  // jusqu'à ce que l'appel du VPS soit vérifié. `CGK_CRON_SECRET_URL=refuse`
  // bascule l'interdiction partout, en une variable, le jour où c'est confirmé.
  const urlRefusee =
    modeCourant() !== "production" ||
    (process.env.CGK_CRON_SECRET_URL ?? "").trim().toLowerCase() === "refuse";

  if (parUrl && !parEntete) {
    if (urlRefusee) {
      console.error(
        "[presence.evaluate] secret fourni en PARAMÈTRE D'URL : refusé. " +
          "Utilisez l'en-tête x-cron-secret.",
      );
      return NextResponse.json(
        { ok: false, error: "secret_en_url_refuse", attendu: "en-tête x-cron-secret" },
        { status: 403 },
      );
    }
    console.warn(
      "[presence.evaluate] secret fourni en PARAMÈTRE D'URL. Toléré en " +
        "production pour ne pas interrompre le moteur d'alertes, mais à " +
        "corriger : le secret se retrouve dans les journaux du proxy. " +
        "Passez le planificateur à l'en-tête x-cron-secret, puis posez " +
        "CGK_CRON_SECRET_URL=refuse.",
    );
  }

  const provided = parEntete || (urlRefusee ? null : parUrl);
  const authorized = (secret && provided === secret) || (await isCurrentUserAdmin());
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  // Passe présence (agrégat + 5 règles d'alerte). Isolée comme les deux autres :
  // sous cron (toutes les 1–2 min), un échec ici ne doit PAS empêcher les passes
  // « commercial » et « documents » de s'exécuter.
  let result: Record<string, unknown> = { ok: false, skipped: true };
  try {
    result = (await evaluate()) as Record<string, unknown>;
  } catch (e) {
    console.error("[presence.evaluate] échec :", (e as Error).message);
    result = { ok: false, error: (e as Error).message };
  }
  // Couche complémentaire « Actions & Relances commerciales » : même cron, en
  // additif. Isolée : une erreur ici ne doit jamais faire échouer les alertes.
  let commercial: unknown = { ok: false, skipped: true };
  try {
    commercial = await evaluateCommercialActions();
  } catch (e) {
    console.error("[commercial-actions.evaluate] échec :", (e as Error).message);
    commercial = { ok: false, error: (e as Error).message };
  }
  // Couche « Documents & Contrats » : alertes push (contrats expirants), isolée.
  let documents: unknown = { ok: false, skipped: true };
  try {
    documents = await evaluateDocumentAlerts();
  } catch (e) {
    console.error("[documents.evaluate] échec :", (e as Error).message);
    documents = { ok: false, error: (e as Error).message };
  }
  // Couche DocuSign : rejeu des notifications en échec et rattrapage des
  // archivages manquants, isolée comme les précédentes.
  //
  // Elle est INDISPENSABLE au bon fonctionnement de la signature : une
  // notification perdue ou un téléchargement échoué laisserait un contrat
  // signé chez DocuSign mais non archivé dans le CRM. C'est ce passage qui
  // ferme la boucle. Sans cron, la signature reste tributaire du seul webhook.
  let docusign: unknown = { ok: false, skipped: true };
  try {
    const [file, archivages] = await Promise.all([
      rejouerFile(),
      rattraperArchivages(),
    ]);
    // Purge isolée DANS la passe : c'est un entretien, pas un traitement
    // critique. Son échec ne doit masquer ni le rejeu des notifications ni le
    // rattrapage des archivages, dont dépend l'exactitude des signatures.
    // `purgerEtatsOAuth()` avale déjà ses erreurs et renvoie null ; ce
    // try/catch couvre le cas où l'appel lui-même ne reviendrait pas.
    let purge: number | null | string = null;
    try {
      purge = await purgerEtatsOAuth();
    } catch (e) {
      purge = `échec : ${(e as Error).message}`;
    }
    docusign = { ok: true, file, archivages, etatsOauthPurges: purge };
  } catch (e) {
    console.error("[docusign.evaluate] échec :", (e as Error).message);
    docusign = { ok: false, error: (e as Error).message };
  }

  // 5e passe (2026-11-09) — actions attendues du back-office : rattrapage de
  // ce que l'évaluation immédiate aurait manqué, et ESCALADES au Super Admin
  // (délais paramétrables). Isolée comme les autres : son échec, ou l'absence
  // de sa migration (20261109000006), n'arrête aucune autre passe.
  let backOffice: unknown = { ok: false, skipped: true };
  try {
    backOffice = await evaluerActionsBackOffice();
  } catch (e) {
    console.error("[actions-back-office.evaluate] échec :", (e as Error).message);
    backOffice = { ok: false, error: (e as Error).message };
  }

  return NextResponse.json({ ...result, commercial, documents, docusign, backOffice });
}

export async function POST(request: Request) {
  return run(request);
}
export async function GET(request: Request) {
  return run(request);
}
