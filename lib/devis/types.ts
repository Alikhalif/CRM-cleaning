// Contrat de données du générateur de devis OPTIMIVV.
// Porté fidèlement depuis exemple_data.json / devis_generator.py (référence figée).
// Seul `client.nom` est réellement obligatoire ; tout le reste a un repli.

export type Prestataire = {
  enseigne: string;
  raison_sociale: string;
  adresse: string;
  ville: string;
  siret: string;
  tva: string;
  telephone: string;
  email: string;
  site: string;
  /**
   * Libellé de l'identifiant légal, selon le pays de la société émettrice :
   * « SIRET » en France, « IDE » en Suisse, « BCE » en Belgique, « RCS » au
   * Luxembourg, « NEQ » au Canada. Cf. `IDENTIFIANT_LEGAL` dans lib/leads.ts.
   *
   * ABSENT = « SIRET ». C'est le défaut historique, et celui des sept
   * sociétés existantes, toutes françaises : ne pas renseigner ce champ laisse
   * le rendu stricement identique à ce qu'il était.
   */
  identifiant_label?: string;
};

export type Marque = {
  nom: string;
  activite: string;
  slogan: string;
};

export type DevisClient = {
  nom: string; // seul champ obligatoire
  adresse?: string;
  adresse2?: string; // ex. "33000 Bordeaux"
  telephone?: string;
  email?: string;
};

export type DocType = "devis" | "facture";

export type Devis = {
  docType: DocType; // "devis" (défaut) ou "facture" — même template, libellés adaptés
  // Modèle graphique du PDF, choisi selon le secteur du lead :
  //  • "demenagement" (défaut) → rendu vectoriel pdfkit (render.ts)
  //  • "nettoyage" → surcouche sur le design figé OPTIMIVV NETTOYAGE
  //    (render-nettoyage.ts). Voir generer via lib/devis/render.ts.
  template?: "demenagement" | "nettoyage";
  numero: string; // "2026-00045" (devis) / "FAC-2026-00001" (facture)
  date_emission: string; // "21/07/2026"
  validite_jours: number; // 30
  acompte_pct: number; // 30
  pagination: string; // "Page 1 / 3"
  mention_tva: string;
  client: DevisClient;
  lieu_intervention?: string;
  date_prevue?: string;
  description?: string; // texte libre, \n conservés
  montant_ht?: number | null;
  prestataire?: Partial<Prestataire>;
  marque?: Partial<Marque>;
  /**
   * L'identité du prestataire a été RÉSOLUE côté serveur depuis
   * `legal_entities`, et doit être DESSINÉE par le moteur.
   *
   * ── Pourquoi un drapeau, et pas une déduction ───────────────────
   *
   * Le gabarit nettoyage porte l'identité d'OPTIMIVV NETTOYAGE dans son
   * design. La « voie 0 » consiste à rendre sur un gabarit NEUTRALISé
   * (`nettoyage-template-neutre.pdf`, produit par
   * `scripts/gabarit-neutre/neutraliser.py`) et à écrire l'identité réelle
   * à la place.
   *
   * Basculer automatiquement dès qu'un `prestataire` est fourni changerait le
   * rendu des devis existants, qui en fournissent un sans vouloir du gabarit
   * neutre. Le drapeau rend la bascule EXPLICITE : faux ou absent, le gabarit
   * d'origine est rendu exactement comme avant.
   */
  identiteDynamique?: boolean;
  /**
   * Logo à dessiner, chemin sur disque. `null` = aucun logo.
   *
   * On n'imprime JAMAIS l'emblème d'une société sur le document d'une autre :
   * en l'absence de logo propre, la place reste vide. Les sept sociétés du CRM
   * n'en ont aucun (mesuré le 2026-11-07) — c'est donc le cas courant.
   */
  logoPath?: string | null;
  // Rempli quand le client a signé en ligne (devis uniquement) : nom + date +
  // image de la signature (data URL PNG). Dessiné dans la case « Bon pour accord ».
  signature?: {
    nom: string;
    date: string;
    imageDataUrl?: string;
  };
};

// Entrée partielle : ce que l'appelant fournit avant application des défauts.
export type DevisInput = Partial<Omit<Devis, "client">> & {
  client: DevisClient;
};

// ------------------------------------------------------------ prestataire par défaut
export const PRESTATAIRE: Prestataire = {
  enseigne: "OPTIMIVV DÉMÉNAGEMENT",
  raison_sociale: "OPTIMIVV SAS",
  adresse: "2 rue Alfred Bruneau",
  ville: "75016 Paris",
  siret: "928 083 427 00023",
  tva: "FR26928083427",
  telephone: "07 56 88 82 75",
  email: "devis@optimivv-demenagement.com",
  site: "www.optimivv-demenagement.com",
};

export const MARQUE: Marque = {
  nom: "OPTIMIVV",
  activite: "DÉMÉNAGEMENT",
  slogan: "Votre nouveau départ commence ici !",
};

export const DEFAUTS = {
  validite_jours: 30,
  acompte_pct: 30,
  pagination: "Page 1 / 3",
  mention_tva:
    "TVA non applicable, article 293 B du Code Général des Impôts (CGI).",
  client: {} as DevisClient,
};

// Date du jour au format français JJ/MM/AAAA (affichage Europe/Paris côté client).
export function todayFr(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Construit un Devis complet à partir d'une entrée partielle + un numéro alloué.
// Les défauts servent de repli ; les valeurs fournies l'emportent.
export function buildDevis(input: DevisInput, numero: string): Devis {
  return {
    ...DEFAUTS,
    ...input,
    docType: input.docType ?? "devis",
    numero,
    date_emission: input.date_emission || todayFr(),
    client: input.client,
  } as Devis;
}
