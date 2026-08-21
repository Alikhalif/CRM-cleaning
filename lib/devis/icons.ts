// Icônes vectorielles du devis OPTIMIVV, portées à l'identique du Python.
// Chaque icône est dessinée dans un carré local [0,1]×[0,1] ; le wrapper icon()
// de render.ts applique translate(X,YT) + scale(s,s) (pdfkit a déjà l'axe Y
// vers le bas, donc PAS d'inversion -s comme reportlab). Les coordonnées et
// épaisseurs sont recopiées telles quelles.

import { NAVY, BLUE, WHITE } from "./layout";

type Doc = PDFKit.PDFDocument;

// Adaptateur graphique : reproduit l'API reportlab (setFillColor/setStrokeColor,
// circle/rect/roundRect/beginPath/drawPath/line avec drapeaux stroke/fill).
export type Gfx = {
  s(col: string, w?: number): void;
  fill(col: string): void;
  circle(cx: number, cy: number, r: number, stroke: number, fill: number): void;
  rect(x: number, y: number, w: number, h: number, stroke: number, fill: number): void;
  rrect(x: number, y: number, w: number, h: number, rad: number, stroke: number, fill: number): void;
  line(x0: number, y0: number, x1: number, y1: number): void;
  m(x: number, y: number): Gfx;
  l(x: number, y: number): Gfx;
  cv(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): Gfx;
  cl(): Gfx;
  draw(stroke: number, fill: number): void;
};

function endPath(doc: Doc, stroke: number, fill: number): void {
  if (fill && stroke) doc.fillAndStroke();
  else if (fill) doc.fill();
  else if (stroke) doc.stroke();
}

export function makeGfx(doc: Doc): Gfx {
  const g: Gfx = {
    s(col, w = 0.09) {
      doc.strokeColor(col).lineWidth(w);
    },
    fill(col) {
      doc.fillColor(col);
    },
    circle(cx, cy, r, stroke, fill) {
      doc.circle(cx, cy, r);
      endPath(doc, stroke, fill);
    },
    rect(x, y, w, h, stroke, fill) {
      doc.rect(x, y, w, h);
      endPath(doc, stroke, fill);
    },
    rrect(x, y, w, h, rad, stroke, fill) {
      doc.roundedRect(x, y, w, h, rad);
      endPath(doc, stroke, fill);
    },
    line(x0, y0, x1, y1) {
      doc.moveTo(x0, y0).lineTo(x1, y1).stroke();
    },
    m(x, y) {
      doc.moveTo(x, y);
      return g;
    },
    l(x, y) {
      doc.lineTo(x, y);
      return g;
    },
    cv(x1, y1, x2, y2, x3, y3) {
      doc.bezierCurveTo(x1, y1, x2, y2, x3, y3);
      return g;
    },
    cl() {
      doc.closePath();
      return g;
    },
    draw(stroke, fill) {
      endPath(doc, stroke, fill);
    },
  };
  return g;
}

// ------------------------------------------------------------ icônes
export function ic_truck(g: Gfx, col: string = NAVY): void {
  g.s(col, 0.085);
  g.fill(col);
  g.m(0.04, 0.28).l(0.56, 0.28).l(0.56, 0.68).l(0.04, 0.68).cl().draw(1, 0);
  g.m(0.56, 0.42).l(0.76, 0.42).l(0.94, 0.58).l(0.94, 0.68).l(0.56, 0.68).cl().draw(1, 0);
  g.circle(0.25, 0.76, 0.1, 1, 1);
  g.circle(0.78, 0.76, 0.1, 1, 1);
}

export function ic_box(g: Gfx, col: string = NAVY): void {
  g.s(col, 0.085);
  g.m(0.5, 0.1).l(0.92, 0.32).l(0.92, 0.74).l(0.5, 0.94).l(0.08, 0.74).l(0.08, 0.32).cl().draw(1, 0);
  g.line(0.08, 0.32, 0.5, 0.52);
  g.line(0.92, 0.32, 0.5, 0.52);
  g.line(0.5, 0.52, 0.5, 0.94);
}

export function ic_hands(g: Gfx, col: string = NAVY): void {
  g.s(col, 0.085);
  g.m(0.05, 0.56).cv(0.05, 0.98, 0.95, 0.98, 0.95, 0.56).draw(1, 0);
  g.line(0.05, 0.56, 0.05, 0.68);
  g.line(0.95, 0.56, 0.95, 0.68);
  g.m(0.5, 0.06).l(0.78, 0.22).l(0.5, 0.38).l(0.22, 0.22).cl().draw(1, 0);
  g.line(0.22, 0.22, 0.22, 0.44);
  g.line(0.78, 0.22, 0.78, 0.44);
  g.line(0.5, 0.38, 0.5, 0.6);
  g.line(0.22, 0.44, 0.5, 0.6);
  g.line(0.78, 0.44, 0.5, 0.6);
}

export function ic_person_ring(g: Gfx, col: string = WHITE): void {
  g.s(col, 0.075);
  g.circle(0.5, 0.5, 0.45, 1, 0);
  g.circle(0.5, 0.38, 0.13, 1, 0);
  g.m(0.25, 0.76).cv(0.3, 0.56, 0.7, 0.56, 0.75, 0.76).draw(1, 0);
}

export function ic_person_full(g: Gfx, bg: string = BLUE, fg: string = WHITE): void {
  g.fill(bg);
  g.circle(0.5, 0.5, 0.5, 0, 1);
  g.fill(fg);
  g.circle(0.5, 0.38, 0.135, 0, 1);
  g.s(fg, 0.16);
  g.m(0.26, 0.8).cv(0.31, 0.58, 0.69, 0.58, 0.74, 0.8).draw(1, 0);
}

export function ic_phone(g: Gfx, col: string = WHITE): void {
  g.fill(col);
  g.m(0.1, 0.16)
    .l(0.34, 0.12)
    .l(0.44, 0.36)
    .l(0.28, 0.46)
    .cv(0.36, 0.66, 0.5, 0.78, 0.66, 0.84)
    .l(0.76, 0.68)
    .l(0.94, 0.8)
    .l(0.88, 0.94)
    .cv(0.5, 0.94, 0.1, 0.56, 0.1, 0.16)
    .cl()
    .draw(0, 1);
}

export function ic_mail(g: Gfx, col: string = WHITE): void {
  g.s(col, 0.085);
  g.rect(0.06, 0.22, 0.88, 0.56, 1, 0);
  g.line(0.06, 0.22, 0.5, 0.58);
  g.line(0.94, 0.22, 0.5, 0.58);
}

export function ic_globe(g: Gfx, col: string = WHITE): void {
  g.s(col, 0.075);
  g.circle(0.5, 0.5, 0.44, 1, 0);
  g.line(0.06, 0.5, 0.94, 0.5);
  g.m(0.5, 0.06).cv(0.24, 0.28, 0.24, 0.72, 0.5, 0.94).draw(1, 0);
  g.m(0.5, 0.06).cv(0.76, 0.28, 0.76, 0.72, 0.5, 0.94).draw(1, 0);
}

export function ic_target(g: Gfx, bg: string = BLUE, fg: string = WHITE): void {
  g.fill(bg);
  g.circle(0.5, 0.5, 0.5, 0, 1);
  g.s(fg, 0.09);
  g.circle(0.46, 0.54, 0.26, 1, 0);
  g.line(0.46, 0.54, 0.82, 0.2);
  g.fill(fg);
  g.circle(0.46, 0.54, 0.07, 0, 1);
  g.m(0.66, 0.2).l(0.82, 0.2).l(0.82, 0.36).draw(1, 0);
}

export function ic_pin(g: Gfx, col: string = BLUE): void {
  g.s(col, 0.085);
  g.m(0.5, 0.96).cv(0.14, 0.6, 0.14, 0.1, 0.5, 0.1).cv(0.86, 0.1, 0.86, 0.6, 0.5, 0.96).draw(1, 0);
  g.circle(0.5, 0.4, 0.15, 1, 0);
}

export function ic_calendar(g: Gfx, col: string = BLUE): void {
  g.s(col, 0.085);
  g.fill(col);
  g.rrect(0.06, 0.18, 0.88, 0.76, 0.1, 1, 0);
  g.line(0.06, 0.4, 0.94, 0.4);
  g.line(0.28, 0.06, 0.28, 0.26);
  g.line(0.72, 0.06, 0.72, 0.26);
  for (const i of [0, 1, 2]) {
    for (const j of [0, 1]) {
      g.rect(0.2 + i * 0.24, 0.52 + j * 0.18, 0.11, 0.1, 0, 1);
    }
  }
}

export function ic_clock(g: Gfx, col: string = BLUE): void {
  g.s(col, 0.085);
  g.circle(0.5, 0.5, 0.44, 1, 0);
  g.line(0.5, 0.5, 0.5, 0.26);
  g.line(0.5, 0.5, 0.7, 0.58);
}

export function ic_shield(g: Gfx, col: string = BLUE): void {
  g.s(col, 0.085);
  g.m(0.5, 0.06)
    .l(0.92, 0.22)
    .l(0.92, 0.54)
    .cv(0.92, 0.78, 0.72, 0.9, 0.5, 0.96)
    .cv(0.28, 0.9, 0.08, 0.78, 0.08, 0.54)
    .l(0.08, 0.22)
    .cl()
    .draw(1, 0);
}

export function ic_shield_check(g: Gfx, col: string = WHITE): void {
  ic_shield(g, col);
  g.s(col, 0.1);
  g.m(0.32, 0.5).l(0.45, 0.64).l(0.7, 0.36).draw(1, 0);
}

export function ic_euro(g: Gfx, bg: string = BLUE, fg: string = WHITE): void {
  g.fill(bg);
  g.circle(0.5, 0.5, 0.5, 0, 1);
  g.s(fg, 0.1);
  g.m(0.7, 0.26).cv(0.34, 0.16, 0.28, 0.84, 0.7, 0.74).draw(1, 0);
  g.line(0.24, 0.44, 0.58, 0.44);
  g.line(0.24, 0.58, 0.58, 0.58);
}

export function ic_info(g: Gfx, bg: string = BLUE, fg: string = WHITE): void {
  g.fill(bg);
  g.circle(0.5, 0.5, 0.5, 0, 1);
  g.fill(fg);
  g.circle(0.5, 0.28, 0.075, 0, 1);
  g.s(fg, 0.13);
  g.line(0.5, 0.44, 0.5, 0.76);
}

export function ic_card(g: Gfx, col: string = BLUE): void {
  g.s(col, 0.085);
  g.fill(col);
  g.rrect(0.04, 0.24, 0.92, 0.52, 0.08, 1, 0);
  g.rect(0.04, 0.36, 0.92, 0.14, 0, 1);
  g.rect(0.16, 0.6, 0.24, 0.08, 0, 1);
}

export function ic_bank(g: Gfx, col: string = BLUE): void {
  g.s(col, 0.085);
  g.m(0.06, 0.36).l(0.5, 0.1).l(0.94, 0.36).cl().draw(1, 0);
  for (const x0 of [0.2, 0.42, 0.64, 0.8]) {
    g.line(x0, 0.42, x0, 0.78);
  }
  g.line(0.06, 0.86, 0.94, 0.86);
}
