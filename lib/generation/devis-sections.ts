// Découpage et remplacement CIBLÉ d'une section du descriptif — PUR, aucune I/O.
//
// ── POURQUOI UN MODULE DE PLUS, ET PAS UNE RÉGÉNÉRATION ─────────────
//
// Jusqu'ici la rédaction assistée ne savait remplacer que des blocs entiers :
// tout le devis, le titre, ou les réserves. Dès que le commercial voulait
// reprendre UNE section — « les sanitaires sont trop maigres » — il n'avait
// que « Régénérer le devis », qui emporte aussi les phrases qu'il avait
// écrites à la main ailleurs.
//
// Ce module travaille donc sur LE TEXTE COURANT, celui que le commercial a
// sous les yeux, et pas sur une sortie neuve du moteur. C'est la contrainte
// du §17 : « ne jamais écraser silencieusement une modification humaine ».
//
// ── L'INVARIANT, ET IL EST VÉRIFIÉ ──────────────────────────────────
//
// Hors des puces de la section visée, le texte ressort IDENTIQUE, caractère
// pour caractère : même en-têtes, même numérotation, mêmes paragraphes de
// queue (mention des produits, conditions d'accès, éléments relevés), même
// bloc RÉSERVES, mêmes lignes vides. La suite de contrôles le mesure en
// comparant les deux textes amputés de la plage remplacée.
//
// ── CE QUE CE MODULE NE DÉCIDE PAS ──────────────────────────────────
//
// Il ne choisit pas le CONTENU de la section : il reçoit des puces et les
// pose. C'est le moteur (`construireSections`) qui dit ce qu'une section peut
// contenir, et lui seul — une section nommée à la main dans le textarea
// n'autorise aucune prestation. L'action serveur refuse donc une section que
// la découverte ne valide pas, au lieu d'inventer des lignes pour elle.

/** Une section telle qu'elle apparaît DANS LE TEXTE, et non dans le moteur. */
export type SectionTexte = {
  /** Numéro affiché (« 3. Sanitaires » → 3). Jamais recalculé. */
  numero: number;
  titre: string;
  /** Index de la ligne portant « N. Titre ». */
  ligneTitre: number;
  /** Puces, tiret retiré. Vide si la section n'en a aucune. */
  puces: string[];
  /**
   * Plage des lignes de puces, bornes incluses. `null` quand la section n'a
   * aucune puce : il n'y a alors pas de plage à remplacer, seulement un point
   * d'insertion juste après le titre.
   */
  plage: { debut: number; fin: number } | null;
};

const EN_TETE_SECTION = /^(\d+)\.\s+(\S.*)$/;
const PUCE = /^-\s+(\S.*)$/;

/** Comparaison de titres : la casse, les accents et la ponctuation ne décident pas. */
export function normaliserTitre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Sections présentes dans un descriptif.
 *
 * Le corps d'une section, ce sont les puces qui suivent son en-tête, jusqu'à
 * la première ligne qui n'est ni vide ni une puce. Cette règle s'arrête
 * d'elle-même devant l'en-tête suivant ET devant les paragraphes de queue
 * (mention des produits, conditions d'accès, éléments relevés, « RÉSERVES »),
 * sans avoir à les connaître — ce qui évite d'avoir à maintenir ici une liste
 * de libellés que le moteur fait évoluer ailleurs.
 */
export function decouperSections(texte: string): SectionTexte[] {
  const lignes = (texte ?? "").split("\n");
  const out: SectionTexte[] = [];

  for (let i = 0; i < lignes.length; i++) {
    const m = EN_TETE_SECTION.exec(lignes[i]);
    if (!m) continue;

    const puces: string[] = [];
    let debut = -1;
    let fin = -1;
    for (let j = i + 1; j < lignes.length; j++) {
      const l = lignes[j];
      if (l.trim() === "") continue;
      const p = PUCE.exec(l);
      if (!p) break;
      if (debut < 0) debut = j;
      fin = j;
      puces.push(p[1].trim());
    }

    out.push({
      numero: Number(m[1]),
      titre: m[2].trim(),
      ligneTitre: i,
      puces,
      plage: debut >= 0 ? { debut, fin } : null,
    });
  }

  return out;
}

/** Titres des sections d'un descriptif, dans l'ordre d'apparition. */
export function titresDeSections(texte: string): string[] {
  return decouperSections(texte).map((s) => s.titre);
}

export type RemplacementSection =
  | { ok: true; texte: string; titre: string; avant: string[]; apres: string[] }
  | { ok: false; motif: MotifRemplacement };

export type MotifRemplacement =
  | "section_introuvable"
  | "section_ambigue"
  | "puces_vides";

export const MOTIF_REMPLACEMENT_LABEL: Record<MotifRemplacement, string> = {
  section_introuvable:
    "cette section n'existe pas dans le descriptif actuel : elle a pu être "
    + "renommée ou supprimée à la main.",
  section_ambigue:
    "deux sections portent ce titre dans le descriptif : renommez-en une, le "
    + "remplacement ne devine pas laquelle reprendre.",
  puces_vides:
    "aucune ligne à poser : une section vide serait une suppression, et une "
    + "suppression se fait à la main.",
};

/**
 * Remplace les puces d'UNE section nommée, et rien d'autre.
 *
 * Le titre, son numéro et toute la mise en page sont conservés tels quels : le
 * numéro vient du texte, jamais d'un recalcul, sinon un descriptif réordonné à
 * la main se retrouverait renuméroté sans que personne l'ait demandé.
 *
 * Une section sans aucune puce est traitée : les lignes sont insérées juste
 * après son titre, séparées par une ligne vide, comme le moteur les écrit.
 */
export function remplacerPucesSection(
  texte: string,
  titre: string,
  puces: string[],
): RemplacementSection {
  const propres = (puces ?? []).map((p) => p.trim()).filter(Boolean);
  if (propres.length === 0) return { ok: false, motif: "puces_vides" };

  const cible = normaliserTitre(titre);
  const sections = decouperSections(texte);
  const trouvees = sections.filter((s) => normaliserTitre(s.titre) === cible);
  if (trouvees.length === 0) return { ok: false, motif: "section_introuvable" };
  if (trouvees.length > 1) return { ok: false, motif: "section_ambigue" };

  const s = trouvees[0];
  const lignes = (texte ?? "").split("\n");
  const nouvelles = propres.map((p) => `- ${p}`);

  if (s.plage) {
    lignes.splice(s.plage.debut, s.plage.fin - s.plage.debut + 1, ...nouvelles);
  } else {
    // Pas de puce aujourd'hui : le moteur écrit une ligne vide entre le titre
    // et la première puce, on reproduit cette forme — sauf si elle est déjà là.
    const suivante = lignes[s.ligneTitre + 1];
    const aDejaUneLigneVide = suivante !== undefined && suivante.trim() === "";
    lignes.splice(s.ligneTitre + 1, 0, ...(aDejaUneLigneVide ? nouvelles : ["", ...nouvelles]));
  }

  return {
    ok: true,
    texte: lignes.join("\n"),
    titre: s.titre,
    avant: s.puces,
    apres: propres,
  };
}

/**
 * Puces présentes AILLEURS dans le texte — pour ne pas réintroduire un doublon.
 *
 * `construireSections` dédoublonne à l'échelle du devis qu'IL produit. Mais
 * ici le texte de référence est celui du commercial : une opération peut avoir
 * été déplacée à la main dans une autre section. On reprend donc la même
 * comparaison, contre le texte réel.
 */
export function pucesAilleurs(texte: string, titre: string): Set<string> {
  const cible = normaliserTitre(titre);
  const out = new Set<string>();
  for (const s of decouperSections(texte)) {
    if (normaliserTitre(s.titre) === cible) continue;
    for (const p of s.puces) out.add(normaliserTitre(p));
  }
  return out;
}
