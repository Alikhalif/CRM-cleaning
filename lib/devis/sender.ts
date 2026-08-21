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

// Domaine des liens client (signature + pixel) selon le secteur du lead.
// Renvoie null pour les autres secteurs → l'appelant retombe sur baseUrl().
export function domainForSector(sector: string | null): string | null {
  if (!sector) return null;
  const clean = (u: string) => u.replace(/\/$/, "");
  if (sector === "nettoyage" || sector === "nettoyage_difficile") {
    return clean(process.env.DEVIS_BASE_URL_NETTOYAGE || "https://devis.optimivv-nettoyage.com");
  }
  if (sector === "demenagement") {
    return clean(process.env.DEVIS_BASE_URL_DEMENAGEMENT || "https://devis.optimivv-demenagement.com");
  }
  return null;
}

// Bannière de signature e-mail (fichier dans public/email-signatures/) selon le
// secteur. Le visuel nettoyage couvre aussi le débarras. null → pas de bannière.
export function signatureBannerFile(sector: string | null): string | null {
  if (sector === "nettoyage" || sector === "nettoyage_difficile" || sector === "debarras") {
    return "nettoyage.png";
  }
  if (sector === "demenagement") return "demenagement.png";
  return null;
}
