// Validation et charge utile d'écriture d'une société émettrice — PUR.
//
// POURQUOI CE MODULE EST SÉPARÉ DE `actions.ts`. Un fichier `"use server"` ne
// peut exporter que des fonctions asynchrones : impossible d'y exposer
// `validate()` ou `buildPayload()` pour les tester. Les sortir ici les rend
// vérifiables sans base, sans session et sans réseau — ce qui compte, puisque
// c'est exactement cette logique qui a cassé la production le 2026-11-05.
//
// Aucune I/O. `actions.ts` garde les écritures Supabase et le journal d'audit.

import type { Database } from "@/lib/supabase/database.types";
import { COUNTRY_LABEL, IDENTIFIANT_LEGAL, type Country, type LegalForm } from "@/lib/leads";

type EntityInsert = Database["public"]["Tables"]["legal_entities"]["Insert"];

export type EntityInput = {
  legalName: string;
  legalForm: LegalForm;
  siret: string;
  apeCode: string;
  vatNumber: string;
  addressLine: string;
  postalCode: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  defaultVatRate: number;
  legalMentions: string;
  color: string;
  representativeName: string;
  representativeTitle: string;
  representativeCompanyName: string;
  country: Country;
  /** Identifiant légal national. Cf. `IDENTIFIANT_LEGAL` dans lib/leads.ts. */
  siren: string;
};

/**
 * Lecture SÛRE d'un champ texte de la charge utile.
 *
 * ── POURQUOI CE HELPER EXISTE ────────────────────────────────────────
 *
 * Bug de production du 2026-11-05 :
 *
 *   TypeError: Cannot read properties of null (reading 'replace')
 *
 * `EntityInput` type ses champs en `string`, mais les valeurs viennent d'une
 * fiche société lue en base, où `ape_code`, `vat_number`, `iban`, `bic` et
 * `color` sont NULLABLES. Le type de frontière (`EntityRow` dans
 * `lib/documents-server.ts`) les déclarait non-nulles : le compilateur, à qui
 * on avait menti, n'exigeait aucune garde, et un `null` traversait jusqu'à
 * `input.iban.replace(...)`. Cinq sociétés sur sept étaient concernées.
 *
 * La cause est corrigée à la source (`EntityRow` dit désormais la vérité et
 * `mapEntity` coerce chaque colonne nullable). Ce helper est la SECONDE
 * barrière : il garantit qu'aucune méthode de chaîne n'est jamais appelée sur
 * autre chose qu'une chaîne, quelle que soit la provenance de la valeur.
 *
 * Un `null` n'est pas une erreur de saisie — c'est un champ vide. Il est donc
 * traité comme une chaîne vide, pas rejeté.
 */
export const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Même lecture, espaces internes retirés : SIRET, SIREN, IBAN. */
export const sansEspaces = (v: unknown): string => texte(v).replace(/\s/g, "");

export function validate(input: EntityInput): string | null {
  if (!texte(input.legalName)) return "Raison sociale requise.";
  if (!input.legalForm) return "Forme juridique requise.";
  if (!input.country) return "Pays d'établissement requis.";

  // Le SIRET à 14 chiffres n'existe QU'EN FRANCE. La règle précédente
  // s'appliquait à toutes les sociétés : aucune entité suisse, belge,
  // luxembourgeoise ou canadienne ne pouvait être enregistrée, alors que le
  // CRM opère dans ces cinq pays. On ne l'exige donc qu'en France, et on
  // demande ailleurs l'identifiant légal national.
  if (input.country === "FR") {
    if (!/^\d{14}$/.test(sansEspaces(input.siret))) {
      return "SIRET invalide (14 chiffres attendus pour une société française).";
    }
  } else if (!texte(input.siren) && !texte(input.siret) && !texte(input.vatNumber)) {
    const l = IDENTIFIANT_LEGAL[input.country].label;
    return `Identifiant légal requis (${l}) pour une société ${COUNTRY_LABEL[input.country]}.`;
  }
  // ⚠️ On teste le TYPE avant de convertir. `Number(null)` vaut 0, et 0 est un
  // taux légitime (franchise en base) : sans ce contrôle, un taux absent
  // s'enregistrerait silencieusement comme « 0 % de TVA » et produirait des
  // factures fausses. Un champ manquant doit être refusé, pas interprété.
  if (typeof input.defaultVatRate !== "number") {
    return "Taux de TVA requis.";
  }
  const tva = input.defaultVatRate;
  if (!Number.isFinite(tva) || tva < 0 || tva > 100) {
    return "Taux de TVA invalide (0–100).";
  }
  return null;
}

export function buildPayload(input: EntityInput): Omit<EntityInsert, "id"> {
  return {
    legal_name: texte(input.legalName),
    legal_form: input.legalForm,
    siret: sansEspaces(input.siret),
    ape_code: texte(input.apeCode),
    vat_number: texte(input.vatNumber),
    address: {
      line1: texte(input.addressLine) || null,
      postal_code: texte(input.postalCode) || null,
      city: texte(input.city) || null,
    },
    contact_email: texte(input.contactEmail) || null,
    contact_phone: texte(input.contactPhone) || null,
    // iban / bic : VOLONTAIREMENT ABSENTS de la charge utile.
    //
    // Les champs ont été retirés du formulaire le 2026-11-05 (le RIB circule
    // en pièce jointe du devis). Les colonnes, elles, restent : deux sociétés
    // ont un IBAN réel qui s'imprime sur leurs factures. Ne pas les écrire
    // ICI est ce qui préserve ces valeurs — y mettre une chaîne vide les
    // aurait effacées à la première modification de la fiche.
    default_vat_rate: Number.isFinite(Number(input.defaultVatRate))
      ? Number(input.defaultVatRate)
      : 20,
    legal_mentions: texte(input.legalMentions) || null,
    color: texte(input.color) || "#5b4bcc",
    // Volontairement PAS obligatoires côté formulaire : les sept sociétés
    // existantes en sont dépourvues, et imposer le champ bloquerait une
    // modification sans rapport. Le refus se fait là où il compte — à
    // l'émission d'un contrat de sous-traitance, par `controlerEntite()`.
    representative_name: texte(input.representativeName) || null,
    representative_title: texte(input.representativeTitle) || null,
    // Représentation par une personne morale : optionnelle, et c'est voulu.
    // La plupart des sociétés sont représentées par une personne physique.
    representative_company_name: texte(input.representativeCompanyName) || null,
    country: input.country,
    siren: sansEspaces(input.siren) || null,
  };
}
