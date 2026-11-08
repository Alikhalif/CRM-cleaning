// Quelle cible l'application vise-t-elle, et cette cible est-elle sûre ?
//
// ── POURQUOI CE MODULE EXISTE ────────────────────────────────────────
//
// Jusqu'ici, le CRM ne savait pas sur quoi il tournait. `.env.local` était le
// seul fichier d'environnement et il pointait sur la production : lancer
// `npm run dev` pour vérifier un écran, c'était écrire dans la base réelle,
// avec la vraie clé Brevo et la vraie clé Ringover actives.
//
// Ce module répond à deux questions, et rien d'autre :
//   1. dans quel MODE tourne-t-on (production / recette / développement) ;
//   2. la configuration présente est-elle DANGEREUSE pour ce mode.
//
// Il est PUR : aucune lecture de `process.env`, aucun accès réseau, aucun
// accès disque. Tout entre par `Config`. C'est ce qui permet au garde-fou de
// démarrage, au script de vérification de cible et à la suite de contrôles
// d'exercer exactement la même décision — et à la suite de prouver qu'une
// configuration dangereuse est bien refusée, ce qu'on ne peut pas prouver sur
// du code qui lit l'environnement lui-même.
//
// ── LE PRINCIPE : RESTRICTIF ─────────────────────────────────────────
//
// En cas d'incertitude, on refuse. Un doute sur la cible d'une recette coûte
// un message d'erreur ; une recette qui écrit en production coûte des données
// réelles. Les deux ne se comparent pas.
//
// ⚠️ UNE EXCEPTION, ASSUMÉE : le mode `production` n'est jamais bloqué par ce
// module. La production tourne aujourd'hui sans aucune de ces variables, et un
// garde-fou qui l'empêcherait de démarrer serait une panne que personne n'a
// demandée. En production, les griefs sont des AVERTISSEMENTS journalisés.

import { createHash } from "node:crypto";
import { type Mode, MODES, modeEffectif } from "./mode";

// Le mode vit dans `./mode`, sans dépendance à `node:crypto` : il est consulté
// par du code qui peut se retrouver dans le graphe d'un composant client.
// Réexporté ici pour que les appelants historiques n'aient pas à changer.
export { type Mode, MODES, modeEffectif, estProduction, envoiBloqueParDefaut } from "./mode";

// ── L'empreinte, pour détecter un secret de production sans le stocker ──

/**
 * Empreinte courte et non réversible d'un secret.
 *
 * Elle existe pour qu'on puisse DÉTECTER la clé de production en recette sans
 * jamais écrire cette clé dans un fichier de configuration, dans un script ni
 * dans un rapport. On déclare l'empreinte attendue ; on compare des
 * empreintes.
 *
 * 12 caractères hexadécimaux : assez pour qu'une collision soit hors de
 * portée ici, trop peu pour aider qui voudrait remonter à la valeur.
 */
export function empreinte(valeur: string): string {
  return createHash("sha256").update(valeur, "utf8").digest("hex").slice(0, 12);
}

// ── Les griefs ───────────────────────────────────────────────────────

export type Gravite = "bloquant" | "avertissement";

export type Grief = {
  code: string;
  gravite: Gravite;
  /** Phrase qui nomme le danger ET le geste qui le lève. Jamais un code seul. */
  message: string;
};

export type Verdict = {
  ok: boolean;
  mode: Mode;
  griefs: Grief[];
};

export type Config = {
  cgkEnv?: string;
  nodeEnv?: string;

  // Base de données
  supabaseUrl?: string;
  /** URL de la production, DÉCLARÉE. Une URL n'est pas un secret. */
  supabaseUrlProduction?: string;

  // Envoi d'e-mails — les DEUX transports
  brevoApiKey?: string;
  smtpHost?: string;
  smtpUser?: string;
  smtpPass?: string;
  devisEmailTransport?: string;
  /** Autorisation explicite d'envoyer réellement hors production. */
  envoiReelAutorise?: string;
  /** Liste blanche de destinataires, séparés par des virgules. */
  destinatairesAutorises?: string;

  // URL publique des liens de signature
  signatureBaseUrl?: string;
  appUrl?: string;
  /** Domaines publics autorisés, séparés par des virgules. */
  domainesPublics?: string;

  // Autres services sortants
  ringoverApiKey?: string;
  docusignClientId?: string;
  docusignEnv?: string;

  // Secrets
  fieldEncryptionKey?: string;
  /** Empreinte de la clé de PRODUCTION, déclarée pour pouvoir la refuser. */
  empreinteCleProduction?: string;
  cronSecret?: string;
};

function renseigne(v?: string): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Hôte d'une URL, ou `null` si elle n'est pas analysable. */
export function hoteDe(url?: string): string | null {
  if (!renseigne(url)) return null;
  try {
    return new URL(url!.trim()).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Liste séparée par des virgules → tableau nettoyé, sans doublon. */
export function liste(brut?: string): string[] {
  if (!renseigne(brut)) return [];
  const vus = new Set<string>();
  for (const part of brut!.split(",")) {
    const v = part.trim().toLowerCase();
    if (v) vus.add(v);
  }
  return [...vus];
}

// ── La décision ──────────────────────────────────────────────────────

/**
 * Les cinq familles de danger du §5 de la demande client, plus la
 * configuration manquante.
 *
 * En mode `production`, tout grief est ramené à un AVERTISSEMENT : ce module
 * ne doit pas pouvoir mettre la production à l'arrêt. En recette et en
 * développement, un grief bloquant empêche le démarrage.
 */
export function evaluerCible(c: Config): Verdict {
  const mode = modeEffectif(c);
  const griefs: Grief[] = [];
  const bloquant = (code: string, message: string) =>
    griefs.push({ code, gravite: "bloquant", message });
  const avertir = (code: string, message: string) =>
    griefs.push({ code, gravite: "avertissement", message });

  // 0. Une valeur de CGK_ENV non reconnue n'est jamais devinée.
  const declare = (c.cgkEnv ?? "").trim().toLowerCase();
  if (declare && !(MODES as string[]).includes(declare)) {
    avertir(
      "mode_inconnu",
      `CGK_ENV="${declare}" n'est pas reconnu et a été ignoré. ` +
        `Valeurs admises : ${MODES.join(", ")}. Mode retenu : ${mode}.`,
    );
  }

  // 1. La base cible correspond-elle à la production ?
  const cible = hoteDe(c.supabaseUrl);
  const prod = hoteDe(c.supabaseUrlProduction);
  if (!renseigne(c.supabaseUrl)) {
    bloquant(
      "base_absente",
      "NEXT_PUBLIC_SUPABASE_URL n'est pas définie : la cible de la base est inconnue.",
    );
  } else if (!cible) {
    bloquant(
      "base_illisible",
      `NEXT_PUBLIC_SUPABASE_URL n'est pas une URL analysable ("${c.supabaseUrl}").`,
    );
  } else if (mode !== "production") {
    if (!prod) {
      avertir(
        "production_non_declaree",
        "CGK_SUPABASE_URL_PRODUCTION n'est pas déclarée : impossible de vérifier " +
          "que la cible n'est PAS la production. Déclarez-la dans .env.recette.",
      );
    } else if (cible === prod) {
      bloquant(
        "base_production",
        `Mode ${mode} mais la base visée est la PRODUCTION (${cible}). ` +
          "Démarrage refusé.",
      );
    }
  }

  // 2. Un service externe pointe-t-il vers le réel ?
  if (mode !== "production") {
    const envoiAutorise = (c.envoiReelAutorise ?? "").trim().toLowerCase() === "oui";

    if (renseigne(c.brevoApiKey) && !envoiAutorise) {
      bloquant(
        "brevo_actif",
        `Mode ${mode} et BREVO_API_KEY est renseignée : un envoi réel resterait ` +
          "possible. Retirez la clé, ou posez CGK_ENVOI_REEL=oui et une liste " +
          "blanche de destinataires en connaissance de cause.",
      );
    }
    // Le second transport. Le bloquer AUSSI est tout l'objet de l'anomalie E4 :
    // retirer la clé Brevo ne coupe pas l'envoi, elle le BASCULE sur SMTP.
    if ((renseigne(c.smtpHost) || renseigne(c.smtpUser)) && !envoiAutorise) {
      bloquant(
        "smtp_actif",
        `Mode ${mode} et le transport SMTP de secours est configuré ` +
          "(SMTP_HOST/SMTP_USER). C'est le repli de `lib/devis/email.ts` quand " +
          "Brevo est absent : le laisser en place contourne le blocage de Brevo.",
      );
    }
    if ((c.devisEmailTransport ?? "").trim().toLowerCase() === "smtp" && !envoiAutorise) {
      bloquant(
        "transport_force_smtp",
        `Mode ${mode} et DEVIS_EMAIL_TRANSPORT=smtp force le transport de secours.`,
      );
    }
    if (envoiAutorise && liste(c.destinatairesAutorises).length === 0) {
      bloquant(
        "envoi_sans_liste_blanche",
        "CGK_ENVOI_REEL=oui sans CGK_DESTINATAIRES_AUTORISES : un envoi réel " +
          "partirait vers n'importe quelle adresse. La liste blanche est obligatoire.",
      );
    }
    if (renseigne(c.ringoverApiKey)) {
      bloquant(
        "ringover_actif",
        `Mode ${mode} et RINGOVER_API_KEY est renseignée : un appel ou un SMS ` +
          "réel resterait possible. Retirez la clé.",
      );
    }
    if (renseigne(c.docusignClientId)) {
      const env = (c.docusignEnv ?? "demo").trim().toLowerCase();
      if (env === "production") {
        bloquant(
          "docusign_production",
          `Mode ${mode} et DOCUSIGN_ENV=production : une enveloppe réelle ` +
            "pourrait partir en signature.",
        );
      } else {
        avertir(
          "docusign_actif",
          `DocuSign est raccordé en « ${env} ». Génération et téléchargement ` +
            "des contrats fonctionnent ; l'envoi en signature partira vers le " +
            "bac à sable DocuSign.",
        );
      }
    }
  }

  // 3. L'URL de signature est-elle correcte ?
  const autorises = liste(c.domainesPublics);
  const base = renseigne(c.signatureBaseUrl) ? c.signatureBaseUrl : c.appUrl;
  const hoteBase = hoteDe(base);
  if (mode !== "production") {
    if (!renseigne(base)) {
      bloquant(
        "url_signature_absente",
        `Mode ${mode} sans SIGNATURE_BASE_URL : les liens de signature ` +
          "retomberaient sur le domaine de production. Posez " +
          "SIGNATURE_BASE_URL=http://localhost:3000.",
      );
    } else if (!hoteBase) {
      bloquant(
        "url_signature_illisible",
        `SIGNATURE_BASE_URL n'est pas une URL absolue analysable ("${base}").`,
      );
    } else if (autorises.length === 0) {
      bloquant(
        "domaines_non_declares",
        "CGK_DOMAINES_PUBLICS n'est pas déclarée : aucun domaine n'est " +
          "explicitement autorisé, donc aucune URL ne peut être validée.",
      );
    } else if (!autorises.includes(hoteBase)) {
      bloquant(
        "url_signature_hors_liste",
        `L'hôte de SIGNATURE_BASE_URL (${hoteBase}) n'est pas dans ` +
          `CGK_DOMAINES_PUBLICS (${autorises.join(", ")}).`,
      );
    }
    if (hoteBase && prod && hoteBase === prod) {
      bloquant(
        "url_signature_production",
        `Mode ${mode} et l'URL de signature pointe sur la production (${hoteBase}).`,
      );
    }
  } else if (!renseigne(base)) {
    avertir(
      "url_signature_implicite",
      "SIGNATURE_BASE_URL n'est pas définie en production : les liens reposent " +
        "sur le repli du premier domaine autorisé. Définissez-la explicitement.",
    );
  }

  // 4. Des secrets de production sont-ils présents ?
  if (mode !== "production" && renseigne(c.fieldEncryptionKey)) {
    if (!renseigne(c.empreinteCleProduction)) {
      avertir(
        "empreinte_non_declaree",
        "CGK_EMPREINTE_CLE_PRODUCTION n'est pas déclarée : impossible de " +
          "vérifier que la clé de chiffrement n'est PAS celle de production.",
      );
    } else if (empreinte(c.fieldEncryptionKey!.trim()) === c.empreinteCleProduction!.trim()) {
      bloquant(
        "cle_production_detectee",
        `Mode ${mode} avec la clé de chiffrement de PRODUCTION. Une recette qui ` +
          "porte cette clé peut déchiffrer les champs confidentiels réels. " +
          "Générez-en une autre : openssl rand -hex 32.",
      );
    }
  }

  // 5. Une configuration critique manque-t-elle ?
  if (mode !== "production" && !renseigne(c.fieldEncryptionKey)) {
    avertir(
      "chiffrement_absent",
      "FIELD_ENCRYPTION_KEY absente : les champs confidentiels resteront en " +
        "clair. Acceptable en recette, jamais en production.",
    );
  }
  if (!renseigne(c.cronSecret)) {
    avertir(
      "cron_absent",
      "PRESENCE_CRON_SECRET absente : le moteur d'alertes et de relances ne " +
        "tournera que si un Super Admin le déclenche à la main.",
    );
  }

  // En production, rien ne bloque : les griefs deviennent des avertissements.
  const finaux: Grief[] =
    mode === "production"
      ? griefs.map((g) => (g.gravite === "bloquant" ? { ...g, gravite: "avertissement" } : g))
      : griefs;

  return {
    ok: !finaux.some((g) => g.gravite === "bloquant"),
    mode,
    griefs: finaux,
  };
}

/** Griefs bloquants seuls. */
export function bloquants(v: Verdict): Grief[] {
  return v.griefs.filter((g) => g.gravite === "bloquant");
}

/**
 * Rapport lisible, SANS AUCUN SECRET.
 *
 * Les valeurs ne sont jamais imprimées : seuls le mode, l'hôte de la base (une
 * URL publique), et les griefs le sont. Les messages de griefs sont écrits
 * pour ne nommer que des NOMS de variables, jamais leurs valeurs.
 */
export function rapporter(v: Verdict, c: Config): string[] {
  const l: string[] = [];
  l.push(`Mode              : ${v.mode}`);
  l.push(`Base visée        : ${hoteDe(c.supabaseUrl) ?? "(non définie)"}`);
  const prod = hoteDe(c.supabaseUrlProduction);
  l.push(`Production connue : ${prod ?? "(non déclarée)"}`);
  l.push(`URL de signature  : ${hoteDe(c.signatureBaseUrl ?? c.appUrl) ?? "(non définie)"}`);
  l.push(`Domaines autorisés: ${liste(c.domainesPublics).join(", ") || "(aucun)"}`);
  l.push("");
  l.push("Services sortants :");
  const etat = (nom: string, valeur?: string) =>
    l.push(`  ${nom.padEnd(22)} ${renseigne(valeur) ? "CONFIGURÉ" : "absent"}`);
  etat("Brevo (e-mail/SMS)", c.brevoApiKey);
  etat("SMTP (secours)", c.smtpHost ?? c.smtpUser);
  etat("Ringover", c.ringoverApiKey);
  etat("DocuSign", c.docusignClientId);
  etat("Chiffrement", c.fieldEncryptionKey);
  etat("Secret du cron", c.cronSecret);
  l.push("");
  if (v.griefs.length === 0) {
    l.push("Aucun grief.");
  } else {
    for (const g of v.griefs) {
      const marque = g.gravite === "bloquant" ? "BLOQUANT" : "avertir ";
      l.push(`  [${marque}] ${g.code}`);
      l.push(`             ${g.message}`);
    }
  }
  l.push("");
  l.push(v.ok ? "VERDICT : cible acceptable." : "VERDICT : CIBLE REFUSÉE.");
  return l;
}
