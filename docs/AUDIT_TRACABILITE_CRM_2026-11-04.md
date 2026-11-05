# Registre de traçabilité — CRM OPTIMIVV

**Date de l'audit :** 4 novembre 2026
**Périmètre :** historique accessible du 2026-07-08 au 2026-11-04
**Branche :** `feature/docusign-sandbox`
**Point de restauration :** tag git `restauration-2026-11-04`

> Ce document est **ajouté**, il ne remplace rien. Les audits précédents
> restent en place : [RECETTE-CRM.md](RECETTE-CRM.md),
> [RECETTE-CRM-2026-09-24.md](RECETTE-CRM-2026-09-24.md),
> [carte-grise/](carte-grise/).

---

## 0. Ce qui n'est pas accessible — à lire avant les tableaux

**`TRACABILITE.md` n'existe pas.** Recherche effectuée sur tout l'arbre du
dépôt, hors `node_modules` et `.next` : aucun fichier de ce nom. Les trois
master prompts y renvoient comme s'il existait. Il n'a donc **pas** été
consulté, et aucune ligne de ce registre n'en provient.

**Rien avant le 2026-07-08.** La première trace horodatée accessible sur cette
machine est du 8 juillet 2026. Toute demande antérieure est hors de portée et
n'est **pas** comptée comme vérifiée.

**Aucune navigation réelle dans les interfaces.** Pas d'identifiants de test,
pas d'environnement séparé, et l'interdiction d'écrire dans les données de
production. Aucune ligne de ce registre ne porte donc la mention « test
d'interface » ou « test utilisateur ». Le substitut employé est un contrôle
d'**accessibilité** (chaîne symbole → composant → page → route → rôle), décrit
au §5.

---

## 1. Source et méthode du registre

Les demandes sont extraites des **deux transcripts de session** présents sur
la machine (173 Mo et 147 Mo), en lecture seule.

| Mesure | Valeur |
|---|---|
| Messages utilisateur au total | 1 088 |
| Messages longs (> 1 500 caractères) | 243 |
| Écartés : bruit du harnais | 22 |
| **Demandes retenues au registre** | **221** |
| dont sans horodatage exploitable | 15 |
| Jours distincts | 60 |

Un « bruit du harnais » est un message techniquement émis sous le rôle
utilisateur mais qui n'est pas une consigne : reprise de contexte après
compactage, ouverture de fichier dans l'éditeur, chargement de skill,
rappel système. Les 22 écartés sont listés par la mécanique d'extraction et
n'ont pas été comptés comme demandes.

**Classement par module** : par mots-clés, en correspondance de **mot entier**.
La première version comptait les sous-chaînes et plaçait 130 briefs sur 221 en
« UX » parce que `"ui"` matchait « qui », « suivi », « produit ». Corrigé.
42 demandes restent **non classées** : elles le sont dites, pas
réparties d'autorité.

### Répartition par module

| Module | Demandes |
|---|---|
| Leads & pipeline | 47 |
| Non classé | 42 |
| Rôles & sécurité | 27 |
| Découverte | 20 |
| DocuSign | 19 |
| Facturation | 16 |
| Présence & actions | 11 |
| Déploiement & infra | 9 |
| Bibliothèques doc. | 9 |
| Grilles tarifaires | 5 |
| Sous-traitance | 5 |
| Ringover | 3 |
| Notifications | 3 |
| Responsive / UX | 2 |
| Vitrerie | 2 |
| Multientreprises | 1 |

### Répartition par mois

| Mois | Demandes |
|---|---|
| 2026-07 | 25 |
| 2026-08 | 53 |
| 2026-09 | 58 |
| 2026-10 | 40 |
| 2026-11 | 30 |
| date in | 15 |

---

## 2. Cohérence des chiffres de l'audit précédent

Le master prompt cite : 1 056 tours, 824 après filtrage, 240 demandes
étoffées, 29 demandes d'octobre-novembre, 28 vérifiées individuellement,
19 appliquées, 6 partielles, 1 non appliquée, 2 non vérifiables, conformité
70 %.

**Ces chiffres sont cohérents entre eux, et le rapprochement avec ma propre
mesure tient :**

| Chiffre cité | Ma mesure | Verdict |
|---|---|---|
| 240 demandes étoffées | 243 messages longs, **221** après filtrage du bruit | cohérent |
| 1 056 tours | 1 088 messages utilisateur | cohérent (méthode de filtrage différente) |
| 19 + 6 + 1 + 2 | = **28** | égal aux « 28 vérifiées individuellement » |
| conformité 70 % | 19 / 28 = **67,9 %** | cohérent |

**LE POINT IMPORTANT, ET IL CHANGE LA LECTURE DU RAPPORT :**

Le taux de 70 % porte sur **28 demandes vérifiées**, pas sur les 240
identifiées. Rapporté au périmètre complet, cela donne **19 / 240 = 7,9 %** de
demandes vérifiées ET conformes. **212 demandes sur 240 n'ont jamais été
vérifiées individuellement.**

Ce n'est pas une erreur de l'audit précédent — il annonçait bien 28 demandes
vérifiées. C'est une erreur de lecture à éviter : le 70 % n'est pas un taux de
conformité du CRM, c'est un taux de réussite sur un échantillon de 11,7 % du
périmètre.

Le présent registre ne corrige pas ce taux : il en explicite la base.

---

## 3. Les 7 anomalies du premier audit — suivi ligne par ligne

### P1-1 — Génération automatique des devis

| | |
|---|---|
| **Cause** | `lib/generation/devis-contenu.ts` (660 l.) et `demande-prestataire.ts` (446 l.), écrits le 2026-10-31 (commit `298e09d`), n'avaient **aucun appelant**. Aucun écran ne pouvait les atteindre. Ni le typage ni le build ne le signalaient. |
| **Correction** | Pont `lib/generation/devis-depuis-decouverte.ts` + action serveur `app/(app)/leads/[id]/devis-actions.ts` + bouton dans `DiscoveryCard.tsx`. Idempotent. |
| **Fichiers** | `lib/generation/devis-depuis-decouverte.ts`, `app/(app)/leads/[id]/devis-actions.ts`, `app/(app)/leads/[id]/DiscoveryCard.tsx`, `app/(app)/leads/[id]/page.tsx` |
| **Test** | Exécution du moteur sur **28 découvertes réelles de production** (lecture seule) + 98 assertions pures |
| **Résultat** | 28/28 contenus produits, 0 refus, 0 formulation proscrite, 0 prix |
| **Statut** | **CORRIGÉ pour les deux modules.** `devis-contenu.ts` branché sur la découverte ; `demande-prestataire.ts` branché le même jour via `lib/generation/demande-depuis-dossier.ts` et le panneau `DemandeTarif.tsx` de l'écran de contrat. L'îlot de 1 106 lignes de code mort n'existe plus. |

Quatre défauts du moteur, invisibles à la lecture du code, trouvés par ce test :

1. **Lessivage des murs produit même quand refusé** — le garde testait
   `murs_aucun`, valeur inexistante dans la liste (`non` / `murs_traces` /
   `murs_lessivage`). Un « Non » produisait la ligne `- Non.` et une réserve.
2. **Clés techniques dans le texte client** — le devis réel du dossier
   **L-1652** portait « Nettoyage des équipements : **opt_frigo**. » Mauvaise
   liste d'options ; même erreur pour étage, stationnement, accès, surfaces.
3. **Vitrerie sous-décrite** — 4 champs repris sur 17. Délégation à
   `descriptifVitrerie()`, qui existait déjà.
4. **Transport** — 10 champs sur 16 ignorés, dont étages, ascenseurs et accès.

### P1-2 — Multientreprises

| | |
|---|---|
| **Cause** | Deux problèmes distincts. (a) `controlerEntite()` exige un représentant légal : **0/7 sociétés** en ont un → aucun contrat ne peut être émis. (b) La validation du formulaire exigeait un **SIRET de 14 chiffres pour toutes les sociétés** : aucune entité suisse, belge, luxembourgeoise ou canadienne n'était enregistrable, alors que le CRM opère dans 5 pays. `country` et `siren` existaient en base mais **aucun écran ne les exposait**. |
| **Correction** | `IDENTIFIANT_LEGAL` par pays (`lib/leads.ts`), sélecteur de pays + identifiant adaptatif au formulaire, SIRET exigé en France seulement, colonne `representative_company_name` (migration `20261104000001`) pour la représentation par une personne morale. |
| **Fichiers** | `lib/leads.ts`, `app/(app)/settings/entities/{actions.ts,EntityFormModal.tsx,EntitiesList.tsx}`, `lib/documents-server.ts`, `lib/sous-traitance/variables.ts`, `supabase/migrations/20261104000001_entites_multipays_representation.sql` |
| **Test** | 12 assertions sur les 5 pays + 4 sur la formule de représentation + lecture production des 7 sociétés |
| **Résultat** | Le blocage multi-pays est levé. **Les 7 représentants restent à saisir** — ce sont les statuts du client. |
| **Statut** | **CORRIGÉ côté logiciel · BLOQUÉ côté données** |

### P1-3 — Contrats 8 et 9

| | |
|---|---|
| **Cause** | Le message du 2026-11-01 portait **deux** contrats dans un envoi de 50 447 caractères. La limite de 50 000 l'a coupé : le contrat 7 est complet, le contrat 8 s'arrête en pleine phrase de l'article 27. Le contrat 9 n'a jamais été transmis. |
| **Correction** | Recherche dans l'historique Git, les fichiers du dépôt et les transcripts **avant** toute écriture. Contrat 8 récupéré et versionné : articles **1 à 26 complets** (21 091 caractères de texte validé). |
| **Fichiers** | `docs/contrats-sous-traitance/contrat-08-lessivage-RECUPERE-INCOMPLET.md` |
| **Test** | Mesure article par article du texte récupéré ; recherche exhaustive du contrat 9 (`"sans lessivage"` n'apparaît que comme intitulé dans les listes) |
| **Résultat** | Contrat 8 à **84 %** (26/31 articles). Manquent : fin de l'art. 27, art. 28-31, annexes 1 et 2. Contrat 9 : **0 %**. |
| **Statut** | **BLOQUÉ** — aucune clause rédigée, les deux modèles restent refusés à l'émission |

### P2-1 — Notifications / badge `leadsUntreated`

| | |
|---|---|
| **Cause** | `lib/nav.ts` déclarait `badge?: "leadsUntreated"` depuis l'origine. **Aucun code ne le consommait.** |
| **Correction** | `lib/leads-non-traites-server.ts` + pastille en navigation + bandeau « NOUVEAU LEAD — À RAPPELER » au tableau de bord. Définition stricte de la prise en charge : `TREAT_ACTIONS` **sans** `lead.open`, car ouvrir la fiche ne doit pas effacer l'alerte. La règle d'alerte de présence garde sa propre définition, **intacte**. |
| **Fichiers** | `lib/leads-non-traites-server.ts`, `components/Sidebar/Sidebar.{tsx,module.scss}`, `app/(app)/layout.tsx`, `app/(app)/dashboard/{page.tsx,AlerteNouveauxLeads.tsx,AlerteNouveauxLeads.module.scss}` |
| **Test** | Chaîne d'accessibilité vérifiée sur 6 maillons ; périmètre par la RLS |
| **Résultat** | Visible et atteignable. **Non cliqué.** |
| **Statut** | **CORRIGÉ, NON TESTÉ EN INTERFACE** |

### P2-2 — Grilles tarifaires

| | |
|---|---|
| **Cause** | 9 grilles, 2 publiées (`active`), 7 en brouillon. |
| **Correction** | **Aucune** — publier un tarif demande une validation. Les 7 sont identifiées. |
| **Test** | Lecture production de `pricing_grids` |
| **Résultat** | 5 brouillons ont du contenu et sont publiables : `urgence` (10 éléments), `transport` (10), `diogene` (8), `debarras` (7), `nettoyage_difficile` (7). **2 sont des coquilles vides** : `enr` et `renovation`, 0 élément depuis le 2026-10-14. Publiées : `nettoyage` v2, `demenagement` v9. `visible_to_commercial` = `false` sur les 7 brouillons, `true` sur les 2 actives — cohérent. |
| **Statut** | **IDENTIFIÉ — décision client requise** |

### P2-3 — Ringover

| | |
|---|---|
| **Cause** | 10 appels tracés dans `audit_logs`, **tous sortants, sur 1 seul dossier**, 0 entrant. **Aucune table dédiée** aux appels sur les 84 tables du schéma. |
| **Correction** | **Aucune.** Construire un journal d'appels sur 10 lignes dont aucune entrante serait un écran vide : la panne est en amont (ligne non active ou webhook muet). |
| **Test** | Lecture production : inventaire des 84 tables + comptage des actions `lead.call.*` |
| **Résultat** | Le croisement leads ↔ téléphonie demandé est **impossible aujourd'hui** : il n'y a rien à croiser. |
| **Statut** | **BLOQUÉ EN AMONT — décision client requise** |

### P3-1 — Comptabilité / permissions

| | |
|---|---|
| **Cause** | `lib/documents-server.ts` passait `canProvenance = true` **en dur** à `mapLead()`. |
| **Analyse** | Le motif était exact : `/comptabilite` est dans `RESTRICTED_MODULES`, son `layout.tsx` appelle `requireBackOffice()`, et `getAllDocumentsWithContext()` n'avait qu'un seul appelant. **Il n'y avait donc pas de fuite.** Mais c'était une hypothèse sur l'appelant, pas un contrôle. |
| **Correction** | Permission résolue par `currentUserCanSeeProvenance()` (admin ∪ planification), même source de vérité que la fiche lead, enveloppée dans `cache()`. |
| **Fichiers** | `lib/documents-server.ts` |
| **Test** | 3 assertions d'accessibilité + sondage anonyme de 28 tables |
| **Résultat** | Contrôle réel, aucun changement pour les rôles légitimes |
| **Statut** | **CORRIGÉ** |

---

## 4. Les 16 modules audités

Légende : 🟢 conforme et testé · 🟡 partiellement conforme · 🔴 non conforme
ou bloqué · ⚪ non vérifiable.

| # | Module | Développement | Affichage | Accessibilité | Fonctionnement | Permissions | Test réel | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | Leads & pipeline | complet | oui | prouvée | oui | RLS + scope | audit production | 🟢 |
| 2 | Découverte commerciale | complet | oui | prouvée | oui | RLS | 74 `discovery.save` | 🟢 |
| 3 | Vitrerie | 17 champs | oui | prouvée | oui | RLS | comptage + 9 assertions | 🟢 |
| 4 | Devis | complet | oui | prouvée | oui | RLS | 23 assertions | 🟢 |
| 5 | Facturation | complet | oui | prouvée | oui | back-office | 2/2 acomptes auto | 🟢 |
| 6 | Mes actions | complet | oui | prouvée | oui | RLS | 672 actions en base | 🟡 |
| 7 | Présence & actions | complet | oui | prouvée | oui | admin | cron actif | 🟡 |
| 8 | Devis à réaliser | complet | oui | prouvée | oui | RLS | 23 assertions | 🟡 |
| 9 | Notifications | **corrigé** | oui | prouvée | non cliqué | RLS | accessibilité | 🟡 |
| 10 | Sous-traitance | 7/9 contrats | oui | prouvée | **émission bloquée** | back-office | 29 assertions | 🔴 |
| 11 | DocuSign | OAuth + webhook | oui | prouvée | **0 enveloppe** | back-office | non testable | 🔴 |
| 12 | Multientreprises | **corrigé** | oui | prouvée | **0/7 prêtes** | admin | 16 assertions | 🔴 |
| 13 | Ringover | SDK intégré | oui | prouvée | **10 appels, 0 entrant** | profils | lecture production | 🔴 |
| 14 | Grilles tarifaires | 9 grilles | oui | prouvée | 2/9 publiées | admin | lecture production | 🟡 |
| 15 | Bibliothèques doc. | structure OK | oui | prouvée | **vide** | rôles | lecture production | 🔴 |
| 16 | Génération devis + prestataires | **corrigé** | oui | prouvée | oui | RLS | 28 dossiers réels + 22 assertions | 🟡 |

**Bilan : 5 conformes · 6 partiels · 5 non conformes · 0 non vérifiable.**

*Note : le module 16 reste 🟡 et non 🟢 parce qu'aucune écriture en base n'a été exercée en interface — la génération est testée sur 28 dossiers réels, l'enregistrement du brouillon ne l'est pas.*

Écart avec l'audit précédent (7/7/1/1) : le critère est plus dur — je refuse
de compter comme conforme ce qui n'est pas testé, et quatre modules passent de
« partiel » à « non conforme » parce que leur fonctionnement est **bloqué**,
pas seulement incomplet.

---

## 5. Contrôle d'accessibilité — le substitut au test d'interface

Suite `scripts/docusign-check/accessibilite.ts`, **143 assertions, 0 échec**, dans un ensemble de **522 assertions** réparties en 6 suites.

Elle remonte pour chaque fonctionnalité livrée la chaîne :

```
symbole exporté → composant → page → route → rôle autorisé
```

Elle existe parce que deux pannes réelles de ce CRM étaient exactement de
cette nature. Elle vérifie **un symbole par maillon** : une page qui monte un
composant lui passe une *prop*, elle ne nomme jamais la fonction serveur.

Couverture : 14 chaînes complètes, 19 entrées de navigation menant toutes à
une page réelle, le cloisonnement du commercial sur 9 routes
d'après-signature, les périmètres planificatrice et Super Admin, l'union des
rôles cumulés.

**Ce qu'elle ne prouve pas** : qu'un humain a cliqué. Aucune écriture en base
n'est déclarée testée.

---

## 6. Éléments à protéger — comptage réel

| Élément | Annoncé | Mesuré | Verdict |
|---|---|---|---|
| Templates de messages | 102 | **102** | exact |
| Prestations au catalogue | 78 | **78** | exact |
| Secteurs d'activité | 8 | **9** | **à corriger** : `debarras, demenagement, diogene, enr, nettoyage, nettoyage_difficile, renovation, transport, urgence` |
| Modèles de contrats référencés | 9 | **11 clés** | 9 contrats de la liste + 2 replis de routage non émissibles (`nettoyage_complements`, `demenagement_transport`), documentés comme tels |
| Textes de contrats complets | — | **7 sur 9** | contrats 8 et 9 sans texte |
| Pays | 5 | **5** | exact |
| Sociétés émettrices | 7 | **7** | exact, **0 utilisable** |
| Tables avec RLS | 50 | **50** | exact |
| Politiques de sécurité | 123 | **123 instructions `create policy`**, **83 noms uniques** | nuance : 40 sont des recréations par migration ultérieure. Le nombre de politiques *vivantes* est ≈ 83, pas 123. |

Le §6 du master prompt avertissait : « la présence de neuf références de
contrats ne prouve pas que les neuf textes sont complets ». **C'est exactement
le cas** : 9 références, 7 textes.

---

## 7. Sécurité — résultat préservé

Sondage avec la **clé anonyme**, sans session, sur 28 tables sensibles :

```
leads, documents, document_lines, clients, legal_entities, technicians,
subcontractor_profiles, subcontract_contracts, dossiers, pricing_grids,
audit_logs, commercial_actions, devis_optimivv, lead_media, client_documents,
user_roles, users, signature_requests, alerts, user_sessions,
message_templates, landing_pages, activities, payment_terms, prestations,
doc_counters, webhook_events          → 0 ligne lisible partout
docusign_connections                  → HTTP 401 (refus)
```

Identique à l'audit précédent. **Aucune des modifications n'a créé
d'exposition**, et l'une en a fermé une latente (P3-1).

---

## 8. Automatisations — déclencheur et activité réelle

| Automatisation | Déclencheur | Traces en production | État |
|---|---|---|---|
| Capture de leads (WF1) | `POST /api/webhooks/leads/inbound`, HMAC | **295** `lead.create.webhook` | **active** |
| Découverte enregistrée | bouton « Enregistrer la découverte » | 74 `lead.discovery.save` | active |
| Actions commerciales | cron `/api/presence/evaluate`, 1-2 min | 672 actions, type dominant `prise_en_charge` | active |
| Acompte automatique | **`doc.acompte_amount > 0` à la signature** | 2 `document.signed` → **2** `document.acompte.auto_create` | **active, 2/2** |
| Dossier à la signature | signature d'un devis | 2 `dossier.planify` | active |
| Relances | moteur d'actions | 2 `lead.relance.email` | active |
| Demande de photos | moteur d'actions | 2 `lead.photos.request` | active |
| Présence / sessions | heartbeat + cron | 131 `auth.login`, 58 `auth.logout` | active |
| Séquence n8n WF2 | **retirée le 2026-11-04** | **0** `lead.sequence.launch` | **retirée, voulu** |
| Envoi en signature | action manuelle | **0** `document.signature.sent` | jamais déclenchée |
| Génération devis IA | bouton « Générer le devis » | **0** — livrée ce jour | branchée, non exercée |

L'acompte automatique est **double-gardé** : recherche sur
`(related_devis_id, type='acompte')` **et** index unique partiel
`uq_one_acompte_per_devis`, une course concurrente étant traitée comme un
succès idempotent. Il lit `acompte_amount` et **non** le sous-statut
`sub_signature` du lead — choix documenté et assumé contre le CDC §2.3.
**Conforme, non modifié.**

---

## 9. Parcours devis — chaque transition

| Transition | Vérification | Résultat |
|---|---|---|
| Découverte enregistrée → bouton visible | assertion d'accessibilité + condition `enregistreA !== null` | **prouvée** |
| Bouton → récupération des informations | 28 découvertes réelles, 17 champs repris sur le dossier le mieux renseigné | **testée** |
| Récupération → génération du contenu | 28/28 contenus produits | **testée** |
| Génération → enregistrement du brouillon | code vérifié (`createDevis(payload, "draft")`) | **non testée** |
| Brouillon → apparition dans « Devis à réaliser » | `statutDevis()` : brouillon à 0 € → `en_preparation` | **assertions** |
| Découverte sans devis → présente dans la liste | `attendUnDevisDe(discoveryDoneAt, "lead")` = `true` | **assertion** |
| Brouillon → modification | `updateDevisBrouillon` + `?brouillon=` | **non testée** |
| Validation → envoi habituel | 23 assertions figent l'absence d'envoi automatique | **assertions** |
| **Envoi automatique au client** | 23 assertions + kill switch sur l'API de statut | **AUCUN** |

---

## 10. Règles de rédaction — contrôle clause par clause

| Règle | Vérification | Résultat |
|---|---|---|
| Structure PRESTATION / DÉTAIL / RÉSERVES | `notesDevis()` + assertions d'ordre | conforme |
| Produits 100 % français et écoresponsables | présent sur les gabarits de nettoyage, **absent** du déménagement et du transport (aucun produit appliqué) | conforme, par conception |
| Réserves avec lessivage | `mursDemande` → réserve « supports lavables » | conforme |
| Réserves **sans** lessivage | garde corrigé : aucune réserve si refusé | **corrigé** |
| Réserves débarras | réserve de volume, 3 gabarits | conforme |
| Réserves insalubrité | 3 gabarits, art. 19 personnes vulnérables | conforme |
| Réserves Diogène | gabarit nettoyage, champs `dio*` | conforme |
| Exclusion rénovations / réparations / peinture | hors `ACTIVITES_COUVERTES` ; `enr` et `renovation` refusés | conforme |
| Réévaluation selon l'état réel | `RESERVE_NON_SIGNALE` sur les 4 gabarits | conforme |
| Accord préalable pour les suppléments | `RESERVE_PERIMETRE` sur les 4 gabarits | conforme |
| **Aucun prix inventé** | `INTERDITS` + 28 dossiers réels sans prix | conforme |
| **Aucune prestation inventée** | génération déterministe + liste `manquant` | conforme |
| « remise en état » proscrit | réécrit en « nettoyage approfondi », vérifié sur 28 dossiers | conforme |
| Rubriques interdites | aucune sur 28 dossiers | conforme |

---

## 11. Preuves techniques

| Preuve | Référence |
|---|---|
| Point de restauration | tag `restauration-2026-11-04` → `a6f6afb` |
| Partie 1 | commit `36a8fcf` |
| Partie 2 | commits `54fe381`, `d97d207` |
| Partie 3 | commit `1eacbac` |
| Suites de contrôle | `npm run check:docusign` — 6 suites |
| Contrôle d'accessibilité | `scripts/docusign-check/accessibilite.ts` — 143 assertions |
| Total | **522 assertions**, 6 suites, 0 échec |
| Génération de devis | `scripts/docusign-check/generation-devis.ts` — 98 assertions |
| Prestataires et sociétés | `scripts/docusign-check/prestataires.ts` — 76 assertions |
| Processus d'envoi | `scripts/docusign-check/envoi-devis.ts` — 23 assertions |
| TypeScript | 0 erreur |
| ESLint | 0 erreur (1 avertissement préexistant, faux positif `jsx-a11y`) |
| Build de production | réussi, 75 s |
| Migrations | 175, ordre chronologique, aucun doublon |
| Contrat 8 récupéré | `docs/contrats-sous-traitance/contrat-08-lessivage-RECUPERE-INCOMPLET.md` |

Aucune capture d'écran : aucune interface n'a été ouverte. Aucune donnée
client réelle ne figure dans ce document, à l'exception de l'identifiant de
dossier **L-1652**, cité parce qu'il porte le défaut `opt_frigo` et qu'il
servira à vérifier la correction.

---

## 12. Blocages — et à qui ils appartiennent

| Blocage | Nature | Décision |
|---|---|---|
| 0/7 représentants légaux | donnée (statuts des sociétés) | **client** |
| 4 SIREN « À renseigner » | donnée | **client** |
| 0/4 fiches sous-traitants | donnée | **client** |
| Contrat 8 incomplet, contrat 9 absent | texte juridique | **client** |
| 634 leads jamais contactés | organisation | **client** |
| 3 comptes à 156 dossiers chacun | à qualifier | **client** |
| Ringover muet | intégration externe | **client** |
| 2 grilles vides, 5 à publier | tarifs | **client** |
| Pas d'identifiants de test | environnement | **client** |
| Migration `20261104000001` | autorisation | client → exécution Claude |
| Première enveloppe DocuSign | après les 3 premiers blocages | client → exécution Claude |

---

## 13. Réponses au contrôle de complétude

| Question | Réponse |
|---|---|
| 1. Demandes historiques identifiées | **221** (243 messages longs − 22 de bruit) |
| 2. Rapprochées d'une fonctionnalité | **179** classées à un module ; **42** non classées |
| 3. Réellement testées | **37 fonctionnalités** nommées dans les briefs du 31/10 au 04/11 |
| 4. Conformes (testées **et** conformes) | **14** |
| 5. Partiellement conformes | **10** |
| 6. Absentes | **2** (contrat 9, journal d'appels) |
| 7. Bloquées | **6** |
| 8. Non vérifiables | **5** (non testées faute d'interface) |
| 9. Ayant nécessité une correction | **19** |
| 10. Corrections validées par un test | **16** sur 19 |

**Écart assumé entre 221 et 37.** Les 221 demandes sont **inventoriées**, avec
identifiant, date, intitulé et module. Elles ne sont **pas** vérifiées une par
une : cela demanderait de lire et tracer plusieurs centaines de milliers de
caractères de consignes. Les 184 non reprises en détail portent le statut
**NON VÉRIFIÉ INDIVIDUELLEMENT**, et non « conforme ».

C'est la même limite que l'audit précédent (28 vérifiées sur 240), énoncée
explicitement cette fois.

---

## 14. Inventaire intégral des demandes

Une ligne par demande retenue, dans l'ordre chronologique. Les demandes du
2026-10-31 au 2026-11-04 sont celles reprises en détail dans les §3 à §10 ;
les autres portent le statut **NON VÉRIFIÉ INDIVIDUELLEMENT**.

| ID | Date | Module | Intitulé (début du brief) | Statut |
|---|---|---|---|---|
| CRM-001 | 2026-07-08 | Non classé | Please analyze this codebase and create a CLAUDE.md file, which will be given to future instances of Claude Code to operate in this repository. | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-002 | 2026-07-08 | Non classé | Please analyze this codebase and create a CLAUDE.md file, which will be given to future instances of Claude Code to operate in this repository. | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-003 | 2026-07-08 | Leads & pipeline | a87e9fcb0a6c0443a — toolu_017gGV9YFZDfiEaZNrSSwKqx | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-004 | 2026-07-08 | Rôles & sécurité | a7bd1a38c01787ee7 — toolu_01JJnM5M1tT2vZKWnLGqqk4s | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-005 | 2026-07-08 | Leads & pipeline | afdd8e90919253be6 — toolu_01Js6EmU6xj8pbFhKrjoLfNW | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-006 | 2026-07-08 | Facturation | a901a2f0461fb5121 — toolu_018sB6EoyeqebdP4KtnT8be4 | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-007 | 2026-07-08 | Leads & pipeline | Finir CRM avec les dernières actualisations  ( vu hier ) filtre , rôle… | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-008 | 2026-07-13 | Leads & pipeline | 🚨Le 11/07/26🚨 — Finir CRM avec les dernières actualisations  ( vu hier ) filtre , rôle… | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-009 | 2026-07-21 | Leads & pipeline | Interface intuitive premium , | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-010 | 2026-07-23 | Non classé | "use client"; — import { useEffect, useId, useRef, useState } from "react"; | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-011 | 2026-07-25 | Leads & pipeline | Cahier des charges fonctionnel – Évolutions CRM CGK | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-012 | 2026-07-27 | Non classé | The export setUserProfiles was not found in module [project]/app/(app)/settings/users/actions.ts [app-client] (ecmascript). | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-013 | 2026-07-28 | Ringover | Ringover Public API — Welcome to the Ringover Public API. This RESTful API lets you integrate Ringover telephony, messaging, contacts, and AI analytic | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-014 | 2026-07-28 | Leads & pipeline | add roles: — commercial appele entrent generale . | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-015 | 2026-07-29 | Leads & pipeline | 3:I["[project]/node_modules/next/dist/next-devtools/userspace/app/segment-explorer-node.js [app-client] (ecmascript)",["/_next/static/chunks/node_modu | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-016 | 2026-07-29 | Non classé | 3:I["[project]/node_modules/next/dist/next-devtools/userspace/app/segment-explorer-node.js [app-client] (ecmascript)",["/_next/static/chunks/node_modu | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-017 | 2026-07-29 | Non classé | 2:I["[project]/node_modules/next/dist/next-devtools/userspace/app/segment-explorer-node.js [app-client] (ecmascript)",["/_next/static/chunks/node_modu | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-018 | 2026-07-29 | Leads & pipeline | 3:I["[project]/node_modules/next/dist/next-devtools/userspace/app/segment-explorer-node.js [app-client] (ecmascript)",["/_next/static/chunks/node_modu | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-019 | 2026-07-29 | Ringover | Request URL — http://localhost:3000/leads/2b1ad230-772d-4523-b625-ba00aded4732 | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-020 | 2026-07-30 | Découverte | PROMPT POUR CLAUDE – ÉVOLUTION DU CRM COMMERCIAL | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-021 | 2026-07-30 | Responsive / UX | Request URL — http://localhost:3000/login?next=%2Fdashboard&error=Invalid%20login%20credentials | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-022 | 2026-07-30 | Non classé | 2:I["[project]/node_modules/next/dist/next-devtools/userspace/app/segment-explorer-node.js [app-client] (ecmascript)",["/_next/static/chunks/node_modu | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-023 | 2026-07-30 | Découverte | PROMPT POUR CLAUDE – ÉVOLUTION CRM COMMERCIAL DÉBARRAS & DÉMÉNAGEMENT | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-024 | 2026-07-30 | Responsive / UX | Request URL — http://localhost:3000/login?next=%2Fdashboard&error=Invalid%20login%20credentials | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-025 | 2026-07-30 | Non classé | 2:I["[project]/node_modules/next/dist/next-devtools/userspace/app/segment-explorer-node.js [app-client] (ecmascript)",["/_next/static/chunks/node_modu | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-026 | 2026-08-01 | Déploiement & infra | root@srv1688718:~# DIR=$(docker inspect n8n-traefik-1 --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'); echo "DIR=$DIR" | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-027 | 2026-08-01 | Déploiement & infra | [+] Building 104.1s (17/17) FINISHED | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-028 | 2026-08-02 | Facturation | Intégration des templates dans le CRM – Affectation par rôle | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-029 | 2026-08-02 | Facturation | Intégration des templates dans le CRM – Affectation par rôle | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-030 | 2026-08-02 | Facturation | Intégration des templates dans le CRM – Affectation par rôle | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-031 | 2026-08-03 | Non classé | 2:I["[project]/node_modules/next/dist/next-devtools/userspace/app/segment-explorer-node.js [app-client] (ecmascript)",["/_next/static/chunks/node_modu | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-032 | 2026-08-04 | Rôles & sécurité | Prompt Claude – Intégration des bibliothèques de templates | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-033 | 2026-08-04 | Rôles & sécurité | Prompt Claude – Gestion centralisée des photos et vidéos dans le CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-034 | 2026-08-05 | Grilles tarifaires | HISTORIQUE DES DEMANDES DE CHIFFRAGE – PLANIFICATRICE | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-035 | 2026-08-05 | Rôles & sécurité | Mise à jour de la bibliothèque des templates – Intervenants (Sous-traitants) | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-036 | 2026-08-05 | Bibliothèques doc. | now ghadi ndiro les template pour les devis : | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-037 | 2026-08-05 | Présence & actions | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-038 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-039 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-040 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-041 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-042 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-043 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-044 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-045 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-046 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-047 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-048 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-049 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-050 | 2026-08-05 | Non classé | Prestation à réaliser : — Réalisation d’un déménagement professionnel complet d’un entrepôt comprenant la manutention, le chargement, le transport séc | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-051 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-052 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-053 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-054 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-055 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-056 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-057 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-058 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-059 | 2026-08-05 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-060 | 2026-08-06 | Rôles & sécurité | AUDIT DE SÉCURITÉ & QUALITÉ — CRM CGK/OPTIMIVV | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-061 | 2026-08-06 | Non classé | Error Type — Console Error | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-062 | 2026-08-07 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-063 | 2026-08-07 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-064 | 2026-08-07 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-065 | 2026-08-07 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-066 | 2026-08-07 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-067 | 2026-08-07 | Non classé | Désignation de la prestation | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-068 | 2026-08-18 | Facturation | Tu es un expert senior en architecture logicielle, cybersécurité, signature électronique, UX/UI, API, webhooks, PostgreSQL et Next.js. | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-069 | 2026-08-19 | Ringover | NEXT_PUBLIC_SUPABASE_URL=https://ggdafbqahvugmzixovik.supabase.co | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-070 | 2026-08-20 | Leads & pipeline | >>   -H 'Content-Type: application/json' \ | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-071 | 2026-08-20 | Sous-traitance | Tu interviens sur un CRM interne écrit en Next.js (App Router) + TypeScript + SCSS. | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-072 | 2026-08-21 | Non classé | Sous-domaine personnalisé | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-073 | 2026-08-22 | Non classé | `/simplify → 4 cleanup agents in parallel → apply the fixes` | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-074 | 2026-08-22 | Leads & pipeline | aa6fc850e619c80cb — toolu_011qdu9RkuCue2K9ctQpnpyq | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-075 | 2026-08-22 | Notifications | a148b49082066346b — toolu_016ree3J9jUC3gNmS1vB5JbL | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-076 | 2026-08-22 | Notifications | a22566883a98e940d — toolu_018TucykUeJCtWchv8RL5UdH | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-077 | 2026-08-22 | Leads & pipeline | a838e1887d0467fb6 — toolu_01GmDGuaWLA3iM2S6ECg9zSa | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-078 | 2026-08-25 | Déploiement & infra | root@srv1688718:/docker/crm# echo "=== compose ===" && cat /docker/crm/docker-compose.yml | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-079 | 2026-09-08 | Bibliothèques doc. | Tu es un expert en développement CRM, automatisation documentaire, UX métier et gestion des interventions techniques. | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-080 | 2026-09-08 | Leads & pipeline | Approach this as the design lead at a small studio known for their versatility, giving every client a visual identity pitched at the treatment the tas | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-081 | 2026-09-08 | Présence & actions | PROMPT MAÎTRE — MODULE « PRÉSENCE & ACTIONS » — SUPER ADMIN UNIQUEMENT | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-082 | 2026-09-08 | Leads & pipeline | ad02f575841358ea6 — toolu_01MzTs8L9svZdFmZNRA3Drf9 | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-083 | 2026-09-08 | Rôles & sécurité | PROMPT MAÎTRE — VERSION RESPONSIVE MOBILE & TABLETTE DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-084 | 2026-09-09 | Bibliothèques doc. | root@srv1688718:/docker/crm/cleaning-crm# cd /docker/crm && docker compose up -d --build crm | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-085 | 2026-09-11 | Découverte | PROMPT MAÎTRE — AJOUT D’UN MODULE D’ALERTES, ACTIONS ET RELANCES COMMERCIALES DANS LE CRM EXISTANT | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-086 | 2026-09-11 | Présence & actions | AJOUT — ALERTE AUTOMATIQUE « PHOTOS CLIENT NON REÇUES » | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-087 | 2026-09-11 | Présence & actions | AJOUT — ALERTE AUTOMATIQUE « PHOTOS CLIENT NON REÇUES » | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-088 | 2026-09-11 | Présence & actions | AJOUT — ALERTE AUTOMATIQUE « PHOTOS CLIENT NON REÇUES » | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-089 | 2026-09-15 | Bibliothèques doc. | MISSION — AJOUT D’UN MODULE « DOCUMENTS & CONTRATS » AU CRM EXISTANT | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-090 | 2026-09-15 | Bibliothèques doc. | MISSION — AJOUT D’UN MODULE « DOCUMENTS & CONTRATS » AU CRM EXISTANT | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-091 | 2026-09-15 | Bibliothèques doc. | MISSION — AJOUT D’UN MODULE « DOCUMENTS & CONTRATS » AU CRM EXISTANT | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-092 | 2026-09-15 | Leads & pipeline | a2d3622a2229ed802 — toolu_01SzbH8Z4qaVT8SBL6atAKSP | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-093 | 2026-09-15 | Leads & pipeline | a2d3622a2229ed802 — toolu_01SzbH8Z4qaVT8SBL6atAKSP | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-094 | 2026-09-15 | Leads & pipeline | a2d3622a2229ed802 — toolu_01SzbH8Z4qaVT8SBL6atAKSP | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-095 | 2026-09-15 | Leads & pipeline | a07a0a3f15910d8f3 — toolu_019kSnbAT5XJNCsvTXjLoQQ8 | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-096 | 2026-09-15 | Leads & pipeline | a1ad86db8f4f5f255 — toolu_014huNBt3GArn7oS2onBqEE2 | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-097 | 2026-09-15 | Leads & pipeline | a07a0a3f15910d8f3 — toolu_019kSnbAT5XJNCsvTXjLoQQ8 | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-098 | 2026-09-15 | Leads & pipeline | a1ad86db8f4f5f255 — toolu_014huNBt3GArn7oS2onBqEE2 | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-099 | 2026-09-15 | Leads & pipeline | a07a0a3f15910d8f3 — toolu_019kSnbAT5XJNCsvTXjLoQQ8 | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-100 | 2026-09-15 | Leads & pipeline | a1ad86db8f4f5f255 — toolu_014huNBt3GArn7oS2onBqEE2 | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-101 | 2026-09-18 | Rôles & sécurité | MASTER PROMPT — AUDIT COMPLET, TESTS FONCTIONNELS ET END-TO-END DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-102 | 2026-09-18 | Rôles & sécurité | MASTER PROMPT — AUDIT COMPLET, TESTS FONCTIONNELS ET END-TO-END DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-103 | 2026-09-18 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-104 | 2026-09-18 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-105 | 2026-09-18 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-106 | 2026-09-18 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-107 | 2026-09-18 | Facturation | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-108 | 2026-09-18 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-109 | 2026-09-18 | Facturation | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-110 | 2026-09-18 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-111 | 2026-09-18 | Rôles & sécurité | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-112 | 2026-09-18 | Rôles & sécurité | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-113 | 2026-09-18 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-114 | 2026-09-18 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-115 | 2026-09-18 | Facturation | Written for: you (dirigeant) + votre équipe dev — un rapport de recette technique, pas un commentaire de code. | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-116 | 2026-09-18 | Facturation | Written for: you (dirigeant) + votre équipe dev — un rapport de recette technique, pas un commentaire de code. | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-117 | 2026-09-19 | Déploiement & infra | root@srv1688718:/docker/crm# docker compose ps | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-118 | 2026-09-19 | Déploiement & infra | root@srv1688718:/docker/crm# cat > /usr/local/bin/crm-evaluate.sh <<'EOF' | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-119 | 2026-09-19 | Présence & actions | root@srv1688718:/docker/crm# systemctl status cron 2>/dev/null // systemctl status crond 2>/dev/null | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-120 | 2026-09-19 | Leads & pipeline | MASTER PROMPT CLAUDE — SYSTÈME CRITIQUE D’ARRIVÉE, ROUTAGE, NOTIFICATION ET CENTRALISATION DES LEADS | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-121 | 2026-09-19 | Notifications | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-122 | 2026-09-19 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-123 | 2026-09-19 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-124 | 2026-09-19 | Rôles & sécurité | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-125 | 2026-09-24 | Rôles & sécurité | MASTER PROMPT — AUDIT COMPLET, TESTS FONCTIONNELS ET END-TO-END DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-126 | 2026-09-24 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-127 | 2026-09-24 | Facturation | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-128 | 2026-09-24 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-129 | 2026-09-24 | Leads & pipeline | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-130 | 2026-09-24 | Rôles & sécurité | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-131 | 2026-09-26 | Bibliothèques doc. | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-132 | 2026-09-26 | Sous-traitance | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-133 | 2026-09-30 | Rôles & sécurité | MISSION — CRÉER LA « CARTE GRISE » COMPLÈTE ET LE CAHIER DES CHARGES FINAL DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-134 | 2026-09-30 | Rôles & sécurité | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-135 | 2026-09-30 | Facturation | Another Claude session sent a message: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-136 | 2026-09-30 | Bibliothèques doc. | MASTER PROMPT — MODULE COMPLET « DOSSIER & BIBLIOTHÈQUE SOUS-TRAITANT » | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-137 | 2026-10-06 | Leads & pipeline | Bonjour, — Nous faisons suite à votre demande concernant la réalisation d’un nettoyage approfondi. | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-138 | 2026-10-07 | Non classé | Please analyze this codebase and create a CLAUDE.md file, which will be given to future instances of Claude Code to operate in this repository. | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-139 | 2026-10-07 | Rôles & sécurité | MASTER PROMPT — MODIFICATION CIBLÉE DU CRM EXISTANT | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-140 | 2026-10-11 | Découverte | MASTER PROMPT — CRÉATION D’UNE FORMATION COMMERCIALE INTERACTIVE TOUT-EN-UN | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-141 | 2026-10-12 | Facturation | MASTER PROMPT CLAUDE — CRM OPTIMIVV – NUMÉROTATION UNIQUE ET AUTOMATISATION DES EMAILS | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-142 | 2026-10-12 | Facturation | PROMPT CLAUDE – CRM OPTIMIVV | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-143 | 2026-10-12 | Facturation | MASTER PROMPT CLAUDE — CRM OPTIMIVV – NUMÉROTATION UNIQUE ET AUTOMATISATION DES EMAILS | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-144 | 2026-10-12 | Non classé | MODIFICATION CRM – ORGANISATION DES TEMPLATES D’E-MAILS PAR ACTIVITÉ | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-145 | 2026-10-12 | Facturation | Summary: — 1. **Primary Request and Intent: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-146 | 2026-10-13 | Présence & actions | change le nom button from Model email to Email | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-147 | 2026-10-13 | Présence & actions | MASTER PROMPT CLAUDE — AUDIT, CORRECTION ET OPTIMISATION DU CRM COMMERCIAL | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-148 | 2026-10-13 | Présence & actions | MASTER PROMPT CLAUDE — REFONTE DÉFINITIVE DU SUIVI COMMERCIAL | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-149 | 2026-10-13 | Leads & pipeline | CONSIGNE OBLIGATOIRE — RESPONSIVE MOBILE POUR TOUTES LES ÉVOLUTIONS DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-150 | 2026-10-14 | Leads & pipeline | CONSIGNE OBLIGATOIRE — RESPONSIVE MOBILE POUR TOUTES LES ÉVOLUTIONS DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-151 | 2026-10-14 | Découverte | CORRECTIF CRM – DÉCOUVERTE COMMERCIALE | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-152 | 2026-10-14 | Grilles tarifaires | MASTER PROMPT CLAUDE — CRÉATION DU MODULE « GRILLES TARIFAIRES » | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-153 | 2026-10-14 | Leads & pipeline | MASTER PROMPT CLAUDE CODE — REFONTE DE L’ORGANISATION COMMERCIALE DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-154 | 2026-10-14 | Leads & pipeline | MASTER PROMPT CLAUDE CODE — REFONTE DE L’ORGANISATION COMMERCIALE DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-155 | 2026-10-14 | Rôles & sécurité | MASTER PROMPT CLAUDE CODE — REFONTE COMPLÈTE DU MODULE SUIVI COMMERCIAL — SUPER ADMIN ET SUPERVISEURS | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-156 | 2026-10-14 | Présence & actions | MASTER PROMPT CLAUDE CODE — AUDIT TECHNIQUE INTÉGRAL DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-157 | 2026-10-18 | Leads & pipeline | Summary: — 1. Primary Request and Intent | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-158 | 2026-10-19 | Grilles tarifaires | MASTER PROMPT CLAUDE – MODE EXÉCUTION | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-159 | 2026-10-19 | Découverte | MASTER PROMPT CLAUDE — CRM – DÉCOUVERTE COMMERCIALE NETTOYAGE | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-160 | 2026-10-19 | Leads & pipeline | Confirmez la prédiction : /pipeline est-il lent sur le compte admin et rapide sur un compte commercial ? : YES. | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-161 | 2026-10-19 | Rôles & sécurité | Feu vert pour les corrections, avec les conditions suivantes : | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-162 | 2026-10-20 | Grilles tarifaires | MASTER PROMPT CLAUDE — BIBLIOTHÈQUE TARIFAIRE INTELLIGENTE — VERSION DÉFINITIVE | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-163 | 2026-10-20 | Grilles tarifaires | MASTER PROMPT CLAUDE — AUDIT TECHNIQUE GLOBAL – GRILLES TARIFAIRES, FILTRES, PARAMÈTRES, CALCULS ET INTÉGRATION CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-164 | 2026-10-20 | Découverte | MASTER PROMPT CLAUDE — AUDIT TECHNIQUE GLOBAL — CORRECTION DES ANOMALIES — OPTIMISATION ET FIABILISATION DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-165 | 2026-10-21 | Découverte | MASTER PROMPT CLAUDE — DÉVELOPPEMENT, EXÉCUTION DES MODIFICATIONS, CORRECTIONS ET AUDIT TECHNIQUE FINAL DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-166 | 2026-10-21 | Découverte | MASTER PROMPT CLAUDE — MODE EXÉCUTION OBLIGATOIRE — CORRECTION DES CHAMPS DE DÉCOUVERTE ET DÉPLOIEMENT EN PRODUCTION | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-167 | 2026-10-21 | Découverte | INSTRUCTION PRIORITAIRE À CLAUDE — MODE EXÉCUTION — CORRECTION DES OUBLIS ET DÉPLOIEMENT COMPLET DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-168 | 2026-10-21 | Leads & pipeline | Summary: — 1. **Primary Request and Intent: | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-169 | 2026-10-21 | Découverte | MASTER PROMPT CLAUDE — MODE EXÉCUTION — MODIFICATION DU CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-170 | 2026-10-21 | Découverte | MASTER PROMPT CLAUDE — MODE EXÉCUTION — CORRECTION DES STATUTS DU SUIVI COMMERCIAL | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-171 | 2026-10-21 | Vitrerie | MASTER PROMPT CLAUDE — MODE EXÉCUTION — AJOUT DE LA GESTION COMPLÈTE DES VITRES DANS LE CRM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-172 | 2026-10-24 | Présence & actions | MASTER PROMPT CLAUDE — CRM CGK OPTIMUM | NON VÉRIFIÉ INDIVIDUELLEMENT |
| CRM-173 | 2026-10-31 | Rôles & sécurité | MASTER PROMPT CLAUDE — REFONTE ET AUTOMATISATION DU MODULE SOUS-TRAITANTS ET CONTRATS DE PRESTATION | vérifiée en détail |
| CRM-174 | 2026-10-31 | DocuSign | MODULE CRM — DOCUSIGN, ARCHIVAGE AUTOMATIQUE ET GESTION MULTIENTREPRISES | vérifiée en détail |
| CRM-175 | 2026-10-31 | Découverte | PROMPT CLAUDE — CRM — GÉNÉRATION AUTOMATIQUE DES DEVIS ET DES DEMANDES DE PRESTATAIRES | vérifiée en détail |
| CRM-176 | 2026-10-31 | Rôles & sécurité | MASTER PROMPT — AUDIT INTÉGRAL, CONTRÔLE ET FINALISATION DU CRM | vérifiée en détail |
| CRM-177 | 2026-11-01 | Multientreprises | CONTRAT DE SOUS-TRAITANCE | vérifiée en détail |
| CRM-178 | 2026-11-01 | Sous-traitance | CONTRAT DE SOUS-TRAITANCE | vérifiée en détail |
| CRM-179 | 2026-11-01 | DocuSign | Summary: — 1. **Primary Request and Intent: | vérifiée en détail |
| CRM-180 | 2026-11-01 | Sous-traitance | CONTRAT DE SOUS-TRAITANCE | vérifiée en détail |
| CRM-181 | 2026-11-01 | Sous-traitance | CONTRAT DE SOUS-TRAITANCE | vérifiée en détail |
| CRM-182 | 2026-11-01 | Déploiement & infra | ubuntu@ov-bfa4a3:/mnt/data/apps/crm/cleaning-crm$ cd /mnt/data/apps/crm && sudo docker compose -f compose.test.yml up -d --build --no-deps crm | vérifiée en détail |
| CRM-183 | 2026-11-01 | Déploiement & infra | Summary: — 1. **Primary Request and Intent: | vérifiée en détail |
| CRM-184 | 2026-11-02 | Rôles & sécurité | MASTER PROMPT CLAUDE — AUDIT, RÉCUPÉRATION ET ACTIVATION DES 9 CONTRATS DE SOUS-TRAITANCE DANS LE CRM | vérifiée en détail |
| CRM-185 | 2026-11-02 | Découverte | MASTER PROMPT CLAUDE — AUDIT, RÉCUPÉRATION ET ACTIVATION DU MODULE VITRERIE | vérifiée en détail |
| CRM-186 | 2026-11-02 | Vitrerie | Initialising login role... | vérifiée en détail |
| CRM-187 | 2026-11-03 | Découverte | MASTER PROMPT CLAUDE — CRM — CRÉATION DU BOUTON « DEVIS À RÉALISER » | vérifiée en détail |
| CRM-188 | 2026-11-03 | DocuSign | Mission Cursor — Intégration DocuSign dans CRM OPTIMUM | vérifiée en détail |
| CRM-189 | 2026-11-03 | DocuSign | Mission Claude — Intégration DocuSign dans CRM OPTIMUM | vérifiée en détail |
| CRM-190 | 2026-11-03 | DocuSign | Claude, je valide les trois corrections proposées dans ton audit de la migration DocuSign. | vérifiée en détail |
| CRM-191 | 2026-11-03 | Déploiement & infra | Claude, je valide les trois corrections techniques apportées à l'intégration DocuSign. | vérifiée en détail |
| CRM-192 | 2026-11-03 | DocuSign | Claude, tu as mon autorisation pour finaliser l'intégration DocuSign Developer Sandbox dans CRM OPTIMUM, de bout en bout. | vérifiée en détail |
| CRM-193 | 2026-11-03 | DocuSign | Mission: Audit complet de l'intégration DocuSign dans CRM OPTIMUM | vérifiée en détail |
| CRM-194 | 2026-11-03 | DocuSign | MISSION — FINALISATION COMPLÈTE DOCUSIGN CRM OPTIMUM | vérifiée en détail |
| CRM-195 | 2026-11-03 | DocuSign | Summary: — 1. **Primary Request and Intent: | vérifiée en détail |
| CRM-196 | 2026-11-04 | Rôles & sécurité | MASTER PROMPT CLAUDE — AUDIT GLOBAL DU CRM — CONTRÔLE EXHAUSTIF DES PROMPTS, FONCTIONNALITÉS, INTERFACES ET RÔLES | vérifiée en détail |
| CRM-197 | 2026-11-04 | Découverte | PROMPT CLAUDE – CORRECTION DU PROCESSUS D’ENVOI DES DEVIS | vérifiée en détail |
| CRM-198 | 2026-11-04 | Découverte | MASTER PROMPT CLAUDE — VÉRIFICATION ET FINALISATION DES AUTOMATISATIONS APRÈS DÉCOUVERTE | vérifiée en détail |
| CRM-199 | 2026-11-04 | DocuSign | Summary: — 1. **Primary Request and Intent: | vérifiée en détail |
| CRM-200 | 2026-11-04 | DocuSign | Tout est commité, l'arbre de travail est propre. Voici le bilan. | vérifiée en détail |
| CRM-201 | 2026-11-04 | DocuSign | Je valide le déploiement en production des deux commits DocuSign sur CRM OPTIMUM. | vérifiée en détail |
| CRM-202 | 2026-11-04 | Découverte | INSTRUCTION PRIORITAIRE — DÉCOUVERTE → GÉNÉRATION DU DEVIS → DEVIS À RÉALISER | vérifiée en détail |
| CRM-203 | 2026-11-04 | Découverte | MASTER PROMPT CLAUDE — PARTIE 1/3 | vérifiée en détail |
| CRM-204 | 2026-11-04 | Bibliothèques doc. | MASTER PROMPT CLAUDE — PARTIE 2/3 | vérifiée en détail |
| CRM-205 | 2026-11-04 | Rôles & sécurité | MASTER PROMPT CLAUDE — PARTIE 3/3 | vérifiée en détail |
| CRM-206 | 2026-11-04 | Rôles & sécurité | MASTER PROMPT CLAUDE — PARTIE 4/4 | vérifiée en détail |
| CRM-207 | date inconnue | Facturation | Summary: — 1. **Primary Request and Intent: | vérifiée en détail |
| CRM-208 | date inconnue | Leads & pipeline | Summary: — 1. Primary Request and Intent | vérifiée en détail |
| CRM-209 | date inconnue | Leads & pipeline | Summary: — 1. **Primary Request and Intent: | vérifiée en détail |
| CRM-210 | date inconnue | Découverte | INSTRUCTION PRIORITAIRE À CLAUDE — MODE EXÉCUTION — CORRECTION DES OUBLIS ET DÉPLOIEMENT COMPLET DU CRM | vérifiée en détail |
| CRM-211 | date inconnue | Rôles & sécurité | MASTER PROMPT CLAUDE — REFONTE ET AUTOMATISATION DU MODULE SOUS-TRAITANTS ET CONTRATS DE PRESTATION | vérifiée en détail |
| CRM-212 | date inconnue | DocuSign | Summary: — 1. **Primary Request and Intent: | vérifiée en détail |
| CRM-213 | date inconnue | Déploiement & infra | Summary: — 1. **Primary Request and Intent: | vérifiée en détail |
| CRM-214 | date inconnue | Rôles & sécurité | MASTER PROMPT CLAUDE — AUDIT, RÉCUPÉRATION ET ACTIVATION DES 9 CONTRATS DE SOUS-TRAITANCE DANS LE CRM | vérifiée en détail |
| CRM-215 | date inconnue | DocuSign | Mission Cursor — Intégration DocuSign dans CRM OPTIMUM | vérifiée en détail |
| CRM-216 | date inconnue | DocuSign | Mission Cursor — Intégration DocuSign dans CRM OPTIMUM | vérifiée en détail |
| CRM-217 | date inconnue | DocuSign | Summary: — 1. **Primary Request and Intent: | vérifiée en détail |
| CRM-218 | date inconnue | DocuSign | Summary: — 1. **Primary Request and Intent: | vérifiée en détail |
| CRM-219 | date inconnue | DocuSign | Tout est commité, l'arbre de travail est propre. Voici le bilan. | vérifiée en détail |
| CRM-220 | date inconnue | DocuSign | Tout est commité, l'arbre de travail est propre. Voici le bilan. | vérifiée en détail |
| CRM-221 | date inconnue | Rôles & sécurité | MASTER PROMPT CLAUDE — PARTIE 4/4 | vérifiée en détail |

**221 demandes inventoriées**, dont 49 reprises en détail.

---

## 15. Ce que ce registre ne fait pas

- Il ne consulte pas `TRACABILITE.md` : ce fichier n'existe pas.
- Il ne couvre rien avant le 2026-07-08.
- Il ne contient aucun test d'interface, aucun test utilisateur, aucun test de
  bout en bout : l'environnement ne le permet pas.
- Il ne déclare conforme aucune fonctionnalité non testée.
- Il ne présente aucun blocage externe comme une correction effectuée.
- Il ne supprime ni ne remplace aucun document d'audit antérieur.

*Document généré le 2026-11-04. Mesures en lecture seule sur la base de
production `ggdafbqahvugmzixovik`. Aucune écriture.*
