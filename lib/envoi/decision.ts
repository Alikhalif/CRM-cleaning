// Un envoi réel part-il, oui ou non ?
//
// ── LE DÉFAUT QUE CE MODULE FERME ────────────────────────────────────
//
// Le CRM a DEUX transports d'e-mail, et c'est ce qui rendait le premier plan
// d'isolation faux : `lib/devis/email.ts` bascule sur SMTP (nodemailer)
// « si Brevo n'est pas configuré ». Retirer `BREVO_API_KEY` ne coupait donc
// pas l'envoi, elle le DÉPLAÇAIT sur un transport que personne ne surveillait
// — et dont les six variables ne figuraient même pas dans `.env.example`.
//
// La leçon : on ne protège pas un envoi en retirant une clé. On le protège en
// posant une décision que TOUS les transports doivent traverser. Il y a
// exactement trois points d'envoi réel dans ce dépôt :
//
//   1. `sendBrevoEmail`  — HTTP vers Brevo
//   2. `sendBrevoSms`    — HTTP vers Brevo
//   3. `lib/devis/email.ts` — SMTP via nodemailer
//
// Les trois appellent `deciderEnvoi()` AVANT tout accès réseau. Onze points
// d'appel métier existent en amont ; aucun n'a besoin de le savoir.
//
// ── POURQUOI CE MODULE EST PUR ───────────────────────────────────────
//
// Aucune lecture de `process.env`. La suite de contrôles peut donc prouver
// qu'un envoi est refusé dans chaque cas de figure, ce qui est impossible sur
// du code qui va chercher lui-même son environnement.

import type { Mode } from "@/lib/env/mode";

export type Canal = "email" | "sms";

export type DecisionEnvoi =
  | { autorise: true; motif: "production" | "autorise_explicitement" }
  | { autorise: false; code: string; message: string };

export type ContexteEnvoi = {
  mode: Mode;
  canal: Canal;
  destinataire: string;
  /** `CGK_ENVOI_REEL` — seule la valeur « oui » autorise. */
  envoiReelAutorise?: string;
  /** `CGK_DESTINATAIRES_AUTORISES` — adresses ou domaines, virgules. */
  destinatairesAutorises?: string;
};

function normaliser(v: string): string {
  return v.trim().toLowerCase();
}

/**
 * Le destinataire est-il sur la liste blanche ?
 *
 * Deux formes acceptées, et rien d'autre :
 *   • une adresse exacte            `moi@exemple.fr`
 *   • un domaine, préfixé d'un `@`  `@exemple.invalid`
 *
 * Un numéro de téléphone se compare après retrait de tout ce qui n'est pas un
 * chiffre : `+33 6 12 34 56 78` et `0033612345678` désignent la même ligne, et
 * une liste blanche qui se laisse contourner par un espace ne protège rien.
 */
export function surListeBlanche(destinataire: string, blanche: string[]): boolean {
  const d = normaliser(destinataire);
  if (!d) return false;

  for (const brut of blanche) {
    const e = normaliser(brut);
    if (!e) continue;
    if (e === d) return true;
    if (e.startsWith("@") && d.endsWith(e)) return true;
    // Comparaison des numéros, chiffres seuls.
    const chiffresE = e.replace(/\D/g, "");
    const chiffresD = d.replace(/\D/g, "");
    if (chiffresE.length >= 6 && chiffresE === chiffresD) return true;
  }
  return false;
}

export function listeBlanche(brut?: string): string[] {
  if (!brut) return [];
  return brut
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * La décision.
 *
 * En production : on envoie, comme aujourd'hui. Ce module n'a pas pour objet
 * de changer le comportement de la production, et ne doit pas pouvoir
 * l'empêcher d'écrire à un client.
 *
 * Partout ailleurs : **rien ne part par défaut**. Un serveur de développement
 * ou de recette n'a aucune raison d'écrire à un vrai client, et c'est
 * précisément ce qui s'est passé jusqu'ici — `.env.local` portait une clé
 * Brevo active et pointait sur la base de production.
 *
 * L'autorisation explicite existe pour le seul cas légitime : vérifier qu'un
 * e-mail arrive réellement, vers SA PROPRE adresse. Elle exige les deux :
 * `CGK_ENVOI_REEL=oui` ET le destinataire sur la liste blanche. L'une sans
 * l'autre ne suffit pas — une autorisation sans liste blanche ouvrirait
 * l'envoi vers n'importe qui.
 */
export function deciderEnvoi(c: ContexteEnvoi): DecisionEnvoi {
  if (c.mode === "production") return { autorise: true, motif: "production" };

  const autorise = normaliser(c.envoiReelAutorise ?? "") === "oui";
  if (!autorise) {
    return {
      autorise: false,
      code: "mode_sans_envoi",
      message:
        `Mode « ${c.mode} » : aucun ${c.canal === "sms" ? "SMS" : "e-mail"} réel ` +
        `ne part. Le message a été capturé au lieu d'être envoyé. Pour envoyer ` +
        `réellement vers votre propre adresse : CGK_ENVOI_REEL=oui et ` +
        `CGK_DESTINATAIRES_AUTORISES.`,
    };
  }

  const blanche = listeBlanche(c.destinatairesAutorises);
  if (blanche.length === 0) {
    return {
      autorise: false,
      code: "liste_blanche_absente",
      message:
        "CGK_ENVOI_REEL=oui mais CGK_DESTINATAIRES_AUTORISES est vide : " +
        "l'envoi partirait vers n'importe quelle adresse. Refusé.",
    };
  }

  if (!surListeBlanche(c.destinataire, blanche)) {
    return {
      autorise: false,
      code: "destinataire_hors_liste",
      message:
        `Le destinataire n'est pas sur CGK_DESTINATAIRES_AUTORISES. Envoi ` +
        `refusé et message capturé. (Le destinataire n'est pas reproduit ici : ` +
        `il figure dans la capture.)`,
    };
  }

  return { autorise: true, motif: "autorise_explicitement" };
}
