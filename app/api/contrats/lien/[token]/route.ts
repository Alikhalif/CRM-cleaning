import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { CLIENT_DOCS_BUCKET } from "@/lib/documents/documents-server";
import { decider, jetonBienForme, TTL_REDIRECTION_SECONDES } from "@/lib/documents/contrat-lien-shared";
import { envoiInitial, lireLien, renouvellementsDernieres24h } from "@/lib/documents/contrat-lien-server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { pagePublique } from "../page-publique";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// D23 — ouverture d'un lien de contrat (public, sans compte).
//
// Valide → redirection vers une URL de stockage de 5 minutes.
// Expiré → page qui propose le renouvellement, s'il est encore permis.
// Révoqué → page qui renvoie au courriel le plus récent.
// Inconnu ou mal formé → même réponse qu'un lien inconnu : on ne dit pas à un
// curieux si un jeton a existé.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inconnu = () => pagePublique(
    "Lien invalide",
    "<p>Ce lien n'est pas valide. Vérifiez qu'il a été copié en entier, ou contactez-nous.</p>",
    404,
  );
  if (!jetonBienForme(token)) return inconnu();

  const lien = await lireLien(token);
  if (!lien) return inconnu();

  const sb = await supabaseServiceRole();
  const { data: contrat } = await sb
    .from("contracts")
    .select("pdf_path, deleted_at")
    .eq("id", lien.contract_id)
    .maybeSingle<{ pdf_path: string | null; deleted_at: string | null }>();
  if (!contrat || contrat.deleted_at || !contrat.pdf_path) {
    return pagePublique("Document indisponible", "<p>Ce document n'est plus disponible. Contactez-nous.</p>", 410);
  }

  const decision = decider(
    { expireAt: lien.expire_at, revoqueAt: lien.revoque_at, envoiInitialAt: await envoiInitial(lien) },
    new Date(),
    await renouvellementsDernieres24h(lien.contract_id),
  );

  if (decision.action === "revoque") {
    return pagePublique(
      "Lien remplacé",
      "<p>Un lien plus récent vous a été envoyé par courriel. Utilisez le dernier reçu.</p>",
      410,
    );
  }

  if (decision.action === "expire") {
    const corps = decision.renouvelable
      ? `<p>Pour votre sécurité, ce lien n'était valable qu'une heure.</p>
         <p>Vous pouvez en recevoir un nouveau, à l'adresse à laquelle ce contrat vous a été envoyé.</p>
         <form method="post" action="/api/contrats/lien/${token}/renouveler">
           <button type="submit">Recevoir un nouveau lien</button>
         </form>`
      : `<p>Ce lien a expiré.</p><p>${decision.raison ?? "Contactez-nous pour un nouvel envoi."}</p>`;
    return pagePublique("Lien expiré", corps, 410);
  }

  // Valide : URL de stockage courte, puis redirection. Le contrat ne quitte
  // le bucket privé que pour cette ouverture.
  const { data: signe } = await sb.storage
    .from(CLIENT_DOCS_BUCKET)
    .createSignedUrl(contrat.pdf_path, TTL_REDIRECTION_SECONDES);
  if (!signe?.signedUrl) {
    return pagePublique("Document indisponible", "<p>Le document n'a pas pu être ouvert. Réessayez dans un instant.</p>", 503);
  }

  await sb.from("contrat_liens_acces")
    .update({ ouvertures: lien.ouvertures + 1, derniere_ouverture: new Date().toISOString() })
    .eq("id", lien.id);
  await auditLog({
    action: "client.contract.link.open",
    entityType: "client",
    entityId: null,
    after: { contractId: lien.contract_id, lienId: lien.id },
  });

  const rep = NextResponse.redirect(signe.signedUrl, 302);
  rep.headers.set("Cache-Control", "no-store");
  rep.headers.set("Referrer-Policy", "no-referrer");
  return rep;
}
