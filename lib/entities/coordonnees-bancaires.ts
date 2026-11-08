// Coordonnées bancaires d'une société émettrice : validation, libellé et
// masquage. Pur — aucune base, aucun secret, aucune entrée-sortie.
//
// ── LE FAIT QUI STRUCTURE CE MODULE ─────────────────────────────────
//
// **LE CANADA N'UTILISE PAS L'IBAN.** Les quatre autres pays du CRM — France,
// Suisse, Belgique, Luxembourg — oui. Une société canadienne identifie son
// compte par un numéro d'institution (3 chiffres), un numéro de transit
// (5 chiffres) et un numéro de compte.
//
// Conséquence : un champ nommé « IBAN » n'a pas de sens pour une société
// canadienne, et une validation IBAN appliquée à ses coordonnées les
// refuserait toutes. Le module valide donc PAR PAYS, et le libellé imprimé
// sur les documents suit le pays — « IBAN » là où c'en est un,
// « Coordonnées bancaires » au Canada.
//
// ── CE QUE CE MODULE NE FAIT PAS ────────────────────────────────────
//
// Il ne vérifie pas que le compte EXISTE, ni qu'il appartient à la société.
// Aucun contrôle de forme ne peut le faire. Il vérifie que la valeur est
// *formée comme* une coordonnée du pays — ce qui attrape la faute de frappe,
// le copier-coller tronqué et le mauvais pays, et rien de plus.

import type { Country } from "@/lib/leads";

/** Longueur attendue d'un IBAN, par pays. Source : registre IBAN. */
const LONGUEUR_IBAN: Partial<Record<Country, number>> = {
  FR: 27,
  CH: 21,
  BE: 16,
  LU: 20,
};

/** Les pays du CRM qui emploient l'IBAN. */
export function paysUtiliseIban(pays: Country): boolean {
  return LONGUEUR_IBAN[pays] !== undefined;
}

/** Intitulé à imprimer sur un document, selon le pays de la société. */
export function libelleCoordonnee(pays: Country): string {
  return paysUtiliseIban(pays) ? "IBAN" : "Coordonnées bancaires";
}

/** Retire espaces et séparateurs, met en majuscules. */
export function normaliser(valeur: string): string {
  return valeur.replace(/[\s.\-/]/g, "").toUpperCase();
}

// ══════════════════════════════════════════════════════════════════════
//  La clé de contrôle IBAN (ISO 13616 / ISO 7064 mod 97-10)
// ══════════════════════════════════════════════════════════════════════

/**
 * Reste modulo 97 d'un IBAN, calculé par morceaux.
 *
 * ⚠️ Un IBAN converti en nombre dépasse largement `Number.MAX_SAFE_INTEGER` :
 * le calcul se fait donc chiffre à chiffre, sans jamais former l'entier. Un
 * `parseInt` sur la chaîne entière donnerait un résultat silencieusement faux.
 */
function modulo97(iban: string): number {
  // Les quatre premiers caractères passent à la fin, puis chaque lettre
  // devient sa position dans l'alphabet + 9 (A=10 … Z=35).
  const reorganise = iban.slice(4) + iban.slice(0, 4);
  let reste = 0;
  for (const c of reorganise) {
    const morceau = /[0-9]/.test(c)
      ? c
      : String(c.charCodeAt(0) - 55); // 'A' (65) → 10
    for (const d of morceau) {
      reste = (reste * 10 + Number(d)) % 97;
    }
  }
  return reste;
}

export function cleIbanValide(valeur: string): boolean {
  const v = normaliser(valeur);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(v)) return false;
  return modulo97(v) === 1;
}

// ══════════════════════════════════════════════════════════════════════
//  La validation
// ══════════════════════════════════════════════════════════════════════

export type Validation =
  | { ok: true; valeurNormalisee: string; avertissement: string | null }
  | { ok: false; motif: string };

/**
 * La coordonnée est-elle formée comme celle de ce pays ?
 *
 * Une valeur VIDE est acceptée : c'est l'état de cinq sociétés sur sept, et
 * les documents n'impriment alors aucune ligne bancaire. Effacer une
 * coordonnée doit rester possible.
 */
export function validerCoordonnee(brut: string, pays: Country): Validation {
  const valeur = brut.trim();
  if (valeur === "") {
    return { ok: true, valeurNormalisee: "", avertissement: null };
  }

  const v = normaliser(valeur);

  // ── Le Canada : pas d'IBAN ──────────────────────────────────────────
  if (!paysUtiliseIban(pays)) {
    // Institution (3) + transit (5) + compte (7 à 12) = 15 à 20 chiffres.
    // On accepte aussi un IBAN si quelqu'un en saisit un : refuser une valeur
    // valide ailleurs serait gratuit. Mais on le signale.
    if (/^[0-9]{15,20}$/.test(v)) {
      return {
        ok: true,
        valeurNormalisee: v,
        avertissement:
          "Le Canada n'utilise pas l'IBAN : cette valeur est lue comme des " +
          "coordonnées locales (institution, transit, compte). Le document " +
          "imprimera « Coordonnées bancaires » et non « IBAN ».",
      };
    }
    if (cleIbanValide(v)) {
      return {
        ok: true,
        valeurNormalisee: v,
        avertissement:
          "Valeur formée comme un IBAN alors que la société est canadienne. " +
          "Vérifiez que c'est bien le compte voulu.",
      };
    }
    return {
      ok: false,
      motif:
        "Coordonnées canadiennes attendues : 15 à 20 chiffres (institution, " +
        "transit, compte), séparateurs admis. Le Canada n'utilise pas l'IBAN.",
    };
  }

  // ── Les quatre pays à IBAN ──────────────────────────────────────────
  if (!/^[A-Z]{2}[0-9]{2}/.test(v)) {
    return {
      ok: false,
      motif: "Un IBAN commence par deux lettres de pays puis deux chiffres de contrôle.",
    };
  }

  const paysIban = v.slice(0, 2);
  if (paysIban !== pays) {
    return {
      ok: false,
      motif:
        `Cet IBAN est déclaré « ${paysIban} » alors que la société est ` +
        `enregistrée en « ${pays} ». Corrigez l'un des deux : une société ne ` +
        `peut pas encaisser sur un compte dont le pays contredit son propre pays.`,
    };
  }

  const attendue = LONGUEUR_IBAN[pays];
  if (attendue !== undefined && v.length !== attendue) {
    return {
      ok: false,
      motif: `Un IBAN ${pays} compte ${attendue} caractères ; celui-ci en a ${v.length}.`,
    };
  }

  if (!cleIbanValide(v)) {
    return {
      ok: false,
      motif:
        "La clé de contrôle de l'IBAN est fausse. C'est presque toujours une " +
        "faute de frappe ou un copier-coller tronqué.",
    };
  }

  return { ok: true, valeurNormalisee: v, avertissement: null };
}

// ══════════════════════════════════════════════════════════════════════
//  Le BIC
// ══════════════════════════════════════════════════════════════════════

export function validerBic(brut: string, pays: Country): Validation {
  const valeur = brut.trim();
  if (valeur === "") return { ok: true, valeurNormalisee: "", avertissement: null };

  const v = normaliser(valeur);
  if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v)) {
    return {
      ok: false,
      motif: "Un BIC compte 8 ou 11 caractères : 4 lettres de banque, 2 de pays, 2 de localité, 3 facultatifs d'agence.",
    };
  }

  const paysBic = v.slice(4, 6);
  if (paysBic !== pays) {
    return {
      ok: true,
      valeurNormalisee: v,
      avertissement:
        `Le BIC désigne le pays « ${paysBic} » alors que la société est en ` +
        `« ${pays} ». C'est possible — une banque étrangère — mais à vérifier.`,
    };
  }

  return { ok: true, valeurNormalisee: v, avertissement: null };
}

// ══════════════════════════════════════════════════════════════════════
//  Le masquage
// ══════════════════════════════════════════════════════════════════════

/**
 * Forme masquée, pour le journal d'audit et l'historique affiché.
 *
 * ⚠️ Un IBAN ne doit **jamais** entrer en clair dans `audit_logs` : le journal
 * est lisible par les administrateurs et conservé des années, alors que la
 * valeur est chiffrée en base. L'y écrire en clair annulerait le chiffrement.
 *
 * Le masque garde les quatre premiers et les quatre derniers caractères :
 * assez pour reconnaître un changement de compte, trop peu pour virer de
 * l'argent.
 */
export function masquer(valeur: string): string {
  const v = normaliser(valeur);
  if (v === "") return "(vide)";
  if (v.length <= 8) return "*".repeat(v.length);
  return `${v.slice(0, 4)}${"*".repeat(v.length - 8)}${v.slice(-4)}`;
}
