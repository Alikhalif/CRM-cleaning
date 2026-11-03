// PKCE et protection CSRF du flux OAuth — PUR, testable.
//
// POURQUOI PKCE ALORS QUE LE CODE TOURNE CÔTÉ SERVEUR
//
// Le secret client authentifie l'application ; PKCE lie le code
// d'autorisation à la demande précise qui l'a initiée. Un code intercepté
// dans l'historique du navigateur, dans un journal de proxy ou dans un
// `Referer` reste inutilisable sans le `code_verifier`, qui ne quitte jamais
// le serveur. Les deux mécanismes répondent à deux risques différents, et
// c'est pourquoi on les emploie ensemble.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** base64url sans remplissage — la forme exigée par RFC 7636. */
function base64url(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type DemandePkce = {
  /** Reste SUR LE SERVEUR. Ne jamais l'envoyer au navigateur. */
  codeVerifier: string;
  /** Transmis à DocuSign dans l'URL d'autorisation. */
  codeChallenge: string;
  codeChallengeMethod: "S256";
  /** Jeton anti-CSRF, à usage unique. */
  state: string;
};

/**
 * Prépare une demande d'autorisation.
 *
 * Le vérificateur fait 43 à 128 caractères selon la RFC ; 32 octets aléatoires
 * donnent 43 caractères en base64url, soit 256 bits d'entropie. Le `state`
 * est tiré séparément : réutiliser le même secret pour les deux usages ferait
 * du jeton anti-CSRF, qui circule en clair dans l'URL, un indice sur le
 * vérificateur, qui doit rester secret.
 */
export function creerDemandePkce(): DemandePkce {
  const codeVerifier = base64url(randomBytes(32));
  return {
    codeVerifier,
    codeChallenge: base64url(createHash("sha256").update(codeVerifier, "ascii").digest()),
    codeChallengeMethod: "S256",
    state: base64url(randomBytes(32)),
  };
}

/** Vérifie qu'un défi correspond bien à son vérificateur. Sert aux tests. */
export function defiCorrespond(codeVerifier: string, codeChallenge: string): boolean {
  const attendu = base64url(createHash("sha256").update(codeVerifier, "ascii").digest());
  const a = Buffer.from(attendu, "utf8");
  const b = Buffer.from(codeChallenge, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Comparaison du `state` en temps constant.
 *
 * Une comparaison naïve laisse fuiter la valeur attendue caractère par
 * caractère. Le `state` est à usage unique et de courte durée, mais la
 * précaution ne coûte rien.
 */
export function stateCorrespond(recu: string, attendu: string): boolean {
  const a = Buffer.from(recu, "utf8");
  const b = Buffer.from(attendu, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Durée de validité d'un `state`. Au-delà, la demande est abandonnée. */
export const STATE_TTL_MS = 10 * 60_000;

export function stateExpire(creeLe: string | Date, maintenant = Date.now()): boolean {
  const t = creeLe instanceof Date ? creeLe.getTime() : new Date(creeLe).getTime();
  if (!Number.isFinite(t)) return true; // date illisible : on refuse
  return maintenant - t > STATE_TTL_MS;
}

// ── URL d'autorisation ────────────────────────────────────────────────

/**
 * Construit l'URL d'autorisation DocuSign.
 *
 * `authHost` est passé en paramètre plutôt que lu ici : cette fonction reste
 * pure, donc testable sans toucher aux variables d'environnement.
 */
export function urlAutorisation(input: {
  authHost: string;
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  demande: DemandePkce;
}): string {
  const u = new URL(`${input.authHost.replace(/\/+$/, "")}/oauth/auth`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", input.scopes.join(" "));
  u.searchParams.set("client_id", input.clientId);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("state", input.demande.state);
  u.searchParams.set("code_challenge", input.demande.codeChallenge);
  u.searchParams.set("code_challenge_method", input.demande.codeChallengeMethod);
  return u.toString();
}

// ── Expiration des jetons ─────────────────────────────────────────────

/**
 * Marge avant expiration : on rafraîchit AVANT la fin.
 *
 * Sans elle, un jeton valide à la vérification peut expirer pendant l'appel
 * qui suit — l'envoi échouerait alors sur un 401 pour quelques secondes
 * d'écart. Soixante secondes couvrent largement un appel d'enveloppe.
 */
export const MARGE_RAFRAICHISSEMENT_MS = 60_000;

export function jetonAExpire(expiresAt: string | Date | null | undefined, maintenant = Date.now()): boolean {
  if (!expiresAt) return true;
  const t = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return true;
  return t - MARGE_RAFRAICHISSEMENT_MS <= maintenant;
}

/**
 * Le jeton de rafraîchissement est-il encore utilisable ?
 *
 * DocuSign le limite à trente jours avec la portée `extended`. Passé ce
 * délai, aucune reconnexion automatique n'est possible : il faut qu'une
 * personne réautorise l'application. L'interface doit le dire AVANT la
 * panne, d'où `joursAvantReautorisation`.
 */
export function rafraichissementExpire(
  refreshExpiresAt: string | Date | null | undefined,
  maintenant = Date.now(),
): boolean {
  if (!refreshExpiresAt) return false; // inconnu : on tentera, DocuSign tranchera
  const t = refreshExpiresAt instanceof Date
    ? refreshExpiresAt.getTime()
    : new Date(refreshExpiresAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t <= maintenant;
}

export function joursAvantReautorisation(
  refreshExpiresAt: string | Date | null | undefined,
  maintenant = Date.now(),
): number | null {
  if (!refreshExpiresAt) return null;
  const t = refreshExpiresAt instanceof Date
    ? refreshExpiresAt.getTime()
    : new Date(refreshExpiresAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((t - maintenant) / 86_400_000);
}

/** Durée de vie d'un jeton de rafraîchissement DocuSign, en jours (scope `extended`). */
export const JOURS_RAFRAICHISSEMENT = 30;
