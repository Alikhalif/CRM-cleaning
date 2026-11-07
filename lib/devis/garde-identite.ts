// Garde de finalisation : la société émettrice est-elle en état d'émettre ?
//
// ── POURQUOI TROIS CRANS, ET PAS UN REFUS BINAIRE ─────────────────────
//
// Le plan du Lot B prévoyait « identité complète, ou refus ». L'audit du
// 2026-11-06 a mesuré ce que ce refus produirait : **une société sur sept**
// porte un identifiant légal valide. CGK Services (`89421753000021`) et
// CGK Énergie (`91730541200018`) ont une clé de Luhn fausse ; quatre autres
// n'ont ni SIREN exploitable ni numéro de TVA.
//
// Poser un refus binaire aujourd'hui bloquerait donc l'émission pour six
// sociétés sur sept. Ce serait supprimer une fonctionnalité qui marche, pour
// corriger une donnée — l'inverse de ce qui est demandé.
//
// D'où trois crans, qui séparent trois natures de problème :
//
//   CRAN 1 — BLOQUANT. Ce sans quoi le document n'existe pas en droit : une
//            dénomination, une adresse de siège, un pays. Aucun réglage ne
//            lève ce cran : un devis sans émetteur identifiable n'est pas un
//            devis.
//
//   CRAN 2 — SIGNALÉ. L'identifiant légal, le numéro de TVA. Ce sont de
//            vraies anomalies, et elles sont NOMMÉES au commercial, mais
//            elles n'empêchent pas d'émettre tant que la base n'est pas
//            corrigée. Le réglage `stricte` les rend bloquantes — c'est un
//            interrupteur à actionner le jour où les sept fiches sont justes,
//            pas avant.
//
//   CRAN 3 — JOURNALISÉ. Les incohérences entre le pays de la société et le
//            gabarit ou la mention retenus. Elles ne disent pas qu'une valeur
//            manque, mais qu'un assemblage est douteux : on les écrit, on ne
//            refuse rien.
//
// ── CE QUE CE MODULE NE FAIT PAS ──────────────────────────────────────
//
// Il ne réécrit aucun contrôle légal. La validité d'un SIRET, d'un SIREN,
// d'une adresse ou d'un courriel se juge dans `lib/identite-legale.ts`, qui
// est déjà la référence pour les contrats de sous-traitance. Un deuxième
// contrôle finirait par diverger du premier, et c'est précisément ce que le
// client a interdit : « ne pas créer cinq moteurs différents ».
//
// Pur, sans I/O : testable sans base, sans session et sans réseau.

import {
  controlerAdressePostale,
  controlerEmail,
  controlerIdentifiantLegal,
  controlerTexteLegal,
  libelleAnomalie,
  premiereValeur,
  releverAnomalies,
  type Anomalie,
} from "@/lib/identite-legale";
import { COUNTRY_LABEL, type Country } from "@/lib/leads";

/** Les cinq pays servis par le CRM. */
const PAYS_CONNUS: readonly string[] = ["FR", "CH", "LU", "BE", "CA"];

/** Ligne de `legal_entities` réduite à ce qu'une émission de devis exige. */
export type EntitePourDevis = {
  id: string;
  legal_name: string | null;
  trade_name?: string | null;
  legal_form?: string | null;
  siren?: string | null;
  siret?: string | null;
  vat_number?: string | null;
  /** Adresse composée « rue, CP ville » — telle que la compose l'appelant. */
  address: string | null;
  country?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_vat_exempt?: boolean | null;
};

export type Cran = 1 | 2 | 3;

export type Grief = {
  cran: Cran;
  /** Libellé court, prêt pour une liste d'interface. */
  libelle: string;
  /** Le champ seul, pour un regroupement ou un lien de correction. */
  champ: string;
  motif: string;
};

export type VerdictIdentite = {
  /** Faux = l'émission est refusée. Seuls le cran 1, et le cran 2 en mode
   *  strict, peuvent valoir faux. */
  emissionAutorisee: boolean;
  /** Tous les griefs, crans confondus, dans l'ordre des crans. */
  griefs: Grief[];
  /** Ce qui bloque réellement, pour le message de refus. */
  bloquants: Grief[];
  /** Ce qui est signalé sans bloquer, pour l'encart d'avertissement. */
  signales: Grief[];
  /** Ce qui n'est qu'écrit au journal. */
  journalises: Grief[];
  /** Vrai si le mode strict était actif lors du contrôle. */
  stricte: boolean;
};

/** Options d'assemblage, qui ne changent jamais la nature d'un cran. */
export type OptionsGarde = {
  /**
   * Le cran 2 devient bloquant. Faux par défaut — voir l'en-tête : six
   * sociétés sur sept seraient refusées aujourd'hui.
   */
  stricte?: boolean;
  /** Gabarit retenu, pour le contrôle de cohérence du cran 3. */
  gabaritPays?: Country | null;
  /** Vrai si aucune mention de produits n'a pu être résolue pour ce pays. */
  mentionAbsente?: boolean;
};

const enGrief = (cran: Cran, a: Anomalie): Grief => ({
  cran,
  libelle: libelleAnomalie(a),
  champ: a.champ,
  motif: a.motif,
});

/**
 * Pays d'établissement, normalisé. `null` si absent ou non servi par le CRM.
 *
 * On ne retombe PAS sur la France. `controlerIdentifiantLegal` le fait, et
 * c'est juste pour lui : il doit bien choisir une règle. Ici, l'enjeu est
 * différent — un pays inconnu change la mention des produits, la
 * terminologie et le libellé de l'identifiant. Le deviner produirait un
 * document faux en silence.
 */
export function paysDeLEntite(e: EntitePourDevis): Country | null {
  const p = (e.country ?? "").trim().toUpperCase();
  return PAYS_CONNUS.includes(p) ? (p as Country) : null;
}

/**
 * Contrôle complet d'une société émettrice avant émission d'un devis.
 *
 * L'ordre des griefs est l'ordre de correction : ce qui bloque d'abord.
 */
export function controlerIdentitePourDevis(
  e: EntitePourDevis,
  options: OptionsGarde = {},
): VerdictIdentite {
  const stricte = options.stricte === true;
  const griefs: Grief[] = [];

  // ── CRAN 1 : sans cela, le document n'existe pas ────────────────────
  //
  // La dénomination et l'adresse du siège sont les deux mentions qu'un devis
  // doit porter pour identifier qui s'engage. La forme juridique n'y est PAS :
  // elle est exigée d'un contrat de sous-traitance, pas d'un devis, et
  // l'imposer ici bloquerait des fiches utilisables.
  for (const a of releverAnomalies([
    {
      champ: "dénomination sociale",
      valeur: e.legal_name,
      controle: (v) => controlerTexteLegal(v, 2),
    },
    { champ: "adresse du siège", valeur: e.address, controle: controlerAdressePostale },
  ])) {
    griefs.push(enGrief(1, a));
  }

  const pays = paysDeLEntite(e);
  if (pays === null) {
    const brut = (e.country ?? "").trim();
    griefs.push({
      cran: 1,
      champ: "pays d'établissement",
      motif: brut
        ? `« ${brut} » n'est pas un pays servi par le CRM (FR, CH, LU, BE, CA)`
        : "absent",
      libelle: brut
        ? `pays d'établissement (« ${brut} » n'est pas un pays servi par le CRM)`
        : "pays d'établissement",
    });
  }

  // ── CRAN 2 : vrai défaut, signalé, non bloquant par défaut ──────────
  const id = controlerIdentifiantLegal(e);
  if (!id.ok) {
    const libelleChamp =
      pays === "FR" || pays === null
        ? "identifiant légal (SIREN ou SIRET)"
        : "identifiant légal (SIREN, SIRET ou TVA)";
    griefs.push({
      cran: 2,
      champ: libelleChamp,
      motif: id.motif,
      libelle: premiereValeur(e.siren, e.siret, e.vat_number)
        ? `${libelleChamp} (${id.motif})`
        : libelleChamp,
    });
  }

  // Le numéro de TVA n'est exigé que d'une société qui facture la TVA. La
  // franchise en base est un régime légal, pas un oubli de saisie : exiger le
  // numéro d'une société franchisée inventerait une anomalie.
  if (e.is_vat_exempt !== true && !premiereValeur(e.vat_number)) {
    griefs.push({
      cran: 2,
      champ: "numéro de TVA intracommunautaire",
      motif: "absent, et la société n'est pas déclarée en franchise en base",
      libelle: "numéro de TVA intracommunautaire",
    });
  }

  // Les coordonnées s'impriment sur le devis : le client doit pouvoir
  // répondre. Un courriel faux est pire qu'un courriel absent — il se lit
  // comme une adresse valable.
  if (premiereValeur(e.contact_email)) {
    const v = controlerEmail(e.contact_email);
    if (!v.ok) {
      griefs.push({
        cran: 2,
        champ: "courriel de contact",
        motif: v.motif,
        libelle: `courriel de contact (${v.motif})`,
      });
    }
  } else {
    griefs.push({
      cran: 2,
      champ: "courriel de contact",
      motif: "absent",
      libelle: "courriel de contact",
    });
  }

  if (!premiereValeur(e.contact_phone)) {
    griefs.push({
      cran: 2,
      champ: "téléphone de contact",
      motif: "absent",
      libelle: "téléphone de contact",
    });
  }

  // ── CRAN 3 : incohérences d'assemblage, écrites, jamais bloquantes ──
  if (pays !== null && options.gabaritPays && options.gabaritPays !== pays) {
    griefs.push({
      cran: 3,
      champ: "cohérence pays / gabarit",
      motif: `société ${COUNTRY_LABEL[pays]}, gabarit prévu pour ${COUNTRY_LABEL[options.gabaritPays]}`,
      libelle: `cohérence pays / gabarit (société ${COUNTRY_LABEL[pays]}, gabarit ${COUNTRY_LABEL[options.gabaritPays]})`,
    });
  }
  if (options.mentionAbsente === true) {
    griefs.push({
      cran: 3,
      champ: "mention des produits",
      motif: pays
        ? `aucune formulation enregistrée pour ${COUNTRY_LABEL[pays]}`
        : "aucune formulation, le pays étant indéterminé",
      libelle: "mention des produits (aucune formulation enregistrée)",
    });
  }

  griefs.sort((a, b) => a.cran - b.cran);
  const bloquants = griefs.filter((g) => g.cran === 1 || (stricte && g.cran === 2));
  return {
    emissionAutorisee: bloquants.length === 0,
    griefs,
    bloquants,
    signales: griefs.filter((g) => g.cran === 2 && !stricte),
    journalises: griefs.filter((g) => g.cran === 3),
    stricte,
  };
}

/**
 * Message de refus, nommant les champs à corriger.
 *
 * Aucun champ n'est deviné et aucune valeur n'est proposée : le message dit
 * ce qui manque et où, il ne remplit rien.
 */
export function messageDeRefus(v: VerdictIdentite): string {
  if (v.emissionAutorisee) return "";
  const liste = v.bloquants.map((g) => g.libelle).join(" · ");
  return (
    "Émission refusée : la société émettrice ne porte pas les mentions "
    + `obligatoires du devis. À compléter dans Réglages › Sociétés — ${liste}.`
  );
}

/** Avertissement affiché au commercial quand rien ne bloque mais qu'il reste des griefs. */
export function messageDAvertissement(v: VerdictIdentite): string {
  if (v.signales.length === 0) return "";
  const liste = v.signales.map((g) => g.libelle).join(" · ");
  return `Société émettrice incomplète : ${liste}. Le devis est émis, la fiche reste à corriger.`;
}
