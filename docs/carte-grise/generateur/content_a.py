# -*- coding: utf-8 -*-
"""Contenu — Parties liminaires + Présentation + Architecture + Données + Pages."""
from reportlab.platypus import Spacer, PageBreak
from reportlab.lib.units import mm
import pdf_kit as K

W = K.CONTENT_W
def sp(h=6): return Spacer(1, h)

# ============================================================ FRONT MATTER ===
def front_matter():
    e = [K.section("Fiche d'identité du document")]
    e.append(K.kv_table([
        ("Titre", "Carte grise &amp; cahier des charges fonctionnel et technique — CRM CGK / OPTIMIVV"),
        ("Version", "1.0 — document de référence de l'existant"),
        ("Date", "30 septembre 2026"),
        ("Objet", "Documenter le CRM <b>tel qu'il existe aujourd'hui</b> : fonctionnalités, processus métier, rôles et droits, automatisations, architecture technique, écarts. Sert de carte grise (référence) et de dossier de reprise pour un nouveau développeur."),
        ("Périmètre", "Intégralité de l'application (Next.js 16 / Supabase) : pages, base de données, RLS, workflows n8n, emails, devis, signatures, facturation, planification, interventions, médias, présence, notifications."),
        ("Auteur", "Audit de code assisté (6 inspections parallèles du dépôt) + revue et rédaction."),
        ("Méthode", "Croisement de trois sources : (1) l'historique des demandes, (2) le code et la structure technique, (3) le comportement réel vérifié en recette."),
        ("Confidentialité", "Document interne. Aucun secret (clé, mot de passe, token) n'y figure — seules les <i>variables de configuration</i> sont nommées."),
    ]))
    e.append(sp(8))
    e.append(K.subsection("Méthode d'audit et règle d'or"))
    e.append(K.para("Le présent document a été produit par inspection méthodique du dépôt (55 migrations de schéma, l'ensemble des routes de l'application, les couches de données, les webhooks et les workflows n8n), puis croisement avec la recette fonctionnelle réelle menée le 24 septembre 2026 (tests dynamiques sur la base de production : compte commercial jetable, appels webhook signés, vérifications service-role). La règle appliquée est stricte :"))
    for b in K.bullets([
        "aucune fonctionnalité n'est déclarée « terminée » sur la seule foi d'une demande passée : elle est <b>vérifiée dans le code</b> ;",
        "une information non vérifiable est marquée « À VÉRIFIER » ;",
        "une fonctionnalité demandée mais introuvable est signalée comme <b>écart</b> ;",
        "les dernières décisions du client priment sur les consignes antérieures contradictoires.",
    ]):
        e.append(b)
    e.append(sp(6))
    e.append(K.subsection("Convention de statut employée dans tout le document"))
    e.append(K.legend_badges([("Actif / conforme","ACTIVE"), ("Partiellement implémenté","PARTIEL"),
                              ("Prévu (non terminé)","PRÉVU"), ("Écart / absent","ABSENT"),
                              ("À vérifier","À VÉRIFIER")]))
    e.append(sp(4))
    e.append(K.small("« Actif » = présent et opérationnel dans le code. « Partiel » = présent mais incomplet ou limité à un moteur. "
                     "« Prévu » = prévu par le cahier des charges, non livré. « Écart / absent » = attendu mais non trouvé, ou divergence à corriger. "
                     "« À vérifier » = à confirmer par un test terrain."))
    e.append(sp(6))
    e.append(K.callout("Avertissement",
        "Le contenu <b>juridique</b> des modèles de contrats récemment ajoutés (sous-traitance, attestation de propreté) est un contenu standard, "
        "<b>à faire valider par un juriste</b> avant usage contractuel. Les montants, taux et libellés métier reflètent l'état du code au 30/09/2026.", "warn"))
    return e

# ================================================ SYNTHÈSE DIRIGEANT (Livr.2) =
def synthese():
    e = [K.section("Résumé exécutif — synthèse dirigeant"), K.para(
        "Le CRM est la plateforme commerciale interne d'une PME de services multi-secteurs (B2B et B2C) opérant sous les marques "
        "<b>OPTIMIVV Nettoyage</b> et <b>OPTIMIVV Déménagement</b>. Il remplace un ensemble de tableurs et d'emails par une chaîne unique qui va "
        "de l'arrivée d'un lead publicitaire jusqu'à l'encaissement du solde, en passant par le devis, la signature électronique, la facturation, "
        "la planification de l'intervention et sa clôture.")]
    e.append(K.subsection("Ce que fait le CRM, en bref"))
    for b in K.bullets([
        "<b>Capte les leads</b> des sites et landing pages (via l'automate n8n), les dédoublonne, les affecte à un commercial et le notifie ;",
        "<b>Pilote le cycle de vente</b> sur un tableau Kanban à 6 étapes (Lead, Devis envoyé, Devis ouvert, Signé, Encaissé, Perdu) ;",
        "<b>Émet devis et factures</b> (acompte automatique, facture finale) avec numérotation légale sans trou, sur plusieurs sociétés ;",
        "<b>Fait signer</b> les devis en ligne (lien sécurisé, PDF figé, preuve de signature) ;",
        "<b>Transmet le dossier</b> signé à la planification, qui affecte un intervenant, suit l'intervention, gère photos et solde ;",
        "<b>Supervise</b> : tableau de bord, performances commerciales, présence des utilisateurs, actions à mener et alertes.",
    ]):
        e.append(b)
    e.append(sp(6))
    e.append(K.subsection("Les rôles"))
    e.append(K.data_table(["Rôle","Périmètre"], [
        ["Super Admin", "Vision globale, chiffre d'affaires, tous les leads et dossiers, utilisateurs, paramétrage, présence, provenance des leads."],
        ["Commercial", "Cloisonné à ses propres leads ; ne voit jamais la provenance marketing ni les informations stratégiques."],
        ["Planificateur", "Planning, comptabilité, intervenants, interventions ; lecture des leads ; périmètre limité à ses pays."],
        ["Assistant", "Prévu par le cahier des charges pour une phase ultérieure — non activé à ce jour."],
    ], [40*mm, W-40*mm]))
    e.append(sp(6))
    e.append(K.subsection("Automatisations principales"))
    for b in K.bullets([
        "<b>WF1 (n8n)</b> — capture et normalisation des leads depuis les formulaires web, routage email par activité, notification différenciée ;",
        "<b>WF2 (n8n)</b> — séquence de relance de devis (4 emails espacés), qui s'arrête dès signature ou perte ;",
        "<b>Moteur d'actions commerciales</b> — calcule en continu la « prochaine action » par lead (découverte, photos, devis, relance) ;",
        "<b>Moteur de présence et d'alertes</b> — connexions, temps d'activité, lead non traité, absence, devis non envoyé, dossier bloqué ;",
        "<b>Facture d'acompte automatique</b> à la signature d'un devis « avec acompte » (moteur générique).",
    ]):
        e.append(b)
    e.append(sp(6))
    e.append(K.subsection("Niveau réel d'achèvement"))
    e.append(K.para("Le cœur du parcours (capture -> devis -> signature -> handoff -> planification -> facturation -> clôture) est <b>opérationnel et sécurisé</b> "
                    "(cloisonnement par RLS, confidentialité de la provenance, signature à preuve, numérotation sans trou). Les cinq points bloquants "
                    "identifiés en recette ont été corrigés et vérifiés en production. Restent des <b>points d'amélioration</b> connus, listés au registre des écarts."))
    e.append(K.data_table(["Domaine","Maturité"], [
        ["Capture leads, cloisonnement, confidentialité provenance", K.badge_cell("ACTIVE")],
        ["Pipeline, devis, signature, facturation, planification, clôture", K.badge_cell("ACTIVE")],
        ["Présence, actions commerciales, alertes, notifications", K.badge_cell("ACTIVE")],
        ["Facture d'acompte auto côté OPTIMIVV (nettoyage/déménagement)", K.badge_cell("PARTIEL")],
        ["Remontée des conversions vers Google Ads", K.badge_cell("ABSENT")],
        ["Planning glisser-déposer, distinction photos avant/après, rôle Assistant", K.badge_cell("PRÉVU")],
    ], [W-42*mm, 42*mm], align_center_cols=[1]))
    e.append(sp(6))
    e.append(K.subsection("Points restant à finaliser (priorisés)"))
    for b in K.bullets([
        "<b>P1</b> — Aligner la confidentialité de la provenance sur l'écran Comptabilité/Documents (voir registre des écarts) ;",
        "<b>P2</b> — Générer une facture d'acompte pour les devis OPTIMIVV signés « avec acompte » ;",
        "<b>P2</b> — Déduire l'acompte sur la facture finale OPTIMIVV ;",
        "<b>P3</b> — Google Ads Enhanced Conversions ; planning glisser-déposer ; photos avant/après ; activation du rôle Assistant.",
    ]):
        e.append(b)
    return e

# ==================================================== PRÉSENTATION GÉNÉRALE ===
def presentation():
    e = [K.section("1. Présentation générale")]
    e.append(K.para("CRM commercial interne destiné à une équipe initiale d'environ dix utilisateurs répartis sur plusieurs villes françaises "
                    "(extension multi-pays FR / CH / LU / BE / CA prévue au modèle de données). Volumétrie de référence : environ 150 leads, 80 devis "
                    "et 30 signatures par mois, avec un objectif de tenue de charge au quintuple sans restructuration."))
    e.append(K.subsection("1.1 Secteurs d'activité (référentiel réel en base)"))
    e.append(K.para("Le cahier des charges décrit quatre secteurs ; la base en compte huit, gérés dynamiquement dans la table <i>activities</i>. "
                    "Chaque secteur porte un taux d'acompte, un taux de TVA et une fourchette de devis par défaut."))
    e.append(K.data_table(["Secteur (slug)","Acompte / TVA (référence CDC)","Marque / moteur devis"], [
        ["Dépannage urgence (urgence)", "0 % / 20 %", "—"],
        ["Nettoyage (nettoyage)", "20 % / 20 %", "OPTIMIVV Nettoyage (franchise 293 B)"],
        ["Nettoyage difficile (nettoyage_difficile)", "voir Nettoyage", "OPTIMIVV Nettoyage"],
        ["Énergies renouvelables (enr)", "30 % / 10 %", "moteur générique"],
        ["Rénovation bâtiment (renovation)", "40 % / 10 %", "moteur générique"],
        ["Débarras (debarras)", "À VÉRIFIER (paramétrable)", "visuel Nettoyage"],
        ["Déménagement (demenagement)", "30 % par défaut", "OPTIMIVV Déménagement (franchise 293 B)"],
        ["Diogène (diogene)", "À VÉRIFIER (paramétrable)", "moteur générique"],
    ], [58*mm, 52*mm, W-110*mm]))
    e.append(K.small("Les taux d'acompte/TVA sont éditables dans les Paramètres ; ne jamais les coder en dur. Les secteurs OPTIMIVV Nettoyage et "
                     "Déménagement appliquent la franchise en base de TVA (article 293 B du CGI) : TTC = HT."))
    e.append(sp(6))
    e.append(K.subsection("1.2 Deux identités de marque"))
    e.append(K.para("Le CRM sert deux marques commerciales avec des identités visuelles et des adresses d'expédition distinctes : "
                    "<b>OPTIMIVV Nettoyage</b> (devispro@optimivv-nettoyage.com) et <b>OPTIMIVV Déménagement</b> (devispro@optimivv-demenagement.com). "
                    "L'entité juridique émettrice (raison sociale, SIRET, TVA, IBAN) est portée par la table <i>legal_entities</i> pour le moteur générique, "
                    "et codée en dur (société OPTIMIVV SAS) pour le moteur OPTIMIVV."))
    return e

# ====================================================== ARCHITECTURE (Sch.1) ==
def architecture():
    e = [K.section("2. Architecture technique")]
    e.append(K.subsection("2.1 Pile technologique"))
    e.append(K.data_table(["Couche","Technologie"], [
        ["Frontend / SSR", "Next.js 16.2 (App Router, Turbopack), React 19.2, TypeScript strict, modules SCSS"],
        ["Backend / données", "Supabase — PostgreSQL, Auth (JWT), Realtime, Storage (buckets privés)"],
        ["Sécurité données", "RLS (Row Level Security) sur chaque table métier ; chiffrement applicatif AES-256-GCM des champs sensibles"],
        ["PDF", "@react-pdf/renderer (moteur générique) et pdfkit (moteur OPTIMIVV, gabarit figé)"],
        ["Automatisation", "n8n auto-hébergé (WF1 capture, WF2 relance)"],
        ["Email / SMS", "Brevo (transactionnel + séquences)"],
        ["Téléphonie", "Ringover (click-to-call, webphone, SMS, screen-pop)"],
    ], [42*mm, W-42*mm]))
    e.append(sp(6))
    e.append(K.subsection("2.2 Schéma 1 — Architecture générale"))
    e.append(K.BoxFlow([
        ("Sites &amp; Landing Pages","formulaires web"),
        ("n8n — WF1 / WF2","normalisation, HMAC, relances"),
        ("CRM Next.js","RSC, API, actions serveur"),
        ("Supabase","Postgres + Auth + RLS + Storage + Realtime"),
    ], W, orient="h", per_row=2, box_h=17*mm, title="Chaîne d'ingestion et de traitement"))
    e.append(sp(4))
    e.append(K.para("Services externes rattachés au CRM : <b>Brevo</b> (emails/SMS et réponses clients entrantes), <b>Ringover</b> (événements d'appel), "
                    "<b>Yousign/DocuSign</b> (prévu au CDC — la signature réellement implémentée est <i>propriétaire</i>, voir partie 8), <b>Google Ads</b> "
                    "(remontée de conversions prévue — non implémentée)."))
    e.append(sp(6))
    e.append(K.subsection("2.3 Structure des routes et porte d'authentification"))
    for b in K.bullets([
        "<b>app/(app)/</b> — pages authentifiées (barre latérale + barre haute) : dashboard, pipeline, leads, planification, comptabilité, etc. ;",
        "<b>app/(auth)/</b> — pages publiques : login, signup, mot de passe oublié / réinitialisation (SSO Google inclus) ;",
        "<b>app/sign/[token]</b> et <b>app/devis-signer/[token]</b> — pages publiques de signature (authentifiées par jeton) ;",
        "<b>proxy.ts</b> — porte d'authentification (Next 16 a renommé <i>middleware</i> en <i>proxy</i>) : valide la session via getUser() et redirige vers /login.",
    ]):
        e.append(b)
    e.append(sp(6))
    e.append(K.subsection("2.4 Trois niveaux d'accès Supabase (à ne jamais mélanger)"))
    e.append(K.data_table(["Client","Clé","Usage","RLS"], [
        ["supabaseBrowser()", "anon", "Code client « use client »", "Appliquée"],
        ["supabaseServer()", "anon + cookie", "RSC / routes / actions serveur, en tant qu'utilisateur connecté", "Appliquée"],
        ["supabaseServiceRole()", "service-role", "Webhooks / cron / code sans session (protégé par « server-only »)", "Contournée"],
    ], [40*mm, 26*mm, W-92*mm, 26*mm], align_center_cols=[3]))
    e.append(K.small("La clé service-role n'est jamais exposée au navigateur (jamais préfixée NEXT_PUBLIC). Les lectures applicatives des tableaux de "
                     "bord d'administration passent par service-role ; les pages correspondantes sont donc gardées par un contrôle de rôle explicite."))
    e.append(sp(6))
    e.append(K.subsection("2.5 Stockage de fichiers"))
    e.append(K.para("Quatre buckets Supabase <b>privés</b> : <i>lead-media</i> (photos/vidéos), <i>signed-documents</i> (PDF de signature), "
                    "<i>devis-optimivv</i> (devis/factures/certificats OPTIMIVV), <i>client-documents</i> (registre documentaire et contrats). "
                    "Aucun accès public : les fichiers sont servis par URL signée à durée limitée (60 min)."))
    return e

# ========================================================= MODÈLE DE DONNÉES ==
def data_model():
    e = [K.section("3. Modèle de données")]
    e.append(K.para("Environ cinquante tables sous le schéma <i>public</i>. Conventions : clés primaires UUID, horodatage en UTC, ENUM PostgreSQL pour "
                    "les états, suppression logique (deleted_at) sauf obligation d'effacement, journal d'audit en ajout seul, numérotation par type et "
                    "par année sans trou. Les noms de colonnes SQL suivent le CDC (client_first_name, ...) ; les types TypeScript exposent une forme "
                    "camelCase, les mappeurs -server.ts font le pont."))
    e.append(K.subsection("3.1 Inventaire des tables par domaine"))
    e.append(K.data_table(["Domaine","Tables principales"], [
        ["Référentiel", "activities, lead_sources, payment_terms, prestations, legal_entities, legal_entity_activities, landing_pages, routing_rules, message_templates, document_templates, app_settings"],
        ["Utilisateurs &amp; rôles", "users, roles, user_roles, user_activities, user_permissions"],
        ["Pipeline &amp; clients", "leads, clients"],
        ["Documents &amp; facturation", "documents, document_lines, doc_counters"],
        ["Signature (principale)", "signature_requests, signature_events"],
        ["Planification / interventions", "dossiers, technicians, intervenant_consultations"],
        ["Médias", "lead_media"],
        ["Contrats &amp; certificats", "contracts, contract_templates, contract_passages, contract_counters, client_documents, cert_hotte, cert_hotte_counters"],
        ["OPTIMIVV (devis/factures)", "devis_optimivv, devis_optimivv_counters, facture_optimivv_counters"],
        ["Présence &amp; actions", "user_presence, user_sessions, presence_pings, activity_daily_summary, presence_config, work_schedules, work_absences, alert_rules, alerts, commercial_actions, commercial_action_rules, commercial_action_events"],
        ["Notifications &amp; audit", "notifications, audit_logs"],
        ["Idempotence / sécurité", "webhook_events, auth_throttle"],
    ], [42*mm, W-42*mm], font_size=7.8))
    e.append(sp(6))
    e.append(K.subsection("3.2 États (ENUM) clés"))
    e.append(K.data_table(["Type","Valeurs"], [
        ["lead_status", "lead, envoye, ouvert, signe, encaisse, perdu"],
        ["sub_envoi (canal d'envoi)", "mano, auto"],
        ["sub_signature (acompte)", "sans, avec"],
        ["sub_signature_mode", "logiciel, planificateur"],
        ["document_type", "devis, acompte, finale"],
        ["document_status", "brouillon, envoye, ouvert, signe, refuse, expire, paye, retard"],
        ["dossier_status", "a_planifier, planifie, en_cours, finalise, solde"],
        ["payment_status", "acompte_non_paye, acompte_paye, partiel, en_attente, solde, impaye"],
        ["role_slug", "admin, commercial, planification, assistant"],
        ["signature_status", "brouillon, pret, envoye, distribue, consulte, en_attente_signature, signe, refuse, expire, annule, erreur"],
        ["contrat / passage (texte)", "contrat : actif, a_renouveler, expire, resilie, en_attente_signature — passage : a_planifier, planifie, realise, annule"],
    ], [46*mm, W-46*mm], font_size=7.9))
    e.append(K.small("Note d'intégrité : les statuts de contrats, passages et actions commerciales sont des colonnes texte sans contrainte CHECK "
                     "(validées côté application uniquement) — voir registre des écarts."))
    e.append(sp(6))
    e.append(K.subsection("3.3 Numérotation légale sans trou"))
    e.append(K.data_table(["Document","Format","Table / compteur"], [
        ["Devis (générique)", "DEV-2026-0001", "documents / doc_counters"],
        ["Facture d'acompte", "FA-2026-0001", "documents / doc_counters"],
        ["Facture finale", "FAC-2026-0001", "documents / doc_counters"],
        ["Devis OPTIMIVV", "2026-00001 (sans préfixe)", "devis_optimivv"],
        ["Facture OPTIMIVV", "FAC-2026-00001", "devis_optimivv"],
        ["Contrat", "CTR-2026-0001", "contracts / contract_counters"],
        ["Certificat de hotte", "CERT-HOTTE-2026-00001", "cert_hotte"],
    ], [52*mm, 52*mm, W-104*mm]))
    e.append(K.small("Attribution atomique dans la transaction d'insertion (compteur verrouillé ligne à ligne). Deux schémas « FAC- » coexistent "
                     "(finale générique à 4 chiffres vs facture OPTIMIVV à 5 chiffres, tables et compteurs distincts) : à documenter pour éviter la confusion."))
    e.append(sp(6))
    e.append(K.subsection("3.4 Déclencheurs et index d'intégrité notables"))
    for b in K.bullets([
        "<b>assign_doc_num</b> — attribue le numéro de document dans la transaction d'insertion (anti-trou, art. 289 CGI) ;",
        "<b>guard_users_privilege_escalation</b> — empêche un commercial de s'auto-attribuer is_premium / is_extreme / pays / profils par écriture directe ;",
        "<b>handle_new_auth_user</b> — miroir auth vers users ; attribue « commercial » à tout nouvel utilisateur, « admin » au tout premier ;",
        "<b>uq_dossiers_lead</b> — un seul dossier par lead ; <b>uq_one_acompte/finale_per_devis</b> — une seule facture d'acompte/finale par devis ;",
        "<b>legal_entity_activities</b> — index unique partiel : une seule société par défaut et par activité.",
    ]):
        e.append(b)
    return e

# ====================================================== CARTOGRAPHIE PAGES ====
def cartographie_pages():
    e = [K.section("4. Cartographie fonctionnelle — inventaire des pages")]
    e.append(K.para("Deux groupes de navigation (Pilotage, Configuration), source de vérité unique dans <i>lib/nav.ts</i>, reflétée dans la barre latérale "
                    "et la palette de commandes (raccourci Cmd/Ctrl+K). « Visible » indique qui peut utiliser utilement la page : lorsqu'une page affiche "
                    "« Accès restreint » aux autres rôles, elle est <b>gardée</b> ; sinon l'accès est filtré par la RLS (données restreintes côté serveur)."))
    e.append(K.subsection("4.1 Groupe « Pilotage »"))
    e.append(K.data_table(["Route","Fonction","Visible","Éléments clés"], [
        ["/dashboard","Tableau de bord (KPI)","Tous (filtré)","4 blocs KPI, graphiques évolution/entonnoir/CA/mano-vs-auto, classement commerciaux, annotations Immo/Travaux (admin)"],
        ["/ma-journee","File d'actions du jour","Tous ; vue équipe pour manager","Onglets à faire / en retard / reportée / photos / terminée / équipe"],
        ["/recherche","Recherche globale","Tous (filtré)","Recherche tél / nom / email / ville / n° de document"],
        ["/pipeline","Kanban 7 colonnes","Tous (par secteur)","Glisser-déposer, sous-statuts Mano/Auto et Sans/Avec, bouton nouveau lead si autorisé"],
        ["/leads","Table leads &amp; devis","Tous (par secteur)","Filtres, tri, export CSV ; colonne Source masquée au commercial"],
        ["/leads/[id]","Fiche lead","Tous ; provenance/immo gardées","Onglets informations / photos / historique / devis / documents / intervention ; actions appel/SMS/email/relance/devis"],
        ["/a-affecter","File des leads non affectés","Super Admin","Affectation en masse"],
        ["/decouverte","Écart de qualification","Tous (mes découvertes)","4 tuiles KPI + 3 tables de leads"],
        ["/commerciaux","Classement commerciaux","Super Admin","4 KPI, table triable, courbes 30 j"],
        ["/commerciaux/[id]","Profil commercial","Super Admin","Infos, KPI, leads par étape/secteur"],
        ["/performance","Table de performance","Tous (RLS)","Filtres société/pays/secteur/commercial/période"],
        ["/planification","Dossiers à planifier","Tous ; planif limité à ses pays","Table filtrable, intervenants, encart acomptes, confirmations"],
        ["/chiffrage","Demandes de chiffrage sous-traitants","Admin + Planif","Suivi des consultations intervenants"],
        ["/comptabilite","Documents / comptabilité","Tous (RLS, sans garde)","Devis/factures, entités, techniciens"],
        ["/documents","Documents &amp; Contrats","Admin + Planif","Tableau de bord contrats/certificats/passages"],
        ["/signatures","Suivi des signatures","Tous (RLS)","Envoi / ouverture / signature / preuve"],
        ["/presence","Présence &amp; Actions","Super Admin","Équipe du jour, statistiques, alertes ouvertes"],
    ], [30*mm, 34*mm, 26*mm, W-90*mm], font_size=7.4))
    e.append(sp(5))
    e.append(K.subsection("4.2 Groupe « Configuration » et pages hors menu"))
    e.append(K.data_table(["Route","Fonction","Visible"], [
        ["/settings","Accueil des paramètres (8 cartes)","Super Admin"],
        ["/settings/users","Utilisateurs, rôles, pools de routage, activités","Super Admin"],
        ["/settings/entities","Sociétés émettrices (multi-société)","Super Admin"],
        ["/settings/routing","Règles de routage des leads","Super Admin"],
        ["/settings/landing-pages","Registre des landing pages (token -> pays/société/secteur)","Super Admin"],
        ["/settings/templates","Modèles email et SMS","Super Admin"],
        ["/settings/technicians","Carnet des intervenants (sous-traitants)","Admin + Planif"],
        ["/settings/integrations","Activation de la séquence n8n WF2","Super Admin"],
        ["/settings/audit","Journal d'audit","Super Admin"],
        ["/notifications","Centre de notifications","Tous (les siennes)"],
        ["/clients, /clients/[id], /clients/new","Clients (hors menu, via liens/palette)","Tous (RLS)"],
        ["/devis/new","Éditeur de devis générique","Tous"],
        ["/devis/nouveau","Éditeur de devis OPTIMIVV","Tous"],
        ["/devis/[id], /factures/[id]","Visualiseur de document","Tous (RLS)"],
        ["/certificat-hotte","Certificat de nettoyage de hotte","Depuis un dossier"],
        ["/sign/[token], /devis-signer/[token]","Signature publique (par jeton)","Public"],
        ["/login, /signup, /forgot-password, /reset-password","Authentification","Public"],
    ], [46*mm, W-92*mm, 46*mm], font_size=7.6))
    return e
