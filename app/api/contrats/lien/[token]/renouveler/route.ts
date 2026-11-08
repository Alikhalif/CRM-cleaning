import { notifierBackOffice, porteeDuContratClient } from "@/lib/notifications/perimetre-server";
import { jetonBienForme, masquerEmail, peutRenouveler } from "@/lib/documents/contrat-lien-shared";
import {
  emettreEtEnvoyerLien,
  envoiInitial,
  lireLien,
  renouvellementsDernieres24h,
} from "@/lib/documents/contrat-lien-server";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { pagePublique } from "../../page-publique";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// D23 — renouvellement CONTRÔLÉ d'un lien de contrat expiré.
//
//   · le nouveau lien part à l'adresse ENREGISTRÉE, jamais à une adresse
//     fournie par la requête — la page n'en demande d'ailleurs aucune ;
//   · seul un lien EXPIRÉ se renouvelle (un lien valide s'utilise) ;
//   · 3 renouvellements par contrat et par 24 h, 30 jours après l'envoi
//     initial au plus (lib/documents/contrat-lien-shared.ts) ;
//   · deux demandes simultanées : la révocation conditionnelle de l'ancien
//     lien (`revoque_at is null`) sert de verrou — une seule l'emporte ;
//   · tracé : la chaîne `renouvelle_id`, le journal d'audit, et une
//     notification au back-office.
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const refus = (titre: string, texte: string, statut = 400) => pagePublique(titre, `<p>${texte}</p>`, statut);
  if (!jetonBienForme(token)) return refus("Lien invalide", "Ce lien n'est pas valide.", 404);

  const lien = await lireLien(token);
  if (!lien) return refus("Lien invalide", "Ce lien n'est pas valide.", 404);
  if (new Date(lien.expire_at).getTime() > Date.now() && !lien.revoque_at) {
    return refus("Lien encore valide", "Ce lien est encore valide : revenez au courriel et ouvrez-le.", 409);
  }

  const verdict = peutRenouveler(
    { expireAt: lien.expire_at, revoqueAt: lien.revoque_at, envoiInitialAt: await envoiInitial(lien) },
    new Date(),
    await renouvellementsDernieres24h(lien.contract_id),
  );
  if (!verdict.renouvelable) return refus("Renouvellement impossible", verdict.raison ?? "Contactez-nous.", 429);

  const sb = await supabaseServiceRole();
  const { data: contrat } = await sb
    .from("contracts").select("id, ref, title, deleted_at").eq("id", lien.contract_id)
    .maybeSingle<{ id: string; ref: string | null; title: string; deleted_at: string | null }>();
  if (!contrat || contrat.deleted_at) return refus("Document indisponible", "Ce document n'est plus disponible.", 410);

  // Verrou : une seule demande révoque l'ancien lien.
  const { data: verrou } = await sb
    .from("contrat_liens_acces")
    .update({ revoque_at: new Date().toISOString() })
    .eq("id", lien.id)
    .is("revoque_at", null)
    .select("id");
  if (!verrou || verrou.length === 0) {
    return refus("Déjà demandé", "Un nouveau lien a déjà été envoyé : consultez votre dernier courriel.", 409);
  }

  const res = await emettreEtEnvoyerLien({
    contractId: contrat.id,
    titre: contrat.title,
    reference: contrat.ref,
    destinataire: lien.destinataire,
    creePar: null,
    origine: "renouvellement",
    renouvelleId: lien.id,
  });
  if (!res.ok) {
    // Échec d'envoi : l'ancien lien redevient renouvelable.
    await sb.from("contrat_liens_acces").update({ revoque_at: null }).eq("id", lien.id);
    return refus("Envoi impossible", "Le nouveau lien n'a pas pu être envoyé. Réessayez plus tard ou contactez-nous.", 503);
  }

  // D31 : ciblée par le périmètre du client du contrat.
  await notifierBackOffice(await porteeDuContratClient(contrat.id), {
    kind: "contract.link.renewed",
    entityType: "contract",
    entityId: contrat.id,
    title: `Lien de contrat renouvelé — ${contrat.title}`,
    body: `Le client a demandé un nouveau lien (envoyé à ${masquerEmail(lien.destinataire)}).`,
  });

  return pagePublique(
    "Nouveau lien envoyé",
    `<p>Un nouveau lien vient d'être envoyé à <strong>${masquerEmail(lien.destinataire)}</strong>.</p>
     <p>Il est valable une heure.</p>`,
  );
}
