# D32 — Cloisonnement des données par pays et entité juridique

> Livrable du 9 novembre 2026, après le commit `39d7552`. **Développé, testé
> techniquement — NON appliqué, NON testé réellement, NON validé.** Rien n'a
> touché la production : aucune migration, aucun push, aucune fusion, aucune
> ressource créée.
>
> **Aucune correction de ce document n'est validée** tant que la section 10 de
> `npm run recette:facturation` et la vérification C26 n'ont pas été jouées
> sur une vraie base de recette.

## 1 · L'inventaire des accès concernés

L'inventaire est **généré** à partir des 185 migrations, rejouées dans
l'ordre, par `scripts/d32/lecteur.ts` — pas écrit à la main. Il est dans
`docs/D32-INVENTAIRE-GENERE.md`.

| | Avant D32 | Après D32 |
| --- | --- | --- |
| Tables ouvertes à **toute** planificatrice (`is_planificateur()`) | **40** | **6**, toutes justifiées |
| Tables **sans RLS** | **4** (les compteurs, D33) | **0** |
| Vues (qui contourneraient la RLS) | 0 | 0 |
| Fonctions de numérotation exécutables par la clé anonyme | **3** (D34) | 0 |

**Les 6 tables restées ouvertes, et pourquoi** : `doc_counters` et
`subcontract_sequences` (numérotation), `document_retention_rules`
(paramètres), et l'annuaire des sous-traitants — `technicians`,
`subcontractor_profiles`, `subcontractor_documents` — qui n'a **ni pays ni
entité** en base (D35, décision ouverte).

**Côté serveur et API** : 63 fichiers utilisent le service-role. Ils ont été
classés. Les webhooks, le cron, les routes publiques à jeton, le journal et
les modules réservés à l'admin sont légitimes. Les modules qui lisent
d'abord par la session, puis complètent au service-role pour les seuls
identifiants obtenus, héritent de la RLS — devis PDF, devis à réaliser,
suivi, médias, palette ⌘K, recherche. **Trois points contournaient la RLS**,
corrigés :

| # | Où | Avant | Après |
| --- | --- | --- | --- |
| F1 | `/documents` (tableau de bord) | tous les contrats, certificats et dossiers, au service-role | lu par la session |
| F2 | Certificat de hotte — génération et envoi | le certificat de **n'importe quel** dossier fourni par la requête | dossier et lead **visibles** exigés, sinon 404 |
| F3 | Fiche client — contrats, passages, interventions | service-role (protégé seulement parce que la fiche l'était) | par la session — défense en profondeur |

**Mes deux erreurs, rattrapées avant toute déclaration** :
- la première version du lecteur déclarait **neuf tables de présence « sans
  RLS »** — elle est activée dans une boucle ; une recherche indépendante l'a
  montré ;
- elle ne voyait pas les politiques créées dans un bloc `DO` **sans boucle** :
  les politiques d'**écriture** de `contracts` et `client_documents`, et
  onze politiques de **dix autres tables**, lui échappaient. **Sans ce rattrapage, la réécriture les aurait
  laissées ouvertes.**

## 2 · Les politiques RLS corrigées

`supabase/migrations/20261109000008_d32_cloisonnement.sql`, **générée** par
`scripts/d32/generer.ts` — 69 politiques sur 34 tables.

**Le principe** : chaque politique est reprise **à l'identique**, et seul
`is_planificateur()` est remplacé par le contrôle de périmètre de sa table.
Les branches `is_admin()` et `owner_id = auth.uid()` ne changent pas : le
Super Admin garde tout, le commercial garde ses propres dossiers.

**La règle** (`planif_perimetre`, et son miroir `lib/perimetre/regle-shared.ts`) :

| Mode | Qui | Accès |
| --- | --- | --- |
| **strict** | **tout nouveau compte** | pays dans ses pays **ET** société dans ses sociétés ; **aucune société cochée = aucun accès** ; pays ou société inconnus = refus |
| **hérité** | planificatrices **existantes** | leur accès d'avant D32, **inchangé** — aucun compte bloqué |

**Le rattachement de chaque table** : un lead par son pays et sa société ;
un dossier, un média, un devis OPTIMIVV, une action commerciale par son lead ;
un document et un contrat client par le pays du lead (à défaut celui du
client, puis celui de la société émettrice) et la société **émettrice** ; un
client par ses propres colonnes (nouvelles, pour les clients directs), à
défaut son lead source ; les lignes, versions, passages, événements, rapports
et photos par leur parent ; les contrats de sous-traitance par leur lead et
leur société ; les archives et enveloppes DocuSign par leur contrat.

**Deux précautions qui comptent** :
- une politique d'**insertion** ne peut pas chercher la ligne par son id
  (elle n'existe pas encore) : les tables de premier niveau sont jugées sur
  **leurs colonnes** — sans quoi une planificatrice ne pourrait plus créer une
  facture ;
- chaque argument est **qualifié par sa table** (`dossiers.lead_id`) : placé
  dans une sous-requête, un `lead_id` nu se rattacherait à la mauvaise table.

**Aussi dans la migration** : RLS sur les quatre compteurs (D33) ; retrait des
trois numérotations à la clé anonyme (D34) ; les notifications (D31) suivent
le mode.

## 3 · Les tests de sécurité

| | Résultat |
| --- | --- |
| Matrice **exécutée** — cinq pays × strict / hérité × entités × rôles | ✅ (suite `d32-cloisonnement`) |
| Schéma **après** D32, rejoué : plus d'ouverture non justifiée, arguments qualifiés, aucune table sans RLS | ✅ |
| La migration est **exactement** celle du générateur (aucune retouche manuelle) | ✅ |
| Mutations volontaires | **6 / 6 détectées** — table oubliée, politique remise à la main, règle sans entité, `/documents` au service-role, garde du Certificat neutralisée (détectée **après** durcissement de l'assertion), comptes neufs en mode hérité |
| Ensemble des vérificateurs | **3 801 contrôles, 0 échec, 46 suites** · `tsc` · `eslint .` propres |
| **Test réel en base** — section 10, accès **directs** à l'API sous une vraie session | **écrit, jamais exécuté** (aucune base) |

**La section 10 éprouve** : la lecture des leads, dossiers, documents et
clients dans le périmètre, d'une autre société du même pays, d'un autre pays ;
une **liste** (aucune fuite par lot) ; la modification et la **création** hors
périmètre ; l'accès **indirect** par les lignes d'un document et par un
document client ; un compte **neuf sans société** (aucun accès) ; le mode
**hérité** (aucun blocage) ; le **commercial** (ses dossiers, inchangé). Le
compte de test est remis dans son état d'origine.

## 4 · Les risques de régression

| # | Risque | Mesure |
| --- | --- | --- |
| R1 | **Tant qu'une planificatrice existante est en mode hérité, D32 ne la cloisonne pas.** C'est voulu (aucun blocage sans validation), mais le défaut reste ouvert pour elle. | Basculer chaque compte après inventaire — §5 |
| R2 | En strict, les **données sans pays ou sans société** deviennent invisibles (D36) : leads sans société, clients directs sans rattachement. | Requête 1c de la procédure **avant** toute bascule |
| R3 | En strict, une planificatrice ne voit **plus** Clients, Documents ni Comptabilité **hors** de ses pays et sociétés. Une tâche transverse (comptabilité de toutes les sociétés) exige un périmètre large. | Régler ses pays et sociétés en conséquence |
| R4 | **Performance** : les politiques appellent des fonctions de périmètre ligne par ligne. | C28 — à mesurer sur la recette |
| R5 | L'annuaire des sous-traitants reste lisible par tous (D35). | Décision |
| R6 | Un compte à la fois **commercial et planification** : la branche propriétaire lui garde ses leads ; le périmètre s'applique au reste. | C26 |
| R7 | Les **types** de la base sont complétés à la main ; à régénérer après la migration sur la recette. | Étape de recette |
| R8 | Le rôle **superviseur** a son propre périmètre (`supervisor_scopes`) : D32 ne le modifie pas. | — |

## 5 · Le plan de migration des permissions existantes

1. **La migration** pose `perimetre_herite = true` sur chaque planificatrice
   existante : **personne n'est bloqué**. Tout compte créé ensuite est strict.
2. **Inventaire** (`supabase/procedures/d32-passage-strict.sql`, étape 1,
   lecture seule) : pour chaque planificatrice, ses pays, ses sociétés, ce
   qu'elle voit aujourd'hui et ce qu'elle verrait en strict ; et les données
   sans périmètre (D36).
3. **Rattacher** les données sans pays ou sans société.
4. **Régler** les pays et les sociétés de chaque compte (Paramètres ›
   Utilisateurs — l'écran affiche désormais le mode réel).
5. **Votre validation**, compte par compte.
6. **Bascule** d'un compte nommé (étape 2) : refusée sans pays ou sans
   société ; `ROLLBACK` par défaut.

## 6 · Les étapes restantes pour commencer la recette

`npm run recette:pret` répond aujourd'hui : **étape 1 — vous — votre
autorisation**. Le détail est dans `LOT-C-RECETTE-PLAN-FINAL.md` §5.

| # | Étape | Qui | Votre accord |
| --- | --- | --- | --- |
| 1 | Relever le plan Supabase et les places gratuites | **vous** | — |
| 2 | Créer le projet de recette (0 € si une place est libre, ≈ 10 $/mois sinon) | **vous** | **oui** |
| 3 | `.env.recette` + `npm run verif:cible -- .env.recette` | **vous** | — |
| 4 | Lier la CLI à la recette | **vous** | — |
| 5 | `npm run migrer:recette` — simulation des **185** migrations | moi | — |
| 6 | `-- --appliquer` | moi | **oui** |
| 7 | Marqueur, semences, six comptes, puis `10_comptes_de_test.sql` et `20_societes_de_test.sql` (la planificatrice de test y devient **stricte** sur les sociétés fictives) | vous + moi | semences : **oui** |
| 8 | `npm run recette:facturation` — **11 sections**, dont la 10 (D32) | moi | — |
| 9 | C26 à l'écran, par rôle, dans les cinq pays ; C27 sur un compte en mode hérité ; C28 | vous + moi | — |

## Ce qui attend votre décision

1. **D35** — l'annuaire des sous-traitants : ressource commune, ou rattachée à
   des pays et des sociétés ?
2. **La bascule** de chaque planificatrice existante en mode strict, après
   l'inventaire.
3. La création de la recette et l'application des migrations.
