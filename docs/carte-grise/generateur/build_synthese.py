# -*- coding: utf-8 -*-
"""LIVRABLE 2 — Synthèse dirigeant (document autonome, court)."""
import os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from reportlab.platypus import PageBreak, Spacer
import pdf_kit as K
import content_a as A

OUT = sys.argv[1] if len(sys.argv) > 1 else "SYNTHESE-DIRIGEANT-CRM-2026-09-30.pdf"
W = K.CONTENT_W

meta = dict(
    title="Synthèse dirigeant — CRM CGK/OPTIMIVV",
    author="Audit CRM CGK/OPTIMIVV",
    kicker="SYNTHÈSE DIRIGEANT",
    subtitle="Ce que fait le CRM, comment il fonctionne, son niveau d'achèvement",
    running="CRM CGK / OPTIMIVV — Synthèse dirigeant",
    confid="Confidentiel — usage interne",
    meta_block="Version 1.0 &nbsp;·&nbsp; 30 septembre 2026<br/>Extrait de la carte grise &amp; du cahier des charges de l'existant",
)

story = []
story += K.cover_story(meta)
story += A.synthese()
story.append(PageBreak())
story.append(K.section("Le parcours en un coup d'œil"))
story.append(Spacer(1, 4))
story.append(K.BoxFlow(["Lead entrant","Devis envoyé","Devis ouvert","Signé","Acompte payé","Encaissé"],
                       W, orient="h", per_row=3, box_h=15*K.mm, title="Cycle de vie d'un lead (Perdu = sortie possible)"))
story.append(Spacer(1, 8))
story.append(K.BoxFlow([("Commercial","vente"),("Handoff","dossier"),("Planification","intervenant"),
                        ("Intervention","photos"),("Facturation","acompte + solde"),("Clôture","soldé")],
                       W, orient="h", per_row=3, box_h=16*K.mm, title="Du commercial à la clôture"))
story.append(Spacer(1, 8))
story.append(K.callout("Pour aller plus loin",
    "Le détail complet (architecture, processus, rôles, permissions, automatisations, sécurité, registre des écarts) figure dans le document "
    "« Carte grise &amp; cahier des charges fonctionnel et technique du CRM » (version 1.0 du 30/09/2026).", "info"))

doc = K.CRMDoc(OUT, meta)
doc.multiBuild(story)
print("BUILT", OUT)
