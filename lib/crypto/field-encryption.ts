import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Chiffrement applicatif des champs confidentiels (CDC §3.5 / §8.2) — AES-256-GCM.
//
// Objectif (correctif recette A14) : le RLS protège l'accès *par ligne*, mais le
// propriétaire d'un lead peut lire toute la ligne via la clé anon — y compris la
// colonne confidentielle Immobilier/Travaux, même sans la permission
// `immob_travaux`. En chiffrant la valeur au niveau applicatif, la colonne reste
// du chiffré illisible en base ; seul le serveur détenant la clé peut déchiffrer,
// et seulement après le contrôle de permission (mapper / RPC security-definer).
//
// La clé vient de FIELD_ENCRYPTION_KEY (32 octets, en hex 64 car. ou en base64).
// Enveloppe stockée : "encv1:<iv_b64>:<tag_b64>:<ciphertext_b64>".
//
// ── FAIL-CLOSED À L'ÉCRITURE (2026-11-05) ────────────────────────────
//
// `encryptField()` LÈVE une erreur quand la clé est absente ou invalide. Il
// renvoyait auparavant le texte clair, avec un seul avertissement console, au
// nom de la rétrocompatibilité. Ce repli était un piège :
//
//   • l'avertissement passe inaperçu dans les journaux d'un serveur de
//     développement, et `warnOnce` ne l'émet qu'UNE fois par processus ;
//   • un `.env.local` dont la clé est mal formée (par exemple 30 caractères,
//     qui ne décodent pas en 32 octets) pointait ici sur la base de
//     PRODUCTION : chaque enregistrement y écrivait la provenance marketing et
//     l'annotation Immobilier/Travaux EN CLAIR, précisément ce que le
//     commercial ne doit jamais voir ;
//   • une colonne en clair ne se rattrape pas après coup — on ne sait plus
//     quelles lignes ont fuité sans les inspecter une par une.
//
// Une écriture refusée se voit et se corrige. Une écriture en clair ne se voit
// pas. C'est tout l'arbitrage, et il va désormais dans ce sens.
//
// La LECTURE reste tolérante, et ce n'est pas une incohérence : une valeur sans
// le préfixe `encv1:` est du texte clair hérité, rendu tel quel — les anciennes
// annotations restent lisibles et seront chiffrées au prochain enregistrement.
// Faire lever `decryptField()` transformerait un champ illisible en page en
// erreur : la confidentialité n'y gagnerait rien, puisqu'il ne renvoie jamais
// de chiffré brut.

const PREFIX = "encv1:";

// ══════════════════════════════════════════════════════════════════════
//  VOIE 2 — identifiant de clé et rotation progressive (2026-11-08)
// ══════════════════════════════════════════════════════════════════════
//
// ── LE DÉFAUT QUE CECI FERME ────────────────────────────────────────
//
// L'enveloppe `encv1:<iv>:<tag>:<ct>` ne porte AUCUN identifiant de clé, et
// le module ne connaissait qu'une seule clé. Trois conséquences :
//
//   · changer la clé rendait tout l'existant indéchiffrable — AES-GCM
//     authentifie, donc le déchiffrement ÉCHOUE au lieu de rendre une valeur
//     fausse ;
//   · aucune cohabitation n'était possible entre anciennes et nouvelles
//     valeurs ;
//   · une rotation interrompue laissait une base dont une moitié est
//     illisible, SANS MOYEN DE SAVOIR LAQUELLE.
//
// ── CE QUE LA VOIE 2 CHANGE ─────────────────────────────────────────
//
//   `encv2:<kid>:<iv>:<tag>:<ct>`
//
// `kid` est une empreinte courte et NON RÉVERSIBLE de la clé : elle dit avec
// laquelle une valeur a été scellée, sans rien révéler de la clé. La rotation
// devient alors reprenable (on sait toujours ce qui reste à convertir),
// progressive (aucune fenêtre d'interruption) et rejouable.
//
// ── ET CE QU'ELLE NE CHANGE PAS ─────────────────────────────────────
//
// ⚠️ L'ÉCRITURE RESTE EN `encv1` PAR DÉFAUT. Le passage à `encv2` n'a lieu
// que si `CGK_CHIFFREMENT_V2=oui`. Sans cette variable, le comportement
// observable est IDENTIQUE à celui d'avant — y compris en production, qui ne
// la définit pas. La lecture, elle, accepte désormais les trois formes :
// texte clair hérité, `encv1`, `encv2`.
//
// Aucune rotation n'est déclenchée par ce code. Il la rend possible.

const PREFIX_V2 = "encv2:";

/** Longueur de l'identifiant de clé, en caractères hexadécimaux. */
const LONGUEUR_KID = 8;

function versCle(raw: string): Buffer | null {
  const v = raw.trim();
  if (!v) return null;
  let key: Buffer;
  try {
    key = /^[0-9a-fA-F]{64}$/.test(v) ? Buffer.from(v, "hex") : Buffer.from(v, "base64");
  } catch {
    return null;
  }
  return key.length === 32 ? key : null;
}

/**
 * Identifiant d'une clé : empreinte courte, non réversible.
 *
 * Elle est calculée sur les OCTETS de la clé, pas sur sa représentation : la
 * même clé donnée en hexadécimal ou en base64 a le même identifiant.
 */
export function kidDeCle(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, LONGUEUR_KID);
}

function loadKey(): Buffer | null {
  const raw = process.env.FIELD_ENCRYPTION_KEY?.trim();
  return raw ? versCle(raw) : null;
}

/**
 * Toutes les clés avec lesquelles on sait DÉCHIFFRER : la courante d'abord,
 * puis les anciennes, dans l'ordre déclaré.
 *
 * `FIELD_ENCRYPTION_KEYS_ANCIENNES` accepte plusieurs clés séparées par des
 * virgules. Elles ne servent QU'À LIRE : rien n'est jamais réécrit avec une
 * ancienne clé.
 */
export function clesDeLecture(): { kid: string; key: Buffer }[] {
  const out: { kid: string; key: Buffer }[] = [];
  const vues = new Set<string>();

  const courante = loadKey();
  if (courante) {
    const kid = kidDeCle(courante);
    out.push({ kid, key: courante });
    vues.add(kid);
  }

  for (const brut of (process.env.FIELD_ENCRYPTION_KEYS_ANCIENNES ?? "").split(",")) {
    const k = versCle(brut);
    if (!k) continue;
    const kid = kidDeCle(k);
    if (vues.has(kid)) continue;
    out.push({ kid, key: k });
    vues.add(kid);
  }

  return out;
}

/** Forme d'une valeur stockée. Sert aux outils de conversion et de comptage. */
export type FormeEnveloppe = "clair" | "v1" | "v2";

export function formeEnveloppe(stored: string): FormeEnveloppe {
  if (stored.startsWith(PREFIX_V2)) return "v2";
  if (stored.startsWith(PREFIX)) return "v1";
  return "clair";
}

/** Identifiant de clé d'une enveloppe `encv2`, ou `null` pour les autres formes. */
export function kidDeLEnveloppe(stored: string): string | null {
  if (!stored.startsWith(PREFIX_V2)) return null;
  const kid = stored.slice(PREFIX_V2.length).split(":")[0] ?? "";
  return /^[0-9a-f]+$/.test(kid) && kid.length === LONGUEUR_KID ? kid : null;
}

/** Le passage à `encv2` est-il demandé ? Faux = on continue d'écrire `encv1`. */
export function ecritureV2Active(): boolean {
  return (process.env.CGK_CHIFFREMENT_V2 ?? "").trim().toLowerCase() === "oui";
}

let warned = false;
function warnOnce(message: string): void {
  if (!warned) {
    console.warn(message);
    warned = true;
  }
}

export function isFieldEncryptionConfigured(): boolean {
  return loadKey() !== null;
}

/**
 * Chiffrement indisponible : clé absente, mal formée, ou de longueur autre que
 * 32 octets.
 *
 * Classe dédiée pour que les appelants distinguent ce refus d'une panne
 * réseau ou d'une erreur Postgres, et affichent un message exploitable plutôt
 * qu'un « 500 ». Le message ne contient JAMAIS la clé ni sa valeur — seule la
 * contrainte de format attendue.
 */
export class FieldEncryptionUnavailableError extends Error {
  readonly code = "FIELD_ENCRYPTION_UNAVAILABLE";

  constructor() {
    super(
      "FIELD_ENCRYPTION_KEY absente ou invalide : le champ confidentiel ne peut pas être "
        + "chiffré, l'écriture est donc refusée. Attendu : 32 octets, soit 64 caractères "
        + "hexadécimaux, soit du base64 décodant sur 32 octets.",
    );
    this.name = "FieldEncryptionUnavailableError";
  }
}

/**
 * Chiffre une valeur en clair.
 *
 * @throws {FieldEncryptionUnavailableError} si la clé est absente ou invalide.
 *   Aucun repli en texte clair : voir l'arbitrage en tête de fichier. Les
 *   appelants doivent soit vérifier `isFieldEncryptionConfigured()` en amont et
 *   refuser proprement, soit laisser remonter l'erreur — jamais l'avaler.
 */
export function encryptField(plaintext: string): string {
  const key = loadKey();
  if (!key) {
    throw new FieldEncryptionUnavailableError();
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const corps = `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;

  // `encv1` par défaut : sans `CGK_CHIFFREMENT_V2=oui`, la sortie est
  // exactement celle d'avant. Une instance qui ne connaîtrait pas `encv2`
  // continue donc de lire tout ce qui est écrit.
  return ecritureV2Active()
    ? `${PREFIX_V2}${kidDeCle(key)}:${corps}`
    : `${PREFIX}${corps}`;
}

// Déchiffre une valeur stockée. Texte clair hérité (sans préfixe) → renvoyé tel
// quel. Enveloppe chiffrée mais clé absente/invalide, ou déchiffrement échoué →
// renvoie "" (illisible) plutôt que d'exposer du chiffré brut.
export function decryptField(stored: string): string {
  const forme = formeEnveloppe(stored);
  if (forme === "clair") return stored; // texte clair hérité

  const cles = clesDeLecture();
  if (cles.length === 0) {
    warnOnce("[field-encryption] valeur chiffrée mais FIELD_ENCRYPTION_KEY absente : déchiffrement impossible.");
    return "";
  }

  // Découpage selon la forme. `encv2` porte un identifiant de clé en plus.
  const parts = stored.split(":");
  const [ivB64, tagB64, ctB64] = forme === "v2" ? parts.slice(2) : parts.slice(1);
  if (!ivB64 || !tagB64 || !ctB64) {
    console.error("[field-encryption] enveloppe mal formée.");
    return "";
  }

  // L'identifiant de clé, quand il existe, désigne la bonne clé du premier
  // coup. On n'en fait pas une exigence : si elle n'est pas dans la liste, on
  // essaie les autres plutôt que de déclarer la valeur perdue — une valeur
  // lisible ne doit pas être déclarée illisible par excès de rigueur.
  const kid = kidDeLEnveloppe(stored);
  const ordre = kid
    ? [...cles.filter((c) => c.kid === kid), ...cles.filter((c) => c.kid !== kid)]
    : cles;

  let derniereErreur = "";
  for (const { key } of ordre) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
      decipher.setAuthTag(Buffer.from(tagB64, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(ctB64, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch (e) {
      // AES-GCM authentifie : un échec signifie « pas cette clé ». On passe à
      // la suivante. C'est ce qui rend une rotation progressive possible.
      derniereErreur = (e as Error).message;
    }
  }

  console.error(
    `[field-encryption] échec du déchiffrement avec ${ordre.length} clé(s)` +
      `${kid ? ` (kid ${kid})` : ""} : ${derniereErreur}`,
  );
  return "";
}
