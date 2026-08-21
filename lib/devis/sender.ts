// Expéditeur (Brevo) des e-mails devis/facture selon le SECTEUR du lead :
//   nettoyage    → devispro@optimivv-nettoyage.com
//   déménagement → devispro@optimivv-demenagement.com
//   autres       → défaut (DEVIS_SENDER_EMAIL / BREVO_SENDER_EMAIL)
// Surchargeable par variables d'environnement.
//
// ⚠️ L'expéditeur DOIT être un expéditeur VÉRIFIÉ dans Brevo (Senders +
// authentification du domaine), sinon l'API renvoie « Sender not valid ».
export function senderForSector(
  sector: string | null,
): { email?: string; name: string } {
  if (sector === "nettoyage" || sector === "nettoyage_difficile") {
    return {
      email:
        process.env.DEVIS_SENDER_NETTOYAGE || "devispro@optimivv-nettoyage.com",
      name: process.env.DEVIS_SENDER_NAME_NETTOYAGE || "OPTIMIVV Nettoyage",
    };
  }
  if (sector === "demenagement") {
    return {
      email:
        process.env.DEVIS_SENDER_DEMENAGEMENT ||
        "devispro@optimivv-demenagement.com",
      name: process.env.DEVIS_SENDER_NAME || "OPTIMIVV Déménagement",
    };
  }
  return {
    email: process.env.DEVIS_SENDER_EMAIL || undefined,
    name: process.env.DEVIS_SENDER_NAME || "OPTIMIVV Déménagement",
  };
}
