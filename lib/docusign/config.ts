// Configuration DocuSign — PUR, aucune I/O réseau, aucun secret en dur.
//
// SÉPARATION STRICTE SANDBOX / PRODUCTION (§2)
//
// Les deux environnements ont des comptes distincts, des jetons distincts et
// des bases d'URL distinctes. Un seul endroit décide lequel est actif, et
// `environnementActif()` est le seul chemin : pas de drapeau recopié ailleurs.
//
// ⚠️ L'URL de l'API N'EST PAS CODÉE EN DUR. Seul le domaine d'AUTHENTIFICATION
// est connu d'avance (account-d.docusign.com en démo, account.docusign.com en
// production) ; la base de l'API — `base_uri` — est renvoyée par
// /oauth/userinfo et varie selon la région du compte. Une production
// européenne répond sur une base que nous n'avons pas à deviner.

export type Environnement = "demo" | "production";

/** Domaines d'authentification OAuth. Ce sont les SEULES URL fixes. */
const AUTH_HOST: Record<Environnement, string> = {
  demo: "https://account-d.docusign.com",
  production: "https://account.docusign.com",
};

/**
 * Portées demandées.
 *
 * `signature` autorise l'envoi et la lecture des enveloppes. `extended` est
 * ce qui permet d'obtenir un jeton de RAFRAÎCHISSEMENT : sans lui, l'accès
 * expirerait au bout de huit heures et il faudrait réautoriser chaque jour.
 */
export const SCOPES = ["signature", "extended"] as const;

export type ConfigDocuSign = {
  environnement: Environnement;
  clientId: string;
  /**
   * Secret client. DocuSign délivre un « Secret Key » pour une application
   * confidentielle. PKCE est employé EN PLUS, pas à la place : le secret
   * authentifie l'application, PKCE lie le code d'autorisation à la demande
   * qui l'a initiée. Les deux ensemble, parce que ce code tourne côté serveur.
   */
  clientSecret: string;
  redirectUri: string;
  /** Clé partagée de DocuSign Connect, pour la vérification HMAC. */
  hmacSecret: string;
};

export type EtatConfig =
  | { ok: true; config: ConfigDocuSign }
  | { ok: false; manquant: string[]; environnement: Environnement };

const lire = (nom: string): string => (process.env[nom] ?? "").trim();

/**
 * Environnement actif.
 *
 * `demo` par défaut, délibérément : une variable oubliée doit envoyer vers le
 * bac à sable, jamais vers la production. L'erreur silencieuse acceptable est
 * « rien n'est parti au vrai prestataire », pas l'inverse.
 */
export function environnementActif(): Environnement {
  return lire("DOCUSIGN_ENV") === "production" ? "production" : "demo";
}

export function authHost(env: Environnement = environnementActif()): string {
  return AUTH_HOST[env];
}

export function urlToken(env: Environnement = environnementActif()): string {
  return `${authHost(env)}/oauth/token`;
}

export function urlUserInfo(env: Environnement = environnementActif()): string {
  return `${authHost(env)}/oauth/userinfo`;
}

/**
 * Configuration complète, ou la liste de ce qui manque.
 *
 * On ne renvoie jamais une configuration partielle : l'interface doit pouvoir
 * dire précisément quelle variable attendre, plutôt qu'afficher un bouton qui
 * échouerait à l'appel.
 */
export function configDocuSign(): EtatConfig {
  const environnement = environnementActif();
  const clientId = lire("DOCUSIGN_CLIENT_ID");
  const clientSecret = lire("DOCUSIGN_CLIENT_SECRET");
  const redirectUri = lire("DOCUSIGN_REDIRECT_URI");
  const hmacSecret = lire("DOCUSIGN_CONNECT_HMAC_SECRET");

  const manquant: string[] = [];
  if (!clientId) manquant.push("DOCUSIGN_CLIENT_ID");
  if (!clientSecret) manquant.push("DOCUSIGN_CLIENT_SECRET");
  if (!redirectUri) manquant.push("DOCUSIGN_REDIRECT_URI");
  // La clé HMAC n'est pas nécessaire pour ENVOYER, mais sans elle aucune
  // notification ne peut être acceptée : le contrat partirait sans que son
  // retour de signature puisse jamais être pris en compte. On l'exige donc
  // dès le raccordement plutôt que de le découvrir après la première
  // signature perdue.
  if (!hmacSecret) manquant.push("DOCUSIGN_CONNECT_HMAC_SECRET");

  if (manquant.length > 0) return { ok: false, manquant, environnement };
  return {
    ok: true,
    config: { environnement, clientId, clientSecret, redirectUri, hmacSecret },
  };
}

/**
 * L'URI de redirection est-elle celle déclarée ?
 *
 * DocuSign refuse déjà une redirection non déclarée, mais on vérifie aussi de
 * notre côté : un `redirect_uri` construit depuis un en-tête de requête
 * (`Host`, `X-Forwarded-Host`) serait détournable. On n'emploie que la valeur
 * de configuration, et cette fonction sert à le prouver dans les tests.
 */
export function redirectionAutorisee(uri: string, config: ConfigDocuSign): boolean {
  return uri === config.redirectUri;
}

/** Base de l'API REST pour un compte, depuis la base renvoyée par DocuSign. */
export function urlApi(baseUri: string, accountId: string, chemin: string): string {
  const base = baseUri.replace(/\/+$/, "");
  const c = chemin.replace(/^\/+/, "");
  return `${base}/restapi/v2.1/accounts/${accountId}/${c}`;
}
