# -*- coding: utf-8 -*-
"""Contenu — Planification + Médias + Emails/n8n + Automatisations/alertes + Intégrations + Matrice."""
from reportlab.platypus import Spacer
from reportlab.lib.units import mm
import pdf_kit as K

W = K.CONTENT_W
def sp(h=6): return Spacer(1, h)

# ===================================================== PLANIFICATION ==========
def planification():
    e = [K.section("10. Planification et interventions")]
    e.append(K.para("La page Planification présente les dossiers sous forme de <b>table filtrable</b> (et non d'un calendrier glisser-déposer). Le "
                    "planificateur non-administrateur ne voit que les dossiers dont le pays du lead figure dans ses pays d'affectation ; l'administrateur "
                    "voit tout."))
    e.append(K.subsection("10.1 Actions disponibles sur un dossier"))
    e.append(K.data_table(["Depuis le statut","Action","Effet"], [
        ["à planifier", "Planifier l'intervention", "Date + créneau (Europe/Paris) + intervenant ; passe « planifié »"],
        ["planifié", "Démarrer la réalisation", "Passe « en cours » (technicien arrivé)"],
        ["planifié / en cours", "Marquer comme réalisé", "Pose la date de réalisation ; passe « finalisé »"],
        ["planifié / en cours", "Reprogrammer (non présenté)", "Rouvre le modal de planification"],
        ["planifié + email", "Confirmation au client", "Email de confirmation (Brevo)"],
        ["tous", "Envoyer à l'intervenant", "Fiche d'intervention au sous-traitant"],
        ["nettoyage", "Certificat de hotte", "Génère le certificat CERT-HOTTE-"],
        ["finalisé", "Émettre la facture finale", "Crée la facture FAC-"],
        ["finalisé", "Marquer soldé", "Passe « soldé » (garde de paiement)"],
    ], [34*mm, 44*mm, W-78*mm], font_size=7.6))
    e.append(sp(5))
    e.append(K.subsection("10.2 Suggestion géographique d'intervenant"))
    e.append(K.para("Le modal de planification propose l'intervenant compétent (secteur) le plus proche : classement en-zone puis au plus près (rayon "
                    "de 100 km, à partir du code postal de base et des départements desservis). Durée d'intervention optionnelle."))
    e.append(K.subsection("10.3 Intervenants (sous-traitants)"))
    e.append(K.para("Table <i>technicians</i> (nom, initiales, couleur, compétences, secteurs, code postal de base, départements, email). Gérés dans "
                    "Paramètres &gt; Intervenants (admin + planification). Seuls les intervenants actifs sont proposés à l'affectation."))
    e.append(K.subsection("10.4 Encart acomptes et KPI"))
    e.append(K.para("KPI Planification : dossiers par statut, interventions de la semaine, « Acomptes à encaisser » (nombre + montant TTC). "
                    "L'action « Encaisser » marque l'acompte payé."))
    return e

# ===================================================== MÉDIAS =================
def medias():
    e = [K.section("11. Photos, vidéos et médias")]
    e.append(K.para("Chaque lead dispose d'un onglet « Photos &amp; Vidéos » adossé à la table <i>lead_media</i> et au bucket privé <i>lead-media</i>. "
                    "Upload (100 Mo/fichier, liste blanche de types, SVG exclu pour éviter le XSS stocké), grille de vignettes, visionneuse plein écran "
                    "avec navigation clavier et téléchargement, commentaire par média, partage à l'intervenant (liens signés à durée limitée)."))
    e.append(K.data_table(["Capacité","Détail"], [
        ["Lecture", "Propriétaire du lead, planificateur, administrateur (URL signées 60 min via service-role)"],
        ["Ajout", "Auteur = utilisateur courant, dans le périmètre du lead"],
        ["Suppression", "Auteur ou administrateur uniquement (le planificateur ne peut pas supprimer)"],
        ["Réception email", "Les pièces jointes image/vidéo des réponses clients sont ingérées automatiquement dans le bucket"],
    ], [34*mm, W-34*mm], font_size=8))
    e.append(K.callout("Écart — avant / après",
        "Le champ <i>kind</i> ne distingue que « photo » et « vidéo » : il n'existe <b>pas</b> de sémantique « avant / après » ni d'alerte signalant "
        "qu'un dossier finalisé n'a pas reçu ses photos « après ». La seule alerte photos existante est <i>en amont du devis</i> (relance client pour "
        "obtenir des photos), pas un contrôle post-intervention.", "warn"))
    return e

# ===================================================== EMAILS & n8n ==========
def emails():
    e = [K.section("12. Emails et centralisation des leads")]
    e.append(K.subsection("12.1 WF1 — capture des leads (n8n)"))
    e.append(K.para("Les formulaires des sites publient vers n8n (webhook lead-capture). WF1 normalise (téléphone E.164, email en minuscules, noms "
                    "capitalisés, activité et source validées, gclid/utm transmis), signe la charge en HMAC-SHA256 et la POST vers le CRM "
                    "(/api/webhooks/leads/inbound) avec en-têtes X-Signature et X-Timestamp. Un identifiant externe sert de clé d'idempotence."))
    e.append(K.para("<b>Routage email par activité</b> : après acceptation par le CRM, WF1 envoie un email de notification via Brevo, expéditeur "
                    "« CRM OPTIMIVV », destinataire déterminé par l'activité — <i>déménagement</i> vers lead.dem360@gmail.com, sinon "
                    "leadnettoyage360@gmail.com. Le corps contient nom, téléphone, email, ville, surface, source, message et un lien vers la fiche."))
    e.append(K.subsection("12.2 Identité email par secteur (CRM)"))
    e.append(K.para("Les devis et communications commerciales partent avec l'identité du secteur : nettoyage -> devispro@optimivv-nettoyage.com "
                    "(bannière nettoyage), déménagement -> devispro@optimivv-demenagement.com (bannière déménagement). Débarras utilise le visuel nettoyage."))
    e.append(K.subsection("12.3 Centralisation email côté CRM"))
    e.append(K.para("Une fonction de centralisation email existe dans le CRM mais est <b>désactivée par défaut</b> (drapeau "
                    "LEAD_CENTRAL_EMAIL_ENABLED = false) : décision explicite de faire vivre la centralisation dans n8n WF1. Si activée, elle route "
                    "déménagement et nettoyage vers les deux boîtes dédiées, avec la provenance marketing complète réservée au pilotage."))
    e.append(K.subsection("12.4 Réponses clients et suivi d'ouverture (Brevo entrant)"))
    for b in K.bullets([
        "<b>brevo/inbound</b> — réponses email des clients : rattachement par n° de document (sujet) ou par email ; ingestion des pièces jointes ; "
        "notification « réponse email » au propriétaire (et à la planification si médias) ;",
        "<b>brevo/events</b> — événement d'ouverture du devis : rapproche le dernier devis OPTIMIVV envoyé à cet email et fait passer le lead "
        "« envoyé » -> « ouvert » (monotone, idempotent).",
    ]):
        e.append(b)
    return e

# =============================================== AUTOMATISATIONS & ALERTES ====
def automatisations():
    e = [K.section("13. Automatisations et alertes")]
    e.append(K.subsection("13.1 WF2 — séquence de relance de devis (n8n)"))
    e.append(K.para("Déclenchée depuis le Kanban, WF2 envoie jusqu'à 4 emails espacés (attentes 24 h / 72 h / 120 h), en vérifiant le statut du lead "
                    "avant chaque envoi. Conditions d'arrêt : lead signé, perdu, ou sous-statut d'envoi différent de « auto ». Le CRM ne transmet "
                    "toutefois pas les paramètres quote_url / quote_ref attendus par les modèles (écart signalé)."))
    e.append(K.subsection("13.2 Trois moteurs d'évaluation (cron)"))
    e.append(K.para("Un unique point d'entrée cron (/api/presence/evaluate, protégé par secret ou session Super Admin) exécute, de façon isolée, trois "
                    "moteurs : présence/alertes, actions commerciales, alertes documents. Cadence attendue : toutes les 1 à 2 minutes."))
    e.append(K.subsection("13.3 Schéma 6 — Automatisations et alertes"))
    e.append(K.BoxFlow([
        ("Événements","audit_logs, statuts, présence"),
        ("Cron evaluate","3 moteurs isolés"),
        ("Actions &amp; alertes","commercial_actions, alerts"),
        ("Notifications","toast + son + centre"),
    ], W, orient="h", per_row=2, box_h=16*mm))
    e.append(sp(4))
    e.append(K.subsection("13.4 Alertes réellement implémentées"))
    e.append(K.data_table(["Alerte","Condition de déclenchement","Destinataire","Résolution"], [
        ["Lead non traité", "Lead « lead » reçu depuis 5/10/20 min sans action qualifiante", "Propriétaire", "Auto dès action qualifiante"],
        ["Inactivité", "Session ouverte mais inactif depuis ~20 min", "Utilisateur", "Auto à la reprise"],
        ["Absence", "Horaire de travail dépassé, non vu, sans absence déclarée", "Utilisateur planifié", "Auto à la connexion"],
        ["Devis non envoyé", "Devis « brouillon » depuis plus de 24 h", "Créateur du devis", "Auto à l'envoi"],
        ["Dossier bloqué", "Dossier « à planifier » depuis plus de 7 jours", "Planificateur", "Auto au changement"],
        ["Appel sans découverte", "Appel passé, découverte non enregistrée (~10 min)", "Propriétaire", "Auto dès découverte"],
        ["Relancer pour photos", "Photos demandées, aucun média reçu après ~24 h", "Propriétaire", "Auto dès média reçu"],
        ["Découverte sans devis", "Découverte faite, devis non envoyé après ~24 h", "Propriétaire", "Auto au passage « envoyé »"],
        ["Relance devis", "Devis « envoyé/ouvert » non signé (J+2 puis tous les 3 j)", "Propriétaire", "Auto à la signature/perte"],
        ["Contrat à renouveler", "Contrat actif/à renouveler expirant sous 7 jours", "Rôle planification", "Poussée (visible sur /documents)"],
    ], [34*mm, W-108*mm, 30*mm, 44*mm], font_size=7.2))
    e.append(K.small("Il n'existe pas d'alerte distincte « lead non affecté » : un lead sans propriétaire reste dans la vue « À affecter » ; l'alerte "
                     "« lead non traité » couvre le non-traitement."))
    e.append(sp(5))
    e.append(K.subsection("13.5 Notifications temps réel"))
    e.append(K.para("Écriture serveur via service-role (best-effort). Temps réel Supabase : sur insertion, un <b>toast cliquable</b> (max 4, 8 s) et un "
                    "<b>bip Web Audio</b> (si le son est activé) ; le badge de la cloche se met à jour. Différenciation clé : l'administrateur reçoit "
                    "« nouveau lead » <i>avec</i> provenance ; le propriétaire reçoit « lead attribué » <i>sans</i> provenance. Types : réponse email, "
                    "appel manqué/entrant, lead attribué/nouveau/perdu, action commerciale, contrat expirant."))
    return e

# ===================================================== INTÉGRATIONS ===========
def integrations():
    e = [K.section("14. Intégrations externes")]
    e.append(K.data_table(["Intégration","Rôle","État réel"], [
        ["Supabase", "Postgres + Auth + Realtime + Storage", K.badge_cell("ACTIVE")],
        ["n8n (auto-hébergé)", "WF1 capture, WF2 relance", K.badge_cell("ACTIVE")],
        ["Brevo", "Emails/SMS transactionnels, séquences, réponses entrantes", K.badge_cell("ACTIVE")],
        ["Ringover", "Click-to-call, webphone, SMS, screen-pop", K.badge_cell("PARTIEL")],
        ["Yousign / DocuSign", "Signature eIDAS (prévue au CDC)", K.badge_cell("ABSENT")],
        ["Google Ads", "Enhanced Conversions (gclid + TTC)", K.badge_cell("ABSENT")],
    ], [42*mm, W-42*mm-30*mm, 30*mm], align_center_cols=[2], font_size=8))
    e.append(sp(4))
    for b in K.bullets([
        "<b>Ringover</b> : le code webphone/SMS/screen-pop est présent et câblé ; côté serveur, le click-to-call fonctionne en « mode simulé » tant que "
        "les clés API ne sont pas fournies. Prêt pour la production dès activation du compte/ligne et connexion de chaque agent ;",
        "<b>Signature eIDAS</b> : le CDC prévoit Yousign/DocuSign ; la signature réellement implémentée est <b>propriétaire</b> (jeton + PDF figé + preuve). "
        "Robuste techniquement, mais à qualifier juridiquement au regard de l'exigence eIDAS ;",
        "<b>Google Ads</b> : gclid et utm sont captés et stockés (chiffrés), mais <b>aucun</b> code ne remonte les conversions vers Google (ni sur « signé », "
        "ni sur « encaissé »). Fonctionnalité à implémenter.",
    ]):
        e.append(b)
    return e

# ===================================================== MATRICE DES DROITS =====
def matrice():
    e = [K.section("15. Matrice des droits et permissions")]
    e.append(K.para("Permissions dérivées du code (RLS + gardes applicatives). Légende : « oui » = complet ; « lecture » = lecture seule ; "
                    "« sien » = limité à ses propres leads/dérivés ; « — » = aucun. Le rôle Assistant est omis (inerte)."))
    e.append(K.data_table(["Module / capacité","Super Admin","Planificateur","Commercial"], [
        ["Leads — lecture", "tous", "tous (lecture)", "les siens"],
        ["Leads — création/édition", "oui", "— (lecture)", "les siens"],
        ["Leads — suppression", "oui", "—", "—"],
        ["Provenance (source, UTM, gclid, URL)", "oui", "oui", "— (retirée)"],
        ["Annotation Immobilier/Travaux", "oui", "si permission accordée", "si permission accordée"],
        ["Clients — lecture / écriture", "oui / oui", "oui / oui", "sien / —"],
        ["Documents (devis, factures)", "oui", "oui", "son lead"],
        ["Dossiers / Planification — lecture", "oui", "oui", "son lead"],
        ["Dossiers — écriture", "oui", "oui", "—"],
        ["Intervenants — lecture / écriture", "oui / oui", "lecture / oui", "lecture / —"],
        ["Utilisateurs, rôles, permissions", "oui (+ garde applicative)", "—", "—"],
        ["Journal d'audit — lecture", "oui", "—", "—"],
        ["Présence &amp; Actions", "oui", "—", "—"],
        ["Comptabilité (données)", "oui", "oui", "ses documents (voir écart provenance)"],
        ["Paramétrage (entités, routage, LP, modèles)", "oui", "—", "—"],
        ["Secteurs visibles", "tous", "tous", "ses activités affectées"],
    ], [W-96*mm, 32*mm, 32*mm, 32*mm], font_size=7.5,
       align_center_cols=[1,2,3]))
    e.append(sp(4))
    e.append(K.subsection("15.1 Données sensibles masquées selon le rôle"))
    for b in K.bullets([
        "<b>Provenance marketing</b> (site, URL, canal, UTM, gclid) : retirée du serveur pour le commercial (omission non cosmétique), chiffrée au repos ;",
        "<b>Annotation Immobilier/Travaux</b> : chiffrée (AES-256-GCM), lisible seulement avec la permission dédiée ou en tant qu'administrateur ;",
        "<b>IBAN/BIC des sociétés</b> et coordonnées bancaires : à protéger (voir registre des écarts — lisibles par tout utilisateur authentifié).",
    ]):
        e.append(b)
    return e
