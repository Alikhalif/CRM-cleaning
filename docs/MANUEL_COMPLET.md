# CGK CRM — Manuel complet

> Manuel de référence à destination des commerciaux, planificateurs, admins et
> développeurs. À jour au 2026-05-20.

---

## 1. Vue d'ensemble

**CGK CRM** est un CRM commercial interne pour une PME française multi-secteurs
(B2B + B2C). Il remplace un patchwork tableurs/emails par une plateforme unique
qui :

- ingère des leads depuis l'acquisition payante (Google Ads, Meta Ads, formulaires LP, téléphone, recommandation),
- pilote le cycle commercial via un Kanban à 7 étapes,
- émet devis, factures d'acompte et factures finales pour plusieurs sociétés (multi-entités),
- déclenche signature électronique (eIDAS) — prévu, non encore wiré,
- pousse les conversions vers Google Ads (offline, via GCLID) — prévu, non encore wiré.

**Équipe initiale** : ~10 utilisateurs (commerciaux + planificatrice + admin).
**Volumes cibles** : 150 leads/mois, 80 devis/mois, 30 signatures/mois — scalable ×5.

### 1.1 Stack technique

| Couche | Outil |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, TypeScript strict, SCSS modules |
| Base de données | Supabase (Postgres 15 + Auth + RLS + Realtime) |
| Email transactionnel | Brevo (envoi + parsing inbound) |
| Téléphonie | Ringover (click-to-call + webhooks events) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| PDF | @react-pdf/renderer (rendu serveur) |
| Hébergement | Vercel (déploiement repo GitHub) |
| Conformité | audit_logs append-only (CDC §8.2), RLS strict sur chaque table business |

### 1.2 État actuel

- ✅ Toutes les pages branchées sur des données réelles (plus aucun mock)
- ✅ Toutes les mutations exposées via Server Actions (lead, devis, dossier, facture)
- ✅ Auth Google opérationnelle (config Google Cloud + Supabase à faire de votre côté)
- ✅ Brevo email envoi + inbound branchés
- ✅ Ringover en mode "fake" (UI et webhooks fonctionnels sans compte)
- ✅ Notifications temps réel via Supabase Realtime
- ✅ Audit logs sur 25+ actions
- ⚠️ n8n WF1/WF2 désactivés par défaut (flag runtime dans `/settings/integrations`)

---

## 2. Démarrage rapide

### 2.1 Prérequis

- Node.js 20+
- npm
- Compte Supabase actif (URL projet + clés)
- Supabase CLI (`npm install -g supabase`)

### 2.2 Installation locale

```bash
git clone <repo>
cd cleaning-crm
npm install
cp .env.example .env.local
# Remplir .env.local avec les vraies clés (voir §10)
npx supabase db push        # applique toutes les migrations
npm run dev                  # http://localhost:3000
```

### 2.3 Premier compte admin

Après inscription via `/signup` ou Google OAuth, donnez le rôle admin :

```sql
-- Dans Supabase SQL editor
insert into user_roles (user_id, role_id)
select au.id, (select id from roles where slug = 'admin')
from auth.users au
where au.email = 'votre-email@example.com'
on conflict do nothing;
```

Puis hard-refresh (Ctrl+Shift+R).

### 2.4 Après chaque migration

Toujours rafraîchir le cache PostgREST sinon les nouvelles colonnes 404 :

```sql
notify pgrst, 'reload schema';
```

---

## 3. Modèle de données

### 3.1 Tables principales

| Table | Rôle |
|---|---|
| `users` (mirror de `auth.users`) | Profil utilisateur (commerciaux, admin, planificateur) |
| `roles` + `user_roles` | Rôles multi-attribution (admin, commercial, planificateur, assistant) |
| `user_permissions` | Permissions granulaires (ex. `immobTravaux`) |
| `activities` | 4 secteurs : urgence, nettoyage, ENR, rénovation |
| `lead_sources` | 5 sources : google_ads, meta_ads, site_web, telephone, recommandation |
| `legal_entities` | Sociétés émettrices (multi-entité) |
| `legal_entity_activities` | Mapping société ↔ activité avec flag is_default |
| `payment_terms` | comptant / 30j / 45j / 60j |
| `prestations` | Catalogue tarifaire (label, prix HT, TVA, unité) |
| `leads` | Le lead (B2C ou B2B) — pivot du cycle commercial |
| `clients` | Le client (issu d'un lead converti OU direct) |
| `documents` | Devis + factures (acompte + finale) — table unique |
| `document_lines` | Lignes des documents |
| `doc_counters` | Compteurs gapless par type+année (CDC §5) |
| `dossiers` | Chantier après signature (à planifier / planifié / finalisé / soldé) |
| `technicians` | Intervenants terrain |
| `notifications` | Inbox per-user |
| `audit_logs` | Traçabilité append-only (CDC §8.2) |
| `app_settings` | Toggles runtime (ex. n8n on/off) |
| `routing_rules` | Règles d'attribution automatique des leads |

### 3.2 Relations clés

```
leads → activity_id → activities
leads → source_id → lead_sources
leads → owner_id → users
clients → source_lead_id → leads (optionnel)
documents → lead_id → leads
documents → client_id → clients
documents → entity_id → legal_entities
dossiers → lead_id → leads
dossiers → technician_id → technicians
```

### 3.3 Row-Level Security (RLS)

**Toutes les tables business ont RLS activée** (CDC §3 + §8.2). Règles principales :

- **leads** : visible si `owner_id = auth.uid()` OU admin OU planificateur
- **documents** : visible si admin OU planificateur OU owner du lead lié
- **dossiers** : visible si admin OU planificateur OU owner du lead lié
- **audit_logs** : SELECT admin uniquement, INSERT pour tous les authentifiés
- **legal_entities / activities / prestations** : SELECT pour tous, write admin uniquement
- **notifications** : SELECT/UPDATE sur sa propre user_id ; INSERT via service-role uniquement

---

## 4. Rôles & permissions

### 4.1 Rôles

| Rôle | Slug | Description |
|---|---|---|
| Super Admin | `admin` | Accès complet, gestion sociétés, audit, intégrations |
| Commercial | `commercial` | Voit ses propres leads, peut créer/modifier devis |
| Planificateur | `planification` | Voit tout, gère les dossiers + interventions |
| Assistant | `assistant` | Phase 2 — non actif |

Un utilisateur peut cumuler plusieurs rôles via `user_roles`.

### 4.2 Matrice d'accès

| Module | Admin | Commercial | Planificateur |
|---|---|---|---|
| Dashboard | full | mes KPIs | full (lecture) |
| Pipeline | full | mes leads | — |
| Leads & devis | full | mes leads | lecture |
| Commerciaux | oui | — | — |
| Planification | oui | — | full CRUD |
| Comptabilité | oui | — | full CRUD |
| Paramètres | oui | — | — |

### 4.3 Permissions granulaires

- `immobTravaux` : affiche le champ confidentiel "Annotation Immobilier/Travaux" sur la fiche lead. À attribuer explicitement.

---

## 5. Workflow commercial bout-en-bout

### 5.1 Les 7 étapes du Kanban

```
Lead entrant → Devis envoyé → Devis ouvert → Signé → Acompte encaissé → Encaissement final
                                                                                        ↓
                                                                              Perdu (sortie possible à tout moment)
```

Les deux dernières colonnes ("Acompte encaissé" et "Encaissement final") sont
**dérivées** : un lead y apparaît quand le document correspondant est marqué payé,
même si `lead.status` n'a pas encore avancé.

### 5.2 Sous-statuts obligatoires (CDC §2.3)

À partir de "Devis envoyé", deux sous-statuts doivent être renseignés (sinon badge rouge "Canal manquant") :

| Catégorie | Valeurs | Sens |
|---|---|---|
| Envoi | `mano` / `auto` | Envoi manuel par le commercial OU séquence n8n WF2 |
| Signature | `sans` / `avec` | Sans acompte (paiement à la livraison) OU avec acompte (déclenche facture d'acompte automatique) |

### 5.3 Cycle complet en pratique

1. **Lead capture** — depuis formulaire LP (via WF1, à brancher) OU saisie manuelle via `/pipeline → Nouveau lead`
2. **Tri** — le commercial qualifie, appelle, prend note (`Notes d'appel` auto-save sur la fiche lead)
3. **Devis** — `Générer devis` ouvre l'éditeur, lignes catalogue/libres, prix calculés serveur
4. **Envoi** — bouton "Envoyer au client" → email Brevo avec PDF en pièce jointe + status `envoye·mano`
5. **Tracking** — quand le client ouvre l'email → status `ouvert`. Quand il répond → notification dans le CRM (parsing inbound Brevo)
6. **Signature** — le commercial marque `signé` (avec/sans acompte). Si avec acompte → facture d'acompte créée automatiquement
7. **Encaissement acompte** — le commercial/planificatrice marque la facture payée
8. **Planification** — dossier passe en `planifié`, technicien + date assignés
9. **Intervention** — réalisée → dossier `finalisé`
10. **Facture finale** — générée manuellement depuis le dossier finalisé
11. **Encaissement final** — facture payée → dossier `soldé`

---

## 6. Pages détaillées

### 6.1 Authentification

#### `/login`
- Bouton **Se connecter avec Google** (OAuth) — primary
- Séparateur "ou"
- Form email + mot de passe
- Lien "Créer un compte" → `/signup`

#### `/signup`
- Champs : prénom, nom, email, mot de passe
- Le **premier utilisateur inscrit** reçoit automatiquement le rôle admin
- Bouton Google OAuth également disponible

#### `/auth/callback`
- Route handler qui reçoit le code OAuth de Google → l'échange contre une session Supabase → redirige vers `?next=`

### 6.2 Dashboard (`/dashboard`)

Vue d'ensemble pilotage. Affichage filtré par période et secteur.

- **6 KPIs** : Leads reçus, Devis envoyés, Devis signés, CA signé, CA encaissé, Taux de conversion
- **Funnel de conversion** : 5 étapes (Leads → Devis envoyés → Ouverts → Signés → Encaissés) avec pourcentages réels (plus de valeurs simulées)
- **Évolution sparkline** : graphique CA encaissé sur la période
- **Répartition par secteur** : Urgence / Nettoyage / ENR / Rénovation
- **Répartition par commercial** : leaderboard simplifié

**Filtres haut de page** : Période (30j par défaut), Activité (toutes par défaut).

### 6.3 Pipeline (`/pipeline`)

Le cœur du commercial — Kanban interactif.

#### Vue Kanban
- **7 colonnes** : Lead entrant / Devis envoyé / Devis ouvert / Signé / Acompte encaissé / Encaissement final / Perdu
- Drag-and-drop entre colonnes — la transition est **monotone** (un lead ne recule jamais)
- Chaque carte affiche : nom, ville, montant estimé, badges (NRP, Urgent, Mano/Auto, Sans/Avec acompte), avatar du commercial responsable

#### Vue Liste
- Même données, format tableau compact, triable

#### Bouton "Nouveau lead"
- Modal de création manuelle avec : type (Particulier/Pro), nom, contact, adresse, **secteur**, **source**, **commercial**, montant estimé, **superficie (m²)**, notes
- Génère le `short_id` automatiquement (L-NNNN)

#### Kebab menu sur chaque carte
- Lancer séquence (n8n — désactivé par défaut)
- Marquer NRP / Retirer NRP
- Mano / Auto (sous-statut envoi)
- Sans / Avec acompte (sous-statut signature)
- Déplacer vers une autre colonne

### 6.4 Leads & devis (`/leads`)

#### Liste (`/leads`)
- Recherche full-text (nom, ville, email, téléphone, shortId)
- **Filtre chip "NRP uniquement"** — retrouver tous les leads qui ne répondent pas
- Filtres par statut, source, commercial
- Toggle "Afficher perdus"
- Export CSV
- Badge NRP visible sur chaque ligne

#### Détail (`/leads/[id]`)
Page riche, onglets multiples.

**Header** :
- Avatar secteur (icône + couleur de marque)
- Nom + #shortId + chip Canal (Auto/Mano) + tags (Urgent, NRP)
- Ligne meta : secteur, ville, source, ancienneté, statut
- Boutons d'action : **Appeler** (Ringover), **Générer devis**, **Marquer NRP**, **Modifier coordonnées**, **Réassigner**, **Marquer perdu**

**Barre de progression Pipeline** :
- 6 étapes visualisées (Lead → Envoyé → Ouvert → Signé → Acompte encaissé → Encaissement final)
- Étape courante en vert + numéro
- Étapes franchies cochées

**4 KPI cards** : Montant devis, Ancienneté, Source, Commercial

**Onglets** : Informations / Historique / Devis / Documents / Intervention

**Onglet Informations (par défaut)** — colonne gauche :
- Coordonnées complètes (client, type, téléphone, email, adresse, source, SIRET si pro)

**Onglet Informations** — colonne droite :
- **Notes d'appel** : textarea auto-save (1.2s debounce), badge "Enregistré il y a X"
- **À rappeler** : 3 boutons rapides (24H / 48H / +48H) qui écrivent `next_followup_at`
- **Délai d'intervention souhaité** (post-signature uniquement) : radio (sous 72h / 1 semaine / 15 jours / 1 mois / personnalisé) + précisions textarea
- **Annotation Immobilier / Travaux** (gated par permission `immobTravaux`) : éditeur inline

**Onglet Historique** : timeline des événements (appels, emails, signatures, paiements, modifications de coordonnées, réassignations…)

**Onglet Devis / Documents** : tableau des devis et factures liés

**Onglet Intervention** : détails du dossier de planification

#### Modales
- **MarkLostModal** : 6 motifs presets (Pas de budget / Concurrence / Pas réactif / Hors zone / Projet reporté / Autre) + textarea
- **EditContactModal** : édition coordonnées (prénom/nom OU raison sociale selon type, email, téléphone, adresse, CP, ville)
- **ReassignLeadModal** : select des commerciaux, le bouton est désactivé si on re-pick le current owner

### 6.5 Commerciaux (`/commerciaux`)

Performance et classement (Super Admin uniquement). Page en cours d'enrichissement —
KPIs par commercial : leads attribués, devis envoyés, devis signés, taux de transfo, CA, panier moyen, sparkline.

### 6.6 Planification (`/planification`)

Vue de la planificatrice.

#### Encart "Acomptes à encaisser"
- Liste les dossiers en attente d'encaissement d'acompte
- Bouton **Encaisser** par ligne → marque la facture d'acompte payée + bump le dossier en `acompte_paye`

#### Tableau des dossiers
- Colonnes : Dossier (client + secteur + shortId), Devis lié, Statut, Paiement, Intervenant, Intervention (date + durée), Drapeaux, Actions
- **4 KPIs** au-dessus : À planifier, Planifiés, Finalisés, Soldés
- Filtres : Statut, Paiement, Drapeaux, Intervenant, recherche

#### Kebab menu par dossier
- **Planifier l'intervention** (status `a_planifier`) — modal date + technicien + durée
- **Marquer comme réalisé** (status `planifie`) — direct
- **Émettre la facture finale** (status `finalise` et pas de finale existante) — direct, génère FAC-NNNN
- **Envoyer confirmation au client** (status `planifie`) — modal email Brevo avec template pré-rempli
- **Marquer soldé**
- **Modifier le dossier** — modal édition complète (date, technicien, durée, notes, drapeaux)

### 6.7 Comptabilité (`/comptabilite`)

Vue financière + factures.

#### Header
- 3 boutons : **Voir clients** / **Nouveau client** / **Nouveau devis** (primary)

#### 4 KPIs
- Devis en attente (count + montant TTC)
- Acomptes à encaisser
- Finales à encaisser
- CA encaissé (mois)

#### Onglets
- **Devis** (par défaut)
- **Factures d'acompte**
- **Factures finales**
- **Fournisseurs** (placeholder — en préparation)

#### 5 Filtres
- Recherche numéro/client
- Toutes entités
- **Toutes activités** (secteur)
- **Tous intervenants** (technicien du dossier lié)
- **Tous apporteurs** (source du lead)

#### Tableau
Colonnes : Numéro / Client / Entité émettrice / Date / Validité ou Échéance / Canal (devis uniquement) / **Activité** (pill colorée) / **Intervenant** (avatar + statut) / Total HT / Total TTC / Statut / Actions

#### Menu kebab par ligne
- Voir le document
- Envoyer par email (deep-link vers la modale d'envoi sur la page détail)
- Dupliquer (crée un nouveau brouillon avec les mêmes lignes, nouveau numéro)
- Ouvrir le lead

### 6.8 Devis (`/devis/new` + `/devis/[id]`)

#### Éditeur (`/devis/new?lead=XXX` ou `?client=XXX`)
- Pré-rempli si `?lead=` ou `?client=` fourni
- **Document card** : Client (select), Entité émettrice (select multi-société), Date d'émission, Valide jusqu'au, Conditions de paiement, Acompte (%)
- **Lignes card** : ajout depuis catalogue (`prestations`) ou ligne libre. Chaque ligne : description, qté, unité, P.U. HT, TVA%, Remise%, Total HT (auto)
- **Notes** : textarea libre
- **Récapitulatif sticky** : Total HT, TVA par taux, Total TTC, Acompte (montant), Solde dû

**3 actions** :
- **Sauvegarder brouillon** : INSERT en status `brouillon`
- **Aperçu PDF** : sauvegarde en brouillon + ouvre le PDF dans un nouvel onglet
- **Envoyer au client** : INSERT en status `envoye` + envoi email Brevo automatique (PDF en pièce jointe). Le lead passe en `envoye·mano` si pas déjà avancé.

#### Détail (`/devis/[id]`)
- En-tête société + numéro + statut
- Bannière rouge si statut `refuse` : motif + prix initial + invitation à dupliquer
- Document A4-style : émetteur, destinataire, lignes, totaux, mentions
- **DocumentActions** (en haut, masqué à l'impression) :
  - **Aperçu PDF** (ouvre le PDF rendu serveur)
  - **Marquer envoyé** (devis brouillon → envoyé, sans email)
  - **Envoyer par email** (ouvre modale Brevo avec PDF)
  - **Dupliquer** (clone en brouillon, navigation auto)
  - **Marquer payée** (factures non payées uniquement)
  - **Marquer refusé** (devis non signés/non refusés uniquement) — modale 7 motifs

### 6.9 Factures (`/factures/[id]`)

Même DocumentView que les devis. Le statut affichage change (paye/retard/etc.). Les actions disponibles dépendent du type (devis vs facture).

### 6.10 Clients (`/clients`)

#### Liste (`/clients`)
- Recherche, filtre par type (pro/particulier) et secteur
- Colonnes : nom, type, ville, CA encaissé, dernière activité

#### Détail (`/clients/[id]`)
- Coordonnées complètes
- Stats (CA encaissé, CA signé, dernière activité)
- Historique des documents

#### Création (`/clients/new`)
- Formulaire complet pro/particulier
- Saisie SIRET, TVA intracom pour pros

### 6.11 Notifications (`/notifications`)

Inbox per-user. Mise à jour **temps réel** via Supabase Realtime — le badge bell dans le topbar update sans refresh.

- Tri par date desc
- Badge "non lu" coloré sur chaque ligne
- Clic sur une ligne : marque lue + navigue vers la cible (lead, document, etc.)
- Bouton "Tout marquer comme lu"

**Types** : `email.reply` (réponse client), `call.missed.inbound`, `call.inbound.answered`, `lead.assigned`, etc.

### 6.12 Paramètres (`/settings`)

Hub admin. Cards vers les sous-pages.

#### Sociétés émettrices (`/settings/entities`)
**Admin uniquement.**

- Liste des sociétés avec : nom, forme juridique, SIRET, APE, TVA, adresse, IBAN, BIC, couleur d'accent
- Bouton **Nouvelle société** → modal 15 champs
- Bouton **Modifier** (crayon) / **Supprimer** (croix) par ligne
- Suppression refusée si la société a des documents (préserve l'intégrité comptable)

#### Règles de routing (`/settings/routing`)
**Admin uniquement.**

Automatisation de l'attribution des leads selon des critères.

- Liste ordonnée par priorité (= ordre d'évaluation)
- Bouton **Nouvelle règle** → modal

**Modale règle** :
- Nom, priorité, active oui/non
- **Conditions** (toutes ET-logiques, toutes optionnelles) :
  - Superficie ≥ / < (m²)
  - Montant ≥ (€)
  - Secteur
  - Source
  - Client premium oui/non
- **Action** (radio, une seule) :
  - Pool commerciaux premium (round-robin par charge, fewest open leads first)
  - Commercial spécifique (select)

Le moteur s'exécute quand `createLead` est appelé avec `autoRoute: true` (le webhook WF1 quand wiré). La modale manuelle `/pipeline` n'utilise PAS le routing — le commercial choisit explicitement.

#### Intégrations (`/settings/integrations`)
**Admin uniquement.**

Toggle runtime pour les intégrations.

- **n8n Auto-séquence** : on/off. Quand off, le bouton "Lancer séquence" disparaît côté UI et l'action serveur refuse.
- Plus d'intégrations à ajouter ici quand wirées.

#### Journal d'audit (`/settings/audit`)
**Admin uniquement.**

100 dernières lignes du journal d'audit (CDC §8.2).

Colonnes : timestamp, acteur, action, entité, payload `after` (JSON résumé).

---

## 7. Intégrations

### 7.1 Supabase

- **Auth** : email/password + Google OAuth (config dans dashboard Supabase → Auth → Providers)
- **Database** : Postgres 15 + RLS sur chaque table
- **Realtime** : activé sur `notifications` (table seulement)
- **Storage** : pas encore utilisé (prévu pour les PDFs persistés)
- **Service role** : utilisé côté serveur uniquement (webhooks, routing) via `lib/supabase/service.ts`

### 7.2 Brevo (email transactionnel)

**Envoi** :
- Toute fonction `sendDocumentByEmail` appelle l'API Brevo avec PDF en pièce jointe
- Sender configuré via `BREVO_SENDER_EMAIL` (doit être vérifié dans Brevo dashboard → Senders)
- Si pas vérifié → erreur 400 "Sender not valid" surfacée à l'utilisateur

**Inbound parsing** (réponses clients) :
- Webhook `/api/webhooks/brevo/inbound`
- Configuration Brevo : sous-domaine (ex. `inbound.cgkcrm.fr`) + MX records + catch-all → URL webhook
- Le webhook parse le sujet pour trouver le numéro de doc (DEV-/FA-/FAC-), matche le lead via service-role, crée un audit log + notification au owner

**Restriction IP** : à désactiver dans Brevo (Vercel a des IPs dynamiques).

### 7.3 Ringover (téléphone)

**Click-to-call** :
- Bouton **Appeler** sur la page détail lead
- Appelle `lib/ringover.ts → initiateCall()`
- En mode fake (env vars absentes) : log console + audit + UI fonctionnent sans appel réel
- En mode réel : POST sur `/v2/callback` qui ring le softphone du commercial puis dial le client

**Webhook events** :
- `/api/webhooks/ringover` reçoit `call.ringing/answered/ended/missed`
- Vérification HMAC via `RINGOVER_WEBHOOK_SECRET`
- Écrit dans audit log `lead.call.<direction>.<phase>` + notifications (appels manqués / entrants)

### 7.4 Google OAuth

- Bouton "Se connecter avec Google" sur `/login` et `/signup`
- Configuration nécessaire :
  1. Google Cloud → Credentials → OAuth Client ID Web
  2. Authorized redirect URI : `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
  3. Supabase dashboard → Auth → Providers → Google → toggle on + Client ID + Secret
- Le callback handler `/auth/callback` échange le code → session

### 7.5 n8n (séquences WF2)

**Désactivé par défaut** via `app_settings.n8n_sequence_enabled = false`.

Pour activer :
1. Provisionner n8n self-hosted
2. Configurer les workflows WF1 (lead capture inbound) + WF2 (relance devis sortante)
3. Dans `/settings/integrations` toggle "n8n auto-séquence" sur ON
4. Le bouton "Lancer séquence" réapparait dans pipeline kebab + LeadActions

Wire à compléter dans `lib/n8n.ts` (à créer) et dans l'action `launchSequence`.

### 7.6 PDF rendering

- @react-pdf/renderer (Helvetica, A4)
- Route : `/api/documents/[id]/preview-pdf` (auth gated)
- Composant : `lib/pdf/DocumentPdf.tsx`
- Layout : header société (logo + legals), parties émetteur/destinataire, lignes, totaux avec TVA par taux, acompte, mentions footer

---

## 8. Conformité & audit

### 8.1 Audit logs (CDC §8.2)

Table `audit_logs` append-only. Chaque mutation écrit un événement avec :
- `user_id` (acteur)
- `action` (slug type `lead.status.change`, `document.send_email`, etc.)
- `entity_type` + `entity_id`
- `before` / `after` (jsonb)

**RLS** : SELECT admin uniquement (le journal est accessible sur `/settings/audit`). INSERT pour tous les authentifiés.

**~25 actions tracées** : status, contact updates, NRP toggle, reassign, lost, sequence launch, calls, document creation/duplication/send_email/mark_sent/mark_paid/mark_refused, dossier planify/edit/finalize/sold/acompte_paid/finale.create, client creation, auth login/logout/signup, routing rule CRUD, entity CRUD.

### 8.2 Annotation Immobilier / Travaux (CDC §3.5)

Champ confidentiel sur chaque lead. Visible uniquement si l'utilisateur a la permission `immobTravaux` (table `user_permissions`).

Le champ existe en clair dans la DB pour l'instant ; chiffrement applicatif AES-GCM prévu pour la phase production.

### 8.3 Encrypted at rest

- IBAN/BIC des sociétés : prévu chiffré applicatif (CDC §4.2) — non encore wiré

---

## 9. Variables d'environnement

Copier `.env.example` → `.env.local` et remplir :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...                 # BYPASS RLS — server-only

# Brevo email
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=ne@votre-domaine.fr           # doit être vérifié dans Brevo
BREVO_SENDER_NAME=CGK CRM
BREVO_INBOUND_SECRET=...                         # optionnel, sécurise le webhook inbound

# Ringover (optionnel — sinon mode fake)
RINGOVER_API_KEY=...
RINGOVER_API_BASE=https://public-api.ringover.com
RINGOVER_WEBHOOK_SECRET=...
```

**IMPORTANT** : ne JAMAIS commit `.env.local`. La valeur réelle du `SUPABASE_SERVICE_ROLE_KEY` permet de bypass RLS — exposition = incident critique.

---

## 10. Migrations & schéma

### 10.1 Liste des migrations

| Date | Fichier | Contenu |
|---|---|---|
| 20260515 | init_extensions, init_tables, indexes, init_functions, init_rls | Schéma initial complet |
| 20260516 | scaffold_anon_read | Lecture anon temporaire (supprimée ensuite) |
| 20260517 | auth_user_setup, drop_scaffold_anon | Mirror auth.users → public.users, fin de la lecture anon |
| 20260518 | next_doc_num_security_definer, lead_nrp, notifications, notifications_realtime | RPC gapless, NRP, inbox, Realtime |
| 20260519 | app_settings, lead_intervention_delay | Toggles runtime + délai post-signature |
| 20260520 | premium_refusal_surface, routing_rules | Premium tiers, motif refus, moteur routing |

### 10.2 Appliquer une migration

```bash
npx supabase db push
# puis dans SQL editor :
notify pgrst, 'reload schema';
```

### 10.3 Régénérer les types TypeScript

```bash
npx supabase gen types typescript --project-id <ref> > lib/supabase/database.types.ts
```

À faire après chaque nouvelle migration qui change la structure.

---

## 11. Déploiement Vercel

### 11.1 Première fois

1. Import du repo GitHub dans Vercel
2. Coller les variables d'environnement (§9) — toutes sauf les `NEXT_PUBLIC_*` doivent être en "Production" + "Preview"
3. Deploy
4. Désactiver la restriction IP de la clé Brevo (IPs Vercel dynamiques)
5. Configurer SPF + DKIM sur le domaine sender (sinon spam)

### 11.2 Mises à jour

`git push origin main` → Vercel build + déploie automatiquement.

---

## 12. Modèle d'usage par rôle

### 12.1 Commercial — journée type

1. Login (Google ou email)
2. Pipeline : voir les nouveaux leads attribués
3. Lead detail → bouton **Appeler** (Ringover) — taper le nom dans le palette ⌘K pour gain de temps
4. Notes d'appel auto-save pendant le tour
5. Si pas de réponse → **Marquer NRP** + bouton À rappeler dans 24H
6. Si intéressé → **Générer devis** → éditeur → **Envoyer au client** (Brevo)
7. Surveiller bell badge (notification temps réel) pour réponses
8. Quand client signe verbalement → marquer Signé (Avec acompte si applicable) — facture d'acompte auto-créée
9. Encaisser acompte depuis Planification (côté planificatrice) ou Comptabilité

### 12.2 Planificatrice — journée type

1. Login
2. Planification : encart "Acomptes à encaisser" en premier
3. Pour chaque dossier acompte payé → **Planifier l'intervention** (modal date + technicien)
4. Email confirmation au client (modal "Envoyer confirmation")
5. Après intervention : **Marquer comme réalisé** sur le dossier
6. **Émettre la facture finale** (génère FAC-NNNN)
7. Envoyer la finale par email (depuis détail document)
8. Quand payée → **Marquer payée** → dossier automatiquement Soldé

### 12.3 Admin — semaine type

1. Settings → Audit pour revue conformité
2. Settings → Sociétés pour ajouter/modifier les sociétés émettrices
3. Settings → Règles de routing pour ajuster les attributions auto
4. Settings → Intégrations pour activer/désactiver n8n
5. Commerciaux → suivre les performances

---

## 13. Limitations connues & roadmap

### 13.1 Limitations

- **n8n WF1/WF2** : non wirés (toggle off par défaut). Quand n8n provisionné, modifier `app/(app)/pipeline/actions.ts` → `launchSequence()` pour POST JWT vers `/webhook/relance-devis`.
- **PDF preview** : rendu en mémoire, pas encore stocké. Pour Yousign / DocuSign, stockage signé-URL via Supabase Storage à wirer.
- **Conversion lead → client** : automatique uniquement lors d'une signature. Le bouton "Convertir" manuel n'existe pas encore.
- **Chiffrement applicatif** : IBAN/BIC et `immob_travaux_annotation` stockés en clair (production : AES-GCM à wirer).
- **MFA TOTP** : non activé (CDC §10 Phase 3).
- **Rate limiting login** : non actif (CDC mentionne 5-failed-login lockout).
- **Multi-tenant** : tout est mono-tenant. Pas de séparation entre plusieurs CGK clientes.

### 13.2 Roadmap court terme

| Tâche | Effort | Notes |
|---|---|---|
| Configurer DKIM/SPF sur sender Brevo | 30 min | Bloque la délivrabilité emails sinon |
| Provisionner Ringover + wiring réel | 1-2h | Schéma déjà ready |
| Provisionner n8n + activer WF1/WF2 | 2-4h | Selon hébergement choisi |
| Yousign / DocuSign | 1 jour | Webhook callback + stockage evidence pack |
| Google Ads Enhanced Conversions | 1 jour | Fire on `signe` + `encaisse` via GCLID |
| MFA TOTP | 2h | Supabase Auth supporte nativement |
| Chiffrement IBAN/immob_travaux | 1 jour | AES-GCM applicatif |

### 13.3 Roadmap long terme (CDC §10 Phase 3)

- Page audit logs avec filtres + export
- Vues matérialisées pour KPIs Dashboard
- Sentry + monitoring
- Rôle Assistant
- Tests E2E
- Runbook ops

---

## 14. Contact & questions techniques

Toute question sur :
- Architecture / extension du code → consulter `CLAUDE.md` + `docs/SPEC.md` + `docs/SUPABASE.md`
- Bugs / régressions → issues GitHub
- Conformité RGPD → revoir CDC §8.2 + audit_logs

---

**Document maintenu par l'équipe technique. Mettre à jour après chaque sprint important.**
