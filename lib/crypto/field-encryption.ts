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
// Rétrocompatibilité (additif, ne casse rien) : une valeur SANS le préfixe
// `encv1:` est traitée comme du texte clair hérité — les anciennes annotations
// restent lisibles et seront re-chiffrées au prochain enregistrement. Tant que
// FIELD_ENCRYPTION_KEY n'est pas fournie, l'écriture reste en clair (le CRM
// fonctionne comme avant) : la protection au repos s'active dès que la clé existe.

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

// Chiffre une valeur en clair. Sans clé configurée → renvoie le texte clair tel
// quel (avertissement une fois) pour ne casser aucun flux existant.
export function encryptField(plaintext: string): string {
  const key = loadKey();
  if (!key) {
    warnOnce(
      "[field-encryption] FIELD_ENCRYPTION_KEY absente : champ confidentiel stocké EN CLAIR. " +
        "Définissez une clé de 32 octets (hex 64 car. ou base64) pour activer le chiffrement au repos.",
    );
    return plaintext;
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
