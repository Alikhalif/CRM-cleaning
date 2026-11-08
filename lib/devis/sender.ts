// Configuration e-mail par SECTEUR du lead : expéditeur, domaine des liens
// (signature + pixel) et bannière de signature. Table unique → une seule source
// de vérité (avant : trois chaînes if/else parallèles qui divergeaient).
//
// ⚠️ L'expéditeur DOIT être un expéditeur VÉRIFIÉ dans Brevo (Senders +
// authentification du domaine), sinon l'API renvoie « Sender not valid ».

import { modeCourant } from "@/lib/env/mode";

type SectorConfig = {
  email?: string; // expéditeur par défaut
  name?: string; // nom d'expéditeur par défaut
  domain?: string; // domaine des liens client (null → repli baseUrl)
  banner?: string; // fichier bannière dans public/email-signatures/
  // Noms des variables d'env qui surchargent les valeurs ci-dessus.
  envEmail?: string;
  envName?: string;
  envDomain?: string;
};

const SECTORS: Record<string, SectorConfig> = {
  nettoyage: {
    email: "devispro@optimivv-nettoyage.com",
    name: "OPTIMIVV Nettoyage",
    domain: "https://devis.optimivv-nettoyage.com",
    banner: "nettoyage.png",
    envEmail: "DEVIS_SENDER_NETTOYAGE",
    envName: "DEVIS_SENDER_NAME_NETTOYAGE",
    envDomain: "DEVIS_BASE_URL_NETTOYAGE",
  },
  demenagement: {
    email: "devispro@optimivv-demenagement.com",
    name: "OPTIMIVV Déménagement",
    domain: "https://devis.optimivv-demenagement.com",
    banner: "demenagement.png",
    envEmail: "DEVIS_SENDER_DEMENAGEMENT",
    envName: "DEVIS_SENDER_NAME",
    envDomain: "DEVIS_BASE_URL_DEMENAGEMENT",
  },
  // Débarras : même visuel que nettoyage, mais expéditeur/domaine au repli.
  debarras: { banner: "nettoyage.png" },
};

function cfg(sector: string | null): SectorConfig {
  if (!sector) return {};
  const key = sector === "nettoyage_difficile" ? "nettoyage" : sector;
  return SECTORS[key] ?? {};
}

const clean = (u: string) => u.replace(/\/$/, "");

export function senderForSector(
  sector: string | null,
): { email?: string; name: string } {
  const c = cfg(sector);
  return {
    email:
      (c.envEmail && process.env[c.envEmail]) ||
      c.email ||
      process.env.DEVIS_SENDER_EMAIL ||
      undefined,
    name:
      (c.envName && process.env[c.envName]) ||
      c.name ||
      process.env.DEVIS_SENDER_NAME ||
      "OPTIMIVV Déménagement",
  };
}

// Domaine des liens client selon le secteur. null → l'appelant retombe sur baseUrl().
//
// ⚠️ C'ÉTAIT LA FUITE LA PLUS SÉRIEUSE DU LOT C.
//
// Les `domain` de la table ci-dessus sont des constantes de PRODUCTION
// (`https://devis.optimivv-nettoyage.com`, …). Or `app/api/devis/envoyer`
// construit le lien de signature avec :
//
//     const sectorBase = domainForSector(sector) ?? (await baseUrl());
//     signUrl = `${sectorBase}/devis-signer/${…}`;
//
// Hors production, cette fonction rendait donc le domaine RÉEL : le devis de
// recette partait avec un lien de signature vers le site de production, et le
// client fictif aurait signé contre la base réelle. Isoler la base de données
// n'y change rien — la fuite passe par le lien, pas par la connexion.
//
// Désormais : la SURCHARGE par variable d'environnement est toujours
// respectée (elle est explicite, donc assumée), mais le domaine EN DUR ne
// s'applique qu'en production. Partout ailleurs on rend `null`, et l'appelant
// retombe sur `baseUrl()`, qui valide contre la liste blanche des domaines
// publics. Le comportement de production est inchangé.
export function domainForSector(sector: string | null): string | null {
  const c = cfg(sector);

  const surcharge = c.envDomain ? process.env[c.envDomain] : undefined;
  if (surcharge && surcharge.trim()) return clean(surcharge.trim());

  if (!c.domain) return null;
  if (modeCourant() !== "production") return null;
  return clean(c.domain);
}

// Fichier bannière (public/email-signatures/) selon le secteur. null → pas de bannière.
export function signatureBannerFile(sector: string | null): string | null {
  return cfg(sector).banner ?? null;
}

// Markup HTML de la bannière de signature (partagé entre l'e-mail d'envoi et
// l'e-mail de devis signé).
export function signatureBannerHtml(url: string): string {
  return `<div style="margin-top:26px;border-top:1px solid #eee;padding-top:16px"><img src="${url}" alt="OPTIMIVV" width="440" style="display:block;width:100%;max-width:440px;height:auto;border:0" /></div>`;
}
