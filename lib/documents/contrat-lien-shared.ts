// D23 — règles des liens d'accès aux contrats (PURES, testables sans base).
//
// Décision du client du 2026-11-09 : « un lien sécurisé valable 60 minutes,
// renouvelable. Le renouvellement doit être contrôlé et tracé. »
//
// « Contrôlé » veut dire ici trois choses, toutes vérifiées par
// scripts/recette-check/contrat-lien.ts :
//   1. le nouveau lien part à l'adresse ENREGISTRÉE lors de l'envoi — jamais à
//      une adresse saisie sur la page publique ;
//   2. au plus RENOUVELLEMENTS_PAR_24H par contrat et par 24 heures ;
//   3. un lien ne se renouvelle que FENETRE_RENOUVELLEMENT_JOURS après son
//      envoi initial ; au-delà, il faut un nouvel envoi par le back-office.

export const DUREE_LIEN_MINUTES = 60;
/** Durée de l'URL de stockage vers laquelle on redirige : l'ouverture, pas plus. */
export const TTL_REDIRECTION_SECONDES = 300;
export const RENOUVELLEMENTS_PAR_24H = 3;
export const FENETRE_RENOUVELLEMENT_JOURS = 30;

export type EtatLien = {
  expireAt: string;
  revoqueAt: string | null;
  /** Date de l'envoi INITIAL de la chaîne (premier lien), pas du renouvellement. */
  envoiInitialAt: string;
};

export type Decision =
  | { action: "ouvrir" }
  | { action: "expire"; renouvelable: boolean; raison?: string }
  | { action: "revoque" };

export function expirationDepuis(maintenant: Date): Date {
  return new Date(maintenant.getTime() + DUREE_LIEN_MINUTES * 60_000);
}

export function decider(lien: EtatLien, maintenant: Date, renouvellements24h: number): Decision {
  if (lien.revoqueAt) return { action: "revoque" };
  if (new Date(lien.expireAt).getTime() > maintenant.getTime()) return { action: "ouvrir" };
  return { action: "expire", ...peutRenouveler(lien, maintenant, renouvellements24h) };
}

export function peutRenouveler(
  lien: EtatLien,
  maintenant: Date,
  renouvellements24h: number,
): { renouvelable: boolean; raison?: string } {
  if (lien.revoqueAt) return { renouvelable: false, raison: "Ce lien a été remplacé par un plus récent." };
  const age = maintenant.getTime() - new Date(lien.envoiInitialAt).getTime();
  if (age > FENETRE_RENOUVELLEMENT_JOURS * 86_400_000) {
    return { renouvelable: false, raison: "Ce contrat vous a été envoyé il y a plus de 30 jours : contactez-nous pour un nouvel envoi." };
  }
  if (renouvellements24h >= RENOUVELLEMENTS_PAR_24H) {
    return { renouvelable: false, raison: "Trop de demandes en 24 heures : réessayez plus tard ou contactez-nous." };
  }
  return { renouvelable: true };
}

/** Adresse lisible sans être exposée : « j***@exemple.fr ». */
export function masquerEmail(email: string): string {
  const [local, domaine] = email.split("@");
  if (!local || !domaine) return "votre adresse";
  return `${local[0]}***@${domaine}`;
}

/** Un jeton bien formé : base64url, 43 caractères (256 bits). Rien d'autre n'est cherché en base. */
export function jetonBienForme(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
