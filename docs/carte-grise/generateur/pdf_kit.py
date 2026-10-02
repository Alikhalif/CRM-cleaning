# -*- coding: utf-8 -*-
"""
pdf_kit.py — Boîte à outils de mise en page pour le document officiel
« CARTE GRISE & CAHIER DES CHARGES » du CRM CGK/OPTIMIVV.

Système visuel professionnel bâti sur reportlab Platypus :
- BaseDocTemplate avec page de couverture dédiée + gabarit corps (en-tête/pied),
- table des matières automatique (afterFlowable -> notify TOCEntry),
- styles de titres H1/H2/H3, corps, petits textes,
- helpers : section(), subsection(), para(), bullet(), kv_table(), data_table(),
  badge(), callout(), flow_horizontal(), flow_vertical(), legend_badges().

Les accents français passent avec Helvetica (encodage latin-1/WinAnsi standard reportlab).
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    NextPageTemplate, PageBreak, Flowable, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents
import datetime

# ---------------------------------------------------------------- Palette ----
INK      = colors.HexColor("#14202b")   # texte principal
MUTED    = colors.HexColor("#5b6b78")   # texte secondaire
BRAND    = colors.HexColor("#0b6e58")   # vert OPTIMIVV / CGK
BRAND_D  = colors.HexColor("#084f3f")   # vert foncé
NAVY     = colors.HexColor("#13293d")   # bleu nuit (couverture)
ACCENT   = colors.HexColor("#c8a24a")   # or / accent
LINE     = colors.HexColor("#d7dee2")
SOFT     = colors.HexColor("#eef3f2")   # fond très clair
SOFT2    = colors.HexColor("#f6f8f9")
WHITE    = colors.white

# Statuts (badges)
OK_BG,   OK_FG   = colors.HexColor("#e2f4ec"), colors.HexColor("#0b6e58")  # ACTIVE
PA_BG,   PA_FG   = colors.HexColor("#fdf0d9"), colors.HexColor("#9a6a00")  # PARTIEL
PL_BG,   PL_FG   = colors.HexColor("#e5eefb"), colors.HexColor("#1f5fbf")  # PREVU
NO_BG,   NO_FG   = colors.HexColor("#fbe4e4"), colors.HexColor("#b02121")  # ABSENT/ECART
VE_BG,   VE_FG   = colors.HexColor("#eceff1"), colors.HexColor("#546069")  # A VERIFIER

PAGE_W, PAGE_H = A4
LM, RM, TM, BM = 20*mm, 18*mm, 22*mm, 20*mm

# ---------------------------------------------------------------- Styles -----
def build_styles():
    ss = getSampleStyleSheet()
    S = {}
    S["cover_kicker"] = ParagraphStyle("cover_kicker", parent=ss["Normal"], fontName="Helvetica-Bold",
                                       fontSize=10, textColor=ACCENT, alignment=TA_CENTER, spaceAfter=6)
    S["cover_title"] = ParagraphStyle("cover_title", parent=ss["Title"], fontName="Helvetica-Bold",
                                       fontSize=30, leading=36, textColor=WHITE, alignment=TA_CENTER, spaceAfter=8)
    S["cover_sub"] = ParagraphStyle("cover_sub", parent=ss["Normal"], fontName="Helvetica",
                                     fontSize=13, leading=18, textColor=colors.HexColor("#cdd8de"),
                                     alignment=TA_CENTER)
    S["cover_meta"] = ParagraphStyle("cover_meta", parent=ss["Normal"], fontName="Helvetica",
                                      fontSize=10, leading=16, textColor=colors.HexColor("#aebbc4"),
                                      alignment=TA_CENTER)
    S["h1"] = ParagraphStyle("h1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=17,
                             leading=21, textColor=BRAND_D, spaceBefore=6, spaceAfter=8)
    S["h2"] = ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12.5,
                             leading=16, textColor=NAVY, spaceBefore=10, spaceAfter=4)
    S["h3"] = ParagraphStyle("h3", parent=ss["Heading3"], fontName="Helvetica-Bold", fontSize=10.5,
                             leading=14, textColor=BRAND, spaceBefore=6, spaceAfter=2)
    S["body"] = ParagraphStyle("body", parent=ss["Normal"], fontName="Helvetica", fontSize=9.5,
                               leading=13.5, textColor=INK, alignment=TA_JUSTIFY, spaceAfter=5)
    S["bodyl"] = ParagraphStyle("bodyl", parent=S["body"], alignment=TA_LEFT)
    S["small"] = ParagraphStyle("small", parent=ss["Normal"], fontName="Helvetica", fontSize=8,
                                leading=11, textColor=MUTED)
    S["bullet"] = ParagraphStyle("bullet", parent=S["body"], leftIndent=12, bulletIndent=2,
                                 spaceAfter=2, alignment=TA_LEFT)
    S["cell"] = ParagraphStyle("cell", parent=ss["Normal"], fontName="Helvetica", fontSize=8.2,
                               leading=10.5, textColor=INK)
    S["cellb"] = ParagraphStyle("cellb", parent=S["cell"], fontName="Helvetica-Bold")
    S["cellh"] = ParagraphStyle("cellh", parent=S["cell"], fontName="Helvetica-Bold", textColor=WHITE)
    S["cellc"] = ParagraphStyle("cellc", parent=S["cell"], alignment=TA_CENTER)
    S["toc_h"] = ParagraphStyle("toc_h", parent=ss["Normal"], fontName="Helvetica-Bold", fontSize=18,
                                textColor=BRAND_D, spaceAfter=12)
    return S

STYLES = build_styles()

# TOC entry levels
TOC_STYLES = [
    ParagraphStyle("toc1", fontName="Helvetica-Bold", fontSize=10.5, leading=18, textColor=NAVY, leftIndent=0),
    ParagraphStyle("toc2", fontName="Helvetica", fontSize=9.5, leading=15, textColor=INK, leftIndent=16),
]

# ---------------------------------------------------------------- Flowables --
class HR(Flowable):
    """Filet horizontal."""
    def __init__(self, width, color=LINE, thickness=0.8, space=2):
        super().__init__(); self.width=width; self.color=color; self.thickness=thickness; self.space=space
    def wrap(self, aw, ah): return (self.width, self.thickness+self.space*2)
    def draw(self):
        self.canv.setStrokeColor(self.color); self.canv.setLineWidth(self.thickness)
        self.canv.line(0, self.space, self.width, self.space)

class Badge(Flowable):
    """Petite étiquette de statut colorée, inline-ish (utilisée seule)."""
    def __init__(self, text, bg, fg, fs=7.5, padx=5, pady=2.5):
        super().__init__(); self.text=text; self.bg=bg; self.fg=fg; self.fs=fs; self.padx=padx; self.pady=pady
        self.w = self.padx*2 + len(text)*fs*0.58
        self.h = self.fs + self.pady*2
    def wrap(self, aw, ah): return (self.w, self.h)
    def draw(self):
        self.canv.setFillColor(self.bg); self.canv.roundRect(0,0,self.w,self.h,3,fill=1,stroke=0)
        self.canv.setFillColor(self.fg); self.canv.setFont("Helvetica-Bold", self.fs)
        self.canv.drawString(self.padx, self.pady+0.5, self.text)

class BoxFlow(Flowable):
    """Diagramme simple : suite de boîtes reliées par des flèches.
       orient='h' (horizontale, wrap sur plusieurs lignes) ou 'v' (verticale)."""
    def __init__(self, steps, width, orient="h", box_h=15*mm, gap=7*mm,
                 fill=SOFT, stroke=BRAND, text_color=INK, title=None, per_row=None):
        super().__init__()
        self.steps=steps; self.width=width; self.orient=orient
        self.box_h=box_h; self.gap=gap; self.fill=fill; self.stroke=stroke
        self.text_color=text_color; self.title=title
        if orient=="h":
            self.per_row = per_row or max(1, min(4, len(steps)))
            self.box_w = (width - (self.per_row-1)*gap) / self.per_row
            rows = -(-len(steps)//self.per_row)  # ceil
            self._h = rows*box_h + (rows-1)*gap + (6*mm if title else 0)
        else:
            self.box_w = width*0.72
            self._h = len(steps)*box_h + (len(steps)-1)*gap + (6*mm if title else 0)
    def wrap(self, aw, ah): return (self.width, self._h)
    def _box(self, x, y, w, h, label, sub=None):
        c=self.canv
        c.setFillColor(self.fill); c.setStrokeColor(self.stroke); c.setLineWidth(1)
        c.roundRect(x, y, w, h, 4, fill=1, stroke=1)
        c.setFillColor(self.text_color); c.setFont("Helvetica-Bold", 8.4)
        # wrap label into up to 3 lines
        words=label.split(); lines=[]; cur=""
        maxch=int(w/4.4)
        for wd in words:
            if len(cur)+len(wd)+1<=maxch: cur=(cur+" "+wd).strip()
            else: lines.append(cur); cur=wd
        if cur: lines.append(cur)
        lines=lines[:3]
        ty=y+h/2+ (len(lines)-1)*4.6/1 - 2
        ty=y+h - 5 - 8.4
        for i,ln in enumerate(lines):
            c.drawCentredString(x+w/2, y+h/2 + (len(lines)-1)*5.2/2 - i*5.2 - 3, ln)
        if sub:
            c.setFont("Helvetica", 6.6); c.setFillColor(MUTED)
            c.drawCentredString(x+w/2, y+3, sub)
    def _arrow(self, x1,y1,x2,y2):
        c=self.canv; c.setStrokeColor(self.stroke); c.setFillColor(self.stroke); c.setLineWidth(1.2)
        c.line(x1,y1,x2,y2)
        import math
        ang=math.atan2(y2-y1,x2-x1); a=2.4
        c.line(x2,y2, x2-a*math.cos(ang-0.5), y2-a*math.sin(ang-0.5))
        c.line(x2,y2, x2-a*math.cos(ang+0.5), y2-a*math.sin(ang+0.5))
    def draw(self):
        c=self.canv; top=self._h
        if self.title:
            c.setFillColor(NAVY); c.setFont("Helvetica-Bold", 9)
            c.drawString(0, top-9, self.title); top-=6*mm
        if self.orient=="h":
            for i,st in enumerate(self.steps):
                r=i//self.per_row; col=i%self.per_row
                x=col*(self.box_w+self.gap); y=top-self.box_h-r*(self.box_h+self.gap)
                sub=st[1] if isinstance(st,(list,tuple)) else None
                lab=st[0] if isinstance(st,(list,tuple)) else st
                self._box(x,y,self.box_w,self.box_h,lab,sub)
                if col<self.per_row-1 and i<len(self.steps)-1:
                    self._arrow(x+self.box_w+1, y+self.box_h/2, x+self.box_w+self.gap-1, y+self.box_h/2)
        else:
            x=(self.width-self.box_w)/2
            for i,st in enumerate(self.steps):
                y=top-self.box_h-i*(self.box_h+self.gap)
                sub=st[1] if isinstance(st,(list,tuple)) else None
                lab=st[0] if isinstance(st,(list,tuple)) else st
                self._box(x,y,self.box_w,self.box_h,lab,sub)
                if i<len(self.steps)-1:
                    self._arrow(x+self.box_w/2, y-1, x+self.box_w/2, y-self.gap+1)

# ---------------------------------------------------------------- Helpers ----
CONTENT_W = PAGE_W - LM - RM

def para(text, style="body"): return Paragraph(text, STYLES[style])
def small(text): return Paragraph(text, STYLES["small"])

def section(title):
    """Titre H1 -> notifié à la TOC (niveau 0)."""
    p = Paragraph(title, STYLES["h1"]); p._toc_level = 0; p._toc_text = _strip(title)
    return KeepTogether([p, HR(CONTENT_W, BRAND, 1.2, 3)])

def subsection(title):
    p = Paragraph(title, STYLES["h2"]); p._toc_level = 1; p._toc_text = _strip(title)
    return p

def h3(title): return Paragraph(title, STYLES["h3"])

def _strip(t):
    import re; return re.sub("<[^>]+>","",t)

def bullets(items):
    return [Paragraph(f"<font color='#0b6e58'>•</font>&nbsp; {it}", STYLES["bullet"]) for it in items]

def badge_cell(text):
    m = {
        "ACTIVE": (OK_BG,OK_FG), "ACTIF": (OK_BG,OK_FG), "OUI": (OK_BG,OK_FG), "CONFORME": (OK_BG,OK_FG),
        "PARTIEL": (PA_BG,PA_FG), "PARTIELLE": (PA_BG,PA_FG),
        "PRÉVU": (PL_BG,PL_FG), "PREVU": (PL_BG,PL_FG),
        "ABSENT": (NO_BG,NO_FG), "ÉCART": (NO_BG,NO_FG), "NON": (NO_BG,NO_FG), "MANQUANT": (NO_BG,NO_FG),
        "À VÉRIFIER": (VE_BG,VE_FG), "A VERIFIER": (VE_BG,VE_FG),
    }
    bg,fg = m.get(text.upper(), (VE_BG,VE_FG))
    st = ParagraphStyle("bdg", fontName="Helvetica-Bold", fontSize=7.4, leading=9,
                        textColor=fg, alignment=TA_CENTER, wordWrap=None, splitLongWords=False)
    t = Table([[Paragraph(text, st)]], colWidths=[len(text)*5.7+16])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),("BOX",(0,0),(-1,-1),0,bg),
                           ("TOPPADDING",(0,0),(-1,-1),2.5),("BOTTOMPADDING",(0,0),(-1,-1),2.5),
                           ("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4)]))
    return t

def data_table(header, rows, col_widths, zebra=True, header_bg=NAVY, font_size=8.2, align_center_cols=None):
    """Tableau standard. header: liste str. rows: liste de listes (str ou Flowable)."""
    align_center_cols = align_center_cols or []
    def mk(v, isheader=False, col=0):
        if isinstance(v, Flowable): return v
        stl = "cellh" if isheader else ("cellc" if col in align_center_cols else "cell")
        return Paragraph(str(v), STYLES[stl])
    data = [[mk(h, True, i) for i,h in enumerate(header)]]
    for r in rows:
        data.append([mk(v, False, i) for i,v in enumerate(r)])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    ts = [
        ("BACKGROUND",(0,0),(-1,0),header_bg),
        ("TEXTCOLOR",(0,0),(-1,0),WHITE),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("GRID",(0,0),(-1,-1),0.5,LINE),
        ("LINEBELOW",(0,0),(-1,0),1,header_bg),
        ("TOPPADDING",(0,0),(-1,-1),4),
        ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),5),
        ("RIGHTPADDING",(0,0),(-1,-1),5),
        ("FONTSIZE",(0,0),(-1,-1),font_size),
    ]
    if zebra:
        for i in range(1,len(data)):
            if i%2==0: ts.append(("BACKGROUND",(0,i),(-1,i),SOFT2))
    t.setStyle(TableStyle(ts))
    return t

def kv_table(pairs, key_w=48*mm, total_w=None):
    total_w = total_w or CONTENT_W
    data=[[Paragraph(k, STYLES["cellb"]), Paragraph(v, STYLES["cell"])] for k,v in pairs]
    t=Table(data, colWidths=[key_w, total_w-key_w])
    t.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("BACKGROUND",(0,0),(0,-1),SOFT),
        ("GRID",(0,0),(-1,-1),0.5,LINE),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
    ]))
    return t

def callout(title, body, kind="info"):
    palette = {"info":(SOFT,BRAND,BRAND_D), "warn":(PA_BG,PA_FG,PA_FG),
               "risk":(NO_BG,NO_FG,NO_FG), "ok":(OK_BG,OK_FG,OK_FG)}
    bg,bar,fg = palette.get(kind, palette["info"])
    inner=[]
    if title: inner.append(Paragraph(title, ParagraphStyle("cot", fontName="Helvetica-Bold",
                   fontSize=9, textColor=fg, spaceAfter=2)))
    inner.append(Paragraph(body, ParagraphStyle("cob", parent=STYLES["body"], alignment=TA_LEFT, textColor=INK)))
    t=Table([[inner]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),
        ("LINEBEFORE",(0,0),(0,-1),3,bar),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
        ("LEFTPADDING",(0,0),(-1,-1),9),("RIGHTPADDING",(0,0),(-1,-1),9)]))
    return t

def legend_badges(pairs):
    """pairs: [(label, key)] -> ligne de badges."""
    cells=[badge_cell(k) for _,k in pairs]
    labs=[Paragraph(l, STYLES["small"]) for l,_ in pairs]
    row=[]
    for b,l in zip(cells,labs):
        row.append(b); row.append(l)
    t=Table([row], colWidths=None)
    t.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("LEFTPADDING",(0,0),(-1,-1),2),("RIGHTPADDING",(0,0),(-1,-1),8)]))
    return t

# ---------------------------------------------------------------- Doc --------
class CRMDoc(BaseDocTemplate):
    def __init__(self, filename, meta, **kw):
        super().__init__(filename, pagesize=A4, leftMargin=LM, rightMargin=RM,
                         topMargin=TM, bottomMargin=BM, title=meta.get("title",""),
                         author=meta.get("author",""), **kw)
        self.meta=meta
        cover = PageTemplate(id="cover", frames=[Frame(0,0,PAGE_W,PAGE_H,id="c")],
                             onPage=self._cover_bg)
        body = PageTemplate(id="body",
                            frames=[Frame(LM, BM, CONTENT_W, PAGE_H-TM-BM, id="b")],
                            onPage=self._deco)
        self.addPageTemplates([cover, body])
    def _cover_bg(self, canv, doc):
        canv.saveState()
        canv.setFillColor(NAVY); canv.rect(0,0,PAGE_W,PAGE_H,fill=1,stroke=0)
        canv.setFillColor(BRAND_D); canv.rect(0,PAGE_H-6*mm,PAGE_W,6*mm,fill=1,stroke=0)
        canv.setFillColor(ACCENT); canv.rect(0,0,PAGE_W,4*mm,fill=1,stroke=0)
        # bande décorative
        canv.setStrokeColor(colors.HexColor("#22415a")); canv.setLineWidth(0.6)
        for i in range(6):
            canv.line(0, 40*mm+i*3*mm, PAGE_W, 40*mm+i*3*mm)
        canv.restoreState()
    def _deco(self, canv, doc):
        canv.saveState()
        # en-tête
        canv.setStrokeColor(LINE); canv.setLineWidth(0.6)
        canv.line(LM, PAGE_H-TM+6*mm, PAGE_W-RM, PAGE_H-TM+6*mm)
        canv.setFont("Helvetica", 7.5); canv.setFillColor(MUTED)
        canv.drawString(LM, PAGE_H-TM+8.5*mm, self.meta.get("running","CRM CGK/OPTIMIVV"))
        canv.drawRightString(PAGE_W-RM, PAGE_H-TM+8.5*mm, self.meta.get("confid","Confidentiel"))
        # pied
        canv.line(LM, BM-4*mm, PAGE_W-RM, BM-4*mm)
        canv.setFont("Helvetica", 7.5); canv.setFillColor(MUTED)
        canv.drawString(LM, BM-8*mm, self.meta.get("title",""))
        canv.drawRightString(PAGE_W-RM, BM-8*mm, "Page %d" % doc.page)
        canv.setFillColor(BRAND); canv.rect(LM, BM-8.6*mm-1, 12, 3, fill=1, stroke=0)
        canv.restoreState()
    def afterFlowable(self, flowable):
        lvl = getattr(flowable, "_toc_level", None)
        if lvl is not None:
            self.notify("TOCEntry", (lvl, getattr(flowable,"_toc_text",""), self.page))

def cover_story(meta):
    e=[]
    e.append(Spacer(1, 62*mm))
    e.append(Paragraph(meta.get("kicker","DOCUMENTATION OFFICIELLE"), STYLES["cover_kicker"]))
    e.append(Spacer(1, 4*mm))
    e.append(Paragraph(meta.get("title",""), STYLES["cover_title"]))
    e.append(Spacer(1, 4*mm))
    e.append(Paragraph(meta.get("subtitle",""), STYLES["cover_sub"]))
    e.append(Spacer(1, 30*mm))
    e.append(Paragraph(meta.get("meta_block",""), STYLES["cover_meta"]))
    e.append(NextPageTemplate("body"))
    e.append(PageBreak())
    return e

def toc_story():
    toc = TableOfContents(); toc.levelStyles = TOC_STYLES
    return [Paragraph("Sommaire", STYLES["toc_h"]), HR(CONTENT_W, BRAND,1.2,4), Spacer(1,6), toc,
            NextPageTemplate("body"), PageBreak()]
