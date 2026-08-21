// Générateur de devis OPTIMIVV — PDF vectoriel A4, porté à l'identique de
// devis_generator.py (reportlab → pdfkit). Le design est FIGÉ : positions,
// couleurs, polices et ordre des blocs sont recopiés tels quels. Seules les
// DONNÉES varient. Une différence de mise en page est un bug.
//
// Correspondance des repères : reportlab a l'origine en bas (Y = PH - YT),
// pdfkit l'a en haut → on écrit directement à YT(py) et on place le texte via
// l'option baseline:'alphabetic' (la ligne de base tombe sur le y passé).

import PDFDocument from "pdfkit";
import {
  PW,
  PH,
  X,
  YT,
  W,
  H,
  FS,
  safe,
  euro,
  NAVY,
  NAVY_FT,
  BLUE,
  BLUE_S,
  LIGHT_BG,
  NOTE_BG,
  BORDER,
  GREY_TXT,
  WHITE,
  LOGO,
  PHOTO,
  FONTS_DIR,
  FONT_FILES,
} from "./layout";
import {
  makeGfx,
  ic_truck,
  ic_box,
  ic_hands,
  ic_person_ring,
  ic_person_full,
  ic_phone,
  ic_mail,
  ic_globe,
  ic_target,
  ic_pin,
  ic_calendar,
  ic_clock,
  ic_shield,
  ic_euro,
  ic_info,
  ic_card,
  ic_bank,
  ic_shield_check,
  type Gfx,
} from "./icons";
import {
  PRESTATAIRE,
  MARQUE,
  DEFAUTS,
  type Devis,
  type DevisInput,
} from "./types";
import path from "node:path";

type Doc = PDFKit.PDFDocument;
type IconFn = (g: Gfx) => void;

export function genererDevisBuffer(donnees: DevisInput): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const buf = buildPdf(donnees);
      const chunks: Buffer[] = [];
      buf.on("data", (c: Buffer) => chunks.push(c));
      buf.on("end", () => resolve(Buffer.concat(chunks)));
      buf.on("error", reject);
      buf.end();
    } catch (e) {
      reject(e);
    }
  });
}

function buildPdf(donnees: DevisInput): Doc {
  // ------------------------------------------------------------ défauts
  const D: Devis = {
    ...DEFAUTS,
    numero: new Date().getFullYear() + "-00001",
    date_emission: formatDateFr(new Date()),
    ...donnees,
  } as Devis;
  const P = { ...PRESTATAIRE, ...(donnees.prestataire || {}) };
  const marque = { ...MARQUE, ...(donnees.marque || {}) };
  const CL = D.client || ({} as Devis["client"]);
  const isFacture = D.docType === "facture";

  const doc: Doc = new PDFDocument({ size: [PW, PH], margin: 0 });
  const kind = D.docType === "facture" ? "Facture" : "Devis";
  doc.info.Title = `${kind} ${D.numero} - ${P.enseigne}`;
  doc.info.Author = P.raison_sociale;
  doc.info.Subject = `${kind} - déménagement, débarras, intervention spécialisée`;

  for (const [alias, file] of FONT_FILES) {
    doc.registerFont(alias, path.join(FONTS_DIR, file));
  }
  const g = makeGfx(doc);

  // Désactive kerning/ligatures/alternates OpenType (fontkit les applique par
  // défaut) pour reproduire la mise en page à chasses brutes de reportlab —
  // sinon la police cursive (Chorus) dérive horizontalement. Sans effet sur
  // Poppins (déjà identique). Forme OBJET obligatoire : `features: []` ne
  // désactive pas les features par défaut du script.
  const NO_FEAT = {
    kern: false,
    liga: false,
    clig: false,
    calt: false,
    rlig: false,
  } as unknown as never[];

  // ------------------------------------------------------------ helpers texte
  const measureAt = (s: string, font: string, size: number): number =>
    doc.font(font).fontSize(size).widthOfString(s, { features: [] });
  const measure1 = (s: string, font: string): number => measureAt(s, font, 1);

  // features: [] désactive kerning/ligatures OpenType (fontkit) pour reproduire
  // la mise en page naïve de reportlab (indispensable pour la police cursive).
  const sw = (s: string, font: string, size: number, space = 0): number =>
    doc.font(font).fontSize(size).widthOfString(safe(s), {
      characterSpacing: space,
      features: NO_FEAT,
    });

  const draw = (
    s: string,
    x: number,
    y: number,
    font: string,
    size: number,
    color: string,
    space = 0,
  ): void => {
    doc
      .font(font)
      .fontSize(size)
      .fillColor(color)
      .text(safe(s), x, y, {
        lineBreak: false,
        baseline: "alphabetic",
        characterSpacing: space,
        features: NO_FEAT,
      });
  };

  const txt = (
    s: string,
    px: number,
    py: number,
    font = "Pop",
    size = 10,
    color: string = GREY_TXT,
    space = 0,
    align: "l" | "c" | "r" = "l",
  ): void => {
    let x = X(px);
    if (align === "c") x -= sw(s, font, size, space) / 2;
    else if (align === "r") x -= sw(s, font, size, space);
    draw(s, x, YT(py), font, size, color, space);
  };

  // ------------------------------------------------------------ helpers formes
  const rect = (
    px0: number,
    py0: number,
    px1: number,
    py1: number,
    opts: { fill?: string; stroke?: string; r?: number; lw?: number } = {},
  ): void => {
    const { fill, stroke, r = 0, lw = 0.7 } = opts;
    const x = X(px0);
    const y = YT(py0);
    const w = X(px1) - X(px0);
    const h = YT(py1) - YT(py0);
    if (r) doc.roundedRect(x, y, w, h, W(r));
    else doc.rect(x, y, w, h);
    if (stroke) doc.lineWidth(lw);
    if (fill && stroke) doc.fillAndStroke(fill, stroke);
    else if (fill) doc.fill(fill);
    else if (stroke) doc.stroke(stroke);
  };

  const line = (
    px0: number,
    py0: number,
    px1: number,
    py1: number,
    color: string = BORDER,
    lw = 0.7,
    dash: [number, number] | null = null,
  ): void => {
    doc.lineWidth(lw);
    if (dash) doc.dash(dash[0], { space: dash[1] });
    doc.moveTo(X(px0), YT(py0)).lineTo(X(px1), YT(py1)).stroke(color);
    if (dash) doc.undash();
  };

  const fit = (
    strings: string[],
    font: string,
    targetPx: number,
    cap: number,
  ): number => {
    const t = W(targetPx);
    let m = cap;
    for (const s of strings) {
      const w1 = measure1(s, font);
      if (w1 > 0) m = Math.min(m, t / w1);
    }
    return m;
  };

  const block = (
    lines: string[],
    px: number,
    py0: number,
    step: number,
    font: string,
    size: number,
    color: string,
  ): void => {
    lines.forEach((l, i) => txt(l, px, py0 + i * step, font, size, color));
  };

  const wrap = (
    texte: string,
    font: string,
    size: number,
    largeurPx: number,
  ): string[] => {
    const maxw = W(largeurPx);
    const out: string[] = [];
    const measure = (s: string): number =>
      doc.font(font).fontSize(size).widthOfString(s, { features: [] });
    for (const para of texte.replace(/\r/g, "").split("\n")) {
      const mots = para.split(/\s+/).filter(Boolean);
      if (mots.length === 0) {
        out.push("");
        continue;
      }
      let cur = "";
      for (const mmm of mots) {
        const essai = (cur + " " + mmm).trim();
        if (measure(essai) <= maxw) cur = essai;
        else {
          if (cur) out.push(cur);
          cur = mmm;
        }
      }
      if (cur) out.push(cur);
    }
    return out;
  };

  const icon = (fn: IconFn, px: number, py: number, sizePx: number): void => {
    doc.save();
    doc.translate(X(px), YT(py));
    const s = W(sizePx);
    doc.scale(s, s);
    doc.lineJoin("round").lineCap("round");
    fn(g);
    doc.restore();
  };

  // ================================================================= PHOTO (fond)
  const px0Img = X(600);
  doc.image(PHOTO, px0Img, YT(95), {
    width: PW - px0Img,
    height: YT(663) - YT(95),
  });

  // ================================================================= EN-TÊTE
  const LOGO_R = 900.0 / 656.0;
  const lw = W(134);
  const lh = lw / LOGO_R;
  doc.image(LOGO, X(40), YT(44), { width: lw, height: lh });

  txt(marque.nom, 200, 96, "PopB", FS(53), NAVY, W(2.0));
  txt(marque.activite, 202, 141, "PopB", FS(31), NAVY, W(6.2));

  txt(marque.slogan, 108, 197, "Script", FS(30), BLUE_S);

  const hs = ["DÉMÉNAGEMENT", "DÉBARRAS", "INTERVENTION SPÉCIALISÉE"];
  const hsz = fit([hs.join("   •   ")], "PopB", 520, FS(19));
  let hx = X(45);
  hs.forEach((wgt, i) => {
    draw(wgt, hx, YT(232), "PopB", hsz, NAVY, W(0.35));
    hx += sw(wgt, "PopB", hsz, W(0.35));
    if (i < 2) {
      draw("  •  ", hx, YT(232), "PopB", hsz, NAVY);
      hx += sw("  •  ", "PopB", hsz);
    }
  });

  line(600, 38, 600, 236, BORDER, 1.0);

  txt(isFacture ? "FACTURE" : "DEVIS", 645, 96, "PopB", isFacture ? FS(46) : FS(52), NAVY, W(1.2));
  txt("N° " + D.numero, 646, 132, "PopM", FS(26), BLUE, W(0.4));

  icon(ic_calendar, 649, 152, 24);
  txt("Date d'émission : " + D.date_emission, 686, 172, "Pop", FS(15), GREY_TXT);
  icon(ic_clock, 649, 190, 24);
  txt(
    isFacture
      ? "Règlement sous " + D.validite_jours + " jours"
      : "Validité de l'offre : " + D.validite_jours + " jours",
    686,
    210,
    "Pop",
    FS(15),
    GREY_TXT,
  );

  // ================================================================= SERVICES
  const SV: Array<[number, string, string, IconFn, number]> = [
    [40, "DÉMÉNAGEMENT", "Particuliers & Professionnels", ic_truck, 140],
    [222, "DÉBARRAS", "Maisons, appartements, locaux", ic_box, 122],
    [386, "INTERVENTION SPÉCIALISÉE", "Solutions sur-mesure", ic_hands, 200],
  ];
  const st = Math.min(...SV.map(([, t, , , av]) => fit([t], "PopB", av, FS(14))));
  const ss = Math.min(...SV.map(([, , s2, , av]) => fit([s2], "PopL", av, FS(12))));
  for (const [x, t, s2, ic, ] of SV) {
    icon(ic, x, 265, 28);
    txt(t, x + 40, 277, "PopB", st, NAVY, W(0.2));
    txt(s2, x + 40, 292, "PopL", ss, GREY_TXT);
  }

  // ================================================================= PRESTATAIRE
  rect(33, 328, 325, 663, { fill: NAVY, r: 14 });
  icon(ic_person_ring, 52, 344, 34);
  txt("PRESTATAIRE", 100, 370, "PopM", FS(19), WHITE, W(1.4));

  txt(P.enseigne, 52, 415, "PopB", FS(18), WHITE, W(0.2));
  txt(P.raison_sociale, 52, 447, "PopB", FS(17), WHITE, W(0.2));
  txt(P.adresse, 52, 473, "PopL", FS(15), WHITE);
  txt(P.ville, 52, 495, "PopL", FS(15), WHITE);

  draw("SIRET :", X(52), YT(529), "PopB", FS(15), WHITE);
  const wsi = measureAt("SIRET :", "PopB", FS(15));
  draw(P.siret, X(52) + wsi + W(7), YT(529), "PopL", FS(15), WHITE);

  draw("TVA :", X(52), YT(550), "PopB", FS(15), WHITE);
  const wtva = measureAt("TVA :", "PopB", FS(15));
  draw(P.tva, X(52) + wtva + W(7), YT(550), "PopL", FS(15), WHITE);

  icon(ic_phone, 52, 573, 17);
  txt(P.telephone, 82, 587, "Pop", FS(16), WHITE);
  // E-mail / site plus longs → réduction auto pour tenir dans le cartouche.
  icon(ic_mail, 51, 607, 19);
  const emailSz = Math.min(FS(16), W(236) / measure1(P.email, "PopL"));
  draw(P.email, X(82), YT(621), "PopL", emailSz, WHITE);
  icon(ic_globe, 52, 640, 18);
  const siteSz = Math.min(FS(16), W(236) / measure1(P.site, "PopL"));
  draw(P.site, X(82), YT(654), "PopL", siteSz, WHITE);

  // ================================================================= CLIENT
  rect(341, 328, 637, 663, { fill: WHITE, stroke: BORDER, r: 14, lw: 0.9 });
  icon(ic_person_full, 358, 347, 34);
  txt("CLIENT", 404, 372, "PopM", FS(19), NAVY, W(1.4));

  const FSZ = FS(14);
  const field = (
    label: string,
    ly: number,
    valeur = "",
    lx1 = 610,
    xLab = 362,
  ): void => {
    let x0: number;
    if (label) {
      txt(label, xLab, ly, "Pop", FSZ, GREY_TXT);
      x0 = X(xLab) + sw(label, "Pop", FSZ) + W(8);
    } else {
      x0 = X(438);
    }
    doc.lineWidth(0.6);
    doc.moveTo(x0, YT(ly + 5)).lineTo(X(lx1), YT(ly + 5)).stroke("#4A4F5A");
    if (valeur) {
      const vs = Math.min(FSZ, (X(lx1) - x0 - W(6)) / measure1(valeur, "PopM"));
      draw(valeur, x0 + W(4), YT(ly), "PopM", vs, NAVY);
    }
  };

  field("Nom / Société :", 424, CL.nom || "");
  field("Adresse :", 469, CL.adresse || "");
  field("", 513, CL.adresse2 || "");
  field("Téléphone :", 563, CL.telephone || "");
  field("Email :", 608, CL.email || "");

  // ================================================================= OBJET
  icon(ic_target, 38, 686, 34);
  txt("OBJET DE LA PRESTATION", 86, 711, "PopB", FS(17), NAVY, W(0.6));

  const OBJ = [
    "Réalisation d'une prestation conforme à votre demande.",
    "L'intervention sera effectuée avec des équipes qualifiées, du matériel",
    "professionnel et des moyens adaptés pour garantir un service",
    "efficace et sécurisé.",
  ];
  block(OBJ, 40, 747, 21, "PopL", fit(OBJ, "PopL", 420, FS(14.5)), GREY_TXT);

  // ================================================================= LIEU / DATE
  rect(33, 838, 945, 886, { fill: LIGHT_BG, r: 8 });
  icon(ic_pin, 49, 850, 23);
  txt("LIEU D'INTERVENTION :", 82, 868, "Pop", FS(13.5), NAVY, W(0.3));
  line(232, 872, 462, 872, "#6A7080", 0.6);
  if (D.lieu_intervention) {
    const v = D.lieu_intervention;
    const s2 = Math.min(FS(13), W(226) / measure1(v, "PopM"));
    txt(v, 236, 868, "PopM", s2, NAVY);
  }
  line(503, 848, 503, 878, BORDER, 1.0);
  icon(ic_calendar, 527, 851, 23);
  txt("DATE PRÉVUE D'INTERVENTION :", 561, 868, "Pop", FS(13.5), NAVY, W(0.3));
  line(772, 872, 932, 872, "#6A7080", 0.6);
  if (D.date_prevue) {
    const v = D.date_prevue;
    const s2 = Math.min(FS(13), W(156) / measure1(v, "PopM"));
    txt(v, 776, 868, "PopM", s2, NAVY);
  }

  // ================================================================= TABLEAU
  rect(33, 906, 990, 944, { fill: NAVY });
  txt(
    "DESCRIPTION DE LA PRESTATION ET TARIF",
    50,
    932,
    "PopB",
    FS(16),
    WHITE,
    W(0.4),
  );

  rect(33, 944, 990, 984, { stroke: BORDER, lw: 0.9 });
  line(697, 944, 697, 984, BORDER, 0.9);
  txt(
    "DESCRIPTION DÉTAILLÉE DE LA PRESTATION",
    50,
    971,
    "PopB",
    FS(13.5),
    NAVY,
    W(0.3),
  );
  txt("MONTANT NET HT", 843, 971, "PopB", FS(13.5), NAVY, W(0.3), "c");

  rect(33, 984, 990, 1193, { stroke: BORDER, lw: 0.9 });
  line(697, 984, 697, 1193, BORDER, 0.9);

  const TXTDESC = (D.description || "").trim();
  if (TXTDESC) {
    let szDesc = FS(14.5);
    let TB = wrap(TXTDESC, "PopL", szDesc, 630);
    if (TB.length > 8) {
      szDesc = FS(12.5);
      TB = wrap(TXTDESC, "PopL", szDesc, 630).slice(0, 9);
    }
    block(TB, 52, 1017, 21, "PopL", szDesc, GREY_TXT);
  } else {
    const PHt = [
      "Merci de décrire ici la prestation demandée (déménagement, débarras, manutention,",
      "garde-meubles, emballage, transport, etc.), les spécificités du lieu, les volumes, les accès,",
      "la distance ou tout autre élément utile à la bonne réalisation de la mission.",
    ];
    block(PHt, 52, 1017, 21, "PopL", fit(PHt, "PopL", 630, FS(14.5)), GREY_TXT);
    for (let i = 0; i < 4; i++) {
      line(48, 1086 + i * 28, 682, 1086 + i * 28, "#8A90A0", 0.6, [0.7, 2.4]);
    }
  }

  const MT = D.montant_ht;
  if (MT === null || MT === undefined) {
    draw(".".repeat(14), X(755), YT(1133), "Pop", FS(20), GREY_TXT, W(1.6));
    draw("€", X(880), YT(1133), "PopM", FS(24), "#20242C");
    draw("HT", X(903), YT(1133), "Pop", FS(17), GREY_TXT);
  } else {
    const m = euro(MT);
    const msz = Math.min(FS(26), W(210) / measure1(m + " HT", "PopB"));
    const mw = sw(m, "PopB", msz) + W(6) + sw("HT", "Pop", msz * 0.72);
    const mx = X(843) - mw / 2.0;
    draw(m, mx, YT(1133), "PopB", msz, NAVY);
    draw("HT", mx + sw(m, "PopB", msz) + W(6), YT(1133), "Pop", msz * 0.72, GREY_TXT);
  }

  // Mention TVA + « Conditions d'intervention » + « À noter » : uniquement sur
  // le DEVIS. Retirés de la FACTURE (demande client 2026-08-20).
  if (!isFacture) {
  txt(D.mention_tva, 40, 1214, "PopL", FS(12.5), BLUE_S);

  // ================================================================= COL. GAUCHE
  icon(ic_shield, 38, 1228, 32);
  txt("CONDITIONS D'INTERVENTION", 84, 1249, "PopB", FS(15), NAVY, W(0.4));

  const CI = [
    "La prestation sera réalisée à la date convenue entre les parties.",
    "Toute prestation supplémentaire demandée sur place ou tout élément non visible lors de",
    "l'établissement du devis pourra faire l'objet d'une facturation complémentaire après",
    "validation du client.",
  ];
  block(CI, 35, 1290, 19, "PopL", fit(CI, "PopL", 430, FS(12.5)), GREY_TXT);

  rect(33, 1360, 470, 1452, { fill: NOTE_BG, r: 8 });
  icon(ic_info, 52, 1371, 28);
  txt("À NOTER", 92, 1391, "PopB", FS(13.5), NAVY, W(0.3));
  const AN = [
    (isFacture ? "Ce document" : "Ce devis") +
      " est établi sur la base des informations communiquées par le client.",
    "En cas de modification des conditions d'intervention (accès, volumes, distances...),",
    "un ajustement pourra être proposé.",
  ];
  block(AN, 52, 1413, 16, "PopL", fit(AN, "PopL", 400, FS(11.5)), GREY_TXT);
  }

  // ================================================================= COL. DROITE
  icon(ic_euro, 528, 1227, 30);
  txt("CONDITIONS DE RÈGLEMENT", 570, 1247, "PopB", FS(15), NAVY, W(0.4));

  const RG: Array<[IconFn, string]> = [
    [ic_euro, "Acompte à la commande : " + D.acompte_pct + " %"],
    [ic_card, "Solde à réception de la facture"],
    [ic_bank, "Paiement par virement bancaire ou lien de paiement sécurisé"],
  ];
  const rsz = fit(RG.map(([, l]) => l), "PopL", 412, FS(13));
  RG.forEach(([ic, l], i) => {
    const yy = 1267 + i * 26;
    icon(ic, 530, yy, 17);
    txt("•", 558, yy + 12, "Pop", rsz, GREY_TXT);
    txt(l, 568, yy + 12, "PopL", rsz, GREY_TXT);
  });

  txt(
    isFacture ? "RÈGLEMENT DE LA FACTURE" : "ACCEPTATION DU DEVIS",
    528,
    1357,
    "PopB",
    FS(15),
    NAVY,
    W(0.4),
  );
  const AC = isFacture
    ? [
        "Facture payable à réception, par virement bancaire",
        "ou lien de paiement sécurisé.",
      ]
    : [
        "Le présent devis vaut contrat après signature du client",
        "accompagnée de la mention : « Bon pour accord »",
      ];
  block(AC, 528, 1378, 17, "PopL", fit(AC, "PopL", 450, FS(12.5)), GREY_TXT);

  rect(528, 1404, 990, 1480, { fill: WHITE, stroke: BORDER, r: 8, lw: 0.9 });
  ["Nom :", "Date :", "Signature & Cachet :"].forEach((lab, i) => {
    const yy = 1425 + i * 20;
    txt(lab, 548, yy, "PopB", FS(13.5), NAVY);
    if (i < 2) line(592, yy + 4, 742, yy + 4, "#4A4F5A", 0.6);
  });

  // Devis signé en ligne : remplit nom/date + dessine la signature à la place
  // de la mention « Bon pour accord ».
  const sig = !isFacture ? D.signature : undefined;
  if (sig?.nom) draw(sig.nom, X(598), YT(1425), "PopM", FS(12.5), NAVY);
  if (sig?.date) draw(sig.date, X(598), YT(1445), "PopM", FS(12.5), NAVY);

  rect(765, 1412, 984, 1472, { fill: WHITE, stroke: BORDER, r: 8, lw: 0.9 });
  const sigBuf = sig?.imageDataUrl ? dataUrlToBuffer(sig.imageDataUrl) : null;
  if (sigBuf) {
    try {
      doc.image(sigBuf, X(772), YT(1416), {
        fit: [W(205), H(52)],
        align: "center",
        valign: "center",
      });
    } catch {
      /* image invalide → on ignore */
    }
  } else {
    txt(isFacture ? "Merci !" : "Bon pour accord", 874, 1450, "Script", FS(31), NAVY, 0, "c");
  }

  // ================================================================= PIED DE PAGE
  rect(33, 1478, 990, 1522, { fill: NAVY_FT });

  const foot = (
    ix: number,
    title: string,
    l1: string,
    l2: string,
    ic: IconFn,
  ): void => {
    icon(ic, ix, 1485, 28);
    txt(title, ix + 40, 1493, "PopB", FS(13), WHITE, W(0.2));
    txt(l1, ix + 40, 1504, "PopL", FS(11.5), "#C8D6F2");
    txt(l2, ix + 40, 1515, "PopL", FS(11.5), "#C8D6F2");
  };

  foot(45, "ÉQUIPES EXPÉRIMENTÉES", "Professionnels formés", "et expérimentés", (gg) =>
    ic_shield_check(gg, WHITE),
  );
  foot(295, "MATÉRIEL PROFESSIONNEL", "Matériel adapté et sécurisé", "pour tous vos biens", (gg) =>
    ic_box(gg, WHITE),
  );
  foot(565, "SERVICE RAPIDE & FIABLE", "Ponctualité, efficacité", "et suivi personnalisé", (gg) =>
    ic_truck(gg, WHITE),
  );

  return doc;
}

function formatDateFr(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Décode une data URL (PNG/JPEG base64, ex. sortie d'un canvas de signature) en
// Buffer pour pdfkit. Renvoie null si le format n'est pas reconnu.
function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = /^data:image\/(?:png|jpe?g);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}
