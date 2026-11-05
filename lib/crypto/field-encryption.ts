import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

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

function loadKey(): Buffer | null {
  const raw = process.env.FIELD_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  let key: Buffer;
  try {
    key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  } catch {
    return null;
  }
  return key.length === 32 ? key : null;
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
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

// Déchiffre une valeur stockée. Texte clair hérité (sans préfixe) → renvoyé tel
// quel. Enveloppe chiffrée mais clé absente/invalide, ou déchiffrement échoué →
// renvoie "" (illisible) plutôt que d'exposer du chiffré brut.
export function decryptField(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // texte clair hérité
  const key = loadKey();
  if (!key) {
    warnOnce("[field-encryption] valeur chiffrée mais FIELD_ENCRYPTION_KEY absente : déchiffrement impossible.");
    return "";
  }
  try {
    const [, ivB64, tagB64, ctB64] = stored.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch (e) {
    console.error("[field-encryption] échec du déchiffrement :", (e as Error).message);
    return "";
  }
}
