import "server-only";
import crypto from "node:crypto";
import { auditLog } from "@/lib/audit";
import { sendBrevoEmail } from "@/lib/brevo";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { baseUrlPublique, verifierLien } from "@/lib/urls/base-publique-server";
import { DUREE_LIEN_MINUTES, masquerEmail } from "./contrat-lien-shared";

// D23 — émission, lecture et renouvellement des liens d'accès aux contrats.
//
// Toutes les écritures passent par le service-role : la table n'a aucune
// politique d'écriture (migration 20261109000004). Les APPELANTS sont gardés :
// `sendContract` exige le back-office ; le renouvellement public n'agit que
// sur un jeton valide, vers l'adresse ENREGISTRÉE.

export type LienRow = {
  id: string;
  contract_id: string;
  destinataire: string;
  expire_at: string;
  revoque_at: string | null;
  renouvelle_id: string | null;
  origine: "envoi" | "renouvellement";
  created_at: string;
  ouvertures: number;
};

export const empreinteJeton = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function lireLien(token: string): Promise<LienRow | null> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("contrat_liens_acces")
    .select("id, contract_id, destinataire, expire_at, revoque_at, renouvelle_id, origine, created_at, ouvertures")
    .eq("token_hash", empreinteJeton(token))
    .maybeSingle<LienRow>();
  return data ?? null;
}

/** Date de l'envoi INITIAL : on remonte la chaîne des renouvellements. */
export async function envoiInitial(lien: LienRow): Promise<string> {
  const sb = await supabaseServiceRole();
  let courant = lien;
  for (let i = 0; i < 200 && courant.renouvelle_id; i++) {
    const { data } = await sb
      .from("contrat_liens_acces")
      .select("id, contract_id, destinataire, expire_at, revoque_at, renouvelle_id, origine, created_at, ouvertures")
      .eq("id", courant.renouvelle_id)
      .maybeSingle<LienRow>();
    if (!data) break;
    courant = data;
  }
  return courant.created_at;
}

export async function renouvellementsDernieres24h(contractId: string): Promise<number> {
  const sb = await supabaseServiceRole();
  const { count } = await sb
    .from("contrat_liens_acces")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", contractId)
    .eq("origine", "renouvellement")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  return count ?? 0;
}

/**
 * Émet un lien (jeton 256 bits, empreinte seule en base) et l'envoie par
 * courriel. AUCUNE pièce jointe : le contrat ne quitte le stockage privé
 * qu'à l'ouverture, pour cinq minutes.
 *
 * L'URL de base est résolue AVANT la création du lien : sans base sûre, rien
 * n'est créé (même ordre que `sendForSignature`).
 */
export async function emettreEtEnvoyerLien(input: {
  contractId: string;
  titre: string;
  reference: string | null;
  destinataire: string;
  creePar: string | null;
  origine: "envoi" | "renouvellement";
  renouvelleId?: string | null;
}): Promise<{ ok: true; lienId: string } | { ok: false; error: string }> {
  const base = await baseUrlPublique();
  if (!base.ok) return { ok: false, error: `Lien du contrat impossible à produire : ${base.raison}` };

  const token = crypto.randomBytes(32).toString("base64url");
  const url = `${base.base}/api/contrats/lien/${token}`;
  const verif = verifierLien(url);
  if (!verif.ok) return { ok: false, error: `Lien du contrat refusé : ${verif.raison}` };

  const sb = await supabaseServiceRole();
  const { data: lien, error } = await sb
    .from("contrat_liens_acces")
    .insert({
      contract_id: input.contractId,
      token_hash: empreinteJeton(token),
      destinataire: input.destinataire,
      cree_par: input.creePar,
      origine: input.origine,
      renouvelle_id: input.renouvelleId ?? null,
    } as never)
    .select("id")
    .single<{ id: string }>();
  if (error || !lien) return { ok: false, error: `Lien du contrat non enregistré : ${error?.message ?? "inconnu"}` };

  const html =
    `<p>Bonjour,</p>`
    + `<p>Votre contrat <strong>${echapper(input.titre)}</strong>${input.reference ? ` (réf. ${echapper(input.reference)})` : ""} est disponible.</p>`
    + `<p><a href="${url}">Consulter / télécharger le contrat</a></p>`
    + `<p>Pour votre sécurité, ce lien est valable <strong>${DUREE_LIEN_MINUTES} minutes</strong>. `
    + `Passé ce délai, la page vous proposera d'en recevoir un nouveau à cette même adresse.</p>`
    + `<p>Cordialement,</p>`;
  const res = await sendBrevoEmail({ to: input.destinataire, subject: `Votre contrat — ${input.titre}`, htmlContent: html });
  if (!res.ok) {
    // Le lien n'est jamais parti : on le révoque pour qu'il ne compte pas.
    await sb.from("contrat_liens_acces").update({ revoque_at: new Date().toISOString() } as never).eq("id", lien.id);
    return { ok: false, error: `Envoi email : ${res.error}` };
  }

  await auditLog({
    action: input.origine === "envoi" ? "client.contract.link.send" : "client.contract.link.renew",
    entityType: "client",
    entityId: null,
    after: { contractId: input.contractId, lienId: lien.id, destinataire: masquerEmail(input.destinataire), renouvelle: input.renouvelleId ?? null },
  });
  return { ok: true, lienId: lien.id };
}

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
