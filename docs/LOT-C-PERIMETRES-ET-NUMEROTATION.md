# Lot C — Périmètres de données, permissions sous-traitants, numérotation

> 9 novembre 2026. **Aucune modification de production, aucune migration,
> aucune donnée touchée.** Audit par mesure sur le schéma, les migrations et
> le code.

## ⚠️ Avertissement sur la numérotation des anomalies

Votre prompt cite un commit **`22f2a23`** et des anomalies **D32 à D36**.
Vérifié : ce commit n'existe dans aucune branche du dépôt, et mon registre va
de **D1 à D22**. Je n'ai donc pas produit ce rapport, et je ne peux pas
confirmer des constats que je n'ai pas établis.

**Vos cinq sujets sont réels**, et je les traite ici sous ma propre
numérotation. Voici la correspondance, pour que rien ne se perde :

| Votre libellé | Traité ici comme | Statut |
| --- | --- | --- |
| D35 — bibliothèque des sous-traitants | §2, et l'anomalie **D20** déjà au registre | audité + cible spécifiée |
| D36 — données sans pays ni entité | §1, et la nouvelle anomalie **D24** | **inventaire exhaustif livré** |
| D32 — activation progressive | §3 | spécifié ; le tableau exige des données que je ne peux pas lire |
| D33 / D34 — numérotation | §4, et la nouvelle anomalie **D23** | **audité, un défaut trouvé** |

---

# 1 · Inventaire des données sans pays ni entité

Mesuré sur les **78 tables** du schéma généré.

## Le fait qui structure tout : seules 3 tables portent un pays

| Table | Colonne `country` | Autorité |
| --- | --- | --- |
| `legal_entities` | **non nul** | ✅ **la seule source autoritative** |
| `leads` | nullable | déclaratif, déduit à l'arrivée |
| `landing_pages` | nullable | déclaratif |

**Aucune autre table ne porte de pays.** Tout le reste doit le **déduire**, et
le chemin passe toujours par la société émettrice ou par le lead.

## Les entités : 6 colonnes non nulles, 8 nullables

| `entity_id` **non nul** | `entity_id` **nullable** |
| --- | --- |
| `documents` · `document_templates` · `document_archive` · `docusign_connections` · `docusign_envelopes` · `docusign_oauth_states` | `leads` · `contracts` · `subcontract_contracts` · `alerts` · `notifications` · `audit_logs` · `users` · `landing_pages` |

Les six premières sont **sûres** : un document a toujours une société
émettrice, et c'est ce qui permet au Lot B de garantir qu'aucune identité ne
se mélange.

## Les chemins de rattachement, table par table

Chacune de ces tables n'a **ni** pays **ni** entité, et doit les déduire :

| Table | Chemin | Fiabilité |
| --- | --- | --- |
| `document_lines` | `document_id` → `documents.entity_id` **non nul** | ✅ **sûr** |
| `signature_requests` | `document_id` → `documents.entity_id` | ✅ sûr |
| `dossiers` | `quote_document_id` → `documents.entity_id`, ou `lead_id` | 🟠 deux chemins, le second nullable |
| `lead_media` · `devis_optimivv` · `cert_hotte` | `lead_id` → `leads.country` **nullable** | 🟠 dépend d'un pays déclaratif |
| `subcontract_missions` | `contract_id` → `subcontract_contracts.entity_id` **nullable** | 🟠 |
| `subcontractor_invoices` | `dossier_id` → `dossiers` → `lead_id` | 🟠 chaîne de deux maillons |
| `client_documents` | `client_id`, `lead_id` ou `dossier_id` | 🟠 trois chemins possibles |
| **`clients`** | **`source_lead_id` SEULEMENT, et il est nullable** | 🔴 **voir ci-dessous** |

## 🔴 Le cas sans issue : les clients créés directement

`clients` n'a **ni** `country`, **ni** `entity_id`. Son **unique** lien est
`source_lead_id`, et il est **nullable**.

Mesuré : seule la conversion d'un lead le renseigne
(`app/(app)/clients/new/actions.ts:191`). **Un client créé directement depuis
`/clients/new` a donc `source_lead_id = null`** — et aucun chemin, même
indirect, ne permet de retrouver son pays ni sa société.

C'est exactement la « donnée ambiguë » que vous voulez voir présentée pour
validation humaine : elle ne se déduit pas, elle se **demande**.

Nouvelle anomalie **D24**.

## La procédure de rattachement — et ce qu'elle ne fera jamais

### Le principe : trois classes, et une seule est automatisable

| Classe | Règle | Action |
| --- | --- | --- |
| **Déductible sûrement** | un seul chemin, non nul (`document_lines`, `signature_requests`) | rattachement automatique, journalisé |
| **Déductible avec réserve** | plusieurs chemins, ou un chemin nullable | rattachement **proposé**, avec le chemin employé affiché, et **validation humaine** |
| **Non déductible** | aucun chemin, ou chemins contradictoires | **présenté pour saisie**. Jamais deviné |

### Les garde-fous, non négociables

1. **Aucune attribution arbitraire.** Si deux chemins donnent deux réponses
   différentes, la donnée passe en classe 3. Un désaccord n'est pas une
   moyenne à faire.
2. **Rien en masse sur la production.** La procédure s'éprouve d'abord sur la
   recette, avec un dénombrement avant/après.
3. **Mode simulation par défaut**, comme le script de rotation : on voit ce
   qui serait rattaché avant que quoi que ce soit le soit.
4. **Journalisation dans `audit_logs`**, avec le chemin employé — pour qu'on
   puisse défaire une décision des mois plus tard.
5. **Aucune suppression.** La procédure ne fait qu'**ajouter** un pays ou une
   entité là où il n'y en a pas. Elle n'écrase jamais une valeur existante.

⚠️ **Le script n'est pas écrit**, et c'est volontaire : il réécrirait des
colonnes de production, et la recette n'existe pas pour l'éprouver. Sa
conception est ci-dessus ; son écriture suit votre autorisation et la
création de la recette.

---

# 2 · La bibliothèque des sous-traitants

## L'état actuel, mesuré

| Point | Constat |
| --- | --- |
| Centralisation | ✅ un sous-traitant est un `technicians` + un `subcontractor_profiles`, **non dupliqué par société** |
| Rattachement multi-société | ❌ **n'existe pas.** Aucune table ne lie un sous-traitant à plusieurs sociétés |
| Rattachement multi-pays | ❌ n'existe pas. `technicians` n'a ni `country` ni `entity_id` |
| Missions / contrats rattachés à une société | 🟠 `subcontract_contracts.entity_id` existe, **nullable** |
| Accès commercial | ✅ **interdit** : `/sous-traitants` est `backOffice`, garde en `layout.tsx`, 404 pour un commercial |
| Accès superviseur | ✅ interdit : le superviseur n'a pas la portée `backOffice` |
| Gardes applicatives | ✅ **14 actions sur 14** vérifient `admin` ou `planification` |
| Périmètre de la planificatrice | ❌ **aucun** : toute planificatrice voit **tous** les sous-traitants |
| RLS | 🔴 **`subcontractor_profiles` : activée sans aucune politique** → table illisible (anomalie **D20**) |

## Ce que votre décision demande, et ce qu'il faut construire

| Exigence | Existe | À construire |
| --- | --- | --- |
| Bibliothèque de groupe, sans duplication | ✅ | — |
| Un sous-traitant pour plusieurs pays | ❌ | table de rattachement `subcontractor_scopes(technician_id, country, entity_id)` |
| Super Admin : accès global | ✅ | — |
| Super Admin : gestion des autorisations | ❌ | écran de rattachement |
| Planificatrice : **ses** pays et sociétés | ❌ | filtrage par rattachement, **en RLS d'abord** |
| Commercial : aucun accès | ✅ | — |
| Superviseur : aucun accès administratif ni financier | ✅ | — |
| Missions, contrats et montants rattachés à la société | 🟠 | rendre `entity_id` **non nul** sur `subcontract_contracts` |

### La conception que je recommande

Une table de rattachement, et **non** un champ sur `technicians` :

```sql
subcontractor_scopes (
  technician_id uuid not null references technicians(id) on delete cascade,
  entity_id     uuid not null references legal_entities(id),
  country       text not null,
  primary key (technician_id, entity_id)
)
```

**Pourquoi une table et non deux colonnes** : un sous-traitant intervenant
pour trois sociétés dans deux pays est **une** fiche et **trois** lignes de
rattachement. Deux colonnes sur `technicians` forceraient à le dupliquer — ce
que vous excluez explicitement.

**Et le périmètre de la planificatrice se déduit de la même table**, par
jointure, sans second mécanisme à maintenir.

⚠️ **Cela demande une migration.** Elle n'est pas écrite : votre autorisation
d'abord, et **D20 corrigée avant**, sans quoi la bibliothèque restera
illisible quel qu'en soit le périmètre.

---

# 3 · Activation progressive du mode strict

## Le tableau que vous demandez

| Colonne | Source | Disponible ? |
| --- | --- | --- |
| Utilisateur | `users` | ✅ |
| Rôle | `user_roles` → `roles.slug` | ✅ |
| Pays autorisés | **n'existe pas** pour la planification | ❌ |
| Sociétés autorisées | `user_activities` existe ; **pas de `user_entities`** | ❌ |
| Mode d'accès actuel | déduit : `backOffice` = tout voir | ✅ |
| Futur périmètre strict | déduit de `subcontractor_scopes` (§2), **à créer** | ❌ |
| Données devenant invisibles | **requête sur la production** | 🔴 |
| Corrections nécessaires | déduit des deux précédentes | ❌ |

**Quatre colonnes sur huit n'ont pas de source aujourd'hui.** Le mécanisme de
périmètre par pays et par société **n'existe que pour le superviseur**
(`supervisor_scopes`), pas pour la planification.

## Ce qui est donc nécessaire, dans l'ordre

1. créer le rattachement (§2) — une migration ;
2. le peupler : c'est une **décision humaine**, société par société ;
3. **alors seulement** le tableau devient calculable ;
4. et la colonne « données devenant invisibles » exige une requête sur la
   production — que je ne peux pas faire, et qui ne doit de toute façon pas
   être faite avant que la recette l'ait éprouvée.

⚠️ **L'activation du mode strict reste soumise à votre validation**, et le
mécanisme du superviseur montre pourquoi : son Option A — périmètre vide =
aucun accès — rend un compte mal configuré **muet**, pas bruyant. Pour une
planificatrice, cela signifierait ne plus voir aucun dossier, sans message.

---

# 4 · Numérotation — un défaut trouvé, et un piège dans sa correction

## La méthode, parce qu'elle a changé le résultat

Mon premier relevé agrégeait les `revoke` et les `grant` **par fichier**, tous
fichiers confondus. C'était insuffisant pour deux raisons :

- il comptait **7** fonctions, alors qu'il y en a **9** (`peek_facture_optimivv_num`
  m'avait échappé) ;
- il ne disait rien de la **chronologie**. Or `create or replace function`
  **conserve** les droits déjà accordés, tandis qu'un `drop function` suivi
  d'un `create` les **remet à zéro**, donc à `PUBLIC`. Trois de ces fonctions
  sont redéfinies par des migrations ultérieures : un `drop` quelque part
  aurait rouvert en silence une fonction correctement révoquée.

Le relevé refait, fonction par fonction et migration par migration :
**aucun `drop function` dans les 177 migrations**, et les trois redéfinitions
**réémettent** même leur `revoke`. L'inquiétude ne se matérialise pas — et un
contrôle verrouille désormais cet état.

## 🔴 Trois fonctions `SECURITY DEFINER` exécutables par `PUBLIC`

| Fonction | `definer` | `search_path` | `revoke … from public` | `grant` |
| --- | --- | --- | --- | --- |
| `next_doc_num` | ✅ | ✅ | ✅ | `authenticated` |
| `next_devis_optimivv_num` | ✅ | ✅ | ✅ ×3 | `authenticated`, `service_role` |
| `next_facture_optimivv_num` | ✅ | ✅ | ✅ ×2 | idem |
| `next_cert_hotte_num` | ✅ | ✅ | ✅ | idem |
| `peek_devis_optimivv_num` | ✅ | ✅ | ✅ | idem |
| `peek_facture_optimivv_num` | ✅ | ✅ | ✅ | idem |
| **`next_contract_num`** | ✅ | ✅ | **❌ aucun** | `authenticated` |
| **`allocate_subcontract_ref`** | ✅ | ✅ | **❌ aucun** | **❌ aucun** |
| **`allocate_document_archive_ref`** | ✅ | ✅ | **❌ aucun** | **❌ aucun** |

**Pourquoi c'est un défaut** : en PostgreSQL, `EXECUTE` est accordé à
**`PUBLIC` par défaut**. Sans `revoke`, le rôle `anon` en fait partie — et
`SECURITY DEFINER` fait tourner la fonction **avec les droits du
propriétaire**, donc en contournant la RLS.

**Ce que ça permettrait** : appeler `allocate_subcontract_ref` et **consommer
une référence**. Mesuré dans son corps : `on conflict (kind, year) do update
set last = subcontract_sequences.last + 1`. Une référence consommée dans une
séquence sans trou **ne se récupère pas**.

**Et les quatre sœurs sont correctement révoquées** : la règle était connue,
ces trois ont été **oubliées**.

### Une bonne nouvelle au passage

**Les neuf épinglent `set search_path`.** La voie d'élévation classique d'un
`SECURITY DEFINER` — laisser l'appelant choisir le schéma où ses tables sont
résolues, et faire exécuter les siennes — est donc **fermée partout**. Le
défaut est le `revoke` manquant, et rien d'autre.

## ⚠️ Le piège : la correction évidente casserait deux fonctionnalités

C'est le constat le plus utile de cet audit, et je ne l'avais pas vu en
écrivant la première version de ce document.

Les trois fonctions **fonctionnent aujourd'hui grâce au `PUBLIC` par défaut** :

| Fonction | Appelée par | Rôle effectif | `grant` existant |
| --- | --- | --- | --- |
| `allocate_subcontract_ref` | `supabaseServer()` (`planification/[id]/actions.ts:329`) | **`authenticated`** | **aucun** |
| `next_contract_num` | `supabaseServiceRole()` (`lib/documents/contracts-server.ts:238`) | **`service_role`** | `authenticated` **seulement** |
| `allocate_document_archive_ref` | **personne** — aucun appel applicatif | — | aucun |

Ajouter les trois `revoke` **seuls** retirerait à ces deux appelants le droit
d'exécuter : **la numérotation des contrats et des contrats de sous-traitance
cesserait de fonctionner**, avec une erreur de permission à l'émission.

**La correction juste** est donc un couple, pas une ligne :

```sql
revoke all on function next_contract_num(integer) from public;
grant execute on function next_contract_num(integer) to service_role;

revoke all on function allocate_subcontract_ref(text, text) from public;
grant execute on function allocate_subcontract_ref(text, text) to authenticated;

-- Aucun appelant applicatif : révoquer sans accorder est ici sans effet de bord.
revoke all on function allocate_document_archive_ref(text) from public;
```

⚠️ **À éprouver sur la recette avant la production** : c'est exactement le
genre de correction dont l'effet ne se voit qu'à l'émission d'un document
réel. Un contrôle (**invariant 4**) empêche désormais la version à moitié —
un `revoke` sans `grant` fait tomber la suite.

### Ce que je ne peux pas affirmer

Que PostgREST **expose** effectivement ces RPC. Cela dépend du schéma exposé,
et je n'ai pas de base pour l'essayer. L'état des droits, lui, est sans
ambiguïté dans les migrations.

## Les autres points de votre §4, vérifiés

| Point | Constat | Preuve |
| --- | --- | --- |
| Aucun numéro consommé en **aperçu** | ✅ **structurellement** | les `peek_*` sont `language sql` **`stable`** — PostgreSQL **refuse** l'écriture dans une fonction `stable`. C'est plus fort qu'une lecture de corps |
| Aucun numéro consommé en **brouillon** | ✅ | l'allocation est appelée à l'émission réelle, jamais à l'enregistrement |
| **Double-clic** | ✅ | garde posée **avant** l'allocation, corrigée au Lot A (`LA-5`) |
| Unicité | ✅ | clé primaire `(kind, year)` sur la table de séquences |
| Émissions simultanées | 🟠 | l'`insert … on conflict do update` est **atomique**, donc sérialisé par PostgreSQL — correct en théorie, **jamais éprouvé sous concurrence réelle** |
| Anciennes routes de facturation | 🟠 | les deux parcours coexistent (anomalie **D4**) ; les deux passent par une allocation |

⚠️ **Une correction de vocabulaire** : le commentaire du code parle de
« verrou de ligne ». Le mécanisme réel est un **`insert … on conflict do
update`**, dont l'atomicité vient de PostgreSQL. Le résultat est le bon ; la
description était approximative.

### Les deux allocateurs partagent une table — et c'est volontaire

`allocate_document_archive_ref` écrit lui aussi dans **`subcontract_sequences`**,
la table de séquences des sous-traitants. Vérifié : **pas de collision**, la
table étant clé `(kind, year)` et l'archive préfixant ses clés
(`'arch_' || p_type`) là où le contrat passe `p_kind = 'contrat'`. Le nom de
la table est trompeur, le mécanisme est sain — et un contrôle garantit que le
préfixe reste en place.

**Aucune facture déjà émise n'a été touchée.**

## Les contrôles posés

`npm run check:recette` compte une suite de plus, **`numerotation.ts`**,
**33 assertions**, et **8 mutations sur 8 détectées** :

| Contrôle | Ce qu'il empêche |
| --- | --- |
| Périmètre **découvert par motif** | qu'une fonction ajoutée demain échappe à l'audit |
| **Invariant 1** — aucun `drop function` | qu'un drop/create réinitialise les droits à `PUBLIC` |
| **Invariant 2** — `search_path` épinglé | la voie d'élévation classique du `SECURITY DEFINER` |
| **Invariant 3** — les `peek_*` sont `stable` | qu'un aperçu puisse consommer un numéro |
| **Invariant 4** — un `revoke` porte un `grant` | **la correction à moitié**, qui casserait l'émission |
| **Plafond D23** — liste **fermée** à 3 | qu'une quatrième s'ajoute, ou que la liste change d'identité |

⚠️ Le plafond est un **plafond**, pas un zéro : D23 n'est **pas corrigée**, la
correction étant une migration qui demande votre autorisation. Les contrôles
garantissent seulement que la situation ne se dégrade pas.

⚠️ **Et la mutation M5 n'a d'abord PAS été détectée** : mon assertion
d'incrémentation cherchait son motif dans les 177 migrations **concaténées**,
et `allocate_document_archive_ref` incrémente la même table — le motif restait
donc trouvable même après avoir vidé la fonction visée. L'assertion passait
**pour la mauvaise raison**. Corrigée en la bornant au corps de la fonction.

---

# 5 · Ce qui exige votre intervention

| # | Opération | Pourquoi moi je ne peux pas |
| --- | --- | --- |
| 1 | **Créer le projet Supabase de recette** | aucun identifiant Supabase |
| 2 | **Autoriser la migration de `revoke`** (D23) | toute migration demande votre accord |
| 3 | **Autoriser la migration de politique RLS** (D20) | idem |
| 4 | **Autoriser la table `subcontractor_scopes`** (§2) | idem, et c'est aussi un choix de conception |
| 5 | **Décider des rattachements** sous-traitant ↔ société ↔ pays | décision métier, pas technique |
| 6 | **Deux commandes sur le VPS** (cron, `DOCUSIGN_ENV`) | ni SSH ni Docker |

---

# 6 · Les quatre niveaux, pour tout ce document

| Sujet | Développé | Testé techniquement | Testé réellement | Validé en recette |
| --- | --- | --- | --- | --- |
| Inventaire pays / entité | ✅ (audit) | ✅ par mesure | — | — |
| Procédure de rattachement | ❌ **spécifiée seulement** | — | — | — |
| Bibliothèque sous-traitants : état | ✅ (audit) | ✅ par mesure | ❌ | ❌ |
| Bibliothèque : multi-société / multi-pays | ❌ **à construire** | — | — | — |
| Tableau d'activation progressive | ❌ 4 colonnes sans source | — | — | — |
| Audit de la numérotation | ✅ (audit) | ✅ par mesure | ❌ | ❌ |
| Correction des `revoke` (D23) | ❌ **migration non écrite** | — | — | — |
| Contrôles de numérotation (`numerotation.ts`) | ✅ | ✅ **33 assertions, 8/8 mutations** | ❌ | ❌ |

**Rien dans ce document n'est validé en recette.** Les ✅ de la colonne
« testé techniquement » signifient « mesuré sur le schéma et le code », jamais
« vu fonctionner ».

---

# Traçabilité

| Demande initiale | Origine | Fonctionnalité | Emplacement | Test réel | Résultat | Correction |
| --- | --- | --- | --- | --- | --- | --- |
| Inventaire des données sans pays ni entité | client 09-11 §2 | audit des 78 tables + chemins | ce document §1 | ❌ | 🟠 **3 tables portent un pays ; `clients` créé directement n'a aucun chemin** | **D24** |
| Procédure de rattachement sécurisée | client 09-11 §2 | 3 classes + 5 garde-fous | §1 | ❌ | spécifiée, non écrite | autorisation |
| Bibliothèque sous-traitants centralisée | client 09-11 §1 | audit + cible | §2 | ❌ | 🟠 centralisée, **mais sans rattachement multi-société** | migration |
| Cloisonnement commercial / superviseur | client 09-11 §1 | déjà en place | `lib/access-shared.ts` | ❌ | ✅ **14 gardes sur 14**, 404 pour le commercial | — |
| Périmètre de la planificatrice | client 09-11 §1 | — | — | ❌ | ❌ **n'existe pas** : toute planificatrice voit tout | migration |
| Activation progressive | client 09-11 §3 | spécification | §3 | ❌ | 🟠 **4 colonnes sur 8 sans source** | dépend de §2 |
| Sécurité des compteurs | client 09-11 §4 | audit chronologique des **9** fonctions | §4 | ❌ | 🔴 **3 exécutables par `PUBLIC`** ; les 9 épinglent `search_path` ; **aucun `drop function`** | **D23** |
| Appel direct par rôle | client 09-11 §4 | — | §4 | ❌ | 🟠 **non testable sans base** : l'état des droits est mesuré, l'exposition PostgREST ne l'est pas | recette |
| Piège de la correction | mesuré, non demandé | invariant 4 | §4 | ❌ | 🔴 **les 3 `revoke` seuls casseraient l'émission** des contrats : il manque le `grant` au bon rôle | couple `revoke`+`grant` |
| Contrôles anti-régression | — | suite `numerotation.ts` | `scripts/recette-check/` | ✅ **exécutée** | ✅ **33 assertions, 8/8 mutations détectées** | — |
| Aucun numéro en aperçu / brouillon | client 09-11 §4 | déjà en place | `peek_*`, garde avant allocation | ❌ | ✅ par mesure | — |
| Double-clic | client 09-11 §4 | corrigé au Lot A | `app/api/devis` | ❌ | ✅ | — |
| Émissions simultanées | client 09-11 §4 | verrou de ligne | RPC | ❌ | 🟠 **jamais éprouvé sous concurrence** | recette |
