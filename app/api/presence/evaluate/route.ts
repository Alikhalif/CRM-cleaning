import { NextResponse } from "next/server";
import { evaluate } from "@/lib/presence/alerts-server";
import { evaluateCommercialActions } from "@/lib/commercial-actions/engine-server";
import { evaluateDocumentAlerts } from "@/lib/documents/alerts-server";
import { isCurrentUserAdmin } from "@/lib/presence/guard";
import { rattraperArchivages, rejouerFile } from "@/lib/docusign/notifications-server";
import { purgerEtatsOAuth } from "@/lib/docusign/oauth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST/GET /api/presence/evaluate — moteur d'alertes + agrégat journalier.
// Déclenché par un cron (toutes les 1–2 min) via l'en-tête X-Cron-Secret =
// PRESENCE_CRON_SECRET, OU manuellement par un Super Admin connecté (bouton
// « Rafraîchir »). Requêtes bornées → aucun impact sur le CRM.
async function run(request: Request) {
  const secret = process.env.PRESENCE_CRON_SECRET;
  const provided = request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");
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

  return NextResponse.json({ ...result, commercial, documents, docusign });
}

export async function POST(request: Request) {
  return run(request);
}
export async function GET(request: Request) {
  return run(request);
}
