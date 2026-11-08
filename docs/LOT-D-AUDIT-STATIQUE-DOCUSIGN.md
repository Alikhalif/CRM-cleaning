# Lot D — Audit statique DocuSign

> 9 novembre 2026. Priorité 7. **Aucune modification de production, aucune
> enveloppe envoyée, aucun appel à DocuSign.** Audit par lecture du code, des
> migrations et de la configuration.
>
> ⚠️ **Et je ne conclus pas sur la valeur juridique des contrats.** Vous me
> l'avez demandé, et vous avez raison : mon rapport du 8 novembre affirmait
> que « les contrats signés en production n'ont aucune valeur juridique ».
> C'était une conclusion **juridique** tirée d'un constat **technique**. Le
> §10 dit ce qui est vérifiable, et s'arrête là.

## Le module, en chiffres

| | |
| --- | --- |
| Fichiers | **13**, `lib/docusign/` |
| Lignes | **3 232** |
| Tables | **5** : `docusign_connections`, `docusign_envelopes`, `docusign_envelope_events`, `docusign_oauth_states`, `docusign_webhook_queue` |
| Routes | **3** : `/api/docusign/connect`, `/api/docusign/callback`, `/api/webhooks/docusign` |
| Contrôles automatisés | **1 163** (`npm run check:docusign`), 0 échec |

---

## 1 · Création des contrats de sous-traitance — ✅ en place

`enregistrerContrat()` dans `app/(app)/planification/[id]/actions.ts`. La
table `subcontract_contracts` porte `ref`, `statut`, `modele`,
`modele_version`, `technician_id`, `entity_id`, `dossier_id`, `lead_id`.

La référence passe par une **RPC `allocate_subcontract_ref`** : même
discipline que la numérotation des devis — pas de trou, allocation sous
verrou.

## 2 · Sélection du modèle — ✅ en place

Table `contract_templates` (`key`, `name`, `kind`, `category`, `schema`,
`clauses`), avec **neuf modèles** semés par
`20261102000001_sous_traitance_neuf_modeles.sql`.

Le contrat retient **`modele` ET `modele_version`** : on sait donc, des années
plus tard, quelle version de quelles clauses a été signée. C'est la bonne
conception pour un document contractuel.

## 3 · Génération du document — ✅ en place

`assemblerDocument()` → `renderAndUploadContractPdf()` →
`ContractPdf` (`@react-pdf/renderer`), puis dépôt dans le bucket privé.

⚠️ **Dépendance bloquante, déjà au registre (D3)** : l'identité légale du
sous-traitant vient de `technicians` + `subcontractor_profiles`. Voir le §8 —
cette seconde table est **illisible aujourd'hui**.

## 4 · Envoi pour signature — ✅ en place

`envoyerContratEnSignature()` (`lib/docusign/envoi-server.ts`), appelée par
`envoyerEnSignature()` depuis l'écran de planification.

Les **ancres de signature** sont gérées à part (`lib/docusign/ancres.ts`) :
DocuSign place les champs sur des marqueurs textuels du PDF, et non sur des
coordonnées — ce qui résiste à un changement de mise en page.

## 5 · Suivi du statut — ✅ en place

`lib/docusign/statuts.ts` fait correspondre les états DocuSign aux états
internes :

| DocuSign | Interne |
| --- | --- |
| `created`, `delivered` | `en_attente_signature` |
| `completed` | `signe_et_archive` |
| `declined` | `annule` |
| `expired` | `expire` |
| `autoresponded`, `deleted` | `erreur`, `alerte` |

Dix états internes au total, dont `erreur_synchronisation` — un état qui
distingue « la signature a échoué » de « on ne sait pas où elle en est ». Cette
distinction est rare et elle est juste.

## 6 · Réception des webhooks — ✅ solide

| Mécanisme | Constat |
| --- | --- |
| Authenticité | **HMAC-SHA256** sur le corps brut (`lib/docusign/webhook.ts`) |
| Comparaison | **`timingSafeEqual`** — à temps constant, donc pas d'oracle temporel |
| Sans secret | **aucune** notification acceptée. Le raccordement l'exige dès le départ, « sinon le contrat partirait sans que son retour de signature puisse être enregistré » |
| Idempotence | table `docusign_webhook_queue` |
| Rejeu | `rejouerFile()` et `rattraperArchivages()`, appelées par le **cron** |

C'est la partie la mieux construite du module. Le choix de `timingSafeEqual`
plutôt qu'une égalité de chaînes n'est pas un détail : il ferme une classe
d'attaque que presque personne ne ferme.

## 7 · Archivage automatique — ✅ en place

`archiverEnveloppe()` télécharge **le document signé ET le certificat de
réalisation**, les dépose dans le bucket privé `document-archive`, et
enregistre `storage_bucket` + le chemin.

| Point | Constat |
| --- | --- |
| Deux pièces | contrat signé **et** certificat — la preuve, pas seulement le document |
| Bucket | **privé** |
| URL | **signée, ≤ 3 600 s** (`Math.min(secondes, 3600)`) — jamais permanente |
| Chemin | validé : ni `..`, ni chemin absolu |
| Rattrapage | le cron reprend les archivages manqués |

## 8 · Permissions et sécurité — ✅ … sauf une table

### Les gardes applicatives : 14 sur 14

| Fichier | Actions | Gardées |
| --- | --- | --- |
| `planification/[id]/actions.ts` | 7 | **7** (`ensurePlanner`) |
| `sous-traitants/actions.ts` | 7 | **7** (`ensurePlanner` local) |

⚠️ **J'ai cru le contraire pendant dix minutes**, et deux fois de suite : une
sortie tronquée par `head`, puis un motif qui ne tolérait pas un double
espace. J'ai failli vous rapporter une élévation de privilège inexistante.
C'est pourquoi les chiffres ci-dessous ont tous été recomptés avec des motifs
tolérants.

### La RLS : activée sur les 7 tables

### 🔴 Mais `subcontractor_profiles` a la RLS **sans aucune politique**

`20260930000001_subcontractor_module.sql:102` active la RLS. **Aucune
politique n'est créée pour cette table** — zéro occurrence de
`on subcontractor_profiles`.

En PostgreSQL, RLS activée **sans politique** = **tout est refusé** aux rôles
qui ne contournent pas la RLS. Or les trois lectures de cette table emploient
le client de **session** (clé anon) :

| Lecture | Fichier |
| --- | --- |
| liste des sous-traitants | `lib/subcontractors-server.ts:110` |
| fiche d'un sous-traitant | `lib/subcontractors-server.ts:154` |
| **identité légale du contrat** | `lib/sous-traitance/contrats-server.ts:256` |

**Conséquence** : la raison sociale, le SIRET et le dirigeant du sous-traitant
ne sont **jamais lus**. La liste et la fiche s'affichent sans eux, et le
contrat ne peut pas porter l'identité de celui qui s'engage.

**Cela explique peut-être « 0 fiche sous-traitant »** relevé le 6 novembre, et
une partie de D3. Ce n'était peut-être pas un défaut de saisie : la table est
peut-être illisible par construction.

Deux branches, et je ne peux pas trancher sans base :
- si la migration `20260930000001` **est** appliquée → la table existe et
  refuse tout ;
- si elle **ne l'est pas** → la table n'existe pas, et les lectures échouent
  autrement.

Dans les deux cas, **le profil sous-traitant ne fonctionne pas aujourd'hui**.

**C'est *fail-closed*** : rien ne fuit, tout est refusé. C'est donc une
anomalie **fonctionnelle**, pas une faille. Nouvelle entrée **D20**.

## 9 · Gestion des erreurs — ✅ en place

| Situation | Comportement |
| --- | --- |
| Configuration absente | génération et téléchargement **continuent** ; seul l'envoi en signature est refusé, « avec un message qui nomme ce qui manque » |
| Clé de chiffrement absente | raccordement **refusé** — un jeton de rafraîchissement en clair équivaudrait à un accès permanent laissé en base |
| Webhook non signé | refusé |
| Webhook perdu | `docusign_webhook_queue` + `rejouerFile()` au cron |
| Archivage manqué | `rattraperArchivages()` au cron |
| Contrat signé qu'on veut annuler | **refusé** : « il se résilie par avenant, et sa trace est conservée » |
| État inconnu | `erreur_synchronisation`, distinct de `erreur` |

Le dernier point du tableau est une **bonne** décision métier, et elle est dans
le code, pas dans un document.

## 10 · Démonstration ou production — ce qui est vérifiable, et rien de plus

### Ce qui est vérifiable

| Fait | Preuve |
| --- | --- |
| `DOCUSIGN_ENV=demo` dans le `.env.local` du poste | lecture du fichier |
| Toute valeur autre que `production`, **et l'absence de variable**, valent `demo` | `config.ts:61` |
| L'hôte d'authentification suit l'environnement (`AUTH_HOST[env]`) | `config.ts:64` |
| La production tournerait en `demo` | **mémoire de projet du 2026-11-05**, pas une mesure de ce jour |

### Ce qui n'est PAS vérifiable depuis ici

- **La valeur effective de `DOCUSIGN_ENV` en production.** Elle vit dans
  l'environnement du conteneur du VPS. Je n'ai ni SSH ni Docker : la seule
  trace dont je dispose est une note du 5 novembre.
- **Les conséquences juridiques** d'une signature en environnement de
  démonstration. C'est une question de droit, et elle demande un conseil —
  pas un audit de code.

### La vérification à faire, en une commande sur le VPS

```bash
docker compose exec crm printenv DOCUSIGN_ENV
```

Trois issues :

| Résultat | Signification |
| --- | --- |
| `production` | La note du 5 novembre est obsolète. Rien à faire. |
| `demo` | Les contrats sont passés par le **bac à sable** DocuSign. Il faut alors établir, avec un conseil, ce que valent ceux déjà signés — et basculer. |
| vide | Vaut `demo` par défaut, même conclusion. |

**Je n'affirme rien de plus.** Ce que je peux dire techniquement : le bac à
sable DocuSign est destiné aux essais, et ses documents en portent la marque.
Ce que cela implique pour un contrat déjà signé relève de votre conseil.

---

## Les anomalies nouvelles de cet audit

| # | Gravité | Anomalie |
| --- | --- | --- |
| **D20** | 🔴 | `subcontractor_profiles` : RLS activée **sans aucune politique** → la table est illisible par le client de session. Raison sociale, SIRET et dirigeant du sous-traitant jamais lus ; le contrat ne peut pas porter l'identité de celui qui s'engage. *Fail-closed* : fonctionnel, pas une fuite |

## Ce que cet audit ne dit pas

**Aucune enveloppe n'a été créée, envoyée ni signée.** Le module est **lu**,
pas **exercé**. Les 1 163 contrôles sont statiques : ils vérifient que le code
dit ce qu'il doit dire.

| Volet | Développé | Testé techniquement | Testé réellement | Validé en recette |
| --- | --- | --- | --- | --- |
| Création du contrat | ✅ | ✅ | ❌ | ❌ |
| Sélection du modèle | ✅ | ✅ | ❌ | ❌ |
| Génération du PDF | ✅ | ✅ | ❌ | ❌ |
| Envoi en signature | ✅ | ✅ | ❌ | ❌ |
| Suivi du statut | ✅ | ✅ | ❌ | ❌ |
| Webhooks | ✅ | ✅ | ❌ | ❌ |
| Archivage | ✅ | ✅ | ❌ | ❌ |
| Permissions | ✅ | ✅ | ❌ | ❌ |
| Gestion des erreurs | ✅ | ✅ | ❌ | ❌ |
| Démo / production | ✅ | ✅ | ❌ | ❌ |

**Dix volets développés, dix testés techniquement, zéro testé réellement.**

Un essai réel demande : une application DocuSign développeur distincte, un
`redirect_uri` sur `localhost`, un sous-traitant fictif avec son profil **et
D20 corrigée** — sans quoi le contrat ne portera aucune identité.
