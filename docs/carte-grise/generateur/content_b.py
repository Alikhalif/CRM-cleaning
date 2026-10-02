# -*- coding: utf-8 -*-
"""Contenu — Processus métier + Rôles + Pipeline/statuts + Devis/Signature + Facturation."""
from reportlab.platypus import Spacer
from reportlab.lib.units import mm
import pdf_kit as K

W = K.CONTENT_W
def sp(h=6): return Spacer(1, h)

# ===================================================== PROCESSUS DE BOUT EN BOUT
def processus():
    e = [K.section("5. Processus métier de bout en bout")]
    e.append(K.para("Le parcours complet, de l'arrivée du lead à la clôture du dossier, mobilise successivement le commercial puis la planification. "
                    "Les transitions de statut sont <b>monotones</b> (vers l'avant uniquement ; seul un administrateur peut revenir en arrière)."))
    e.append(K.subsection("5.1 Schéma 2 — Cycle de vie d'un lead"))
    e.append(K.BoxFlow([
        "Lead entrant", "Devis envoyé", "Devis ouvert", "Signé", "Acompte payé", "Encaissé",
    ], W, orient="h", per_row=3, box_h=15*mm, title="Statuts pipeline (Perdu = sortie possible à tout moment)"))
    e.append(sp(4))
    e.append(K.subsection("5.2 Schéma 3 — Du commercial à la clôture"))
    e.append(K.BoxFlow([
        ("Commercial","lead -> devis -> signature"),
        ("Handoff","création du dossier"),
        ("Planification","date + intervenant"),
        ("Intervention","réalisation + photos"),
        ("Facturation","acompte + solde"),
        ("Clôture","dossier soldé"),
    ], W, orient="h", per_row=3, box_h=16*mm))
    e.append(sp(6))
    e.append(K.subsection("5.3 Étapes détaillées"))
    e.append(K.data_table(["Étape","Acteur","Action / effet","Statut atteint","Automatisation / notification"], [
        ["Arrivée du lead","n8n / système","Formulaire web capté, normalisé (téléphone E.164, email, nom), dédoublonné, affecté via règles de routage","lead","Notif propriétaire « lead attribué » (sans provenance) ; notif Super Admin « nouveau lead » (avec provenance) ; email de centralisation par activité"],
        ["Qualification / appel","Commercial","Appel (Ringover), notes d'appel, NRP éventuel","lead","Audit de l'appel ; alerte « appel sans découverte » si pas de découverte"],
        ["Découverte","Commercial","Fiche de découverte (détails chantier, surface, délai souhaité, réaction prix)","lead","Ferme l'action « découverte » ; ouvre l'échéance « envoyer le devis »"],
        ["Photos (si requis)","Commercial / client","Demande de photos au client ; réception via réponse email ou upload","lead","Action « photos » bloque le devis tant qu'aucun média reçu"],
        ["Devis","Commercial","Création du devis (éditeur générique ou OPTIMIVV), totaux recalculés serveur","lead -> envoye","Passage « devis envoyé · mano » à l'envoi email"],
        ["Envoi / relance","Commercial / n8n","Envoi manuel (mano) ou séquence automatique WF2 (auto, 4 emails)","envoye","WF2 s'arrête si signé/perdu ; pixel/webhook d'ouverture -> ouvert"],
        ["Ouverture","Client","Ouverture du devis (suivi email)","ouvert","Remontée automatique envoye -> ouvert"],
        ["Signature","Client","Signature en ligne (lien sécurisé, PDF figé, preuve)","signe","Facture d'acompte auto si « avec acompte » (moteur générique) ; création du dossier ; notif propriétaire + planification"],
        ["Handoff","Système","Création idempotente du dossier « à planifier »","signe","Dossier transmis à la planification"],
        ["Planification","Planificateur","Date + créneau + intervenant (suggestion géographique)","dossier : planifie","Confirmation client (email) ; envoi à l'intervenant"],
        ["Intervention","Planificateur / intervenant","Démarrage puis « réalisé » ; photos avant/après","planifie -> en_cours -> finalise","Certificat de hotte si secteur nettoyage"],
        ["Facturation solde","Planificateur","Émission de la facture finale (devis moins acompte)","finalise","Facture FAC- ; encart acomptes à encaisser"],
        ["Encaissement / clôture","Planificateur","Marquage de la facture payée","dossier : solde ; lead : encaisse","Lead passe « encaissé » ; dossier « finalisé et soldé »"],
    ], [22*mm, 20*mm, 54*mm, 22*mm, 54*mm], font_size=7.1))
    return e

# ================================================================= RÔLES ======
def roles():
    e = [K.section("6. Documentation par rôle")]
    e.append(K.para("Quatre rôles existent au référentiel (admin, commercial, planification, assistant). Un utilisateur peut en cumuler plusieurs ; "
                    "les permissions effectives sont l'<b>union</b> des rôles détenus. Un sélecteur « Vue » permet de changer le rôle actif (libellé + écran "
                    "d'accueil, sans modifier les permissions) et, pour l'administrateur seul, un <b>aperçu en lecture seule</b> des rôles non détenus."))

    e.append(K.subsection("6.1 Commercial"))
    e.append(K.para("Parcours : réception du lead, appel, découverte, informations client, devis, envoi, relance, suivi jusqu'à la signature. "
                    "Cloisonné à ses propres leads par la RLS (il ne peut jamais lire les leads d'un autre commercial)."))
    e.append(K.data_table(["Ce qu'il voit / peut","Ce qu'il ne voit pas / ne peut pas"], [
        ["Ses leads, ses devis, ses clients, ses dossiers ; le pipeline de ses secteurs ; son tableau de bord personnel ; sa file d'actions du jour.",
         "La <b>provenance marketing</b> (site, URL, canal, UTM, gclid) — retirée du serveur, jamais transmise. Les leads d'autres commerciaux. Les modules d'administration."],
        ["Créer/éditer ses leads et devis ; appeler/envoyer SMS et emails ; lancer une relance ; générer un devis ; demander des photos.",
         "Supprimer un lead (admin seul) ; modifier les entités, le routage, les utilisateurs ; s'attribuer des privilèges (bloqué par déclencheur)."],
    ], [W/2, W/2], font_size=8))
    e.append(K.small("Boutons/alerts principaux : « Prochaine action » sur la fiche lead ; badges « Canal manquant » / « Acompte ? » sur les cartes ; "
                     "alertes découverte, photos, devis, relance."))
    e.append(sp(6))

    e.append(K.subsection("6.2 Planificateur / Administration"))
    e.append(K.para("Reçoit les dossiers validés (devis signés). Gère planning, facturation, acompte, attribution d'intervention, suivi, photos, solde et "
                    "clôture administrative. Lecture de tous les leads (sans droit d'écriture directe sur le lead) ; périmètre limité à ses pays."))
    for b in K.bullets([
        "Planifie l'intervention (date, créneau, intervenant avec suggestion géographique) ;",
        "Émet la facture finale, encaisse acompte et solde (garde de paiement avant « soldé ») ;",
        "Envoie les confirmations client et les fiches d'intervention aux sous-traitants ;",
        "Consulte photos avant/après ; génère le certificat de hotte ; gère contrats et attestations ;",
        "Voit la provenance des leads (au même titre que l'administrateur).",
    ]):
        e.append(b)
    e.append(sp(6))

    e.append(K.subsection("6.3 Super Admin"))
    e.append(K.para("Supervision générale, sans restriction de tenancy. Toutes les fonctions supplémentaires :"))
    e.append(K.data_table(["Domaine","Capacités"], [
        ["Vision globale", "Tous les leads, dossiers, devis, factures ; chiffre d'affaires ; performances ; classement des commerciaux."],
        ["Provenance &amp; stratégie", "Seul (avec le planificateur) à voir la provenance ; seul à voir les annotations Immobilier/Travaux confidentielles."],
        ["Utilisateurs", "Création, rôles, activités, pools de routage, drapeaux premium/extrême ; réglages société et modèles."],
        ["Présence &amp; contrôle", "Connexions, temps de présence, activité, dernière activité, historique des actions, alertes ; détail par utilisateur."],
        ["Paramétrage", "Secteurs, entités, routage, landing pages, modèles, intégrations, journal d'audit."],
    ], [40*mm, W-40*mm], font_size=8))
    e.append(sp(6))
    e.append(K.subsection("6.4 Assistant"))
    e.append(K.para("Rôle présent au référentiel et prévu par le cahier des charges pour une phase ultérieure. "
                    "<b>Inerte à ce jour</b> : aucune politique RLS ni contrôle applicatif ne lui accorde de droit particulier."))
    e.append(K.legend_badges([("Statut du rôle Assistant","PRÉVU")]))
    return e

# ===================================================== PIPELINE & STATUTS =====
def pipeline_statuts():
    e = [K.section("7. Pipeline et statuts du dossier")]
    e.append(K.subsection("7.1 Étapes du pipeline"))
    e.append(K.para("Le statut du lead repose sur <b>6 valeurs</b> (lead, envoye, ouvert, signe, encaisse, perdu). Le Kanban affiche <b>7 colonnes</b> : "
                    "il ajoute une colonne <i>dérivée</i> « Acompte payé » calculée à partir des factures payées (elle n'est pas un statut de lead). "
                    "Les transitions sont monotones (garde serveur : retour arrière réservé à l'administrateur ; « Perdu » toujours possible)."))
    e.append(K.subsection("7.2 Sous-statuts obligatoires"))
    e.append(K.data_table(["Dimension","Valeurs","Signification"], [
        ["Envoi (sub_envoi)", "mano / auto", "mano = envoyé manuellement après accord téléphonique ; auto = séquence n8n WF2"],
        ["Signature (sub_signature)", "sans / avec", "sans = paiement à la livraison ; avec = acompte dû -> facture d'acompte automatique"],
        ["Mode de signature", "logiciel / planificateur", "trace <i>comment</i> la signature a eu lieu (uniquement sur le moteur générique)"],
    ], [40*mm, 34*mm, W-74*mm], font_size=8))
    e.append(K.small("Un badge rouge « Canal manquant » (envoi) ou « Acompte ? » (signature) s'affiche sur la carte tant que le sous-statut requis n'est "
                     "pas renseigné. Le partage Mano/Auto est structurant pour l'analytique (vente à la main vs séquence) — à ne pas supprimer."))
    e.append(sp(6))
    e.append(K.subsection("7.3 Statuts du lead — détail"))
    e.append(K.data_table(["Statut","Définition","Entrée","Sortie / suivant","Rôle"], [
        ["lead", "Lead entrant à qualifier", "Capture WF1 / création manuelle", "-> envoye (devis envoyé) ou perdu", "Commercial"],
        ["envoye", "Devis envoyé (mano/auto)", "Envoi du devis", "-> ouvert / signe / perdu", "Commercial / n8n"],
        ["ouvert", "Devis ouvert par le client", "Ouverture (pixel / webhook)", "-> signe / perdu", "Client"],
        ["signe", "Devis signé", "Signature en ligne ou glisser-déposer", "-> encaisse ; crée le dossier", "Client / système"],
        ["encaisse", "Solde encaissé", "Facture finale payée", "Terminal (clôture)", "Planificateur"],
        ["perdu", "Affaire perdue", "Marquage manuel", "Terminal", "Commercial / Admin"],
    ], [20*mm, 40*mm, 40*mm, W-130*mm, 30*mm], font_size=7.4))
    e.append(sp(5))
    e.append(K.subsection("7.4 Statuts du dossier (après signature)"))
    e.append(K.data_table(["Statut","Libellé","Déclenché par","Suivant"], [
        ["a_planifier", "À planifier", "Handoff à la signature", "planifie"],
        ["planifie", "Planifié", "Planifier l'intervention (date + intervenant)", "en_cours / (reprogrammer)"],
        ["en_cours", "En cours de réalisation", "Démarrer la réalisation (jour J)", "finalise"],
        ["finalise", "Finalisé", "Marquer comme réalisé", "solde"],
        ["solde", "Finalisé et soldé", "Facture finale payée / « Marquer soldé » (garde de paiement)", "Terminal"],
    ], [26*mm, 40*mm, W-108*mm, 42*mm], font_size=7.6))
    e.append(K.small("Les statuts « Non finalisé » et « Finalisé attente solde » évoqués historiquement ne sont pas des valeurs distinctes : ils sont "
                     "représentés par composition (état + statut de paiement). « Finalisé et soldé » correspond à <i>solde</i>. Un flux d'annulation formel "
                     "(cancellation_reason) existe en colonne mais n'est pas câblé."))
    return e

# ===================================================== DEVIS & SIGNATURE ======
def devis_signature():
    e = [K.section("8. Devis et signature électronique")]
    e.append(K.para("Le CRM comporte <b>deux moteurs de devis</b> et <b>deux systèmes de signature</b>, hérités de l'histoire du produit. Le moteur et la "
                    "signature « OPTIMIVV » servent le cœur du business (nettoyage et déménagement) ; le moteur générique sert les autres secteurs et la "
                    "logique multi-société."))
    e.append(K.subsection("8.1 Deux moteurs de devis"))
    e.append(K.data_table(["Critère","Moteur générique (A)","Moteur OPTIMIVV (B)"], [
        ["Stockage", "documents + document_lines", "devis_optimivv (JSON + PDF)"],
        ["Rendu PDF", "@react-pdf/renderer", "pdfkit (gabarit figé)"],
        ["Secteurs", "tous (2 thèmes)", "nettoyage + déménagement"],
        ["TVA", "multi-taux", "franchise 293 B (TTC = HT)"],
        ["Identité société", "par legal_entities (multi-société)", "codée en dur (OPTIMIVV SAS)"],
        ["Éditeur", "/devis/new (catalogue prestations)", "/devis/nouveau"],
        ["Numérotation", "DEV-/FA-/FAC-2026-0001", "2026-00001 / FAC-2026-00001"],
        ["Facture d'acompte auto", "OUI", "NON (écart)"],
    ], [40*mm, (W-40*mm)/2, (W-40*mm)/2], font_size=7.7))
    e.append(K.small("Sécurité des calculs : dans le moteur générique, tous les montants (HT, remise, TVA par ligne, TTC, acompte, solde) sont "
                     "<b>recalculés côté serveur</b> — les totaux transmis par le client sont ignorés."))
    e.append(sp(6))
    e.append(K.subsection("8.2 Deux systèmes de signature"))
    e.append(K.data_table(["Critère","Signature principale (robuste)","Signature OPTIMIVV"], [
        ["Jeton", "aléatoire 32 o, seul le hachage est stocké", "signé HMAC (leadId~numero~horodatage)"],
        ["Liaison", "1:1 avec le document", "liée au couple (lead, numéro) exact"],
        ["Expiration", "30 jours", "60 jours"],
        ["Usage unique", "garde de statut en base", "garde d'idempotence (_signature_meta)"],
        ["Intégrité", "PDF figé + SHA-256 revérifié, PDF fusionné + certificat", "PDF régénéré (pas de chaîne SHA / certificat)"],
        ["Preuve / audit", "signature_events en ajout seul + certificat", "métadonnées (date, IP, UA)"],
    ], [34*mm, (W-34*mm)/2, (W-34*mm)/2], font_size=7.6))
    e.append(K.para("La signature OPTIMIVV a été <b>durcie</b> (recette du 24/09/2026) : l'ancien jeton était déterministe, sans expiration, non lié à un "
                    "devis précis et rejouable. Le nouveau jeton lie la signature au numéro exact, ajoute un horodatage et une fenêtre de 60 jours, et une "
                    "garde d'idempotence empêche tout rejeu. Point restant : le PDF OPTIMIVV est régénéré à la volée plutôt que figé à l'émission."))
    e.append(sp(6))
    e.append(K.subsection("8.3 Processus de signature (schéma 4)"))
    e.append(K.BoxFlow([
        "Création du devis", "Envoi (lien sécurisé)", "Ouverture client",
        "Signature en ligne", "Statut -> Signé", "Dossier + notifications",
    ], W, orient="h", per_row=3, box_h=15*mm))
    e.append(K.small("À la signature : le lead passe « signé », un dossier « à planifier » est créé de façon idempotente, le propriétaire et le rôle "
                     "planification sont notifiés, et le PDF signé est envoyé au client. Le mode de signature (logiciel/planificateur) n'est tracé que "
                     "sur le moteur générique."))
    return e

# ===================================================== FACTURATION ============
def facturation():
    e = [K.section("9. Facturation et paiement")]
    e.append(K.subsection("9.1 Facture d'acompte (automatique)"))
    e.append(K.para("À la signature d'un devis <b>générique</b> comportant un acompte (montant &gt; 0), une facture d'acompte (type <i>acompte</i>, statut "
                    "« envoyé », numéro FA-) est créée <b>automatiquement</b>, avec la TVA héritée du devis. L'opération est idempotente (une seule facture "
                    "d'acompte par devis, garantie par index unique)."))
    e.append(K.callout("Écart — acompte OPTIMIVV",
        "Les devis OPTIMIVV (nettoyage/déménagement) signés « avec acompte » ne génèrent <b>aucune</b> facture d'acompte automatique : il n'existe pas de "
        "ligne dans <i>documents</i> à laquelle rattacher la facture. À traiter (voir registre des écarts). Décision client du 24/09/2026 : laissé en l'état "
        "pour l'instant, à revoir avec le comptable.", "risk"))
    e.append(sp(4))
    e.append(K.subsection("9.2 Facture finale (manuelle)"))
    e.append(K.para("Après intervention « finalisée », le planificateur émet la facture finale (numéro FAC-). Sur le moteur générique, le montant vaut "
                    "« devis moins acompte » (répartition HT/TVA proportionnelle) ; l'opération est idempotente (une seule finale par devis). Un repli "
                    "OPTIMIVV reconstruit la facture depuis le devis signé lorsqu'il n'existe pas de document générique — mais cette facture OPTIMIVV "
                    "<b>ne déduit pas l'acompte</b> (hypothèse signalée « à valider »)."))
    e.append(sp(4))
    e.append(K.subsection("9.3 Encaissement et statuts de paiement"))
    for b in K.bullets([
        "Facture d'acompte payée -> dossier « acompte payé » ;",
        "Facture finale payée -> dossier « soldé » et lead « encaissé » ;",
        "Garde : « Marquer soldé » refuse si une facture finale émise n'est pas encore payée ;",
        "Encart « Acomptes à encaisser » sur la page Planification (montant TTC en attente).",
    ]):
        e.append(b)
    e.append(K.small("Le statut de paiement « retard » existe à l'ENUM mais n'est jamais posé automatiquement (il faudrait un job d'échéance) — à noter."))
    return e
