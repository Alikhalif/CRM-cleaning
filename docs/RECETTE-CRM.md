# CGK / OPTIMIVV CRM — Rapport de recette fonctionnelle

**Date :** 2026-09-18 · **Méthode :** audit statique de bout en bout du code (source de vérité) + build réel · **Périmètre :** 100 % du CRM existant · **Règle respectée :** aucune modification du code pendant cette passe (audit → test → documentation → priorisation).

---

## ⚠️ Avertissement de méthode — lire d'abord (honnêteté des résultats)

Cet environnement est **non-interactif** : pas de navigateur, pas d'automatisation d'interface, pas de runner de test, et le fournisseur d'e-signature / les migrations Supabase ne sont pas confirmés « live ». Je **ne peux donc pas** cliquer réellement, ouvrir plusieurs sessions utilisateurs simultanées, faire signer un vrai client, ni mesurer le rendu responsive.

Ce qui a été **réellement exécuté** :
- ✅ **Build de production** (`npm run build`) → **exit 0**, les ~53 routes compilent.
- ✅ **Traçage statique de chaque flux** (action → serveur → écriture DB → automatisation → destinataire → statut → historique) avec preuves `fichier:ligne`.
- ✅ Analyse migrations / RLS / permissions / calculs / interpolation de templates.

**Signification stricte des statuts dans ce rapport :**

| Statut | Signification EXACTE ici |
|---|---|
| 🟢 OK | Tracé de bout en bout au niveau code, cohérent, **aucun défaut détecté** — *reste à confirmer par un test navigateur réel* |
| 🟠 À CORRIGER | Fonctionne partiellement / défaut identifié dans le code |
| 🔴 BUG | Défaut **confirmé** qui casse la fonction ou produit une sortie fausse |
| ⚪ NON TESTABLE | Nécessite une exécution runtime indisponible ici (signature live, envoi mail/SMS réel, temps réel multi-utilisateurs, responsive). Raison indiquée. |

> Conformément à votre règle #19 : **un 🟢 ne signifie pas « test réel réussi »**, il signifie « code présent, cohérent, tracé ». Rien n'a été inventé ; tout défaut est sourcé.

---

## 1. SYNTHÈSE DIRIGEANT

### État global du CRM

- **Périmètre identifié :** ~24 modules, ~120 fonctions/boutons cartographiés.
- **Le socle est solide et cohérent** : cycle commercial complet (lead → découverte → devis → signature → dossier → planification → facturation → encaissement), signature électronique **maison** réellement construite (intégrité SHA-256 + certificat de preuve), isolation des leads par RLS correcte, KPIs de dashboard réels (pas de maquette), module de présence qui enregistre vraiment.
- **Mais il y a 1 bloquant de déploiement, 4 défauts critiques et une série de correctifs importants** avant une mise en production sereine.

| Résultat | Nb (indicatif) |
|---|---|
| 🟢 OK (tracé, cohérent) | ~78 |
| 🟠 À corriger | ~22 |
| 🔴 Bug (défaut confirmé) | ~8 |
| ⚪ Non testable ici (runtime) | ~12 |

### 🚫 BLOQUANTS AVANT MISE EN PRODUCTION (P0 / P1)

1. **[P0 — DÉPLOIEMENT] Les migrations ne sont pas appliquées en base** (`npx supabase db push` jamais exécuté). Le code `getAllLeads` sélectionne des colonnes (`source_url`, `move_*`, …) qui **n'existent pas encore en base** → Supabase renvoie une erreur → `return []` → **la liste des leads apparaît vide**. C'est la cause exacte du « où sont mes leads ». **Correctif : pousser les migrations (additif, non destructif) avant/avec le déploiement.**
2. **[P1] Aucune tâche planifiée (cron) n'existe** → **toutes** les automatisations (relances, alertes photos, rappel découverte/devis, lead non traité, expiration des contrats) **ne se déclenchent jamais seules** — uniquement quand un Super Admin rafraîchit manuellement. Tout le module « Actions & Relances » et l'alerte « Photos » sont inertes en pratique.
3. **[P1 — SÉCURITÉ] RLS trop permissives sur les nouvelles tables** : `contracts` et `client_documents` sont **lisibles par tout utilisateur authentifié** (un commercial voit les contrats/documents de tous les clients), et `contract_passages` est **lisible ET modifiable/supprimable par n'importe qui**. Casse le modèle de cloisonnement « mine ».
4. **[P1 — COMPTABILITÉ] Course à la double signature → double facture d'acompte** : pas de contrainte d'unicité `(related_devis_id, type)`. Deux soumissions concurrentes peuvent générer **deux numéros de facture** pour le même acompte.
5. **[P1 — CLIENT] Deux templates envoyés au client contiennent `[Date]` / `[Heure]` et « Bonjour , » littéraux** (« Mail confirmation d'intervention », « Mail proposition de créneaux »). Le moteur n'interpole que `{token}`, donc le client reçoit un mail visiblement cassé.

### ⚠️ POINTS IMPORTANTS À CORRIGER (P2)

Monotonie du pipeline non gardée côté serveur (retours arrière possibles) · échec de la passe présence qui tue les autres alertes · « Marquer signé » manuel qui déclenche toute la cascade légale sans preuve · sous-système devis **OPTIMIVV** sans facture d'acompte et dossier sans lien devis (**impasse de facturation**) · HT recalculé en Comptabilité depuis une TVA secteur codée en dur (faux si TVA mixte) · « CA encaissé » qui somme le **TTC** au lieu du HT · numérotation à trous possible en cas d'échec · contrats sans `end_date` → alertes d'expiration dormantes · `{intervention.date/heure}` vides dans les mails client · confidentialité Immob/Travaux non protégée au niveau colonne · aperçu « lecture seule » des rôles non implémenté.

### 🔧 AMÉLIORATIONS MINEURES (P3)

Code mort click-to-call serveur · « Model email » journalisé « relance » · perso perdue dans les mails devis · bouton « Planifier » non contextuel · lecture all-auth de `cert_hotte`/`devis_optimivv` · page `/settings` non gardée · `entity_type` d'audit surchargé en « user » · liste leads sans pagination · « Refus » découverte via `window.prompt` sans confirmation · écritures best-effort sans contrôle d'erreur · dedup WF1 renvoyant 500 au lieu de 200.

---

## 2. CARTOGRAPHIE — périmètre réel testé

**Routes (build réel, 53) :** dashboard · ma-journee · recherche · pipeline · leads(+[id]) · a-affecter · decouverte · commerciaux(+[id]) · performance · planification · chiffrage · comptabilite · documents · clients(+[id]/new) · devis(new/nouveau/[id]) · factures/[id] · certificat-hotte · signatures(+[id]) · notifications · presence(+[userId]/parametres) · settings(users/entities/routing/landing-pages/templates/technicians/integrations/audit) · sign/[token] · devis-signer/[token] · APIs (webhooks leads/brevo/ringover, presence, documents preview, leads/[id]).

**Modules fonctionnels :** Auth & rôles · Dashboard & KPIs · Pipeline (Kanban + sous-statuts) · Leads & fiche · Découverte · Communication (appel/SMS/email/photos) · Devis (2 sous-systèmes) · Signature électronique maison · Factures acompte/finale · Comptabilité · Planification & dossiers · Passage de relais commercial→planif · Documents & Contrats · Certificat hotte · Templates message · Actions & relances commerciales · Alertes présence · Automatisations (cron/WF1/WF2) · Notifications · Présence & activité · Permissions & RLS · Audit · Recherche · Settings · Média.

---

## 3. MATRICE DE RECETTE (par module)

> Résultat = évaluation **statique** (voir §Avertissement). Preuves complètes dans les fiches d'anomalie §7.

| ID | Module | Fonction | Rôle | Résultat | Crit. | Commentaire |
|---|---|---|---|---|---|---|
| CRM-001 | Leads | Liste, filtres, recherche, tri, export CSV | Commercial/Admin | 🟢 | — | Filtrage 100 % client ; **pas de pagination** (perf à l'échelle) |
| CRM-002 | Leads | Affichage `source_url` 🔗 (liste + fiche) | Tous | 🟠 | P0* | Correct, mais colonne absente en base tant que migrations non poussées |
| CRM-003 | Leads | Fiche : cartes Déménagement / Source | Commercial | 🟢 | — | Affichage lecture seule, conditionné à la présence des champs |
| CRM-004 | Découverte | Formulaire sectoriel + Enregistrer (persistant) | Commercial | 🟢 | — | `saveDiscovery` écrit + revalide ; additif (ne touche pas l'outcome) |
| CRM-005 | Découverte | OK / OK voir + / **Refus** | Commercial | 🟠 | P3 | Refus via `window.prompt` sans confirmation → perte de lead sur mauvais clic |
| CRM-006 | Pipeline | Kanban drag-drop, sous-statuts mano/auto, sans/avec | Commercial | 🟢 | — | Badges « Canal manquant » / « Acompte ? » corrects |
| CRM-007 | Pipeline | **Monotonie forward-only** | Commercial | 🔴 | P2 | Retours arrière autorisés (lead/envoye/ouvert/signe) ; **aucun garde serveur** |
| CRM-008 | Comm. | Appeler (webphone Ringover) | Commercial | ⚪ | P3 | Webphone client ; `callLead` serveur = **code mort**, aucun appel persisté |
| CRM-009 | Comm. | SMS (webphone) | Commercial | 🟠 | P2 | Fire-and-forget : journalisé « envoyé » sans confirmation de livraison |
| CRM-010 | Comm. | Email modèle / relance (Brevo) | Commercial | ⚪ | P3 | Envoi non exécuté ici ; « Model email » journalisé « relance » |
| CRM-011 | Comm. | Demande de photos (email/SMS Brevo) | Commercial | 🟢 | — | Estampille `photos_requested_at` ; canal SMS via Brevo (≠ webphone) |
| CRM-012 | Devis A | Éditeur lignes + catalogue + acompte % | Commercial | 🟢 | — | Totaux recalculés serveur (source de vérité) |
| CRM-013 | Devis A | **Calculs HT / TVA / TTC / remise / acompte** | — | 🟢 | — | Remise sur HT avant TVA ✓, acompte sur **TTC** (à confirmer client) |
| CRM-014 | Signature | E-signature maison (token, tracé, SHA-256, certificat) | Client | ⚪/🟢 | — | Flux réel maison ✓ ; **pas de Yousign/DocuSign** (CDC demande eIDAS tiers) |
| CRM-015 | Signature | « Marquer signé » manuel / drag→signe | Planif/Comm. | 🟠 | P2 | Déclenche toute la cascade légale (statut+FA+dossier) **sans preuve** |
| CRM-016 | Factures | Facture d'acompte auto sur signature | Système | 🟠 | P1 | Split TVA pondéré ✓ mais **course → doublon possible** (pas d'unicité) |
| CRM-017 | Factures | Facture finale manuelle (après réalisé) | Planif | 🟢 | — | acompte + finale = total devis ✓ |
| CRM-018 | Compta | Numérotation séquentielle sans trou | Système | 🟠 | P2 | **Trou possible** si échec après allocation (avant INSERT) |
| CRM-019 | Compta | Table Comptabilité (HT/TVA/CA) | Admin | 🔴 | P2 | HT recalculé via TVA secteur **codée en dur** (faux si TVA mixte) ; CA = **TTC** |
| CRM-020 | Devis B | Sous-système **OPTIMIVV** (montant libre, « Bon pour accord ») | Commercial | 🟠 | P2 | Pas de facture d'acompte ; dossier `quote_document_id=null` → **impasse facturation** |
| CRM-021 | Handoff | Signature → dossier auto → visible planif | Système | 🟢 | — | **Entièrement automatique**, aucune ressaisie (données par JOIN `lead_id`) |
| CRM-022 | Handoff | Notification planif sur mark-signé **manuel** | Système | 🟠 | P2 | Aucune notif sur ce chemin (seuls e-sign en ligne + OPTIMIVV notifient) |
| CRM-023 | Planif | Écran unique : KPIs, filtres, encart acomptes | Planif | 🟢 | — | Filtres client ; encart « acomptes à encaisser » OK |
| CRM-024 | Planif | Planifier / Démarrer / Réalisé / Reprogrammer | Planif | 🟢 | — | Cycle `a_planifier→planifie→en_cours→finalise→solde` |
| CRM-025 | Planif | **Marquer soldé** | Planif | 🟠 | P2 | Aucune vérification de paiement avant `solde` |
| CRM-026 | Planif | Données visibles au planif (client/adr/montant/devis/photos) | Planif | 🟠 | P2 | Notes **commerciales** + découverte **non affichées** (uniquement dans le mail intervenant) |
| CRM-027 | Docs | Onglet « Documents & Contrats » fiche client | Commercial | 🟢 | — | Tags activités, registre, contrats, passages, certifs |
| CRM-028 | Docs | Certificat hotte (depuis fiche via dossier) | Planif | 🟢 | — | Pré-remplissage **verrouillé** ✓, bon rattachement client ✓ |
| CRM-029 | Contrats | Création contrat (hotte / désinsectisation) + PDF | Commercial | 🟢 | — | Pré-remplissage sans double saisie ✓, ref `CTR-AAAA-NNNN` |
| CRM-030 | Contrats | **Alertes renouvellement / expiration** | Système | 🔴 | P2 | Aucune UI ne saisit `end_date` → KPI & alerte **jamais déclenchés** |
| CRM-031 | Templates | Interpolation `{token}` (`renderTemplate`) | Système | 🟢 | — | Simple accolade ; **pas de bug `{{…}}`** |
| CRM-032 | Templates | Mails client confirmation / créneaux | Planif | 🔴 | P1 | `[Date]`/`[Heure]` + « Bonjour , » **littéraux** envoyés au client |
| CRM-033 | Templates | `{intervention.date/heure}` mails client | Planif | 🔴 | P2 | Aucun trigger ne les peuple → rendu **vide** même dossier planifié |
| CRM-034 | Actions | Moteur relances (découverte/devis/relance/photos) | Commercial | 🟠 | P1 | Logique correcte mais **ne tourne jamais** sans cron (voir CRM-040) |
| CRM-035 | Actions | Alerte Photos (attente / à vérifier / auto-clôture) | Commercial | 🟢 | — | Anti faux-positif « répondu mais non rattaché » ✓ (mais dépend du cron) |
| CRM-036 | Actions | Clôture manuelle d'une action | Commercial | 🟠 | P2 | Re-création + re-notification au cycle suivant si signal inchangé (spam) |
| CRM-037 | Alertes | Présence (lead non traité, absence, inactivité, devis non envoyé, dossier bloqué) | Admin | 🟠 | P2 | Écrit `alerts` ✓ mais **jamais poussé au bandeau notif** ; dépend du cron |
| CRM-038 | Notifs | Cloche, `notifyRole`, liste | Tous | 🟢 | — | RLS `auth.uid()` ✓ ; alertes présence absentes de la cloche (choix) |
| CRM-039 | WF1 | Webhook lead entrant (HMAC + idempotence `external_id`) | Système | 🟠 | P3 | HMAC + anti-rejeu ✓ ; course dedup renvoie 500 au lieu de 200 |
| CRM-040 | Automat. | **Planificateur (cron) d'évaluation** | Système | 🔴 | P1 | **N'existe nulle part** (ni Vercel/GitHub/n8n/OS) ; `PRESENCE_CRON_SECRET` non défini |
| CRM-041 | Automat. | Isolation des passes d'évaluation | Système | 🟠 | P2 | `evaluate()` hors try/catch → un throw tue commercial+documents |
| CRM-042 | WF2 | Séquence relance devis (trigger + poll) | Système | ⚪ | P3 | `N8N_WF2_TRIGGER_URL/SECRET` non câblés dans cet env ; double-send edge documenté |
| CRM-043 | Rôles | Isolation leads « mine » par RLS | Commercial | 🟢 | — | `owner_id = auth.uid() or is_admin() or is_planificateur()` ✓ |
| CRM-044 | Rôles | Gestion utilisateurs (rôles, premium, création) | Admin | 🟢 | — | Garde d'action `callerIsAdmin` **+** RLS (défense en profondeur) |
| CRM-045 | Rôles | RLS `contracts`/`client_documents`/`contract_passages` | — | 🔴 | P1 | `using(true)` → lecture inter-clients ; passages **écrivables par tous** |
| CRM-046 | Rôles | Confidentialité Immob/Travaux | Admin | 🟠 | P2 | Masquée par le mapper serveur, **pas au niveau colonne** (lisible par le commercial propriétaire via anon) |
| CRM-047 | Rôles | Sélecteur « Vue » / aperçu lecture seule | Tous | 🔴 | P2 | **Non implémenté** (placeholder « arrivera plus tard ») |
| CRM-048 | Dashboard | KPIs (funnel, CA, top commerciaux, canaux) | Admin/Comm. | 🟢 | — | **Requêtes réelles**, pas de maquette ; scoping par RLS |
| CRM-049 | Présence | Heartbeat / sessions / activité | Système | 🟢 | — | Enregistre réellement (`user_presence`, `user_sessions`, `presence_pings`) |
| CRM-050 | Audit | Journal append-only | Système | 🟠 | P3/P4 | Large couverture ✓ ; `entity_type` surchargé « user » pour entity/routing/settings |
| CRM-051 | Média | Upload/suppression/consultation/commentaire photos | Comm./Planif | 🟢 | — | Bucket privé + URLs signées + RLS owner/admin/planner ✓ |
| CRM-052 | Recherche | Recherche globale | Tous | ⚪ | — | Route présente ; non exécutée en runtime ici |

`*` CRM-002 dépend directement du P0 migrations (CRM-… ⇒ colonne inexistante en base).

---

## 4. MATRICE DES PARCOURS

**PARCOURS COMMERCIAL** — Lead → Appel → Découverte → Devis → Envoi → Signature → Transmission
**Statut global : 🟠** — chaîne fonctionnelle et tracée, mais : monotonie non gardée (CRM-007), SMS non confirmé (CRM-009), et la transmission dépend du chemin de signature (auto ✓ sur e-sign en ligne, **sans notif** sur mark-signé manuel — CRM-022).

**PARCOURS PLANIFICATRICE** — Devis signé → Réception → Planification → Intervention → Facturation
**Statut global : 🟠** — réception **automatique** et sans ressaisie (CRM-021, excellent), cycle de statuts complet, mais notes commerciales/découverte non affichées (CRM-026), « soldé » sans contrôle paiement (CRM-025), et **impasse de facturation** pour les deals signés via OPTIMIVV (CRM-020).

**PARCOURS CLIENT** — Demande → Contact → Devis → Signature → Confirmation → Intervention → Facture
**Statut global : 🔴** — le maillon **Confirmation** est cassé côté client : les mails « confirmation d'intervention » / « proposition de créneaux » sortent avec `[Date]`/`[Heure]`/« Bonjour , » (CRM-032/033). Le reste est cohérent.

**PARCOURS SUPER ADMIN** — Supervision → Alertes → CA → Équipes → Leads → Dossiers → Performances
**Statut global : 🟠** — supervision, KPIs réels, présence et audit solides ; mais **les alertes ne se déclenchent que sur rafraîchissement manuel** (CRM-040) et le CA est surévalué (TTC vs HT — CRM-019).

---

## 5. MATRICE DES PASSAGES DE RELAIS

| Événement | Source | Destination | Attendu | Résultat (statique) |
|---|---|---|---|---|
| Nouveau lead (WF1) | CRM/n8n | Commercial | Lead visible + notif si assigné | 🟠 leads vides tant que migrations non poussées (P0) ; sinon ✓ |
| Découverte terminée | Commercial | CRM | Données enregistrées + persistées | 🟢 `saveDiscovery` ✓ |
| Devis envoyé | Commercial | Client | Lien e-signature reçu | ⚪ envoi non exécuté ici ; flux présent ✓ |
| Devis signé (e-sign en ligne) | Client | Commercial | Signature visible + statut `signe` | 🟢 cascade + notif owner ✓ |
| Devis signé | Client | CRM | Statut modifié + FA acompte auto | 🟠 ✓ mais **doublon FA possible** (course) |
| Devis signé | CRM | Planificatrice | Dossier « à planifier » | 🟢 auto (e-sign en ligne) ; 🟠 **sans notif** si mark-signé manuel |
| Devis signé **OPTIMIVV** | Client | Planif/Compta | Dossier avec devis + facturable | 🔴 dossier **sans lien devis**, non facturable (CRM-020) |
| Intervention planifiée | Planif | Commercial/Admin | Info visible | 🟢 visible (dashboard/planif) ; pas de notif dédiée |
| Intervention réalisée | Planning | Facturation | Dossier `finalise` → facturable | 🟢 `generateFactureFinale` (gardé `finalise` + devis signé) |
| Paiement reçu (finale) | Facturation | CRM | Statut `solde` + lead `encaisse` | 🟢 `markDocumentPaid` cascade ✓ |
| Contrat proche expiration | CRM | Planification | Alerte J-7 | 🔴 **jamais** (pas de `end_date` + pas de cron) |
| Photos reçues | Client (Brevo) | Commercial | Action photos auto-clôturée | 🟠 logique ✓ mais **dépend du cron** (inerte) |

---

## 6. AUTOMATISATIONS — inventaire & état

| Déclencheur | Condition | Action | Destinataire | État |
|---|---|---|---|---|
| Appel sans découverte | `status=lead`, +10 min | action `decouverte` | owner | 🟠 correct mais **cron absent** |
| Découverte sans devis | +24 h, hors attente photos | action `devis` | owner | 🟠 idem |
| Devis non closé | envoyé +2 j puis +3 j | action `relance` | owner | 🟠 idem + dérive due-date via `updatedAt` |
| Photos demandées non reçues | +24 h, média < demande | action `photos` | owner | 🟠 idem + bloque le devis indéfiniment |
| Lead non traité | reçu <24 h, sans action, 5/10/20 min | alerte présence | owner | 🟠 écrit `alerts`, **pas de cron, pas de cloche** |
| Absence / inactivité | début journée + grâce / idle 20 min | alerte présence | user | 🟠 idem |
| Devis brouillon >24 h / dossier bloqué >7 j | — | alerte présence | créateur / planner | 🟠 idem |
| Contrat `end_date ≤ J+7` | — | `notifyRole(planification)` | planificateurs | 🔴 `end_date` jamais saisi → jamais |
| Signature (e-sign en ligne) | finalize | statut + FA acompte + dossier + notif | owner + planif | 🟢 (câblé, hors cron) |
| Lead entrant WF1 | HMAC ok, `external_id` neuf | insert lead + audit + notif | owner | 🟢 (mais voir dedup 500) |

**Fait marquant :** 8 automatisations sur 10 dépendent d'un **cron inexistant** (CRM-040). Tant qu'aucun planificateur n'appelle `/api/presence/evaluate` (avec `PRESENCE_CRON_SECRET`), elles ne s'exécutent qu'au rafraîchissement manuel d'un Super Admin.

---

## 7. FICHES D'ANOMALIE (priorisées)

Format : **[ID] Titre** — Écran/rôle · Scénario · Attendu → Constaté · Cause · Reco. Preuve `fichier:ligne`.

### P0 — Bloquant déploiement

**[A01] Migrations non appliquées → liste leads vide** · Leads/Super Admin · Ouvrir `/leads` → « Aucun lead ». Attendu : liste peuplée → Constaté : vide. **Cause :** `getAllLeads` SELECT référence `source_url`/`move_*` absents en base ; `if (error || !data) return []` masque l'erreur (`lib/leads-server.ts` ~265-290). **Reco :** `npx supabase db push` (additif, non destructif — aucun DROP/DELETE/TRUNCATE dans les migrations) **avant** le déploiement du code. C'est la cause du « où sont mes leads ».

### P1 — Critique

**[A02] Aucun cron → automatisations inertes** · Système · Attendu : relances/alertes toutes les 1–2 min → Constaté : uniquement au refresh admin. **Cause :** aucun `vercel.json`/GitHub Action/n8n Schedule/OS cron ; `PRESENCE_CRON_SECRET` non défini (`app/api/presence/evaluate/route.ts:14-40`). **Reco :** planifier un appel récurrent (Vercel Cron / n8n Schedule / GitHub Action) vers `/api/presence/evaluate` avec le secret ; provisionner `PRESENCE_CRON_SECRET`.

**[A03] RLS ouvertes sur Documents & Contrats** · Sécurité/tenancy · Un commercial requête `contracts`/`client_documents` → voit **tous** les clients ; `contract_passages` **modifiable/supprimable par tous**. **Cause :** `SELECT using(true)` (`20260915000002_contracts.sql:98`, `20260915000001_client_documents.sql:53`) et `for all using(true) with check(true)` (`20260915000003_contract_passages.sql:34-35`). **Reco :** restreindre le SELECT au modèle propriétaire/rôle (comme `documents`) et scoper l'écriture des passages.

**[A04] Double signature → double facture d'acompte** · Compta · Deux soumissions concurrentes (ou mark-signé + signer) passent le garde lecture-puis-insert. **Cause :** pas de contrainte unique `(related_devis_id, type)` ; garde non atomique (`_shared/document-actions.ts:207-224,264`). **Reco :** index unique partiel `(related_devis_id) where type='acompte'` + idem finale ; idéalement allocation numéro + insert dans une transaction/RPC.

**[A05] Templates client `[Date]`/`[Heure]` littéraux** · Client · Planificatrice envoie « Mail confirmation d'intervention » → client reçoit « Bonjour , … Date : [Date] Heure : [Heure] ». **Cause :** migration `20260801000004_templates_verbatim.sql:34-38` a écrasé la version variabilisée (`…003…:74-82`) par du texte brut ; `renderTemplate` n'interprète que `{token}` (`lib/message-templates-shared.ts:311-315`). **Reco :** restaurer `{client.prenom}`, `{intervention.date}`, `{intervention.heure}` dans ces deux templates.

### P2 — Important

**[A06] Monotonie pipeline non gardée côté serveur** · Le garde est **client-only** (`PipelineBoard.tsx:123`) et exempte lead/envoye/ouvert/signe ; `updateLeadStatus` écrit toute cible sans validation (`pipeline/actions.ts:37-86`). Impacte l'analytique mano/auto. **Reco :** valider la transition côté serveur.

**[A07] Passe présence hors isolation** · `await evaluate()` hors try/catch (`route.ts:21`) ; un throw tue commercial+documents. **Reco :** envelopper aussi `evaluate()`.

**[A08] « Marquer signé » manuel = cascade légale sans preuve** · `MarkSignedModal` → `markDocumentSigned(id,"planificateur")` fait statut+FA+dossier sans signature/consentement/événement. **Reco :** confirmer l'intention métier (accord téléphonique) et tracer un événement dédié.

**[A09] OPTIMIVV : dossier sans lien devis → impasse facturation** · `lib/devis/status.ts:81-93` insère `quote_document_id=null` ; `generateFactureFinale` → « Aucun devis signé ». **Reco :** rattacher le devis OPTIMIVV ou unifier vers le System A.

**[A10] Comptabilité : HT & CA faux** · HT recalculé via TVA secteur codée en dur (`documents-server.ts:173-174,211-220`) → faux si TVA de ligne ≠ défaut ; `caThisMonth` somme le **TTC** (`documents-shared.ts:77-84`). **Reco :** lire `total_ht`/`total_vat` stockés ; sommer le HT pour le CA ; corriger le bord TZ.

**[A11] Numérotation à trous** · Numéro alloué avant l'INSERT dans une instruction séparée → échec = trou permanent (`init_functions.sql:20-25`). **Reco :** allouer + insérer atomiquement.

**[A12] Contrats sans `end_date`** · Aucune UI ne saisit la date de fin → KPI « expirent » et alerte J-7 dormants (`contracts-actions.ts:60`, `dashboard-server.ts:83`). **Reco :** ajouter le champ date de fin au `ContractForm`.

**[A13] `{intervention.date/heure}` vides côté client** · Aucun trigger client ne peuple ces variables (`leads/[id]/page.tsx:158-168`). **Reco :** injecter la date/heure du dossier dans le contexte du mail client, ou créer un modal client en planification.

**[A14] Confidentialité Immob/Travaux non protégée colonne** · Masquée par le mapper (`leads-server.ts:205`) mais lisible via anon par le commercial propriétaire (RLS ligne). **Reco :** protection colonne (vue/politique) ou chiffrement applicatif comme prévu au CDC.

**[A15] Aperçu « lecture seule » non implémenté** · `Topbar.tsx:207-210` placeholder. **Reco :** implémenter ou retirer de la promesse de recette.

**[A16] Clôture manuelle re-fire + re-notifie** · `completeAction` ne change pas le signal → recréation au cycle suivant (`engine-server.ts:287-338`). **Reco :** marquer « traité » sur le signal, ou fenêtre de suppression.

**[A17] « Marquer soldé » sans contrôle paiement** ; **planner sans pays voit tout** (`planification/actions.ts:146` ; `planification/page.tsx:37-40`). **Reco :** vérifier facture payée ; refuser scope vide.

**[A18] SMS fire-and-forget** journalisé « envoyé » sans confirmation (`SmsModal.tsx:57-61`). **Reco :** confirmer l'émission webphone avant de journaliser.

### P3 — Mineur

`callLead` code mort (`pipeline/actions.ts:884`) · « Model email » loggé « relance » (`…:1050`) · perso perdue mails devis (« Bonjour » sans nom) · dashboard « Planifier » non contextuel (`DocumentsDashboard.tsx:99`) · `cert_hotte`/`devis_optimivv` all-auth read · `/settings` index non gardé · `entity_type` audit surchargé « user » · leads sans pagination · « Refus » via `window.prompt` sans confirm · écritures best-effort sans check erreur · dedup WF1 TOCTOU 500 au lieu de 200 · funnel « Lead entrant € » approximé (assumé).

---

## 8. CONTRÔLE DE COUVERTURE

- **Fonctionnalités identifiées :** ~120 (24 modules).
- **Avec résultat de recette :** 100 % (tableau §3 + fiches §7). Les éléments non exécutables sont explicitement ⚪ avec raison (signature live, envoi mail/SMS réel, temps réel multi-utilisateurs, responsive, recherche runtime).
- **Boutons/actions :** inventoriés module par module dans les 6 balayages (leads/pipeline, devis/signature, planif, documents/templates, alertes, rôles) ; aucun bouton mort trouvé côté Documents & Contrats ; côté commercial, seul le chemin serveur `callLead` est du code mort (non déclenché depuis l'UI).

### Ce qui a été confirmé SOLIDE (aucun défaut détecté)
Calculs HT→TVA→TTC + remise + split TVA acompte · intégrité SHA-256 & expiration de signature · isolation des leads par RLS · gestion utilisateurs (garde + RLS) · KPIs dashboard réels · module présence (enregistre vraiment) · pré-remplissage certificat hotte & contrats (sans double saisie) · handoff signature→dossier **entièrement automatique** · média (bucket privé + URLs signées + RLS).

### Test réel réalisable prochainement (hors de cet environnement)
Une fois les migrations poussées et un cron branché : rejouer en navigateur les 5 scénarios client (signe / ne signe pas / photos manquantes / signé non planifié / soldé) avec 2 comptes commerciaux + 1 planif + 1 admin en parallèle, et vérifier la propagation temps réel + la non-attribution croisée des signatures (points §3/§4/§15 de votre cahier de recette).

---

## 9. PLAN DE CORRECTION RECOMMANDÉ (ordre)

1. **P0** — `npx supabase db push` (débloque les leads).
2. **P1** — Cron d'évaluation + secret · durcir RLS contracts/client_documents/contract_passages · index unique anti-doublon FA · restaurer les variables des 2 templates client.
3. **P2** — Garde serveur de transition · isolation `evaluate()` · Comptabilité HT/CA · `end_date` contrats · date/heure mails client · OPTIMIVV facturable · contrôle « soldé ».
4. **P3** — Nettoyages (code mort, libellés, pagination, gardes cosmétiques).

> Aucune correction n'a été appliquée dans cette passe (règle respectée). Sur votre feu vert, je peux traiter les P0/P1 en priorité, un lot à la fois, avec build de vérification à chaque étape.
