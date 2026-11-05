# Audit de l'existant — module Comptabilité centralisé

**Date :** 2026-11-05 · **Demande :** master prompt « Module comptabilité
centralisé — multi-sociétés · multi-pays · rapprochement bancaire ·
collaboration · exports comptables » (Parties 1 à 25).

**Consigne respectée :** aucun code n'a été écrit. Ce document est l'audit
demandé en Partie 21 et le plan demandé en Partie 22, à valider avant
développement.

---

## 0. Méthode et limites de cet audit

**Ce que j'ai réellement examiné :** le code du dépôt et les 176 migrations
SQL. J'ai lu la page Comptabilité, la couche documents, les sociétés
émettrices, les factures sous-traitants, l'archivage documentaire, les
notifications, les alertes, les exports existants, les rôles et les règles
d'accès.

**Ce que je n'ai PAS pu examiner :** la base de production. Je n'ai aucun
accès en lecture à la base depuis ce poste. **Toutes les affirmations de ce
document portent donc sur le schéma et le code, jamais sur les volumes de
données réels.** Les deux seuls chiffres de production cités (7 sociétés
émettrices, dont 5 sans IBAN) proviennent du correctif du 2026-11-05 consigné
dans le code, et non d'une requête que j'aurais lancée.

Conséquence pratique : avant le lot 1, il faudra vérifier en base **combien de
sociétés existent réellement, dans quels pays, avec quels comptes bancaires**.
C'est une vérification de cinq minutes pour qui a l'accès ; je ne peux pas la
faire à votre place.

---

## 1. Ce qui existe déjà, et qu'il ne faut pas refaire

### 1.1 L'onglet Comptabilité existe

`app/(app)/comptabilite/` — une page, un composant de 505 lignes.

| Élément | État |
| --- | --- |
| Onglets | 4 : Devis · Factures d'acompte · Factures finales · **Fournisseurs** |
| Onglet « Fournisseurs » | **Écran vide**, texte « en préparation pour la prochaine itération ». Compteur figé à 0. |
| Indicateurs | 4 : devis en attente · acomptes à encaisser · finales à encaisser · CA encaissé (mois) |
| Indicateurs cliquables | **Non.** Ce sont des cartes mortes. |
| Filtres | recherche · société émettrice · activité · intervenant · apporteur |
| Filtre pays | **Absent** |
| Filtre période (année / trimestre / mois / dates) | **Absent** |
| Filtre compte bancaire | **Absent** (la notion n'existe pas) |
| Export | **Absent** |
| Garde d'accès | `requireBackOffice()` dans le `layout.tsx` → Super Admin **et Planification** |

**Point important sur les droits.** Vous écrivez « ne donne pas
automatiquement accès à la planificatrice ». **Elle a déjà l'accès complet au
module Comptabilité**, depuis le cloisonnement du 2026-10-07 : la comptabilité
fait partie du périmètre « après-signature » du back-office. Il n'y a donc
rien à ouvrir — et rien à fermer non plus, sauf si vous me demandez de
restreindre ce qu'elle voit aujourd'hui. Je n'ai touché à aucun droit.

### 1.2 Les sociétés juridiques existent

Table `legal_entities`, écran *Paramètres → Sociétés émettrices*.

Elle porte déjà : dénomination, forme juridique (SAS/SARL/EURL/SASU/EI/SCI),
SIRET, SIREN, code APE, numéro de TVA, adresse, contact, **un** IBAN, **un**
BIC, taux de TVA par défaut, franchise de TVA, mentions légales, logo,
couleur, **pays** (`FR | CH | LU | BE | CA`), et depuis le 2026-11-04 le
représentant légal, y compris le cas d'une société représentée par une autre
société.

Le mapping `legal_entity_activities` désigne **la société qui facture par
défaut pour une activité donnée**, avec un index unique partiel garantissant
un seul défaut par activité. Le rédacteur de devis peut surcharger.

**Deux réserves factuelles :**

1. La colonne `country` est `not null default 'FR'`. Toute société enregistrée
   avant que l'écran n'expose le pays (correctif du 2026-11-04) est donc
   **étiquetée France par défaut**, qu'elle le soit ou non. Le multi-pays est
   d'abord un travail de **saisie**, pas de code.
2. **Aucune colonne de devise.** Voir §2.1 — c'est le point bloquant n° 1.

### 1.3 Les factures clients existent, et elles sont déjà centralisées

Table `documents`, unifiée : `type` ∈ `devis | acompte | finale`.

Elle porte déjà tout ce que demande la Partie 3 : société émettrice
(`entity_id`, obligatoire), client, numéro, devis d'origine
(`related_devis_id`), activité, dates d'émission / validité / échéance,
HT / TVA / TTC, acompte (%, montant, montant déduit, solde dû), statut, PDF,
destinataire de l'envoi, date de paiement, **référence de paiement**, notes,
suppression douce, et le lien vers le dossier commercial par `lead_id`.

La numérotation est **sans trou, par type et par année**, allouée par des
fonctions `SECURITY DEFINER` avec verrou de ligne, et consommée seulement à
l'émission réelle — jamais à l'aperçu. C'est conforme à l'exigence comptable
française et c'est déjà en place.

`markDocumentPaid()` marque une facture payée, synchronise le dossier de
planification et fait passer le lead à « encaissé ».

**Donc : la Partie 3 est satisfaite à 80 %.** Ce qui manque n'est pas la
centralisation, c'est la devise, les avoirs, les règlements partiels, et les
filtres pays/période.

### 1.4 Les factures fournisseurs existent — mais seulement pour les sous-traitants

Table `subcontractor_invoices` (module Sous-traitants, 2026-09-30) :
numéro, date de facture, date de réception, HT, TVA, TTC, statut
(`recue | a_regler | reglee | litige`), date de règlement, fichier dans le
bucket privé `subcontractor-documents`, notes.

**Trois manques structurels :**

- **Pas de `entity_id`.** La facture est rattachée à un *intervenant* et à un
  *dossier*, jamais à une société juridique. Elle est donc **inclassable dans
  une comptabilité** au sens de la Partie 1. C'est le défaut à corriger en
  premier côté fournisseurs.
- **Périmètre restreint aux sous-traitants.** Les abonnements, les services
  administratifs, les frais professionnels et les dépenses de fonctionnement
  (Partie 4) n'ont nulle part où aller.
- **Aucune extraction automatique** des informations à l'import.

### 1.5 L'archivage documentaire existe, et il est de bonne qualité

Table `document_archive` (2026-10-31), conçue pour les contrats DocuSign mais
**directement réutilisable** :

- `entity_id` **obligatoire** — c'est lui qui assure l'isolation entre
  sociétés ;
- `sha256` du fichier — preuve de non-altération ;
- `entity_snapshot` — instantané juridique de la société au moment de l'envoi,
  pour qu'un changement d'adresse ne réécrive pas l'histoire ;
- immuabilité : un document final n'est jamais remplacé en silence, une
  nouvelle version est une **nouvelle ligne** qui pointe sur l'ancienne
  (`supersedes_id`, `version`) ;
- `retention_until` + table `document_retention_rules` ;
- `document_access_log` — qui a consulté quoi.

Six buckets privés existent : `lead-media`, `signed-documents`,
`devis-optimivv`, `client-documents`, `subcontractor-documents`,
`document-archive`. Les URL sont toujours signées, TTL ≤ 60 min.

**C'est exactement le socle qu'exige la Partie 20.** Le module comptable doit
s'y brancher, pas en créer un second.

### 1.6 La traçabilité existe

`audit_logs` : append-only, écrite par le rôle de service (donc jamais perdue
quand l'événement vient d'une machine), avec `before`/`after` en JSON,
utilisateur, IP, agent. L'espace de noms des actions est documenté.

Répond à la Partie 20 : « qui a identifié, qui a proposé, qui a validé, à
quelle date, avec quelle justification » — le mécanisme est là, il n'y a qu'à
y écrire les bonnes actions.

### 1.7 Les notifications internes existent

Table `notifications` (utilisateur, type, entité, titre, corps, lien, lu),
diffusion temps réel Supabase, composant global `<RealtimeNotifications>`,
page `/notifications`.

**C'est le véhicule du circuit planificatrice ↔ comptable de la Partie 10.**
Rien à réinventer : il faut y rattacher les objets comptables.

### 1.8 Un moteur d'alertes existe

Tables `alerts` + `alert_rules`, quatre niveaux de gravité
(`watch | warn | high | critical`), statut `open | resolved`, action de
résolution, contexte JSON. Alimenté par le cron
`POST /api/presence/evaluate` (toutes les 1–2 minutes, trois passes isolées).

Réutilisable tel quel pour les anomalies comptables.

### 1.9 Trois exports CSV existent

Tableau de bord, Suivi commercial, Performance. Même technique :
construction des lignes côté client, BOM UTF-8, `Blob`, téléchargement.

**Aucun export comptable. Aucun ZIP. Aucune dépendance** `zip`, `xlsx` ou
équivalent dans le `package.json` (11 dépendances au total).

### 1.10 Une seconde chaîne de facturation existe déjà

`devis_optimivv` : table séparée, compteur séparé, bucket séparé, PDF au
pixel près porté depuis un original Python. Et des compteurs
`facture_optimivv_counters` avec leurs fonctions `next_` / `peek_`, **mais
aucune table de factures OPTIMIVV**.

**Conséquence directe de votre consigne « ne pas créer une deuxième base de
facturation » : il en existe déjà une.** Les devis OPTIMIVV n'apparaissent
pas dans `/comptabilite`. C'est un doublon antérieur à votre demande, et une
décision à prendre (voir D4).

---

## 2. Ce qui manque — la liste honnête

### 2.1 ⛔ Aucune notion de devise — point bloquant n° 1

- Aucune colonne `currency`, ni sur `documents`, ni sur `legal_entities`, ni
  sur `subcontractor_invoices`.
- `formatEUR()` est **codé en dur** et utilisé dans **23 fichiers**.
- Tous les montants existants sont donc implicitement des euros, **y compris
  ceux d'une société suisse ou canadienne**.
- Les indicateurs de la page Comptabilité additionnent aujourd'hui tous les
  documents de toutes les sociétés, sans distinction de devise.

Vous écrivez : « ne jamais additionner des montants de devises différentes
sans conversion fiable, datée et documentée ». **Le code le fait déjà
aujourd'hui**, parce qu'il ignore la notion de devise. Ce n'est pas une
régression à venir, c'est un défaut présent.

### 2.2 ⛔ Aucun compte bancaire

- `legal_entities` porte **un seul** IBAN et **un seul** BIC.
- Ils sont **en clair**. Le schéma l'admet lui-même : *« CDC §8.5: encrypt
  application-side. Stored here as text for now »*. Le mécanisme de
  chiffrement applicatif (AES-256-GCM) existe et fonctionne — il couvre
  l'annotation Immobilier/Travaux, la provenance marketing et les jetons
  DocuSign — **mais pas l'IBAN**.
- Aucune table de comptes bancaires, donc aucun moyen de rattacher un relevé
  à un compte.

### 2.3 ⛔ Aucun relevé bancaire

Rien. Pas de table, pas d'import, pas de parseur, pas de dépendance. Les cinq
formats demandés (PDF, CSV, XLSX, OFX, CAMT.053) sont tous à construire.

### 2.4 ⛔ Aucun rapprochement bancaire

Rien : ni table, ni moteur de correspondance, ni écran. C'est la Partie 6
intégralement à construire.

### 2.5 ⛔ L'encaissement n'est pas un objet

Un paiement, aujourd'hui, c'est **deux colonnes sur la facture** :
`paid_at` et `payment_reference`. Il n'existe aucune table de paiements.

Il en découle que **rien** de la Partie 12 n'est possible :

| Cas demandé (Partie 12) | Faisable aujourd'hui |
| --- | --- |
| Plusieurs paiements pour une facture | **Non** |
| Un paiement couvrant plusieurs factures | **Non** |
| Paiement partiel | **Non** — l'énumération `payment_status` contient la valeur `partiel`, mais **aucune ligne de code ne l'écrit jamais**. C'est une valeur morte. |
| Trop-perçu | **Non** |
| Remboursement | **Non** |
| Frais bancaires | **Non** |
| Virement interne | **Non** |
| Paiement par un tiers | **Non** |

### 2.6 ⛔ Aucun avoir

L'énumération `document_type` vaut `devis | acompte | finale`. Une contrainte
de base (`documents_status_per_type`) interdit tout autre type. Les avoirs
demandés aux Parties 3, 12 et 14 n'existent pas.

### 2.7 ⛔ Aucun payeur tiers — la fonctionnalité que vous déclarez prioritaire

La Partie 7 (« fonctionnalité prioritaire et obligatoire ») n'a **aucune
amorce** dans le code : pas de champ, pas de table, pas d'historique des
payeurs, pas de distinction écart d'identité / écart financier / écart mixte.

### 2.8 ⛔ Aucun circuit collaboratif comptable

Pas de fil de discussion attaché à une opération comptable. Les notifications
existent mais ne portent sur aucun objet comptable. Les huit statuts du
circuit (Partie 10) sont à créer.

### 2.9 ⛔ Aucun rôle comptable

`role_slug` vaut `admin | commercial | planification | assistant`, plus
`superviseur` ajouté le 2026-11-05. **Il n'y a pas de rôle comptable.** Le mot
n'apparaît dans le code que dans des commentaires — dont celui-ci, explicite :
« planification + comptabilité (pas de rôle comptable distinct) ».

La RLS sur `documents` autorise la lecture à : administrateur, planificateur,
ou propriétaire du lead. Rien d'autre.

Créer le rôle = modifier les droits, ce que vous avez interdit pour le
moment. Voir D5.

### 2.10 ⛔ Pièces manquantes, clôture mensuelle, historique des exports

Les Parties 13, 16 et 17 n'ont aucune amorce.

### 2.11 Manques mineurs mais visibles

- Indicateurs non cliquables (Partie 2).
- Pas de filtre pays ni de filtre période sur la comptabilité.
- La colonne « Validité » du tableau est **recalculée à l'affichage** comme
  « émission + 30 jours », alors que la vraie date est stockée en base
  (`documents.valid_until`) **et correctement renseignée à la création du
  devis**. L'écran affiche donc une date qui peut être fausse alors que la
  bonne est disponible. À corriger au passage.

---

## 3. Tableau de correspondance — Demande → Existant → Manquant → Développement

| § | Demande | Existant | Manquant | Développement nécessaire |
| --- | --- | --- | --- | --- |
| 1 | Une société juridique = une comptabilité | `legal_entities` (7 sociétés), pays, mapping par activité, `entity_id` obligatoire sur `documents` | Devise ; comptes bancaires ; `entity_id` sur les factures fournisseurs | Colonne devise + table `bank_accounts` + rattachement fournisseurs |
| 2 | Tableau de bord, filtres, indicateurs cliquables | Page + 4 indicateurs + 5 filtres | Filtres pays / période / compte ; indicateurs cliquables ; 5 familles d'indicateurs sur 5 absentes | Refonte du tableau de bord (lot 7) |
| 3 | Centralisation des factures clients | `documents` complète, numérotation sans trou, PDF, lien devis/dossier | Devise, avoirs, règlements partiels, export | Extension, pas de nouvelle base |
| 4 | Factures fournisseurs + justificatifs | `subcontractor_invoices` (sous-traitants seuls) + bucket privé | Société juridique, périmètre élargi, extraction automatique, détection de doublons | Table fournisseurs élargie + import assisté |
| 5 | Import des relevés bancaires (5 formats) | — | Tout | Table `bank_statements` + `bank_transactions` + parseurs |
| 6 | Rapprochement intelligent | — | Tout | Moteur de correspondance + écran de validation |
| 7 | Écart d'identité payeur / client | — | Tout (**priorité déclarée**) | Détection + typage des trois écarts |
| 8 | Centre de traitement des écarts | `alerts` réutilisable | Rubrique, tableau, compteurs, ancienneté | Écran + vues d'agrégation |
| 9 | Fiche d'identification du paiement | — | Tout | Écran + champs d'intervention + verrou sur le libellé d'origine |
| 10 | Circuit planificatrice ↔ comptable | `notifications` + temps réel | Fils de discussion, 8 statuts, validations | Table d'échanges + machine à états |
| 11 | Historique des payeurs | — | Tout | Table `payer_aliases` cloisonnée par société |
| 12 | Acomptes et paiements partiels | Acompte au niveau du document (`acompte_pct`, `acompte_deduit`, `solde_du`) | Objet paiement, affectations multiples, trop-perçu, remboursement, frais, virement interne | Tables `payments` + `payment_allocations` |
| 13 | Pièces manquantes | — | Tout | Vues de contrôle + actions tracées |
| 14 | Export comptable multi-pays + ZIP | 3 exports CSV (autres modules) | Export comptable, ZIP arborescent, PDF/Excel | Génération serveur + dépendance ZIP |
| 15 | Exports adaptés par pays | — | Tout | Modèles d'export par société/cabinet |
| 16 | Suivi de clôture mensuelle | — | Tout | Table de clôture + contrôles bloquants |
| 17 | Historique des exports | `document_archive` réutilisable | Historique dédié, versions, export complémentaire | Table `accounting_exports` |
| 18 | Interface à 12 rubriques | 4 onglets dont 1 vide | 9 rubriques | Navigation du module |
| 19 | Rôles et autorisations par société et pays | Garde back-office, RLS documents | Rôle comptable, périmètre par société/pays | **Rien pour l'instant — sur votre consigne** |
| 20 | Sécurité et traçabilité | `audit_logs`, `document_archive`, sha256, buckets privés, chiffrement applicatif | Chiffrement de l'IBAN, traçabilité des affectations bancaires | Extension du chiffrement + actions d'audit |

**États :** Partie 3 = *existant à étendre*. Parties 1, 4, 8, 10, 17, 20 =
*socle existant, fonctionnalité à construire*. Parties 5, 6, 7, 9, 11, 12, 13,
14, 15, 16, 18 = *à construire intégralement*. Partie 2 = *à refondre*.
Partie 19 = *gelé sur votre consigne*.

---

## 4. Risques techniques

**R1 — La devise est un préalable, pas un détail.** Les montants déjà en base
n'ont pas de devise. On ne peut pas les étiqueter rétroactivement sans une
règle que vous validez. Ma recommandation : la devise se **déduit du pays de
la société émettrice** (FR/BE/LU → EUR, CH → CHF, CA → CAD), elle est écrite
explicitement sur chaque nouvelle écriture, et **aucun total ne mélange deux
devises** — les totaux s'affichent côte à côte, par devise. **Aucune
conversion dans cette version**, puisqu'il n'y a pas de source de taux datée.

**R2 — Les sociétés sont probablement toutes marquées « France ».** La colonne
pays vaut `FR` par défaut et l'écran ne l'exposait pas avant le 2026-11-04. Le
multi-pays commence par une saisie administrative, à faire par vous.

**R3 — L'IBAN est en clair, et le module va concentrer de la donnée
bancaire.** Importer des relevés multiplie la sensibilité du contenu. Le
chiffrement applicatif existe ; il faut l'étendre à l'IBAN, au BIC et aux
libellés de relevé qui contiennent des noms de personnes physiques.

**R4 — Le PDF n'est pas un format de données.** L'extraction depuis un relevé
PDF est intrinsèquement faillible : colonnes fusionnées, montants collés,
libellés tronqués. Je recommande de traiter **CSV, XLSX, OFX et CAMT.053
comme fiables** (CAMT.053 est du XML normalisé, OFX est structuré) et le
**PDF en mode assisté**, avec vérification humaine ligne à ligne obligatoire
avant validation. Cela applique directement votre consigne : « ne jamais
inventer les données manquantes ».

**R5 — Le rapprochement automatique est le vrai danger comptable.** Votre
prompt l'encadre déjà correctement. Je le tiendrai strictement : **le moteur
propose, il n'affecte jamais**. Un seuil de confiance ne doit jamais devenir
une autorisation d'écrire.

**R6 — Double comptabilisation.** Sans objet « encaissement » unique et
idempotent, le même virement importé deux fois compte deux fois. Protection
prévue : empreinte SHA-256 du fichier importé + clé d'unicité
(compte bancaire, date de valeur, montant, référence bancaire). Le dépôt
dispose déjà du bon précédent : la déduplication des webhooks par violation
d'unicité.

**R7 — RLS.** Chaque nouvelle table devra porter sa politique dans la même
migration. Le cloisonnement par société sera la frontière réelle, pas un
filtre d'interface. Plusieurs défauts passés du CRM ont été exactement cela :
« l'interface filtrait, la base non ».

**R8 — Il n'y a pas de lanceur de tests dans ce dépôt.** Les contrôles se font
par scripts ad hoc (`npm run check:*`), que j'utiliserai pour le moteur de
rapprochement et les parseurs. Mais **les 12 tests de la Partie 23 seront des
contrôles de moteur sur jeux de données construits, pas des tests
d'interface automatisés.** Je ne déclarerai rien « validé » sans l'avoir
exécuté, et je distinguerai toujours « moteur testé » de « écran testé
manuellement ».

**R9 — Je n'ai pas accès à la base de production.** Aucun chiffre de volume
dans ce document. Les tests sur données réelles devront être faits par
quelqu'un qui a l'accès, ou les données devront m'être fournies.

**R10 — Deux chantiers simultanés.** Le module Superviseur est en cours :
lot 1 livré et poussé (`be943d7`), lots 2 à 6 non commencés, et sa migration
`20261105000001` **n'est pas appliquée**. Deux modules qui touchent la même
base en parallèle, c'est un risque de conflit de migrations. Voir D7.

---

## 5. Plan de développement — les 7 lots que vous avez validés

Chaque lot se termine par le tableau de traçabilité de la Partie 24, et rien
ne passe au lot suivant sans contrôle exécuté.

**LOT 1 — Architecture multi-sociétés.** Devise par société et par document ;
table des comptes bancaires (plusieurs par société) ; chiffrement de l'IBAN
et du BIC ; filtres pays et période sur la comptabilité ; séparation stricte
des totaux par devise. *Préalable : décisions D1 et D2.*

**LOT 2 — Centralisation documentaire.** Les factures clients remontent déjà :
on ajoute les avoirs, on élargit les factures fournisseurs (rattachement à la
société juridique, périmètre au-delà des sous-traitants), import assisté avec
extraction vérifiable et détection de doublons, justificatifs branchés sur
l'archivage existant. *Préalable : D3, D4, D6.*

**LOT 3 — Importation bancaire.** Tables relevé + opérations ; parseurs
CAMT.053, OFX, CSV, XLSX fiables ; PDF assisté ; conservation du fichier
d'origine ; déduplication par empreinte et par clé d'opération ; **jamais de
donnée inventée**. *Préalable : un relevé réel anonymisé de chaque banque.*

**LOT 4 — Rapprochement intelligent.** Objets paiement et affectation ;
règlements partiels, paiement multi-factures, trop-perçu, remboursement, frais
bancaires, virement interne ; moteur de correspondance qui **propose** ;
validation humaine obligatoire ; impossibilité structurelle de compter deux
fois.

**LOT 5 — Gestion collaborative des écarts.** Détection des trois types
d'écart (identité / financier / mixte, jamais confondus) ; fiche
d'identification du paiement avec libellé bancaire **non modifiable** ;
historique des payeurs cloisonné par société, qui propose sans jamais
affecter ; circuit à 8 statuts planificatrice ↔ comptable sur les
notifications existantes ; tout historisé.

**LOT 6 — Exports comptables.** Génération par société / pays / période ;
arborescence ZIP en 10 dossiers ; formats PDF, Excel, CSV ; modèles d'export
par société et par cabinet ; historique et versions. **Aucun fichier ne sera
présenté comme un export réglementaire certifié** — ce sont des dossiers
complets destinés à un expert-comptable, et le document le dira
explicitement.

**LOT 7 — Tableau de bord et clôture.** Les 5 familles d'indicateurs,
cliquables ; suivi de clôture mensuelle avec statut « Prêt » **conditionné aux
contrôles**, jamais déclaratif ; rubrique « pièces manquantes » ; tests finaux
de la Partie 23.

---

## 6. Décisions à prendre avant que j'écrive la première ligne

| # | Décision | Pourquoi elle bloque | Ma recommandation |
| --- | --- | --- | --- |
| **D1** | Devise : déduite du pays de la société ? Et aucune conversion ? | Sans règle, je ne peux ni étiqueter l'existant ni calculer un total | Déduire du pays ; écrire la devise explicitement ; **jamais de total multi-devises, jamais de conversion** |
| **D2** | Combien de comptes bancaires par société, et quels formats vos banques fournissent-elles réellement ? | Détermine les parseurs à écrire. Un format annoncé mais indisponible est du travail perdu | Me fournir **un relevé réel anonymisé par banque** avant le lot 3 |
| **D3** | Avoirs : nouveau type `avoir` dans `documents`, ou table séparée ? | Modifier une énumération de base est irréversible en pratique | Nouveau type dans `documents` : même numérotation sans trou, même PDF, même centralisation |
| **D4** | Les devis OPTIMIVV : les absorber en lecture dans la comptabilité, ou les migrer vers `documents` ? | Ils sont aujourd'hui invisibles dans la comptabilité. C'est le « doublon » que vous voulez éviter, et il préexiste | Absorber **en lecture** au lot 2 ; ne rien migrer sans un plan de reprise validé |
| **D5** | Rôle comptable : le créer maintenant (sans l'attribuer), ou plus tard ? | Vous avez interdit de modifier les droits. Mais le concevoir après coup coûte plus cher | Le créer **désactivé** au lot 1, attribué à personne, périmètre par société et pays dès la conception |
| **D6** | Factures fournisseurs : élargir `subcontractor_invoices` ou créer une table englobante ? | Deux tables de dépenses seraient le doublon que vous refusez | Une table unique de dépenses, avec `entity_id` obligatoire ; les factures sous-traitants deviennent un cas particulier |
| **D7** | Ordre des chantiers : Comptabilité maintenant, ou finir le Superviseur ? | Deux modules sur la même base en parallèle = conflits de migrations | Trancher explicitement. Ma préférence : **appliquer la migration du Superviseur, puis démarrer la Comptabilité**, et mettre les lots 2 à 6 du Superviseur en attente |

---

## 7. Ce que cet audit ne prouve pas

- Il ne dit rien des **volumes réels** ni de l'**état des données** en
  production : je n'y ai pas accès.
- Il ne dit rien de la **conformité fiscale** des exports par pays. Je peux
  produire des dossiers complets et structurés ; déclarer qu'ils satisfont
  une obligation belge, luxembourgeoise ou canadienne demande la validation
  du cabinet local. Je ne le ferai pas à sa place.
- Il n'a **exécuté aucun test**, puisqu'aucun code n'a été écrit. Aucune
  fonctionnalité n'est déclarée opérationnelle dans ce document.

---

*Audit statique du code et des 176 migrations, 2026-11-05. Aucun code écrit,
aucune migration créée, aucune donnée modifiée, aucun droit utilisateur
touché.*
