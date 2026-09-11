import { NextResponse } from "next/server";
import { evaluate } from "@/lib/presence/alerts-server";
import { evaluateCommercialActions } from "@/lib/commercial-actions/engine-server";
import { isCurrentUserAdmin } from "@/lib/presence/guard";

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
  const result = await evaluate();
  // Couche complémentaire « Actions & Relances commerciales » : même cron, en
  // additif. Isolée : une erreur ici ne doit jamais faire échouer les alertes.
  let commercial: unknown = { ok: false, skipped: true };
  try {
    commercial = await evaluateCommercialActions();
  } catch (e) {
    console.error("[commercial-actions.evaluate] échec :", (e as Error).message);
    commercial = { ok: false, error: (e as Error).message };
  }
  return NextResponse.json({ ...result, commercial });
}

export async function POST(request: Request) {
  return run(request);
}
export async function GET(request: Request) {
  return run(request);
}
