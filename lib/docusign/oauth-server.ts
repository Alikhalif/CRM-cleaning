import "server-only";

// Flux OAuth DocuSign : échange, rafraîchissement, stockage des jetons.
//
// TROIS RÈGLES, et chacune répond à un risque précis.
//
//   1. LES JETONS NE SORTENT JAMAIS D'ICI. Aucune fonction ne les renvoie à
//      un appelant d'interface. `etatConnexion()` ne rend qu'un résumé —
//      connecté, expire le, compte — et c'est tout ce dont l'écran a besoin.
//   2. CHIFFRÉS AU REPOS, par `lib/crypto/field-encryption.ts`. La table n'a
//      aucune politique de lecture : la clé de service seule y accède. Les
//      deux protections sont nécessaires, car un jeton de rafraîchissement
//      vaut un accès durable au compte DocuSign.
//   3. JAMAIS DANS UN JOURNAL. Les erreurs remontées sont des messages
//      construits, jamais le corps brut d'une réponse de jeton.

import { createHash } from "node:crypto";
import { supabaseServiceRole } from "@/lib/supabase/service";
import { decryptField, encryptField, isFieldEncryptionConfigured } from "@/lib/crypto/field-encryption";
import {
  SCOPES, authHost, configDocuSign, urlToken, urlUserInfo,
  type ConfigDocuSign, type Environnement,
} from "./config";
import type { EtatConnexion } from "./vues";

// Réexport : le code serveur garde un seul point d'entrée.
export type { EtatConnexion } from "./vues";
import {
  JOURS_RAFRAICHISSEMENT, STATE_TTL_MS, creerDemandePkce, jetonAExpire,
  joursAvantReautorisation, rafraichissementExpire, stateExpire, urlAutorisation,
} from "./pkce";

export type Echec = { ok: false; error: string };

// ══════════════════════════════════════════════════════════════════════
//  Démarrage : créer un état et renvoyer l'URL d'autorisation
// ══════════════════════════════════════════════════════════════════════

export async function demarrerAutorisation(input: {
  entityId: string;
  userId: string;
}): Promise<{ ok: true; url: string } | Echec> {
  const conf = configDocuSign();
  if (!conf.ok) {
    return { ok: false, error: `Configuration DocuSign incomplète : ${conf.manquant.join(", ")}.` };
  }
  if (!isFieldEncryptionConfigured()) {
    // Refus explicite : stocker un jeton de rafraîchissement en clair serait
    // pire que ne pas raccorder du tout.
    return {
      ok: false,
      error: "FIELD_ENCRYPTION_KEY n'est pas configurée. Les jetons DocuSign ne peuvent pas "
        + "être chiffrés, le raccordement est donc refusé.",
    };
  }

  const demande = creerDemandePkce();
  const sb = await supabaseServiceRole();
  const { error } = await sb.from("docusign_oauth_states").insert({
    state: demande.state,
    entity_id: input.entityId,
    environment: conf.config.environnement,
    // Le vérificateur reste en base, côté serveur. Il ne transite jamais.
    code_verifier: demande.codeVerifier,
    redirect_uri: conf.config.redirectUri,
    created_by: input.userId,
    expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  } as never);
  if (error) return { ok: false, error: `Impossible d'initier l'autorisation : ${error.message}` };

  return {
    ok: true,
    url: urlAutorisation({
      authHost: authHost(conf.config.environnement),
      clientId: conf.config.clientId,
      redirectUri: conf.config.redirectUri,
      scopes: SCOPES,
      demande,
    }),
  };
}

// ══════════════════════════════════════════════════════════════════════
//  Retour : consommer l'état, échanger le code, enregistrer la connexion
// ══════════════════════════════════════════════════════════════════════

type EtatRow = {
  state: string;
  entity_id: string;
  environment: Environnement;
  code_verifier: string;
  redirect_uri: string;
  created_at: string;
  used_at: string | null;
};

type ReponseJeton = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
};

type CompteUserInfo = {
  account_id: string;
  account_name: string | null;
  base_uri: string;
  is_default: boolean;
};

/**
 * En-tête d'authentification de l'application.
 *
 * DocuSign attend `Basic base64(clientId:clientSecret)` sur /oauth/token.
 */
function basic(config: ConfigDocuSign): string {
  return "Basic " + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
}

/**
 * Lit une réponse de jeton sans jamais la journaliser.
 *
 * On ne renvoie pas le corps en cas d'échec : une réponse d'erreur DocuSign
 * peut contenir des fragments de la requête, donc du secret.
 */
function lireJeton(brut: unknown): { ok: true; acces: string; refresh: string | null; expiresIn: number; scope: string | null } | Echec {
  if (!brut || typeof brut !== "object") return { ok: false, error: "réponse de jeton illisible" };
  const r = brut as ReponseJeton;
  const acces = typeof r.access_token === "string" ? r.access_token : "";
  if (!acces) return { ok: false, error: "jeton d'accès absent de la réponse" };
  const expiresIn = typeof r.expires_in === "number" && Number.isFinite(r.expires_in)
    ? r.expires_in
    : 8 * 3600;
  return {
    ok: true,
    acces,
    refresh: typeof r.refresh_token === "string" && r.refresh_token ? r.refresh_token : null,
    expiresIn,
    scope: typeof r.scope === "string" ? r.scope : null,
  };
}

/** Compte à retenir : celui par défaut, à défaut le premier renvoyé. */
function choisirCompte(brut: unknown): CompteUserInfo | null {
  if (!brut || typeof brut !== "object") return null;
  const comptes = (brut as { accounts?: unknown }).accounts;
  if (!Array.isArray(comptes) || comptes.length === 0) return null;
  const lus: CompteUserInfo[] = [];
  for (const c of comptes) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const id = typeof o.account_id === "string" ? o.account_id : "";
    // `base_uri` est la base de l'API pour CE compte. C'est elle qui porte la
    // région — on ne la devine pas, on la conserve telle quelle.
    const base = typeof o.base_uri === "string" ? o.base_uri : "";
    if (!id || !base) continue;
    lus.push({
      account_id: id,
      account_name: typeof o.account_name === "string" ? o.account_name : null,
      base_uri: base,
      is_default: o.is_default === true || o.is_default === "true",
    });
  }
  return lus.find((c) => c.is_default) ?? lus[0] ?? null;
}

export async function terminerAutorisation(input: {
  code: string;
  state: string;
}): Promise<{ ok: true; entityId: string; compte: string } | Echec> {
  const conf = configDocuSign();
  if (!conf.ok) {
    return { ok: false, error: `Configuration DocuSign incomplète : ${conf.manquant.join(", ")}.` };
  }
  const config = conf.config;

  const sb = await supabaseServiceRole();
  const { data: etat } = await sb
    .from("docusign_oauth_states")
    .select("state, entity_id, environment, code_verifier, redirect_uri, created_at, used_at")
    .eq("state", input.state)
    .maybeSingle<EtatRow>();

  // Un `state` inconnu signale soit une tentative de falsification, soit une
  // demande trop ancienne. Dans les deux cas on refuse sans détailler.
  if (!etat) return { ok: false, error: "Demande d'autorisation inconnue ou déjà expirée." };
  if (etat.used_at) return { ok: false, error: "Cette autorisation a déjà été utilisée." };
  if (stateExpire(etat.created_at)) {
    return { ok: false, error: "Demande d'autorisation expirée. Relancez le raccordement." };
  }
  // L'URI employée est celle de la CONFIGURATION, jamais une valeur reçue.
  if (etat.redirect_uri !== config.redirectUri) {
    return { ok: false, error: "L'URI de redirection ne correspond plus à la configuration." };
  }
  if (etat.environment !== config.environnement) {
    return {
      ok: false,
      error: `Cette demande visait l'environnement « ${etat.environment} » alors que le CRM est `
        + `désormais en « ${config.environnement} ». Relancez le raccordement.`,
    };
  }

  // Marquage AVANT l'échange : un code rejoué ne doit pas pouvoir repasser,
  // même si l'échange échoue ensuite.
  const { error: errUse, data: pris } = await sb
    .from("docusign_oauth_states")
    .update({ used_at: new Date().toISOString() } as never)
    .eq("state", input.state)
    .is("used_at", null)
    .select("state");
  if (errUse || !pris || pris.length === 0) {
    return { ok: false, error: "Cette autorisation a déjà été utilisée." };
  }

  const corps = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: etat.code_verifier,
    redirect_uri: config.redirectUri,
  });

  let jeton: Awaited<ReturnType<typeof lireJeton>>;
  try {
    const rep = await fetch(urlToken(config.environnement), {
      method: "POST",
      headers: {
        Authorization: basic(config),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: corps.toString(),
      cache: "no-store",
    });
    if (!rep.ok) {
      // Le statut seul, jamais le corps : il peut refléter la requête.
      return { ok: false, error: `DocuSign a refusé l'échange du code (HTTP ${rep.status}).` };
    }
    jeton = lireJeton(await rep.json());
  } catch {
    return { ok: false, error: "DocuSign est injoignable pour l'échange du code." };
  }
  if (!jeton.ok) return jeton;

  // Le compte et sa base d'URL viennent de /oauth/userinfo.
  let compte: CompteUserInfo | null = null;
  let sub: string | null = null;
  try {
    const rep = await fetch(urlUserInfo(config.environnement), {
      headers: { Authorization: `Bearer ${jeton.acces}` },
      cache: "no-store",
    });
    if (!rep.ok) return { ok: false, error: `Lecture du compte DocuSign impossible (HTTP ${rep.status}).` };
    const brut = await rep.json();
    compte = choisirCompte(brut);
    sub = typeof (brut as { sub?: unknown })?.sub === "string" ? (brut as { sub: string }).sub : null;
  } catch {
    return { ok: false, error: "DocuSign est injoignable pour la lecture du compte." };
  }
  if (!compte) return { ok: false, error: "Aucun compte DocuSign exploitable sur cet utilisateur." };

  // Second contrôle du chiffrement, après celui de `demarrerAutorisation()`.
  // Il n'est pas redondant : entre le départ vers DocuSign et ce retour de
  // callback, le serveur a pu être redémarré avec un environnement différent.
  // Sans ce refus, `encryptField()` lèverait quelques lignes plus bas et
  // l'utilisateur récolterait un « 500 » au lieu d'un motif lisible.
  if (!isFieldEncryptionConfigured()) {
    return {
      ok: false,
      error: "FIELD_ENCRYPTION_KEY n'est plus configurée. Les jetons DocuSign ne peuvent pas "
        + "être chiffrés : le raccordement est refusé et la connexion existante est conservée.",
    };
  }

  const maintenant = Date.now();
  const ligne = {
    entity_id: etat.entity_id,
    environment: config.environnement,
    account_id: compte.account_id,
    base_uri: compte.base_uri,
    account_name: compte.account_name,
    docusign_user_id: sub,
    access_token_enc: encryptField(jeton.acces),
    refresh_token_enc: jeton.refresh ? encryptField(jeton.refresh) : null,
    expires_at: new Date(maintenant + jeton.expiresIn * 1000).toISOString(),
    refresh_expires_at: jeton.refresh
      ? new Date(maintenant + JOURS_RAFRAICHISSEMENT * 86_400_000).toISOString()
      : null,
    scope: jeton.scope,
    connected_by: null as string | null,
    connected_at: new Date(maintenant).toISOString(),
    last_error: null as string | null,
    last_error_at: null as string | null,
    revoked_at: null as string | null,
    updated_at: new Date(maintenant).toISOString(),
  };

  // Réautoriser REMPLACE la connexion : l'index unique partiel
  // `uq_dsc_entity_env (entity_id, environment) where revoked_at is null`
  // n'admet qu'une seule ligne ACTIVE par entité et par environnement.
  //
  // L'ordre n'est donc pas un choix : insérer avant de révoquer violerait cet
  // index. Mais révoquer d'abord ouvre une fenêtre — si l'insertion échoue,
  // l'entité se retrouve sans AUCUN raccordement alors qu'elle en avait un
  // qui fonctionnait, et il faut une réautorisation humaine pour s'en
  // remettre. PostgREST ne donne pas de transaction sur deux appels, alors on
  // compense : on retient les lignes qu'on vient de révoquer, et on les
  // rétablit si l'insertion échoue.
  const { data: revoquees } = await sb
    .from("docusign_connections")
    .update({ revoked_at: new Date(maintenant).toISOString() } as never)
    .eq("entity_id", etat.entity_id)
    .eq("environment", config.environnement)
    .is("revoked_at", null)
    .select("id");

  const { error: errIns } = await sb.from("docusign_connections").insert(ligne as never);
  if (errIns) {
    // Retour à l'état antérieur. S'il n'y avait pas de connexion active,
    // cette boucle ne fait rien — c'est le cas d'un premier raccordement.
    let retabli = true;
    for (const r of ((revoquees ?? []) as { id: string }[])) {
      const { error } = await sb
        .from("docusign_connections")
        .update({ revoked_at: null } as never)
        .eq("id", r.id);
      if (error) retabli = false;
    }
    return {
      ok: false,
      error: `Enregistrement de la connexion impossible : ${errIns.message}`
        + (retabli
          ? ""
          : " De plus, l'ancien raccordement n'a pas pu être rétabli : une réautorisation "
            + "DocuSign est nécessaire."),
    };
  }

  return {
    ok: true,
    entityId: etat.entity_id,
    compte: compte.account_name ?? compte.account_id,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  Jeton utilisable : lecture, rafraîchissement
// ══════════════════════════════════════════════════════════════════════

type ConnexionRow = {
  id: string;
  entity_id: string;
  environment: Environnement;
  account_id: string;
  base_uri: string;
  account_name: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string;
  refresh_expires_at: string | null;
  connected_at: string;
  last_error: string | null;
};

export type AccesDocuSign = {
  accessToken: string;
  accountId: string;
  baseUri: string;
  environnement: Environnement;
};

async function connexion(entityId: string, env: Environnement): Promise<ConnexionRow | null> {
  const sb = await supabaseServiceRole();
  const { data } = await sb
    .from("docusign_connections")
    .select(
      "id, entity_id, environment, account_id, base_uri, account_name, access_token_enc, "
      + "refresh_token_enc, expires_at, refresh_expires_at, connected_at, last_error",
    )
    .eq("entity_id", entityId)
    .eq("environment", env)
    .is("revoked_at", null)
    .maybeSingle<ConnexionRow>();
  return data ?? null;
}

async function noterErreur(id: string, message: string): Promise<void> {
  const sb = await supabaseServiceRole();
  await sb
    .from("docusign_connections")
    .update({
      last_error: message.slice(0, 500),
      last_error_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
}

/**
 * Jeton d'accès valide pour une entité, rafraîchi si nécessaire.
 *
 * ⚠️ Usage SERVEUR exclusivement. Le jeton renvoyé ne doit jamais remonter
 * jusqu'à une action appelée depuis le navigateur.
 */
export async function accesPourEntite(
  entityId: string,
  env: Environnement = configDocuSign().ok ? (configDocuSign() as { config: ConfigDocuSign }).config.environnement : "demo",
): Promise<{ ok: true; acces: AccesDocuSign } | Echec> {
  const conf = configDocuSign();
  if (!conf.ok) {
    return { ok: false, error: `Configuration DocuSign incomplète : ${conf.manquant.join(", ")}.` };
  }

  const c = await connexion(entityId, env);
  if (!c) {
    return {
      ok: false,
      error: "Cette entité juridique n'est pas raccordée à DocuSign. Un Super Admin doit "
        + "autoriser l'application depuis Réglages.",
    };
  }

  // UN SEUL contrôle du chiffrement, et il est placé AVANT toute lecture de
  // jeton. L'ordre est le correctif ; le contrôle, lui, existait déjà.
  //
  // Il se trouvait plus bas, juste avant l'écriture des jetons renouvelés.
  // Trop tard, et le motif affiché était faux : sans clé valide,
  // `decryptField()` rend "". Le chemin « jeton encore valide » renvoyait
  // donc un `Bearer` VIDE — DocuSign répondait 401 sans que la clé soit
  // jamais nommée — et le rafraîchissement postait un `refresh_token` VIDE,
  // d'où un 400 et un `last_error` « rafraîchissement refusé (HTTP 400) »
  // qui envoie l'exploitant réautoriser alors que seule la clé manque. Le
  // garde-fou d'écriture n'était même plus atteint dans ce scénario.
  //
  // Ici, un seul refus couvre les trois usages de la clé : les deux
  // déchiffrements et l'écriture. `noterErreur` parce que `last_error` est ce
  // que la fiche dossier affiche — l'exploitant doit y lire la cause réelle,
  // pas une fausse piste. La connexion reste en place : elle redevient
  // utilisable dès la clé rétablie, sans réautorisation DocuSign.
  if (!isFieldEncryptionConfigured()) {
    await noterErreur(c.id, "FIELD_ENCRYPTION_KEY absente ou invalide : jetons inutilisables");
    return {
      ok: false,
      error: "FIELD_ENCRYPTION_KEY absente ou invalide : les jetons DocuSign ne peuvent être "
        + "ni déchiffrés ni renouvelés. Le raccordement est conservé et redeviendra utilisable "
        + "dès que la clé sera rétablie.",
    };
  }

  if (!jetonAExpire(c.expires_at)) {
    return {
      ok: true,
      acces: {
        accessToken: decryptField(c.access_token_enc),
        accountId: c.account_id,
        baseUri: c.base_uri,
        environnement: c.environment,
      },
    };
  }

  // Jeton expiré : rafraîchissement.
  if (!c.refresh_token_enc) {
    await noterErreur(c.id, "jeton expiré sans jeton de rafraîchissement");
    return { ok: false, error: "L'accès DocuSign a expiré. Une réautorisation est nécessaire." };
  }
  if (rafraichissementExpire(c.refresh_expires_at)) {
    await noterErreur(c.id, "jeton de rafraîchissement expiré");
    return {
      ok: false,
      error: `L'autorisation DocuSign a expiré (DocuSign limite le renouvellement à `
        + `${JOURS_RAFRAICHISSEMENT} jours). Un Super Admin doit réautoriser l'application.`,
    };
  }

  const corps = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: decryptField(c.refresh_token_enc),
  });

  let jeton: Awaited<ReturnType<typeof lireJeton>>;
  try {
    const rep = await fetch(urlToken(c.environment), {
      method: "POST",
      headers: {
        Authorization: basic(conf.config),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: corps.toString(),
      cache: "no-store",
    });
    if (!rep.ok) {
      await noterErreur(c.id, `rafraîchissement refusé (HTTP ${rep.status})`);
      return {
        ok: false,
        error: `DocuSign a refusé le renouvellement de l'accès (HTTP ${rep.status}). `
          + "Une réautorisation est probablement nécessaire.",
      };
    }
    jeton = lireJeton(await rep.json());
  } catch {
    await noterErreur(c.id, "DocuSign injoignable au rafraîchissement");
    return { ok: false, error: "DocuSign est injoignable pour renouveler l'accès." };
  }
  if (!jeton.ok) {
    await noterErreur(c.id, jeton.error);
    return jeton;
  }

  // Le chiffrement a déjà été contrôlé en tête de cette fonction, avant le
  // déchiffrement du jeton de rafraîchissement. Pas de second contrôle ici :
  // ce serait du bruit, et c'est surtout ici qu'il arrivait trop tard.
  const maintenant = Date.now();
  const sb = await supabaseServiceRole();
  await sb
    .from("docusign_connections")
    .update({
      access_token_enc: encryptField(jeton.acces),
      // DocuSign renvoie un NOUVEAU jeton de rafraîchissement : le conserver
      // remet le compteur de trente jours à zéro. L'ignorer condamnerait le
      // raccordement à expirer même sur un CRM utilisé tous les jours.
      ...(jeton.refresh
        ? {
            refresh_token_enc: encryptField(jeton.refresh),
            refresh_expires_at: new Date(maintenant + JOURS_RAFRAICHISSEMENT * 86_400_000).toISOString(),
          }
        : {}),
      expires_at: new Date(maintenant + jeton.expiresIn * 1000).toISOString(),
      last_error: null,
      last_error_at: null,
      updated_at: new Date(maintenant).toISOString(),
    } as never)
    .eq("id", c.id);

  return {
    ok: true,
    acces: {
      accessToken: jeton.acces,
      accountId: c.account_id,
      baseUri: c.base_uri,
      environnement: c.environment,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
//  État de connexion, pour l'interface
// ══════════════════════════════════════════════════════════════════════

/**
 * Résumé de l'état du raccordement pour une entité.
 *
 * Ne renvoie AUCUN jeton — c'est la raison d'être de cette fonction. L'écran
 * a besoin de savoir s'il peut activer le bouton, pas de détenir le secret.
 */
export async function etatConnexion(entityId: string | null): Promise<EtatConnexion> {
  const conf = configDocuSign();
  const environnement = conf.ok ? conf.config.environnement : (conf as { environnement: Environnement }).environnement;
  const base: EtatConnexion = {
    configure: conf.ok,
    manquant: conf.ok ? [] : conf.manquant,
    environnement,
    chiffrementActif: isFieldEncryptionConfigured(),
    connecte: false,
    compte: null,
    connecteLe: null,
    joursAvantReautorisation: null,
    derniereErreur: null,
  };
  if (!entityId || !conf.ok) return base;

  const c = await connexion(entityId, environnement);
  if (!c) return base;

  return {
    ...base,
    connecte: !rafraichissementExpire(c.refresh_expires_at),
    compte: c.account_name ?? c.account_id,
    connecteLe: c.connected_at,
    joursAvantReautorisation: joursAvantReautorisation(c.refresh_expires_at),
    derniereErreur: c.last_error,
  };
}

/**
 * Purge les états OAuth périmés.
 *
 * Un `state` non consommé n'a plus aucune valeur passé son expiration, et
 * garder des `code_verifier` indéfiniment agrandit la surface d'attaque pour
 * rien. La suppression passe par la fonction `security definer`
 * `purge_docusign_oauth_states()` : son filtre — expiration dépassée de plus
 * d'une heure — est en base, donc impossible à élargir par erreur depuis le
 * code. Un état encore valable n'est jamais touché.
 *
 * Renvoie le nombre de lignes supprimées, ou `null` si l'appel a échoué :
 * l'appelant le journalise sans faire échouer le reste du cron.
 */
export async function purgerEtatsOAuth(): Promise<number | null> {
  try {
    const sb = await supabaseServiceRole();
    const { data, error } = await sb
      .rpc("purge_docusign_oauth_states")
      .returns<number>();
    if (error) {
      console.error(`[docusign] purge des états OAuth : ${error.message}`);
      return null;
    }
    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.error("[docusign] purge des états OAuth impossible", err);
    return null;
  }
}

/** Empreinte d'un jeton, pour tracer sans rien exposer. */
export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex").slice(0, 12);
}
