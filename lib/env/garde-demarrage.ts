import "server-only";

// Garde-fou de démarrage : la seule couche qui lit `process.env`.
//
// Toute la DÉCISION vit dans `lib/env/cible.ts`, qui est pur. Ici on ne fait
// que deux choses : assembler la configuration depuis l'environnement, et
// agir sur le verdict. Cette séparation n'est pas de l'élégance : c'est ce
// qui permet à la suite de contrôles de prouver qu'une configuration
// dangereuse est refusée, en exerçant la décision sans avoir à fabriquer de
// vraies variables d'environnement.

import {
  type Config,
  type Verdict,
  evaluerCible,
  bloquants,
  rapporter,
} from "./cible";

/** Assemble la configuration observée. Aucune valeur n'est transformée. */
export function configDepuisEnv(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    cgkEnv: env.CGK_ENV,
    nodeEnv: env.NODE_ENV,

    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseUrlProduction: env.CGK_SUPABASE_URL_PRODUCTION,

    brevoApiKey: env.BREVO_API_KEY,
    smtpHost: env.SMTP_HOST,
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    devisEmailTransport: env.DEVIS_EMAIL_TRANSPORT,
    envoiReelAutorise: env.CGK_ENVOI_REEL,
    destinatairesAutorises: env.CGK_DESTINATAIRES_AUTORISES,

    signatureBaseUrl: env.SIGNATURE_BASE_URL,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    domainesPublics: env.CGK_DOMAINES_PUBLICS,

    ringoverApiKey: env.RINGOVER_API_KEY,
    docusignClientId: env.DOCUSIGN_CLIENT_ID,
    docusignEnv: env.DOCUSIGN_ENV,

    fieldEncryptionKey: env.FIELD_ENCRYPTION_KEY,
    empreinteCleProduction: env.CGK_EMPREINTE_CLE_PRODUCTION,
    cronSecret: env.PRESENCE_CRON_SECRET,
  };
}

/** Verdict sur l'environnement courant. */
export function verdictCourant(env: NodeJS.ProcessEnv = process.env): Verdict {
  return evaluerCible(configDepuisEnv(env));
}

/**
 * Vérification au démarrage du serveur.
 *
 * Appelée par `instrumentation.ts`, dont le `register()` s'exécute UNE FOIS et
 * doit se terminer avant que le serveur accepte des requêtes : c'est le seul
 * endroit où un refus de démarrer est un vrai refus de démarrer, et non une
 * erreur sur la première page ouverte.
 *
 * ⚠️ En mode `production`, cette fonction ne lève JAMAIS. `evaluerCible()`
 * ramène tous les griefs à des avertissements dans ce mode : la production
 * tourne aujourd'hui sans aucune de ces variables, et un garde-fou qui
 * l'empêcherait de démarrer serait une panne que personne n'a demandée.
 */
export function verifierAuDemarrage(env: NodeJS.ProcessEnv = process.env): void {
  const config = configDepuisEnv(env);
  const verdict = evaluerCible(config);
  const lignes = rapporter(verdict, config);

  const titre = "── CGK CRM · vérification de la cible ────────────────────";
  const sortie = [titre, ...lignes].join("\n");

  if (!verdict.ok) {
    console.error(sortie);
    const causes = bloquants(verdict)
      .map((g) => `  • [${g.code}] ${g.message}`)
      .join("\n");
    throw new Error(
      `Démarrage refusé — la configuration est dangereuse pour le mode ` +
        `« ${verdict.mode} ».\n${causes}\n\n` +
        `Aucune donnée n'a été touchée. Corrigez la configuration, ou passez ` +
        `CGK_ENV=production si c'est bien la production que vous lancez.`,
    );
  }

  // Cible acceptable : on journalise quand même, parce que savoir sur quoi on
  // tourne ne doit pas demander d'aller lire un fichier.
  if (verdict.griefs.length > 0) console.warn(sortie);
  else console.log(`${titre}\nMode ${verdict.mode} · cible acceptable.`);
}
