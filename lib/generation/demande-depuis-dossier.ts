// Pont entre un dossier à planifier et le générateur de demande de tarif.
//
// POURQUOI CE MODULE EXISTE. `lib/generation/demande-prestataire.ts`
// (446 lignes, écrites le 2026-10-31) n'avait **aucun appelant** : le
// générateur et son double contrôle de confidentialité étaient prêts, et
// aucun écran ne pouvait les atteindre. C'est la dernière des deux pannes de
// ce genre relevées le 2026-11-04 ; celle-ci la ferme.
//
// PUR, aucune I/O — donc testable sans base, et utilisable depuis un
// composant client.
//
// ─────────────────────────────────────────────────────────────────────
//  LA RÈGLE QUE CE MODULE FAIT RESPECTER
// ─────────────────────────────────────────────────────────────────────
//
// Une demande de tarif part à PLUSIEURS prestataires, dont aucun n'est encore
// retenu. Elle ne doit donc JAMAIS porter :
//
//   • l'adresse complète du chantier — code postal et ville, rien de plus ;
//   • le nom du client final ;
//   • son téléphone, son courriel ;
//   • le prix de vente.
//
// Le type `LigneAcceptee` ne comporte délibérément aucun champ de prix : la
// règle est tenue par le typage, pas par la vigilance. Et `preparerDemande()`
// relit le texte produit en cherchant les vraies valeurs du dossier : si une
// seule ressort, elle refuse de rendre le texte.
//
// Le bon de mission, lui, porte l'adresse complète — mais il ne part qu'au
// prestataire RETENU, au moment de contractualiser. Les deux documents n'ont
// pas le même destinataire, donc pas le même contenu.

import {
  contexteRedige,
  preparerDemande,
  type Confidentiel,
  type DossierSigne,
  type Fuite,
  type LigneAcceptee,
  type DemandePrestataire,
} from "./demande-prestataire";

/**
 * Ce que le pont attend d'un dossier.
 *
 * Structural plutôt que `DossierContrat` : le type complet traîne la reprise
 * du devis, les montants et les états DocuSign, dont rien ici n'a besoin. Un
 * objet de test tient en quinze lignes.
 */
export type DossierPourDemande = {
  mission: {
    secteurSlug: string;
    adresse: string;
    codePostal: string;
    ville: string;
    surfaceM2: number | null;
    volumeDebarras: string;
    niveauDifficulte: string;
    dateSouhaitee: string;
    etage: string;
    acces: string;
    consignes: string;
  };
  client: {
    nom: string;
    prenom: string;
    societe: string;
    telephone: string;
    email: string;
    adresse: string;
    codePostal: string;
    ville: string;
  };
  /** Prestations reconnues au devis signé, dans l'ordre. */
  prestations: { label: string }[];
  /** Des photos sont-elles au dossier ? */
  photosDisponibles?: boolean;
  /** Dénomination de la société émettrice, pour signer la demande. */
  signatureEntite?: string | null;
  /** Déménagement et transport : deux localisations. */
  depart?: { codePostal: string; ville: string } | null;
  arrivee?: { codePostal: string; ville: string } | null;
};

export type ResultatDemande =
  | { ok: true; demande: DemandePrestataire }
  | { ok: false; raison: string; fuites: Fuite[] };

const t = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Valeurs confidentielles du dossier, telles que le CRM les détient.
 *
 * C'est la liste que `verifierFuites()` ira chercher dans le texte produit.
 * Plus elle est complète, plus le contrôle est strict — donc on n'en omet
 * aucune, même celles qu'aucun gabarit n'emploie.
 */
export function confidentielDe(d: DossierPourDemande): Confidentiel {
  const nomComplet = [d.client.prenom, d.client.nom].filter(Boolean).join(" ").trim();
  return {
    rue: t(d.mission.adresse) || t(d.client.adresse) || null,
    complement: t(d.mission.etage) || null,
    adresseComplete:
      [t(d.mission.adresse), t(d.mission.codePostal), t(d.mission.ville)]
        .filter(Boolean).join(" ") || null,
    nomClient: nomComplet || t(d.client.societe) || null,
    telephone: t(d.client.telephone) || null,
    email: t(d.client.email) || null,
  };
}

/** Correspondance dossier → entrée du générateur. Aucune valeur inventée. */
export function dossierSigneDe(d: DossierPourDemande): DossierSigne {
  const lignes: LigneAcceptee[] = d.prestations
    .map((p) => ({ label: t(p.label) }))
    .filter((l) => l.label.length > 0);

  // Volume : le champ de débarras porte un libellé (« 20 m³ », « 10 à 20 m³ »)
  // plutôt qu'un nombre. On n'extrait un chiffre que s'il y en a un, et on
  // n'en fabrique jamais.
  const volume = (() => {
    const m = t(d.mission.volumeDebarras).match(/(\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const n = Number(m[1].replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  return {
    sector: t(d.mission.secteurSlug),
    lignes,
    surfaceM2: d.mission.surfaceM2,
    volumeM3: volume,
    // Les contraintes techniques utiles, sans rien de nominatif ni de localisant.
    details: {
      etage: t(d.mission.etage),
      acces: t(d.mission.acces),
      consignes: t(d.mission.consignes),
    },
    etatSalete: t(d.mission.niveauDifficulte) || null,
    // ⚠️ `contexteRedige` ne laisse passer QUE code postal et ville.
    lieu: contexteRedige({
      cp: t(d.mission.codePostal) || t(d.client.codePostal),
      ville: t(d.mission.ville) || t(d.client.ville),
    }),
    depart: d.depart
      ? contexteRedige({ cp: d.depart.codePostal, ville: d.depart.ville })
      : null,
    arrivee: d.arrivee
      ? contexteRedige({ cp: d.arrivee.codePostal, ville: d.arrivee.ville })
      : null,
    photosDisponibles: Boolean(d.photosDisponibles),
    dateSouhaitee: t(d.mission.dateSouhaitee) || null,
    signatureEntite: d.signatureEntite ?? null,
  };
}

/**
 * Prépare la demande de tarif d'un dossier.
 *
 * Elle n'ENVOIE rien : elle rédige. L'envoi reste un geste de la
 * planificatrice, après relecture — comme pour le devis au client.
 *
 * Refuse de rendre un texte qui fuite, et dit laquelle des valeurs
 * confidentielles est ressortie.
 */
export function demandePourDossier(d: DossierPourDemande): ResultatDemande {
  return preparerDemande(dossierSigneDe(d), confidentielDe(d));
}
