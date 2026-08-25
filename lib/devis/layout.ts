// Système de coordonnées et constantes du devis OPTIMIVV.
// Porté à l'identique de devis_generator.py — NE PAS re-designer.
// Le design a été relevé sur une maquette de 957×1490 px ; ces facteurs
// convertissent les unités "maquette" en points PDF (A4). Origine EN HAUT
// (pdfkit) : on utilise YT() directement (pas l'inversion Y() de reportlab).

import path from "node:path";

// A4 en points (reportlab.lib.pagesizes.A4 = 595.2755…×841.8897…)
export const PW = 595.275590551181;
export const PH = 841.8897637795277;

export const SX = 535.0 / 957.0; // ≈ 0.5591
export const SY = 806.0 / 1490.0; // ≈ 0.5409

export const X = (px: number): number => 30.0 + (px - 33) * SX;
export const YT = (px: number): number => 22.0 + (px - 30) * SY; // origine en HAUT
export const W = (px: number): number => px * SX; // largeur / rayon / épaisseur
export const H = (px: number): number => px * SY;
export const FS = (px: number): number => px * 0.552; // taille de police

// ------------------------------------------------------------ couleurs
export const NAVY = "#01276F";
export const NAVY_FT = "#021F7A";
export const BLUE = "#0050C7";
export const BLUE_S = "#1A62C9";
export const LIGHT_BG = "#EBF1FC";
export const NOTE_BG = "#DCE6F9";
export const BORDER = "#E2E6EF";
export const GREY_TXT = "#3A3F4B";
export const WHITE = "#FFFFFF";
export const PAGEBOX = "#004FC3";
export const LOGO_LT = "#2E7BE0";

// ------------------------------------------------------------ substitutions
// Caractères absents de Poppins → équivalents sûrs (identique au safe() Python).
const SUBST: Record<string, string> = {
  "→": "»", // → »
  "➔": "»", // ➔ »
  "⇒": "»", // ⇒ »
  "–": "-", // – -
  "—": "-", // — -
  " ": " ", // nbsp → espace
  " ": " ", // fine nbsp → espace
  "•": "•", // • •
  "‘": "'", // ‘ '
  "’": "'", // ’ '
};

// Classe de caractères précompilée (aucune valeur de SUBST n'est elle-même une
// clé → un seul passage suffit et donne un résultat identique à la boucle).
const SUBST_RE = new RegExp(
  "[" +
    Object.keys(SUBST)
      .map((k) => "\\u" + k.charCodeAt(0).toString(16).padStart(4, "0"))
      .join("") +
    "]",
  "g",
);

export function safe(s: unknown): string {
  return String(s).replace(SUBST_RE, (ch) => SUBST[ch]);
}

// "1250 -> '1 250,00 €'"  (identique à euro() Python)
export function euro(v: number): string {
  const fixed = Number(v).toFixed(2); // "2450.00"
  const [intPart, decPart] = fixed.split(".");
  const neg = intPart.startsWith("-");
  const digits = neg ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${grouped},${decPart} €`;
}

// ------------------------------------------------------------ assets
export const ASSETS_DIR =
  process.env.DEVIS_ASSETS_DIR ||
  path.join(process.cwd(), "public", "devis-assets");
export const FONTS_DIR = path.join(ASSETS_DIR, "fonts");
export const LOGO = path.join(ASSETS_DIR, "logo.png");
export const PHOTO = path.join(ASSETS_DIR, "photo.jpg");

// alias -> fichier (identique aux registerFont du Python)
export const FONT_FILES: Array<[string, string]> = [
  ["Pop", "Poppins-Regular.ttf"],
  ["PopL", "Poppins-Light.ttf"],
  ["PopM", "Poppins-Medium.ttf"],
  ["PopB", "Poppins-Bold.ttf"],
  ["Script", "Chorus.ttf"],
];
