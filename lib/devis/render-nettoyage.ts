// Générateur de devis OPTIMIVV NETTOYAGE.
//
// Contrairement au devis DÉMÉNAGEMENT (dessiné vectoriellement à partir de zéro
// avec pdfkit, cf. render.ts), le devis NETTOYAGE repart du fichier de design
// FIGÉ fourni par le client (public/devis-assets/nettoyage-template.pdf) : on le
// charge tel quel avec pdf-lib et on écrit UNIQUEMENT les données variables
// par-dessus. La mise en page (charte verte/or, hero, cartouche prestataire,
// mentions, bandeau bas) est donc pixel-perfect par construction — c'est le
// design lui-même. Une différence de mise en page serait un bug.
//
// Repères : les coordonnées ci-dessous sont relevées sur le PDF avec pdfplumber
// (origine EN HAUT, en points). pdf-lib a l'origine EN BAS → y_pdf = H - top.
// Les valeurs d'exemple encore présentes dans le gabarit (numéro, date) sont
// masquées par un rectangle blanc avant réécriture.

import { PDFDocument, rgb, type PDFFont, type PDFImage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "node:fs";
import path from "node:path";
import { ASSETS_DIR, FONTS_DIR, safe, euro } from "./layout";
import { DEFAUTS, todayFr, type Devis, type DevisInput } from "./types";

const TEMPLATE =
  process.env.DEVIS_NETTOYAGE_TEMPLATE ||
  path.join(ASSETS_DIR, "nettoyage-template.pdf");

// Octets template/polices lus UNE fois (l'aperçu régénère à chaque frappe).
const fileCache = new Map<string, Buffer>();
function fileBytes(p: string): Buffer {
  let b = fileCache.get(p);
  if (!b) {
    b = fs.readFileSync(p);
    fileCache.set(p, b);
  }
  return b;
}

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Charte relevée sur le gabarit.
const GREEN = hex("#0E3B2C"); // vert foncé (N° devis, montant, carte prestataire)
const DGREY = hex("#33413B"); // gris-vert (date, texte courant)
const VALUE = hex("#12241C"); // valeurs client
const WHITE = rgb(1, 1, 1);

// Prestataire OPTIMIVV NETTOYAGE — corrige le tél. et l'e-mail incrustés dans le
// design figé (le gabarit portait contact@optimivv.fr / 01 84 80 41 15).
const PRESTATAIRE_NETTOYAGE = {
  tel: "07 56 88 82 75",
  email: "devis@optimivv-nettoyage.com",
  site: "www.optimivv-nettoyage.com",
};

function dataUrlToImageBytes(
  dataUrl: string,
): { kind: "png" | "jpg"; bytes: Buffer } | null {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return {
      kind: m[1].toLowerCase().startsWith("jp") ? "jpg" : "png",
      bytes: Buffer.from(m[2], "base64"),
    };
  } catch {
    return null;
  }
}

export async function genererDevisNettoyageBuffer(
  donnees: DevisInput,
): Promise<Buffer> {
  const D: Devis = {
    ...DEFAUTS,
    numero: new Date().getFullYear() + "-00001",
    date_emission: todayFr(),
    ...donnees,
  } as Devis;
  const CL = D.client || ({} as Devis["client"]);

  const pdf = await PDFDocument.load(fileBytes(TEMPLATE));
  pdf.registerFontkit(fontkit);
  // subset : n'embarque que les glyphes réellement utilisés → PDF léger.
  const reg = await pdf.embedFont(
    fileBytes(path.join(FONTS_DIR, "Poppins-Regular.ttf")),
    { subset: true },
  );
  const med = await pdf.embedFont(
    fileBytes(path.join(FONTS_DIR, "Poppins-Medium.ttf")),
    { subset: true },
  );
  const bold = await pdf.embedFont(
    fileBytes(path.join(FONTS_DIR, "Poppins-Bold.ttf")),
    { subset: true },
  );
  const light = await pdf.embedFont(
    fileBytes(path.join(FONTS_DIR, "Poppins-Light.ttf")),
    { subset: true },
  );

  const page = pdf.getPage(0);
  const H = page.getHeight();

  // Rectangle blanc (masque une valeur d'exemple du gabarit). Coordonnées en
  // haut-origine (top), converties pour pdf-lib.
  const cover = (
    x0: number,
    t0: number,
    x1: number,
    t1: number,
    color: RGB = WHITE,
  ): void => {
    page.drawRectangle({
      x: x0,
      y: H - t1,
      width: x1 - x0,
      height: t1 - t0,
      color,
    });
  };

  // Écrit une valeur ; `b` = ligne de base (bottom du glyphe en haut-origine).
  // maxRight : réduit la taille pour tenir dans [x, maxRight]. align:right :
  // aligne la fin du texte sur rightX.
  const put = (
    s: string | undefined | null,
    x: number,
    b: number,
    font: PDFFont,
    size: number,
    color: RGB,
    opts: { maxRight?: number; align?: "right"; rightX?: number } = {},
  ): void => {
    const str = safe(s ?? "").trim();
    if (!str) return;
    let sz = size;
    const limit = opts.maxRight != null ? opts.maxRight - x : Infinity;
    while (sz > 4 && font.widthOfTextAtSize(str, sz) > limit) sz -= 0.3;
    const xx =
      opts.align === "right"
        ? (opts.rightX ?? x) - font.widthOfTextAtSize(str, sz)
        : x;
    page.drawText(str, { x: xx, y: H - b, size: sz, font, color });
  };

  // ---- En-tête : N° de devis + date d'émission (valeurs d'exemple masquées) --
  cover(121, 95.5, 205, 111.5);
  put(D.numero, 123.1, 110, bold, 12, GREEN);
  cover(113.5, 115.5, 158, 126.5);
  put(D.date_emission, 115, 124.8, reg, 7.4, DGREY);

  // ---- Prestataire (carte verte) : tél + e-mail (design figé corrigé) --------
  // Masque vert #0E3B2C par-dessus l'ancien texte blanc, sans toucher l'icône.
  cover(62, 236.5, 150, 248, GREEN);
  put(PRESTATAIRE_NETTOYAGE.tel, 63.7, 246.5, light, 8, WHITE, { maxRight: 199 });
  cover(62, 252, 200, 263.5, GREEN);
  put(PRESTATAIRE_NETTOYAGE.email, 63.7, 261.7, light, 8, WHITE, { maxRight: 199 });
  cover(62, 267.5, 200, 278.5, GREEN);
  put(PRESTATAIRE_NETTOYAGE.site, 63.7, 276.9, light, 8, WHITE, { maxRight: 199 });

  // ---- Pied de page : tél + site (même contact, cohérent avec la carte) ------
  cover(446, 820.5, 495, 830.5, GREEN);
  put(PRESTATAIRE_NETTOYAGE.tel, 447.4, 829.2, reg, 7.2, WHITE, { maxRight: 495 });
  cover(503, 820.5, 563, 830.5, GREEN);
  put(PRESTATAIRE_NETTOYAGE.site, 504.3, 829.2, reg, 7.2, WHITE, { maxRight: 588 });

  // ---- Cartouche CLIENT (carte de droite) -----------------------------------
  // Toutes les valeurs démarrent à la MÊME abscisse (colonne alignée, aspect
  // structuré) et sont bornées à droite AVANT la photo (hero à x≈309) pour ne
  // jamais déborder dessus — sinon les longues adresses/e-mails s'y étalent.
  const CX = 296; // départ commun (juste après le plus long label « Nom/Société : »)
  const CMAX = 460; // bord droit utile de la carte, en deçà de la photo
  const CW = CMAX - CX; // largeur utile pour le retour à la ligne

  put(CL.nom, CX, 182, med, 8.4, VALUE, { maxRight: CMAX });

  // Adresse : 3 lignes disponibles dans le gabarit → on ENVELOPPE le texte
  // (retour à la ligne) au lieu de le laisser sortir du cadre. On garantit
  // toujours l'affichage du CP/ville (adresse2, prioritaire) : la rue (adresse)
  // s'enveloppe dans les lignes restantes au-dessus, tronquée si vraiment trop
  // longue. Lignes rendues de haut en bas, sans trou.
  const addrBaselines = [197.8, 213.5, 229.2];
  const street = (CL.adresse ?? "").trim();
  const city = (CL.adresse2 ?? "").trim();
  const cityLines = city ? wrap(city, med, 8.4, CW) : [];
  const streetLines = street
    ? wrap(street, med, 8.4, CW).slice(0, addrBaselines.length - cityLines.length)
    : [];
  [...streetLines, ...cityLines]
    .slice(0, addrBaselines.length)
    .forEach((ln, i) => put(ln, CX, addrBaselines[i], med, 8.4, VALUE, { maxRight: CMAX }));

  put(CL.telephone, CX, 245, med, 8.4, VALUE, { maxRight: CMAX });
  put(CL.email, CX, 260.7, med, 8.4, VALUE, { maxRight: CMAX });

  // ---- Lieu / date prévue d'intervention ------------------------------------
  put(D.lieu_intervention, 160, 391, med, 8, VALUE, { maxRight: 305 });
  put(D.date_prevue, 460, 391, med, 8, VALUE, { maxRight: 560 });

  // ---- Description de la prestation (masque le texte d'exemple + pointillés) -
  const desc = (D.description || "").trim();
  if (desc) {
    cover(46, 468, 450, 536);
    const lines = wrap(desc, reg, 8.5, 396);
    lines.slice(0, 5).forEach((l, i) => {
      put(l, 52, 480 + i * 11.5, reg, 8.5, DGREY);
    });
  }

  // ---- Montant net HT (masque les pointillés, garde le « € HT » du gabarit) --
  if (D.montant_ht != null) {
    // Masque les pointillés (x 437.5→507.6) sans toucher le « € HT » (x 513.9).
    cover(435, 489, 513, 503);
    const m = euro(D.montant_ht).replace(/\s*€\s*$/, "");
    put(m, 0, 502.3, bold, 11, GREEN, { align: "right", rightX: 508 });
  }

  // ---- Signature en ligne (devis uniquement) --------------------------------
  const sig = D.docType !== "facture" ? D.signature : undefined;
  if (sig?.nom) put(sig.nom, 362, 718.3, med, 8.5, VALUE, { maxRight: 555 });
  if (sig?.date) put(sig.date, 360, 734.6, med, 8.5, VALUE, { maxRight: 555 });
  if (sig?.imageDataUrl) {
    const img = dataUrlToImageBytes(sig.imageDataUrl);
    if (img) {
      try {
        const embedded: PDFImage =
          img.kind === "jpg"
            ? await pdf.embedJpg(img.bytes)
            : await pdf.embedPng(img.bytes);
        // Masque la mention cursive « Bon pour accord » puis pose la signature.
        cover(452, 712, 558, 748);
        const box = { w: 146, h: 36 };
        const s = Math.min(box.w / embedded.width, box.h / embedded.height);
        const w = embedded.width * s;
        const h = embedded.height * s;
        page.drawImage(embedded, {
          x: 410 + (box.w - w) / 2,
          y: H - 748 + (box.h - h) / 2,
          width: w,
          height: h,
        });
      } catch {
        /* image invalide → on ignore, le devis reste correct */
      }
    }
  }

  pdf.setTitle(`Devis ${D.numero} - OPTIMIVV NETTOYAGE`);
  const out = await pdf.save();
  return Buffer.from(out);
}

// Découpe un texte en lignes tenant dans `largeurPt` (points), en respectant les
// retours à la ligne explicites.
function wrap(
  texte: string,
  font: PDFFont,
  size: number,
  largeurPt: number,
): string[] {
  const out: string[] = [];
  for (const para of safe(texte).replace(/\r/g, "").split("\n")) {
    const mots = para.split(/\s+/).filter(Boolean);
    if (mots.length === 0) {
      out.push("");
      continue;
    }
    let cur = "";
    for (const mot of mots) {
      const essai = cur ? cur + " " + mot : mot;
      if (font.widthOfTextAtSize(essai, size) <= largeurPt) cur = essai;
      else {
        if (cur) out.push(cur);
        cur = mot;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}
