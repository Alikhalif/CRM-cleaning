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
import {
  RENVOI_PAGE_SUITE, estIntertitre, paginer, repartirDescriptif,
} from "./debordement";

const TEMPLATE =
  process.env.DEVIS_NETTOYAGE_TEMPLATE ||
  path.join(ASSETS_DIR, "nettoyage-template.pdf");

/**
 * Gabarit NEUTRALISé — la « voie 0 » du Lot B.
 *
 * Même design, débarrassé de l'identité d'OPTIMIVV : dénomination, adresse,
 * identifiant légal, téléphone, site, slogan et emblème. Produit hors ligne
 * par `scripts/gabarit-neutre/neutraliser.py`, qui RETIRE le texte du flux de
 * contenu au lieu de le masquer.
 *
 * ⚠️ La différence n'est pas cosmétique. Un rectangle blanc cache le texte à
 * l'œil mais le laisse dans la couche texte : un devis émis au nom d'une
 * société suisse contiendrait encore, en copier-coller et en recherche plein
 * texte, « OPTIMIVV SAS » et son SIRET. Sur un document contractuel, c'est
 * une fausse mention d'identité.
 */
const TEMPLATE_NEUTRE =
  process.env.DEVIS_NETTOYAGE_TEMPLATE_NEUTRE ||
  path.join(ASSETS_DIR, "nettoyage-template-neutre.pdf");

/**
 * Identité relevée sur le gabarit d'origine : abscisse, LIGNE DE BASE, police,
 * taille et couleur de chaque élément retiré.
 *
 * Les lignes de base viennent des opérateurs `Tm` du flux, pas de la boîte
 * mesurée par pdfplumber — l'écart entre les deux vaut la descente de la
 * police, environ 2,8 pt à ces tailles. Redessiner à la ligne de base
 * d'origine est ce qui rend la voie 0 fidèle.
 */
const ID = {
  marque: { x: 86.5, b: 42.2, taille: 18, maxRight: 300 },
  slogan: { x: 86.5, b: 58.8, taille: 12, maxRight: 300 },
  denomination: { x: 46.8, b: 182.3, taille: 10, maxRight: 196 },
  adresse: { x: 46.8, b: 197.7, taille: 8.2, maxRight: 196 },
  ville: { x: 46.8, b: 208.7, taille: 8.2, maxRight: 196 },
  identifiant: { x: 46.8, b: 225.2, taille: 7.8, maxRight: 196 },
  tel: { x: 63.7, b: 243.7, taille: 8, maxRight: 196 },
  email: { x: 63.7, b: 258.9, taille: 8, maxRight: 196 },
  site: { x: 63.7, b: 274.1, taille: 8, maxRight: 196 },
  piedIdentite: { x: 63.8, b: 821.7, taille: 8, maxRight: 430 },
  piedContact: { x: 447.4, b: 826.7, taille: 7.2, maxRight: 588 },
  logoEntete: { x: 34, top: 21.3, w: 42.5, h: 50.2 },
  logoPied: { x: 34, top: 812.3, w: 20.2, h: 23.8 },
} as const;

/**
 * Valeurs CONTRACTUELLES que le gabarit porte en dur, et leurs repères.
 *
 * ⚠️ Le gabarit imprime « Validité de l'offre : 30 jours », « Acompte à la
 * commande : 30 % » et la mention de TVA de l'article 293 B. Le moteur porte
 * pourtant `validite_jours`, `acompte_pct` et `mention_tva` — et ne les
 * dessinait nulle part. Un devis de nettoyage, dont l'acompte par défaut est
 * à 20 %, imprimait donc 30 %.
 *
 * `cuit` est ce que le fichier porte. On ne recouvre que si la valeur réelle
 * en diffère : quand elles coïncident, le rendu reste identique à l'octet.
 */
const CUIT = {
  /** Numéro et date : lignes de base d'origine, pour le gabarit neutre. */
  numero: { x: 123.1, b: 105.8, taille: 12 },
  dateEmission: { x: 50.4, b: 122.2, taille: 7.4 },
  validite: {
    jours: 30,
    x: 193.0, b: 122.2, taille: 7.4,
    boite: [191, 113, 295, 127] as const,
  },
  acompte: {
    pct: 30,
    x: 335.3, b: 603.1, taille: 7.2,
    boite: [333, 594, 470, 608] as const,
  },
  tva: {
    texte: "TVA non applicable, article 293 B du Code Général des Impôts (CGI).",
    x: 34.0, b: 555.0, taille: 6.8,
    boite: [32, 546, 300, 560] as const,
  },
} as const;

/** Gris-vert du texte courant du gabarit. */
const TEXTE_COURANT = hex("#33413B");
/** Gris plus clair de la mention de TVA. */
const TEXTE_MENTION = hex("#5B665F");

/** Vert de la charte, pour le texte de l'en-tête. */
const VERT_TITRE = hex("#0E3B2C");
/** Or de la charte, pour le slogan. */
const OR = hex("#BE8A4B");

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

  // Voie 0 : l'identité a été résolue côté serveur, on part du gabarit neutre.
  // Faux ou absent → gabarit d'origine, rendu exactement comme avant.
  const identiteDynamique = D.identiteDynamique === true;
  const P = D.prestataire ?? {};
  const MQ = D.marque ?? {};
  const pdf = await PDFDocument.load(
    fileBytes(identiteDynamique ? TEMPLATE_NEUTRE : TEMPLATE),
  );
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
  // Cursive du slogan. Embarquée même sans slogan : `subset` n'embarque que
  // les glyphes employés, donc le coût est nul quand la ligne est vide.
  const chorus = await pdf.embedFont(
    fileBytes(path.join(FONTS_DIR, "Chorus.ttf")),
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

  // ---- En-tête : N° de devis + date d'émission -----------------------------
  if (identiteDynamique) {
    // Le gabarit neutre ne porte AUCUNE valeur d'exemple : rien à masquer,
    // et le texte s'écrit sur la ligne de base d'origine.
    put(D.numero, CUIT.numero.x, CUIT.numero.b, bold, CUIT.numero.taille, GREEN,
      { maxRight: 290 });
    // Libellé et valeur formaient un seul opérateur de texte dans le gabarit :
    // ils sont indissociables, donc la ligne entière est redessinée.
    put(`Date d'émission : ${safe(D.date_emission ?? "")}`, CUIT.dateEmission.x,
      CUIT.dateEmission.b, reg, CUIT.dateEmission.taille, DGREY, { maxRight: 188 });
  } else {
    // Gabarit d'origine : les valeurs d'exemple sont là, on les masque.
    cover(121, 95.5, 205, 111.5);
    put(D.numero, 123.1, 110, bold, 12, GREEN);
    cover(113.5, 115.5, 158, 126.5);
    put(D.date_emission, 115, 124.8, reg, 7.4, DGREY);
  }

  if (identiteDynamique) {
    // ---- VOIE 0 : l'identité réelle, dessinée sur le gabarit neutre --------
    //
    // Aucun repli sur OPTIMIVV : un champ vide reste vide. Afficher la valeur
    // par défaut à la place d'un champ manquant produirait un devis au nom de
    // la mauvaise société — précisément ce que la voie 0 existe pour empêcher.
    const enseigne = safe(MQ.nom || P.enseigne || "").trim();
    const activite = safe(MQ.activite || "").trim();
    const titre = [enseigne, activite].filter(Boolean).join(" ");
    put(titre, ID.marque.x, ID.marque.b, bold, ID.marque.taille, VERT_TITRE, {
      maxRight: ID.marque.maxRight,
    });
    // Le slogan n'existe sur aucune fiche société : la ligne reste vide plutôt
    // que de porter celui d'une autre marque.
    put(MQ.slogan, ID.slogan.x, ID.slogan.b, chorus, ID.slogan.taille, OR, {
      maxRight: ID.slogan.maxRight,
    });

    put(P.raison_sociale, ID.denomination.x, ID.denomination.b, bold,
      ID.denomination.taille, WHITE, { maxRight: ID.denomination.maxRight });
    put(P.adresse, ID.adresse.x, ID.adresse.b, light, ID.adresse.taille, WHITE,
      { maxRight: ID.adresse.maxRight });
    put(P.ville, ID.ville.x, ID.ville.b, light, ID.ville.taille, WHITE,
      { maxRight: ID.ville.maxRight });

    // Le LIBELLÉ de l'identifiant part avec sa valeur : « SIRET » est
    // français. Une société suisse porte un IDE, une belge un numéro BCE.
    const idValeur = safe(P.siret ?? "").trim();
    if (idValeur) {
      const libelle = `${safe(P.identifiant_label || "SIRET")} :`;
      put(libelle, ID.identifiant.x, ID.identifiant.b, bold, ID.identifiant.taille,
        WHITE);
      const l = bold.widthOfTextAtSize(libelle, ID.identifiant.taille);
      put(idValeur, ID.identifiant.x + l + 2.1, ID.identifiant.b, light,
        ID.identifiant.taille, WHITE, { maxRight: ID.identifiant.maxRight });
    }

    put(P.telephone, ID.tel.x, ID.tel.b, light, ID.tel.taille, WHITE,
      { maxRight: ID.tel.maxRight });
    put(P.email, ID.email.x, ID.email.b, light, ID.email.taille, WHITE,
      { maxRight: ID.email.maxRight });
    put(P.site, ID.site.x, ID.site.b, light, ID.site.taille, WHITE,
      { maxRight: ID.site.maxRight });

    // ---- Pied de page : la ligne d'identité et le contact ----------------
    const piedId = [
      safe(P.raison_sociale ?? "").trim(),
      [safe(P.adresse ?? "").trim(), safe(P.ville ?? "").trim()].filter(Boolean).join(", "),
      idValeur ? `${safe(P.identifiant_label || "SIRET")} : ${idValeur}` : "",
    ].filter(Boolean).join("  •  ");
    put(piedId, ID.piedIdentite.x, ID.piedIdentite.b, light, ID.piedIdentite.taille,
      WHITE, { maxRight: ID.piedIdentite.maxRight });
    const piedContact = [safe(P.telephone ?? "").trim(), safe(P.site ?? "").trim()]
      .filter(Boolean).join("  •  ");
    put(piedContact, ID.piedContact.x, ID.piedContact.b, reg, ID.piedContact.taille,
      WHITE, { maxRight: ID.piedContact.maxRight });

    // ---- Emblème, si et seulement si la société en a un --------------
    if (D.logoPath) await poserLogo(pdf, page, H, D.logoPath);
  } else {
    // ---- Gabarit d'origine : correctif de contact, inchangé depuis 2026-08
    // Masque vert #0E3B2C par-dessus l'ancien texte blanc, sans toucher l'icône.
    cover(62, 236.5, 150, 248, GREEN);
    put(PRESTATAIRE_NETTOYAGE.tel, 63.7, 246.5, light, 8, WHITE, { maxRight: 199 });
    cover(62, 252, 200, 263.5, GREEN);
    put(PRESTATAIRE_NETTOYAGE.email, 63.7, 261.7, light, 8, WHITE, { maxRight: 199 });
    cover(62, 267.5, 200, 278.5, GREEN);
    put(PRESTATAIRE_NETTOYAGE.site, 63.7, 276.9, light, 8, WHITE, { maxRight: 199 });

    cover(446, 820.5, 495, 830.5, GREEN);
    put(PRESTATAIRE_NETTOYAGE.tel, 447.4, 829.2, reg, 7.2, WHITE, { maxRight: 495 });
    cover(503, 820.5, 563, 830.5, GREEN);
    put(PRESTATAIRE_NETTOYAGE.site, 504.3, 829.2, reg, 7.2, WHITE, { maxRight: 588 });
  }

  // ---- Cartouche CLIENT (carte de droite) -----------------------------------
  // Valeurs à leur place naturelle (juste après chaque label), MAIS bornées au
  // bord droit utile de la carte (avant la photo hero à x≈309) pour qu'aucune
  // donnée ne sorte du cadre.
  const CMAX = 460;
  put(CL.nom, 292, 183.5, med, 8.6, VALUE, { maxRight: CMAX });

  // Adresse : 3 lignes dispo dans le gabarit → RETOUR À LA LIGNE (wrap au mot)
  // au lieu de déborder. Rue (adresse) + CP/ville (adresse2) forment un bloc
  // aligné à la même abscisse. Le CP/ville est toujours affiché (prioritaire) :
  // la rue s'enveloppe dans les lignes du dessus, tronquée si vraiment trop long.
  const ADX = 268; // départ du bloc adresse (juste après « Adresse : »)
  const addrBaselines = [199.3, 215, 230.7];
  const aw = CMAX - ADX; // largeur utile pour le wrap
  const street = (CL.adresse ?? "").trim();
  const city = (CL.adresse2 ?? "").trim();
  const cityLines = city ? wrap(city, med, 8.6, aw) : [];
  const streetLines = street
    ? wrap(street, med, 8.6, aw).slice(0, addrBaselines.length - cityLines.length)
    : [];
  [...streetLines, ...cityLines]
    .slice(0, addrBaselines.length)
    .forEach((ln, i) => put(ln, ADX, addrBaselines[i], med, 8.6, VALUE, { maxRight: CMAX }));

  put(CL.telephone, 278, 246.5, med, 8.6, VALUE, { maxRight: CMAX });
  put(CL.email, 258, 262.2, med, 8.6, VALUE, { maxRight: CMAX });

  // ---- Lieu / date prévue d'intervention ------------------------------------
  put(D.lieu_intervention, 160, 391, med, 8, VALUE, { maxRight: 305 });
  put(D.date_prevue, 460, 391, med, 8, VALUE, { maxRight: 560 });

  // ---- Description de la prestation (masque le texte d'exemple + pointillés) -
  //
  // ⚠️ L'ENCADRÉ NE TIENT QUE CINQ LIGNES. Avant le Lot B, cet écran recevait
  // quelques phrases recopiées de la découverte, et cinq lignes suffisaient.
  // Depuis l'harmonisation, c'est le MOTEUR qui rédige : PRESTATION, DÉTAIL,
  // RÉSERVES — quarante à soixante lignes. Les suivantes partaient à la
  // poubelle EN SILENCE, dont **toutes les réserves**.
  //
  // L'encadré garde sa taille : la charte n'est pas touchée. Ce qui déborde
  // part sur des pages de suite.
  const desc = (D.description || "").trim();
  let lignesEnTrop: string[] = [];
  if (desc) {
    cover(46, 468, 450, 536);
    const lines = wrap(desc, reg, 8.5, 396);
    // La décision est PARTAGÉE avec le gabarit déménagement et éprouvée à
    // part : elle décide si les réserves atteignent le client.
    const r = repartirDescriptif(lines, 5);
    r.encadre.forEach((l, i) => put(l, 52, 480 + i * 11.5, reg, 8.5, DGREY));
    if (r.deborde) {
      // Le renvoi occupe la dernière ligne : sans lui, l'encadré se lit comme
      // le devis entier.
      put(RENVOI_PAGE_SUITE, 52, 480 + r.encadre.length * 11.5, med, 8.5, GREEN,
        { maxRight: 440 });
      lignesEnTrop = lines;
    }
  }

  // ---- Montant net HT (masque les pointillés, garde le « € HT » du gabarit) --
  if (D.montant_ht != null) {
    // Masque les pointillés (x 437.5→507.6) sans toucher le « € HT » (x 513.9).
    cover(435, 489, 513, 503);
    const m = euro(D.montant_ht).replace(/\s*€\s*$/, "");
    put(m, 0, 502.3, bold, 11, GREEN, { align: "right", rightX: 508 });
  }

  // ---- Valeurs contractuelles : corrigées SEULEMENT si elles diffèrent ----
  //
  // Ce bloc s'applique aux DEUX chemins — gabarit d'origine comme voie 0 —
  // parce que le défaut est celui du gabarit, pas celui de la voie 0.
  //
  // Sur le gabarit NEUTRE, ces trois valeurs ont été retirées du fichier : le
  // moteur les écrit donc toujours. Sur le gabarit d'ORIGINE, elles y sont
  // encore, et on ne les recouvre que si la valeur réelle en diffère — sans
  // quoi le rendu changerait pour rien.
  const jours = Number(D.validite_jours);
  if (Number.isFinite(jours) && jours > 0
      && (identiteDynamique || jours !== CUIT.validite.jours)) {
    if (!identiteDynamique) cover(...CUIT.validite.boite);
    put(`Validité de l'offre : ${jours} jours`, CUIT.validite.x, CUIT.validite.b,
      reg, CUIT.validite.taille, TEXTE_COURANT, { maxRight: 295 });
  }

  const pct = Number(D.acompte_pct);
  if (Number.isFinite(pct) && (identiteDynamique || pct !== CUIT.acompte.pct)) {
    if (!identiteDynamique) cover(...CUIT.acompte.boite);
    // Un acompte à zéro n'est pas « 0 % » : c'est l'absence d'acompte, et le
    // dire ainsi évite qu'un client cherche un versement qu'on ne lui demande pas.
    const phrase = pct <= 0
      ? "• Aucun acompte à la commande"
      : `• Acompte à la commande : ${pct} %`;
    put(phrase, CUIT.acompte.x, CUIT.acompte.b, light, CUIT.acompte.taille,
      TEXTE_COURANT, { maxRight: 470 });
  }

  const mention = safe(D.mention_tva ?? "").trim();
  if (identiteDynamique || mention !== CUIT.tva.texte) {
    if (!identiteDynamique) cover(...CUIT.tva.boite);
    // Une mention vide se traduit par un BLANC, pas par la mention française :
    // une société assujettie ne doit pas porter l'article 293 B, et une
    // société suisse encore moins.
    if (mention) {
      put(mention, CUIT.tva.x, CUIT.tva.b, light, CUIT.tva.taille, TEXTE_MENTION,
        { maxRight: 300 });
    }
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

  // ---- Pages de suite : le descriptif COMPLET ------------------------------
  if (lignesEnTrop.length > 0) {
    await poserPagesDeSuite(pdf, {
      reg, med, bold,
      numero: D.numero,
      societe: [
        safe(P.raison_sociale ?? "").trim(),
        safe(P.adresse ?? "").trim(),
        safe(P.ville ?? "").trim(),
      ].filter(Boolean).join(" · "),
      texte: desc,
    });
  }

  // Les métadonnées du PDF portent aussi une identité : elles s'affichent dans
  // l'onglet du navigateur et dans les propriétés du fichier.
  const marqueTitre = safe(MQ.nom || P.enseigne || "OPTIMIVV NETTOYAGE").trim();
  pdf.setTitle(`Devis ${D.numero} - ${marqueTitre}`);
  if (P.raison_sociale) pdf.setAuthor(safe(P.raison_sociale));
  const out = await pdf.save();
  return Buffer.from(out);
}

/**
 * Pose le descriptif complet sur des pages de suite.
 *
 * ── Pourquoi des pages NEUTRES, et pas une copie du gabarit ─────────
 *
 * Le gabarit est une mise en page de PREMIÈRE page : hero, cartouches,
 * cases de signature. Le répéter produirait trois fois la case « Bon pour
 * accord », donc trois endroits où signer. Les pages de suite portent donc
 * le strict nécessaire — le numéro, le titre, le texte, l'identité et la
 * pagination.
 *
 * Le texte est repris DEPUIS LE DÉBUT : un lecteur qui tourne la page doit
 * trouver le descriptif entier, pas sa fin. Les quatre lignes de l'encadré
 * sont un aperçu, la page 2 est le document.
 */
async function poserPagesDeSuite(
  pdf: PDFDocument,
  o: {
    reg: PDFFont; med: PDFFont; bold: PDFFont;
    numero: string; societe: string; texte: string;
  },
): Promise<void> {
  const L = 595.28;
  const H = 841.89;
  const MARGE = 52;
  const LARGEUR = L - MARGE * 2;
  const TAILLE = 9;
  const INTERLIGNE = 13.2;
  const HAUT = 92;      // première ligne de texte
  const BAS = 92;       // marge basse, pied compris

  const lignes = wrap(o.texte, o.reg, TAILLE, LARGEUR);
  const parPage = Math.max(1, Math.floor((H - HAUT - BAS) / INTERLIGNE));
  const feuillets = paginer(lignes, parPage);
  const pages = feuillets.length;

  for (let p = 0; p < pages; p++) {
    const page = pdf.addPage([L, H]);
    const ecrire = (
      t: string, x: number, bas: number, f: PDFFont, taille: number, c: RGB,
    ) => {
      const str = safe(t).trim();
      if (str) page.drawText(str, { x, y: H - bas, size: taille, font: f, color: c });
    };

    // En-tête : un filet vert, le numéro, le titre.
    page.drawRectangle({ x: 0, y: H - 6, width: L, height: 6, color: GREEN });
    ecrire(`DEVIS N° ${o.numero}`, MARGE, 46, o.bold, 11, GREEN);
    ecrire("DESCRIPTIF DÉTAILLÉ DE LA PRESTATION", MARGE, 64, o.med, 9, DGREY);
    page.drawRectangle({
      x: MARGE, y: H - 74, width: LARGEUR, height: 0.8, color: DGREY,
    });

    for (const [i, ligne] of (feuillets[p] ?? []).entries()) {
      const titre = estIntertitre(ligne);
      ecrire(ligne, MARGE, HAUT + i * INTERLIGNE, titre ? o.med : o.reg,
        TAILLE, titre ? GREEN : DGREY);
    }

    // Pied : identité de la société émettrice et pagination. Une page de
    // suite détachée du devis doit rester rattachable à son émetteur.
    page.drawRectangle({
      x: MARGE, y: 58, width: LARGEUR, height: 0.6, color: DGREY,
    });
    ecrire(o.societe, MARGE, H - 44, o.reg, 7, DGREY);
    const pagination = `Page ${p + 2} / ${pages + 1}`;
    const w = o.reg.widthOfTextAtSize(pagination, 7);
    ecrire(pagination, L - MARGE - w, H - 44, o.reg, 7, DGREY);
  }
}

/**
 * Pose l'emblème de la société, en en-tête et en pied.
 *
 * Les deux emplacements sont ceux du gabarit d'origine, au point près. L'image
 * est inscrite DANS la boîte sans la déformer : un logo large ne s'étire pas
 * pour remplir une boîte carrée.
 *
 * Un fichier illisible ou d'un format non supporté n'interrompt rien : le devis
 * sort sans emblème. Un logo n'est pas une mention obligatoire.
 */
async function poserLogo(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument["getPage"]>,
  H: number,
  chemin: string,
): Promise<void> {
  try {
    const octets = fileBytes(chemin);
    const img: PDFImage = /\.png$/i.test(chemin)
      ? await pdf.embedPng(octets)
      : await pdf.embedJpg(octets);
    for (const b of [ID.logoEntete, ID.logoPied]) {
      const e = Math.min(b.w / img.width, b.h / img.height);
      const w = img.width * e;
      const h = img.height * e;
      page.drawImage(img, {
        x: b.x + (b.w - w) / 2,
        y: H - b.top - b.h + (b.h - h) / 2,
        width: w,
        height: h,
      });
    }
  } catch {
    /* emblème illisible → le devis sort sans logo, et reste valide */
  }
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
