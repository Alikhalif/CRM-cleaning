import { NextResponse } from "next/server";
import { terminerAutorisation } from "@/lib/docusign/oauth-server";
import { auditLog } from "@/lib/audit";

// Retour d'autorisation DocuSign.
//
// L'URL est celle déclarée dans l'application DocuSign Developer
// (DOCUSIGN_REDIRECT_URI). Elle est publique par nature — DocuSign y renvoie
// le navigateur — mais elle ne donne aucun pouvoir : sans un `state` connu,
// non expiré et non consommé, le code reçu est inutilisable. Le
// `code_verifier` de PKCE, lui, n'a jamais quitté le serveur.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Où revenir, avec un message lisible. Jamais de secret dans l'URL.
 *
 * L'origine est déduite de `DOCUSIGN_REDIRECT_URI`, qui est déjà obligatoire
 * et absolue. On évite ainsi une variable d'environnement de plus, et surtout
 * une incohérence : l'origine du retour est forcément celle que DocuSign a
 * appelée. Elle n'est PAS prise dans les en-têtes de la requête — un `Host`
 * forgé dirigerait la redirection vers un domaine tiers.
 */
function retour(message: string, ok: boolean): NextResponse {
  const configuree = (process.env.DOCUSIGN_REDIRECT_URI ?? "").trim();
  let origine = "http://localhost:3000";
  try {
    if (configuree) origine = new URL(configuree).origin;
  } catch {
    // URI mal formée : on retombe sur le local plutôt que de planter le
    // retour. La configuration sera de toute façon signalée ailleurs.
  }
  const u = new URL("/settings/entities", origine);
  u.searchParams.set("docusign", ok ? "ok" : "erreur");
  u.searchParams.set("message", message);
  return NextResponse.redirect(u.toString(), 303);
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;

  // DocuSign renvoie `error` si l'utilisateur refuse l'autorisation.
  const refus = p.get("error");
  if (refus) {
    return retour("Autorisation refusée chez DocuSign.", false);
  }

  const code = p.get("code") ?? "";
  const state = p.get("state") ?? "";
  if (!code || !state) return retour("Retour DocuSign incomplet.", false);

  const r = await terminerAutorisation({ code, state });
  if (!r.ok) {
    // Journalisé sans le code ni le state : ce sont des éléments à usage
    // unique, mais inutile de les laisser dans les journaux.
    console.error(`[docusign:callback] ${r.error}`);
    return retour(r.error, false);
  }

  await auditLog({
    action: "docusign.authorize.success",
    entityType: "user",
    entityId: null,
    after: { entity_id: r.entityId, compte: r.compte },
  });

  return retour(`Compte DocuSign « ${r.compte} » raccordé.`, true);
}
