# -*- coding: utf-8 -*-
"""Contenu — Inventaire/checklist + Test global + Registre des écarts + Sécurité + Historique + Annexes."""
from reportlab.platypus import Spacer
from reportlab.lib.units import mm
import pdf_kit as K

W = K.CONTENT_W
def sp(h=6): return Spacer(1, h)
def bc(s): return K.badge_cell(s)

# ===================================================== INVENTAIRE (Livr. 3) ===
def inventaire():
    e = [K.section("16. Inventaire exhaustif des fonctionnalités (checklist de conformité)")]
    e.append(K.para("Chaque fonctionnalité est classée selon son état <b>réel</b> dans le code au 30/09/2026, et non sur la seule foi d'une demande."))
    rows = [
        ["Authentification (email + Google SSO), mot de passe 12+ / HIBP / anti-brute-force", bc("ACTIVE")],
        ["Cloisonnement multi-commercial (RLS « mine »)", bc("ACTIVE")],
        ["Confidentialité de la provenance (commercial)", bc("ACTIVE")],
        ["Annotation Immobilier/Travaux chiffrée (AES-GCM)", bc("ACTIVE")],
        ["Capture des leads WF1 (HMAC, dédup, routage propriétaire)", bc("ACTIVE")],
        ["Notifications différenciées + toast + son", bc("ACTIVE")],
        ["Pipeline Kanban 6 étapes + sous-statuts mano/auto, sans/avec", bc("ACTIVE")],
        ["Éditeur de devis générique (catalogue, recalcul serveur, multi-société)", bc("ACTIVE")],
        ["Moteur de devis OPTIMIVV (nettoyage + déménagement, franchise 293 B)", bc("ACTIVE")],
        ["Signature principale (jeton aléatoire, PDF figé, SHA-256, certificat)", bc("ACTIVE")],
        ["Signature OPTIMIVV durcie (jeton lié, TTL, idempotence)", bc("ACTIVE")],
        ["Facture d'acompte automatique (moteur générique)", bc("ACTIVE")],
        ["Facture d'acompte automatique (moteur OPTIMIVV)", bc("ABSENT")],
        ["Facture finale (générique, devis moins acompte)", bc("ACTIVE")],
        ["Facture finale OPTIMIVV (sans déduction d'acompte)", bc("PARTIEL")],
        ["Numérotation légale sans trou (DEV/FA/FAC/CTR/CERT)", bc("ACTIVE")],
        ["Handoff signature -> dossier (idempotent)", bc("ACTIVE")],
        ["Planification (table, intervenant, suggestion géographique)", bc("ACTIVE")],
        ["Planning glisser-déposer (calendrier)", bc("PRÉVU")],
        ["Interventions : cycle a_planifier -> ... -> solde", bc("ACTIVE")],
        ["Photos/vidéos par dossier (upload, visionneuse, partage)", bc("ACTIVE")],
        ["Distinction photos avant / après + contrôle post-intervention", bc("ABSENT")],
        ["Certificat de hotte (CERT-HOTTE-)", bc("ACTIVE")],
        ["Contrats dynamiques (hotte, désinsectisation, sous-traitance, attestation)", bc("ACTIVE")],
        ["Registre documentaire client + onglets fiche", bc("ACTIVE")],
        ["Séquence de relance WF2 (4 emails, gardes d'arrêt)", bc("PARTIEL")],
        ["Moteur d'actions commerciales (« prochaine action »)", bc("ACTIVE")],
        ["Présence, connexions, temps d'activité, alertes", bc("ACTIVE")],
        ["Journal d'audit (append-only, service-role)", bc("ACTIVE")],
        ["Multi-société + modèles de documents", bc("ACTIVE")],
        ["Ringover (webphone, SMS, screen-pop, click-to-call)", bc("PARTIEL")],
        ["Signature eIDAS Yousign/DocuSign", bc("ABSENT")],
        ["Google Ads Enhanced Conversions (gclid + TTC)", bc("ABSENT")],
        ["Rôle Assistant (phase 2)", bc("PRÉVU")],
        ["Responsive mobile/tablette (barre d'onglets, tables->cartes)", bc("ACTIVE")],
        ["Thème sombre, palette Cmd/Ctrl+K, recherche globale", bc("ACTIVE")],
        ["Modale d'onboarding (premier accès)", bc("ABSENT")],
        ["MFA / TOTP (Super Admin)", bc("ABSENT")],
    ]
    e.append(K.data_table(["Fonctionnalité","Statut"], rows, [W-40*mm, 40*mm], align_center_cols=[1], font_size=7.5))
    return e

def test_global():
    e = [K.section("17. Test fonctionnel global (simulation de dossier)")]
    e.append(K.para("Une recette réelle a été menée le 24/09/2026 sur la base de production (compte commercial jetable, appels webhook signés, "
                    "vérifications service-role, données étiquetées puis nettoyées). Résultats du parcours simulé :"))
    e.append(K.data_table(["Étape simulée","Résultat"], [
        ["Réception d'un lead (webhook signé)", "OK — lead créé, propriétaire notifié, audit=1"],
        ["Cloisonnement (commercial jetable)", "OK — ne voit que ses leads, provenance absente"],
        ["Devis + envoi", "OK — passage « envoyé », email émis"],
        ["Lien de signature + signature", "OK — statut « signé », vérifié via la page publique (5/5)"],
        ["Handoff -> dossier", "OK — un seul dossier créé (index unique), idempotent"],
        ["Facture d'acompte (générique)", "OK — une seule FA par devis"],
        ["Facture d'acompte (OPTIMIVV)", "ÉCART — aucune FA générée (documenté)"],
        ["Anti-escalade de privilèges", "OK — is_premium reste faux pour un commercial"],
        ["RLS cert_hotte / devis_optimivv", "OK — commercial ne lit rien (fuites fermées)"],
    ], [W-52*mm, 52*mm], font_size=7.8))
    e.append(K.small("Les cinq points bloquants (P1) identifiés en recette ont été corrigés et vérifiés en production (fuites RLS fermées, audit rétabli, "
                     "signature OPTIMIVV durcie, intégrité des dossiers, anti-escalade)."))
    return e

# ===================================================== REGISTRE DES ÉCARTS ====
def ecarts():
    e = [K.section("18. Registre des écarts et anomalies")]
    e.append(K.para("Différences entre le cahier des charges / les demandes et l'existant réel. Priorité indicative : P1 (à traiter vite), P2 (à planifier), "
                    "P3 (amélioration)."))
    e.append(K.data_table(["Fonction attendue","Conf.","Problème constaté","Correction","Prio"], [
        ["Confidentialité provenance sur tous les écrans", "Partiel",
         "L'écran Comptabilité/Documents force l'affichage de la provenance et n'est pas gardé par rôle ; un commercial propriétaire pourrait la recevoir",
         "Dériver l'autorisation du rôle réel (ou garder la page)", "P1"],
        ["Facture d'acompte à la signature", "Partiel",
         "Seul le moteur générique génère la FA ; OPTIMIVV (cœur du business) n'en génère aucune",
         "Générer une FA pour les devis OPTIMIVV « avec acompte »", "P2"],
        ["Facture finale = devis moins acompte", "Partiel",
         "Le repli OPTIMIVV facture le montant plein sans déduire l'acompte (« à valider »)",
         "Déduire l'acompte sur la finale OPTIMIVV", "P2"],
        ["Signature eIDAS (Yousign/DocuSign)", "Non",
         "Signature propriétaire (robuste) mais pas de prestataire eIDAS qualifié",
         "Qualifier juridiquement ou intégrer un prestataire eIDAS", "P2"],
        ["Google Ads Enhanced Conversions", "Non",
         "gclid capté et stocké, mais aucune remontée de conversion (signé/encaissé)",
         "Implémenter l'upload de conversions hors ligne", "P3"],
        ["Photos avant / après", "Non",
         "Pas de distinction avant/après ni d'alerte de photos manquantes post-intervention",
         "Ajouter le type avant/après + alerte sur dossier finalisé", "P3"],
        ["Planning glisser-déposer", "Non",
         "La planification est une table filtrable, pas un calendrier drag-and-drop",
         "Ajouter la vue calendrier (optionnel)", "P3"],
        ["IBAN/BIC des sociétés protégés", "Partiel",
         "legal_entities.iban/bic lisibles par tout utilisateur authentifié (using(true)) et non chiffrés",
         "Restreindre la lecture + chiffrer au repos", "P2"],
        ["Statut « retard » de facture", "Partiel",
         "Valeur d'ENUM présente mais jamais posée automatiquement",
         "Job d'échéance qui pose « retard »", "P3"],
        ["Séquence WF2 complète", "Partiel",
         "Le CRM ne transmet pas quote_url / quote_ref -> paramètres vides dans les emails ; cadence 24/72/120 h (vs CDC J+0/3/7/14)",
         "Transmettre les paramètres ; confirmer la cadence avec le client", "P2"],
        ["Rôle Assistant", "Non",
         "Présent au référentiel, aucune politique/permission",
         "Activer en phase ultérieure", "P3"],
        ["Contrôle d'intégrité des statuts texte", "Partiel",
         "contracts/passages/actions : colonnes texte sans contrainte CHECK",
         "Ajouter des CHECK ou ENUM", "P3"],
        ["MFA / TOTP Super Admin", "Non",
         "Non implémenté côté application",
         "Activer la MFA (Supabase) pour les administrateurs", "P2"],
    ], [30*mm, 14*mm, 70*mm, 46*mm, 12*mm], font_size=6.9, align_center_cols=[1,4]))
    e.append(K.small("Les écrans /comptabilite, /signatures ne portent pas de garde de rôle en page (ils reposent sur la RLS et la visibilité du menu) — "
                     "à harmoniser avec /documents si l'on souhaite un back-office strictement réservé."))
    return e

# ===================================================== SÉCURITÉ & MAINTENANCE =
def securite():
    e = [K.section("19. Sécurité, conformité et recommandations")]
    e.append(K.subsection("19.1 Posture de sécurité réellement implémentée"))
    for b in K.bullets([
        "RLS sur chaque table métier ; clé service-role jamais exposée au navigateur ;",
        "Mot de passe : 12 caractères minimum, vérification HaveIBeenPwned (k-anonymat), anti-enumération à la réinitialisation ;",
        "Anti-force-brute à la connexion (5 tentatives / 15 min, verrou exponentiel) ;",
        "Chiffrement applicatif AES-256-GCM des champs sensibles (provenance, annotation Immo/Travaux) ;",
        "Signature à preuve : PDF figé + SHA-256 + événements en ajout seul + certificat ;",
        "Journal d'audit append-only via service-role (résout l'auteur au mieux) ; déclencheur anti-escalade de privilèges ;",
        "URL de fichiers signées à durée limitée (60 min) ; buckets privés.",
    ]):
        e.append(b)
    e.append(sp(5))
    e.append(K.subsection("19.2 Points de sécurité à renforcer"))
    for b in K.bullets([
        "<b>MFA/TOTP</b> non implémentée (le CDC l'exige pour le Super Admin) ;",
        "<b>IBAN/BIC</b> des sociétés lisibles par tout authentifié et non chiffrés ;",
        "<b>Provenance</b> sur l'écran Comptabilité/Documents (voir écart P1) ;",
        "Limitation de débit uniquement sur la connexion (pas sur les autres points d'entrée) ;",
        "Vérification HIBP non appliquée aux comptes créés par l'administrateur.",
    ]):
        e.append(b)
    e.append(sp(5))
    e.append(K.subsection("19.3 Recommandations de maintenance"))
    for b in K.bullets([
        "Conserver la discipline « additif, non cassant » et vérifier chaque lot par un build réel ;",
        "Traiter en priorité les écarts P1/P2 du registre (provenance comptabilité, acompte OPTIMIVV, IBAN, MFA) ;",
        "Documenter la coexistence des deux moteurs (générique vs OPTIMIVV) et viser une convergence à terme ;",
        "Faire valider par un juriste le contenu des nouveaux contrats et la qualification eIDAS de la signature ;",
        "Mettre en place la supervision (Sentry) et des vues KPI matérialisées (phase 3 du CDC).",
    ]):
        e.append(b)
    return e

# ===================================================== HISTORIQUE =============
def historique():
    e = [K.section("20. Historique et versions du CRM")]
    e.append(K.para("Chronologie synthétique des grands lots d'évolution (d'après l'historique projet) :"))
    e.append(K.data_table(["Période","Évolution"], [
        ["Fondations", "Modèle de données + RLS, auth &amp; rôles + vue multi-rôle, dashboard, pipeline + sous-statuts, leads &amp; devis, signature, WF1, WF2, facture finale manuelle"],
        ["Juin 2026", "Backlog client : routage/premium, secteur Débarras, techniciens géo, devis multi-société, NRP, email planificateur"],
        ["Juillet 2026", "Multi-société / multi-pays (Diogène, pays, registre LP, profils commerciaux + routage, leads à affecter, recherche) ; refonte rôles/routage + Canada"],
        ["Juillet 2026", "Assistant commercial guidé (découverte enrichie) ; bibliothèque de modèles par rôle/audience ; Ringover webphone + SMS + templates"],
        ["Août 2026", "Correctif signature -> planification + deux modes de signature ; module Photos &amp; Vidéos par dossier ; sécurité (throttle, HMAC, signature)"],
        ["Septembre 2026", "Responsive mobile/tablette ; module Actions &amp; Relances commerciales ; module Documents &amp; Contrats (hotte, désinsectisation)"],
        ["19-24 sept. 2026", "Recette complète avant prod (cartographie + tests réels) ; correction des 5 bloquants P1 + P2 ; déploiement et vérification en production"],
        ["19-26 sept. 2026", "Chaîne d'arrivée des leads + confidentialité de la provenance ; contrat de sous-traitance + attestation de propreté"],
        ["30 sept. 2026", "Production de la présente carte grise / cahier des charges de l'existant"],
    ], [30*mm, W-30*mm], font_size=7.4))
    return e

# ===================================================== ANNEXES ================
def annexes():
    e = [K.section("Annexes")]
    e.append(K.subsection("A. Variables de configuration (noms uniquement)"))
    e.append(K.para("Aucune valeur secrète n'est publiée. Les secrets sont configurés par variables d'environnement (conteneur de production) et jamais "
                    "dans le code ni ce document."))
    e.append(K.data_table(["Domaine","Variables"], [
        ["Supabase", "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"],
        ["Chiffrement", "FIELD_ENCRYPTION_KEY"],
        ["Webhooks", "LEADS_INBOUND_SECRET, BREVO_INBOUND_SECRET, BREVO_EVENTS_TOKEN, RINGOVER_WEBHOOK_SECRET"],
        ["n8n", "WF2_TRIGGER_SECRET, N8N_TO_CRM_BEARER"],
        ["Email / SMS", "BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SMS_SENDER, BREVO_TPL_E1..E4"],
        ["Centralisation", "LEAD_CENTRAL_EMAIL_ENABLED (false), LEAD_CENTRAL_EMAIL_NETTOYAGE, LEAD_CENTRAL_EMAIL_DEMENAGEMENT"],
        ["Devis (identité)", "DEVIS_SENDER_*, DEVIS_BASE_URL_*, DEVIS_TRACK_SECRET"],
        ["Téléphonie", "RINGOVER_API_KEY, RINGOVER_API_BASE"],
        ["Cron", "PRESENCE_CRON_SECRET"],
    ], [34*mm, W-34*mm], font_size=7.6))
    e.append(sp(6))
    e.append(K.subsection("B. Buckets de stockage (privés)"))
    e.append(K.para("lead-media (photos/vidéos) · signed-documents (signatures) · devis-optimivv (devis/factures/certificats OPTIMIVV) · "
                    "client-documents (registre + contrats). Accès par URL signée uniquement."))
    e.append(K.subsection("C. Fonctions de numérotation (RPC)"))
    e.append(K.para("next_doc_num, next_devis_optimivv_num, next_facture_optimivv_num, next_cert_hotte_num, next_contract_num — toutes en SECURITY "
                    "DEFINER, attribution atomique par compteur annuel."))
    e.append(K.subsection("D. Glossaire"))
    e.append(K.data_table(["Terme","Définition"], [
        ["RLS", "Row Level Security — filtrage des lignes au niveau base selon l'utilisateur"],
        ["Handoff", "Transmission du dossier du commercial vers la planification à la signature"],
        ["Mano / Auto", "Devis envoyé à la main vs via la séquence automatique n8n"],
        ["Sans / Avec", "Signature sans acompte (paiement livraison) vs avec acompte"],
        ["Franchise 293 B", "Franchise en base de TVA (art. 293 B CGI) : TVA non applicable, TTC = HT"],
        ["OPTIMIVV", "Marque et moteur de devis dédié nettoyage + déménagement"],
        ["eIDAS", "Règlement européen sur la signature électronique qualifiée"],
    ], [34*mm, W-34*mm], font_size=7.8))
    e.append(sp(8))
    e.append(K.HR(W, K.BRAND, 1.0, 3))
    e.append(K.small("Fin du document — Carte grise &amp; cahier des charges fonctionnel et technique du CRM CGK/OPTIMIVV, version 1.0 du 30/09/2026. "
                     "Document produit par inspection du code ; toute information non vérifiable est signalée « À VÉRIFIER »."))
    return e
