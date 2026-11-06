// Contrôle des identités légales — PUR, aucune I/O.
//
// ── POURQUOI CE MODULE EXISTE ────────────────────────────────────────
//
// `controlerEntite()` et le contrôle de fiche prestataire ne testaient que le
// VIDE. Or la production portait, au 2026-11-06, cinq sociétés sur sept dont
// le SIRET vaut littéralement « À renseigner » et l'adresse du siège
// « À renseigner ». Ces valeurs ne sont pas vides : elles PASSAIENT le
// contrôle.
//
// Conséquence mesurée : il suffisait de renseigner le représentant légal et sa
// qualité — les deux seuls champs réellement détectés comme manquants — pour
// que le contrat devienne émissible et sorte avec « À renseigner » comme
// identifiant du donneur d'ordre. Un contrat qui n'identifie pas ses parties
// n'est pas opposable : le défaut est juridique, pas cosmétique.
//
// Le formulaire de Réglages › Sociétés refuse DÉJÀ un SIRET mal formé
// (`validate()` dans lib/entities-shared.ts). Ce module ne le remplace pas :
// il tient la SECONDE porte, celle de l'émission, par laquelle passent les
// lignes enregistrées AVANT cette validation — et que les consignes du dépôt
// interdisent de corriger en base sans autorisation explicite.
//
// Pur et sans I/O : importable depuis un composant client comme depuis un
// module `server-only`.

import { texte } from "@/lib/entities-shared";

export type Verdict = { ok: true } | { ok: false; motif: string };

const OK: Verdict = { ok: true };
const KO = (motif: string): Verdict => ({ ok: false, motif });

// ── Détection des valeurs de remplissage ──────────────────────────────

/**
 * Forme comparable d'une valeur : minuscules, sans accents, espaces
 * normalisés, ponctuation de bordure retirée.
 *
 * « À renseigner. » et « a renseigner » doivent se reconnaître comme une même
 * valeur, sans quoi la liste des libellés serait sans fin.
 */
export function normaliser(v: unknown): string {
  return texte(v)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:!«»"'()[\]-]+|[\s.,;:!«»"'()[\]-]+$/g, "")
    .trim();
}

/**
 * Valeurs qui remplissent un champ sans rien y mettre.
 *
 * ⚠️ LA COMPARAISON PORTE SUR LA VALEUR ENTIÈRE, jamais sur une sous-chaîne.
 * Chercher « test » dans le texte rejetterait le patronyme « Testud » et
 * l'adresse « rue des Testes ». Le prix de ce choix est qu'une valeur
 * composite (« SIRET : à renseigner ») passe — mais elle est alors rattrapée
 * par le contrôle de structure, qui n'y trouve pas quatorze chiffres.
 */
const VALEURS_FICTIVES = new Set([
  // Formulations d'attente, telles qu'on les trouve en base.
  "a renseigner", "a completer", "a definir", "a preciser", "a fournir",
  "a venir", "a remplir", "a saisir", "en attente", "en cours",
  "non renseigne", "non renseignee", "non communique", "non communiquee",
  "non defini", "non definie", "non precise", "non precisee", "non disponible",
  "pas renseigne", "pas de siret", "pas d'adresse",
  // Abréviations.
  "n/a", "na", "n a", "nc", "n/c", "n c", "s/o", "so", "sans objet",
  "tbd", "todo", "to do", "fixme",
  // Négations et inconnues.
  "neant", "aucun", "aucune", "inconnu", "inconnue", "indetermine",
  "indeterminee", "vide", "sans", "nul", "nulle", "null", "undefined", "none",
  // Marqueurs de test et de gabarit.
  "test", "tests", "essai", "demo", "exemple", "example", "sample",
  "placeholder", "dummy", "fake", "lorem", "lorem ipsum", "toto", "tata",
  "azerty", "qwerty", "asdf",
  // Renvois : ils ne renseignent rien de ce champ-ci.
  "idem", "voir ci-dessus", "voir plus haut", "voir devis", "cf devis",
  "cf ci-dessus", "comme ci-dessus", "meme adresse",
]);

/** Suites d'un seul caractère répété, et chiffres nuls : « xxx », « --- », « 000 ». */
const MOTIFS_FICTIFS: RegExp[] = [
  /^(.)\1*$/u,          // un caractère répété : « x », « xxx », « ---», « ... »
  /^0+$/,               // « 0 », « 00000000000000 »
  /^\?+$/,              // « ? », « ??? »
  /^x+$/i,              // « X », « XXXXXX »
];

/**
 * La valeur remplit-elle le champ sans l'informer ?
 *
 * Une chaîne vide n'est PAS fictive : elle est absente. Les deux cas méritent
 * un message différent, donc ils restent distincts.
 */
export function estValeurFictive(v: unknown): boolean {
  if (texte(v) === "") return false;
  const n = normaliser(v);
  // Valeur faite UNIQUEMENT de ponctuation — « --- », « ... », « ___ », « / ».
  // Elle n'est pas vide, donc elle passait les contrôles de présence ; mais
  // elle normalise sur la chaîne vide, donc elle n'informe rien. Sans ce cas,
  // elle finissait refusée pour « trop court », ce qui désigne mal le défaut.
  if (n === "") return true;
  if (VALEURS_FICTIVES.has(n)) return true;
  return MOTIFS_FICTIFS.some((re) => re.test(n));
}

// ── Clé de contrôle de Luhn ───────────────────────────────────────────

/**
 * Clé de Luhn — celle que portent SIREN et SIRET.
 *
 * ⚠️ LIMITE CONNUE ET ASSUMÉE : les établissements de La Poste
 * (SIREN 356000000) échappent à cette règle — leurs SIRET se valident sur une
 * somme divisible par 5. Aucune exception n'est codée ici : les donneurs
 * d'ordre de ce CRM sont les sociétés du client, et inventer un chemin pour un
 * cas qui ne peut pas se présenter coûterait plus qu'il ne protège. Si La
 * Poste devenait un jour sous-traitant, son SIRET serait refusé à tort — et
 * c'est ce commentaire qui dira pourquoi.
 */
export function luhnValide(chiffres: string): boolean {
  if (!/^\d+$/.test(chiffres)) return false;
  let total = 0;
  for (let i = chiffres.length - 1, rang = 0; i >= 0; i--, rang++) {
    let d = chiffres.charCodeAt(i) - 48;
    if (rang % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
  }
  return total % 10 === 0;
}

/** Retire tout ce qui n'est pas un chiffre : espaces, points, tirets, insécables. */
const chiffresSeuls = (v: unknown): string => texte(v).replace(/[^\d]/g, "");

// ── SIRET et SIREN ────────────────────────────────────────────────────

export function controlerSiret(v: unknown): Verdict {
  const brut = texte(v);
  if (!brut) return KO("absent");
  if (estValeurFictive(brut)) return KO(`valeur de remplissage « ${brut} »`);

  const n = chiffresSeuls(brut);
  if (n === "") return KO(`aucun chiffre dans « ${brut} »`);
  if (n.length === 9) {
    return KO("9 chiffres fournis : c'est un SIREN, le SIRET en compte 14");
  }
  if (n.length !== 14) {
    return KO(`${n.length} chiffre${n.length > 1 ? "s" : ""} au lieu de 14`);
  }
  if (!luhnValide(n)) return KO("clé de contrôle invalide (14 chiffres, mais la clé ne tombe pas juste)");
  return OK;
}

export function controlerSiren(v: unknown): Verdict {
  const brut = texte(v);
  if (!brut) return KO("absent");
  if (estValeurFictive(brut)) return KO(`valeur de remplissage « ${brut} »`);

  const n = chiffresSeuls(brut);
  if (n === "") return KO(`aucun chiffre dans « ${brut} »`);
  if (n.length === 14) {
    return KO("14 chiffres fournis : c'est un SIRET, le SIREN en compte 9");
  }
  if (n.length !== 9) {
    return KO(`${n.length} chiffre${n.length > 1 ? "s" : ""} au lieu de 9`);
  }
  if (!luhnValide(n)) return KO("clé de contrôle invalide (9 chiffres, mais la clé ne tombe pas juste)");
  return OK;
}

/** Première valeur réellement renseignée d'une liste. `""` n'en est pas une. */
export function premiereValeur(...vs: unknown[]): string {
  for (const v of vs) {
    const t = texte(v);
    if (t) return t;
  }
  return "";
}

/**
 * Identifiant légal d'une société, selon son pays d'établissement.
 *
 * La France est la seule où la structure est vérifiable ici : le SIRET à
 * quatorze chiffres et le SIREN à neuf portent une clé de Luhn. Pour les
 * quatre autres pays du CRM (CH, LU, BE, CA), les formats diffèrent et ne sont
 * pas figés dans le dépôt : on exige une valeur réelle — ni vide, ni fictive —
 * sans prétendre la valider. Annoncer une validation qu'on ne fait pas serait
 * pire que de ne rien annoncer.
 *
 * Un pays absent est traité comme la France : c'est le pays d'exploitation du
 * CRM, et les sept sociétés existantes y sont toutes établies. Le formulaire
 * exige désormais le pays (`validate()`), donc seules des lignes antérieures
 * peuvent en être dépourvues.
 */
export function controlerIdentifiantLegal(e: {
  siren?: string | null;
  siret?: string | null;
  vat_number?: string | null;
  country?: string | null;
}): Verdict {
  const pays = texte(e.country).toUpperCase() || "FR";

  if (pays === "FR") {
    const siren = texte(e.siren);
    const siret = texte(e.siret);
    if (!siren && !siret) {
      const tva = texte(e.vat_number);
      if (tva) {
        return KO(
          "seul un numéro de TVA est renseigné : une société française doit porter "
          + "son SIREN ou son SIRET sur le contrat",
        );
      }
      return KO("absent (SIREN à 9 chiffres ou SIRET à 14 attendu)");
    }
    // L'un des deux suffit, mais celui qui est renseigné doit être juste. Un
    // SIRET faux à côté d'un SIREN juste resterait imprimé sur le contrat.
    if (siren) {
      const v = controlerSiren(siren);
      if (!v.ok) return KO(`SIREN : ${v.motif}`);
    }
    if (siret) {
      const v = controlerSiret(siret);
      if (!v.ok) return KO(`SIRET : ${v.motif}`);
    }
    return OK;
  }

  const id = premiereValeur(e.siren, e.siret, e.vat_number);
  if (!id) return KO("absent");
  if (estValeurFictive(id)) return KO(`valeur de remplissage « ${id} »`);
  if (normaliser(id).replace(/[^a-z0-9]/g, "").length < 4) {
    return KO(`« ${id} » est trop court pour un identifiant légal`);
  }
  return OK;
}

// ── Identité d'une personne, adresse, courriel ────────────────────────

/**
 * Nom d'une personne physique — représentant légal, dirigeant.
 *
 * Trois exigences seulement : une valeur, non fictive, et assez de lettres
 * pour être un nom. On n'impose NI prénom + nom, NI majuscule, NI jeu de
 * caractères : les mononymes existent, et un contrat refusé pour une règle
 * typographique serait un faux positif payé par la planificatrice.
 */
export function controlerNomPersonne(v: unknown): Verdict {
  const brut = texte(v);
  if (!brut) return KO("absent");
  if (estValeurFictive(brut)) return KO(`valeur de remplissage « ${brut} »`);
  // ⚠️ L'ORDRE COMPTE. Testé après la longueur, ce cas n'était jamais atteint :
  // « 123456 » n'a aucune lettre, donc il tombait sur « trop court », ce qui
  // envoie allonger un champ au lieu d'y mettre un nom.
  const lettres = normaliser(brut).replace(/[^a-z]/g, "");
  if (lettres.length === 0) return KO(`« ${brut} » ne contient aucune lettre`);
  if (lettres.length < 3) return KO(`« ${brut} » est trop court pour un nom`);
  return OK;
}

/**
 * Adresse postale, telle qu'elle s'imprimera dans l'en-tête du contrat.
 *
 * L'adresse arrive aplatie — « 2 rue Alfred Bruneau, 75016, Paris ». Chaque
 * segment est contrôlé séparément : « À renseigner, 75016, Paris » ne doit pas
 * passer sous prétexte que l'ensemble n'est pas, mot pour mot, une valeur de
 * remplissage.
 *
 * On n'exige PAS de numéro de rue : « Place de l'Église » est une adresse
 * valide, et des milliers de sièges sociaux n'ont pas de numéro.
 */
export function controlerAdressePostale(v: unknown): Verdict {
  const brut = texte(v);
  if (!brut) return KO("absente");
  if (estValeurFictive(brut)) return KO(`valeur de remplissage « ${brut} »`);

  const segments = brut.split(",").map((s) => s.trim()).filter(Boolean);
  const fictif = segments.find((s) => estValeurFictive(s));
  if (fictif) return KO(`valeur de remplissage « ${fictif} » dans l'adresse`);

  const lettres = normaliser(brut).replace(/[^a-z]/g, "");
  if (lettres.length < 4) return KO(`« ${brut} » est trop court pour une adresse`);
  return OK;
}

/**
 * Courriel — structure seulement.
 *
 * Aucune vérification d'existence : elle demanderait un appel réseau, et ce
 * module est pur. Le refus d'envoi réel reste du ressort de DocuSign et de
 * Brevo, qui rapportent une adresse injoignable.
 */
export function controlerEmail(v: unknown): Verdict {
  const brut = texte(v);
  if (!brut) return KO("absent");
  if (estValeurFictive(brut)) return KO(`valeur de remplissage « ${brut} »`);
  if (/\s/.test(brut)) return KO(`« ${brut} » contient un espace`);
  if (!/^[^@]+@[^@]+$/.test(brut)) return KO(`« ${brut} » n'a pas la forme d'une adresse`);
  const [locale, domaine] = brut.split("@");
  if (!locale) return KO("rien avant l'arobase");
  if (!/^[^.]+(\.[^.]+)*$/.test(domaine) || !domaine.includes(".")) {
    return KO(`domaine « ${domaine} » incomplet`);
  }
  if (!/\.[a-z]{2,}$/i.test(domaine)) return KO(`extension de domaine absente dans « ${domaine} »`);
  return OK;
}

/**
 * Champ texte dont le contrat a besoin, sans structure imposée :
 * dénomination sociale, forme juridique, qualité du représentant.
 */
export function controlerTexteLegal(v: unknown, longueurMin = 2): Verdict {
  const brut = texte(v);
  if (!brut) return KO("absent");
  if (estValeurFictive(brut)) return KO(`valeur de remplissage « ${brut} »`);
  if (normaliser(brut).replace(/[^a-z0-9]/g, "").length < longueurMin) {
    return KO(`« ${brut} » est trop court`);
  }
  return OK;
}

// ── Assemblage d'un verdict lisible ───────────────────────────────────

/** Un champ contrôlé, et ce qui lui manque. */
export type Anomalie = {
  /** Libellé du champ, tel qu'il s'affiche à l'écran. */
  champ: string;
  /** Ce qui cloche, en clair. */
  motif: string;
  /** Vrai = le champ est vide. Faux = il porte une valeur inexploitable. */
  absent: boolean;
};

/**
 * Applique une liste de contrôles et retourne les anomalies.
 *
 * L'ordre de la liste est l'ordre d'affichage : il suit celui du bloc
 * « ENTRE LES SOUSSIGNÉS » du contrat, pour que la planificatrice corrige dans
 * l'ordre où elle lit.
 */
export function releverAnomalies(
  controles: { champ: string; valeur: unknown; controle: (v: unknown) => Verdict }[],
): Anomalie[] {
  const out: Anomalie[] = [];
  for (const c of controles) {
    const v = c.controle(c.valeur);
    if (!v.ok) out.push({ champ: c.champ, motif: v.motif, absent: !texte(c.valeur) });
  }
  return out;
}

/**
 * Libellé court d'une anomalie, pour les listes de l'interface.
 *
 * Un champ vide se dit par son seul nom — « SIRET » — parce que « SIRET :
 * absent » est redondant dans une phrase qui commence déjà par « à compléter ».
 * Un champ renseigné mais faux doit en revanche DIRE pourquoi, sinon la
 * planificatrice le relit, le trouve rempli, et conclut à une panne.
 */
export function libelleAnomalie(a: Anomalie): string {
  return a.absent ? a.champ : `${a.champ} (${a.motif})`;
}
