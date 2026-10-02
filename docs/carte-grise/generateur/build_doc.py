# -*- coding: utf-8 -*-
"""Assemble le document PDF complet — LIVRABLE 1 : Carte grise & CDC du CRM."""
import os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from reportlab.platypus import PageBreak
import pdf_kit as K
import content_a as A, content_b as B, content_c as C, content_d as D

OUT = sys.argv[1] if len(sys.argv) > 1 else "CARTE-GRISE-CRM-2026-09-30.pdf"

meta = dict(
    title="Carte grise & CDC — CRM CGK/OPTIMIVV",
    author="Audit CRM CGK/OPTIMIVV",
    kicker="DOCUMENTATION OFFICIELLE — RÉFÉRENCE DE L'EXISTANT",
    subtitle="Carte grise &amp; cahier des charges fonctionnel et technique du CRM",
    running="CRM CGK / OPTIMIVV — Carte grise & CDC",
    confid="Confidentiel — usage interne",
    meta_block="Version 1.0 &nbsp;·&nbsp; 30 septembre 2026 &nbsp;·&nbsp; Périmètre : application complète<br/>"
               "Next.js 16 · Supabase · n8n · Brevo · Ringover",
)

story = []
story += K.cover_story(meta)
story += K.toc_story()

# Parties liminaires + Synthèse dirigeant
story += A.front_matter();      story.append(PageBreak())
story += A.synthese();          story.append(PageBreak())
# Corps
story += A.presentation();      story.append(PageBreak())
story += A.architecture();      story.append(PageBreak())
story += A.data_model();        story.append(PageBreak())
story += A.cartographie_pages();story.append(PageBreak())
story += B.processus();         story.append(PageBreak())
story += B.roles();             story.append(PageBreak())
story += B.pipeline_statuts();  story.append(PageBreak())
story += B.devis_signature();   story.append(PageBreak())
story += B.facturation();       story.append(PageBreak())
story += C.planification();     story.append(PageBreak())
story += C.medias();            story.append(PageBreak())
story += C.emails();            story.append(PageBreak())
story += C.automatisations();   story.append(PageBreak())
story += C.integrations();      story.append(PageBreak())
story += C.matrice();           story.append(PageBreak())
story += D.inventaire();        story.append(PageBreak())
story += D.test_global();       story.append(PageBreak())
story += D.ecarts();            story.append(PageBreak())
story += D.securite();          story.append(PageBreak())
story += D.historique();        story.append(PageBreak())
story += D.annexes()

doc = K.CRMDoc(OUT, meta)
doc.multiBuild(story)
print("BUILT", OUT)
