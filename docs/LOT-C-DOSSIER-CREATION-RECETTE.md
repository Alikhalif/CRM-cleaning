# Lot C — Dossier de création de l'environnement de recette

> 8 novembre 2026. **Rien n'a été créé.** Ce dossier est la procédure soumise
> à votre autorisation, conformément à votre décision : *« Attends mon
> autorisation explicite avant de créer toute ressource. »*
>
> Il répond aux trois demandes du §1 — procédure exacte, coûts éventuels,
> contrôles garantissant l'isolation — et au §7 : étapes, vérifications,
> conditions de sécurité.

---

## 0. La contrainte qui a façonné cette procédure

> *« Les clés et mots de passe devront être configurés directement dans un
> environnement sécurisé, jamais dans un rapport ou dans le code. »*

**Cette procédure est conçue pour qu'aucune clé ne me parvienne jamais.**
C'est une correction de ce que je vous avais proposé la veille, où je
demandais que les quatre clés me soient transmises. C'était une mauvaise
conception : un secret transmis est un secret exposé, et il n'y en avait
aucun besoin.

Le mécanisme qui le permet existe déjà — c'est `npm run verif:cible`, livré
hier. Il lit le fichier d'environnement et **n'imprime aucune valeur** : ni
clé, ni mot de passe, ni secret. Seuls sortent le mode, des hôtes publics, des
**noms** de variables et leur état « configuré / absent ». Quatre assertions
le vérifient en lui soumettant des secrets factices et en cherchant leur trace
dans la sortie.

Conséquence pratique, et c'est le cœur du dossier :

| Qui | Fait quoi | Voit les secrets |
| --- | --- | --- |
| **Vous** | créez le projet, écrivez les clés dans `.env.recette`, liez la CLI | **oui** |
| **Moi** | lis la sortie de `verif:cible` que vous me collez, et je guide | **non, jamais** |

Vous ne me collez qu'un rapport **conçu pour ne rien divulguer**. Si jamais
vous me transmettez une clé par inadvertance, considérez-la comme exposée et
régénérez-la : c'est la règle, et elle vaut aussi pour moi.

---

## 1. Les ressources à créer

| Ressource | Quantité | Qui la crée |
| --- | --- | --- |
| Projet Supabase dédié à la recette | 1 | **vous** |
| Fichier `.env.recette` sur votre poste | 1 | **vous** (gabarit fourni) |
| Clé de chiffrement propre à la recette | 1 | **vous** (`openssl rand -hex 32`) |
| Comptes de test fictifs | 6 | vous, par inscription dans l'application |
| Serveur, domaine, conteneur | **aucun** | — |

**Aucune ressource d'hébergement.** La recette tourne sur `localhost`. Ce
n'est pas une économie de moyens : un second service déployé serait une
seconde surface à protéger, pour un bénéfice nul tant qu'il s'agit de vérifier
des écrans.

### Le projet à créer

| Paramètre | Valeur recommandée | Pourquoi |
| --- | --- | --- |
| Nom | `CRM-CGK-recette` | qu'on ne puisse pas le confondre dans le tableau de bord |
| Organisation | **la même** que la production | sinon la place du plan gratuit ne compte pas |
| Région | `eu-west-1` (Irlande) | la même que la production : les latences observées en recette deviennent comparables |
| Version Postgres | la plus récente proposée | la production est en **17.6.1** ; une recette plus ancienne ne prouverait rien |
| Mot de passe de base | généré, **déposé dans votre coffre** | il ne doit figurer dans aucun fichier du dépôt |

⚠️ **Nommez-le explicitement « recette ».** Le tableau de bord Supabase
affiche les projets côte à côte, et le projet de production s'appelle
aujourd'hui *« devone75015's Project »* — un nom qui ne dit pas qu'il porte
687 leads réels. La confusion est un risque d'exploitation, pas une question
de confort.

---

## 2. Les coûts

| Poste | Coût attendu | Base |
| --- | --- | --- |
| Projet Supabase de recette | **0 €** | Le plan gratuit autorise **2 projets actifs** par organisation. Le second projet historique du dépôt (`zscnvebnizliyuwwchyt`) est **supprimé** — mesuré : son nom d'hôte ne résout plus. La place est donc a priori libre. |
| Contrepartie du plan gratuit | — | Un projet gratuit **se met en pause après 7 jours d'inactivité**. La recette se fera par salves : il faudra le réveiller depuis le tableau de bord. Sans incidence sur les données. |
| Brevo, SMTP | **0 €** | Aucun des deux transports n'est configuré. |
| Ringover | **0 €** | Non raccordé (pas de bac à sable chez l'éditeur). |
| DocuSign | **0 €** | Compte développeur gratuit, et seulement au Lot D. |
| Hébergement | **0 €** | `localhost`. |
| **Total attendu** | **0 €** | |

**À confirmer avant tout engagement** : les sources publiques **divergent** sur
le prix d'un projet supplémentaire au plan payant et sur le coût du
*branching*. Je ne retiens aucun chiffre ; la page officielle
`supabase.com/pricing` fait foi. Mon avis : le plan gratuit suffit, et le
*branching* est à écarter de toute façon — il **dérive du schéma de
production**, alors qu'on veut précisément éprouver les 177 migrations depuis
une base vide.

**Si la place du plan gratuit n'est pas libre** (un autre projet actif existe
dans l'organisation), deux options sans frais : mettre en pause le projet
inactif, ou créer le projet de recette dans une **autre organisation**
gratuite. Je recommande la seconde : elle isole aussi la facturation.

---

## 3. Les contrôles qui garantissent l'isolation

Dix mesures, et surtout : **comment chacune se vérifie**. Une mesure
d'isolation qu'on ne peut pas constater n'est pas une mesure, c'est une
intention.

| # | Mesure | Comment on la constate |
| --- | --- | --- |
| **I1** | La cible n'est pas la production | `npm run verif:cible` — ligne « Base visée » ≠ « Production connue » |
| **I2** | Le démarrage refuse une configuration dangereuse | `npm run dev` **refuse** et nomme la cause. Prouvé par exécution le 8 novembre : aucun processus survivant, aucune connexion servie |
| **I3** | Aucun des **deux** transports d'e-mail | `verif:cible` — « Brevo » et « SMTP (secours) » tous deux `absent` |
| **I4** | Aucun lien vers la production | `verif:cible` — « URL de signature » = `localhost:3000`, et « Domaines autorisés » ne contient pas `crmoptimum.com` |
| **I5** | Clé de chiffrement **différente** de la production | `verif:cible` — aucun grief `cle_production_detectee`. La détection se fait par **empreinte**, sans que la clé de production soit stockée nulle part |
| **I6** | Ringover et DocuSign non raccordés | `verif:cible` — les deux `absent` |
| **I7** | La CLI vise bien la recette | `verif:cible` — bloc « CLI Supabase », avec un avertissement explicite si le projet lié diffère de celui visé |
| **I8** | Aucune donnée de production copiée | Les semences ne contiennent **que** des adresses `@example.invalid` (47 vérifiées). Règle : aucun export de production, jamais |
| **I9** | La recette n'est pas exposée | `localhost` seulement. Pas de tunnel, pas de domaine, pas de reverse-proxy |
| **I10** | Aucun secret serveur dans le navigateur | `npm run check:bundle` — 0 fuite sur 113 fichiers |

**Les trois contrôles qui comptent le plus** : I2 (parce qu'il ne dépend pas
de l'attention humaine), I3 (parce que neutraliser Brevo seul **basculait**
l'envoi sur SMTP) et I4 (parce qu'un lien de signature de recette pointait sur
la production, et qu'aucune isolation de base de données n'arrête une fuite
par le lien).

### La vérification d'ensemble, en une commande

```bash
npm run verif:cible && npm run check:recette && npm run check:bundle
```

Les trois doivent sortir en **0**. La première refuse si la cible est
dangereuse ; la deuxième éprouve **191 contrôles** dont les refus de
configuration ; la troisième cherche 14 secrets dans le bundle navigateur.

---

## 4. La procédure, étape par étape

Les étapes marquées **[vous]** sont celles où un secret est manipulé : je n'y
participe pas.

### Étape 1 — créer le projet **[vous]**

Tableau de bord Supabase → New project, avec les paramètres du §1. Conserver
le mot de passe de base dans votre coffre à secrets.

### Étape 2 — écrire l'environnement **[vous]**

```bash
cp .env.recette.example .env.recette
```

Puis renseigner, dans votre éditeur : les 4 valeurs du projet, l'URL de la
production (ce n'est pas un secret), la clé de chiffrement de recette
(`openssl rand -hex 32`), l'empreinte de la clé de production (la commande est
dans le gabarit), et un secret de cron propre à la recette.

**Laisser vides** : `BREVO_API_KEY`, les six `SMTP_*`, `RINGOVER_API_KEY`, les
cinq `DOCUSIGN_*`. C'est l'isolation principale.

### Étape 3 — constater l'isolation **[vous, puis vous me collez la sortie]**

```bash
npm run verif:cible -- .env.recette
```

Sortie attendue : `VERDICT : cible acceptable.` Si elle refuse, elle nomme la
cause et le geste. **Collez-moi cette sortie** — elle ne contient aucun
secret, par conception.

### Étape 4 — basculer l'environnement actif **[vous]**

```bash
cp .env.local .env.production.sauvegarde   # hors du dépôt, à conserver
cp .env.recette .env.local
npm run verif:cible                        # doit sortir 0
```

### Étape 5 — lier la CLI **[vous]**

```bash
npx supabase login            # ouvre le navigateur
npx supabase link --project-ref <ref-de-la-recette>
```

**Cette étape vous revient**, et pas seulement par principe : la commande
**demande le mot de passe de la base de façon interactive**, et mon
environnement d'exécution est non interactif — la commande se bloquerait. Le
mot de passe n'est donc jamais saisi là où je pourrais le voir.

```bash
npm run verif:cible    # vérifier que le projet LIÉ est bien celui visé
```

⚠️ **C'est le moment le plus dangereux de toute la procédure.** Tant que
l'étape 5 n'est pas faite, la CLI est liée à la **production**, et
`supabase db reset --linked` détruit la base du projet lié. Aucune commande
`supabase` ne doit être lancée avant que `verif:cible` ait confirmé la cible.

### Étape 6 — appliquer les 177 migrations

```bash
npx supabase db push --dry-run      # ce qui serait appliqué
npx supabase db push --include-all  # l'application réelle
```

**C'est l'étape dont je ne peux pas prédire la durée.** Les migrations n'ont
jamais été rejouées depuis une base vide : 81 insèrent des données de
référence et collisionneraient sur une unicité si la ligne existe déjà, 9
réécrivent des données. `db push` enregistre les migrations réussies : une
reprise reprend où elle s'est arrêtée, à condition de corriger le fichier
fautif **sans le renuméroter**.

Je peux lancer cette étape et corriger au fur et à mesure — elle ne demande
aucun secret une fois la CLI liée.

### Étape 7 — charger les semences

`--include-seed` est **inerte** : il lit la semence « from your config », et il
n'y a pas de `config.toml`. Charger explicitement, dans l'ordre, par l'éditeur
SQL du tableau de bord :

1. `supabase/seed.sql` — lire le `raise notice` final, vérifier l'absence de
   `warning` sur les doublons de sociétés ;
2. `supabase/seed_bulk_demo.sql` — **après** l'étape 8, qui crée les comptes
   auxquels ses 25 leads se rattachent ;
3. `supabase/seed_test_data.sql`.

### Étape 8 — créer les comptes **[vous]**

Par inscription dans l'application, **l'administrateur en premier** : le
premier inscrit reçoit automatiquement le rôle `admin`
(`20260517000001_auth_user_setup.sql`). Puis les cinq autres, dans l'ordre du
§L6 du dossier d'audit. Les adresses sont en `@example.invalid` ; les mots de
passe restent chez vous.

### Étape 9 — les migrations en attente, **sur la recette seulement**

```bash
npx supabase db push    # applique M1 (20261108000001) et superviseur (20261105000001)
npx supabase gen types typescript --linked > lib/supabase/database.types.ts
```

La régénération des types ferme **D13** : les quatre colonnes du superviseur
cesseront d'être déclarées sans exister.

### Étape 10 — la sécurité

```bash
npm run check:recette && npm run build && npm run check:bundle
```

Puis les dix tests **S1 à S10** du dossier d'audit, dont la fuite RLS **par la
clé anon directement** — pas par l'interface, qui filtre déjà.

### Étape 11 — la recette fonctionnelle

Les **13 vérifications** de la partie C du registre, jamais faites dans une
session authentifiée, puis le catalogue de scénarios.

---

## 5. Conditions de sécurité

| # | Condition | Statut |
| --- | --- | --- |
| **S-1** | Aucun secret ne transite par un rapport, un message ou le dépôt | ✅ garanti par la conception (§0) |
| **S-2** | Aucune commande `supabase` avant confirmation de la cible | ⏳ discipline + `verif:cible`, sortie non nulle si refus |
| **S-3** | La production reste intacte : dénombrement des leads, dernier commit déployé, aucun e-mail parti | ⏳ à constater en fin de lot |
| **S-4** | Aucune donnée de production copiée en recette | ✅ règle ferme (RGPD) |
| **S-5** | La clé de chiffrement de recette diffère de celle de production | ✅ détecté par empreinte, refus au démarrage |
| **S-6** | Aucun envoi réel possible | ✅ les deux transports absents + goulet qui capture |
| **S-7** | Aucun lien de recette ne pointe sur la production | ✅ liste blanche + refus explicite |
| **S-8** | La recette n'est jamais exposée sur Internet | ⏳ règle d'exploitation |
| **S-9** | `.env.production.sauvegarde` conservé hors du dépôt | ⏳ à votre charge |
| **S-10** | Les comptes de test ne sont pas des personnes réelles | ✅ `@example.invalid`, RFC 2606 |

---

## 6. Conditions d'une future intégration continue

Demandé au §6 de votre message, en lien avec **E6** et **D16**.

### Les huit commandes existent déjà

```bash
npx tsc --noEmit        # AVANT le build — voir le piège ci-dessous
npm run lint
npm run check:devis
npm run check:docusign
npm run check:superviseur
npm run check:recette
npm run build
npm run check:bundle    # APRÈS le build : il a besoin de l'artefact
```

### ⚠️ L'ordre n'est pas indifférent — c'est le piège E6

`tsconfig.json` inclut **`.next/types/**/*.ts` et `.next/dev/types/**/*.ts`** :
du code **généré** par Next, pas le nôtre. Le 8 novembre, un `tsc` lancé après
plusieurs builds et deux démarrages de serveur de développement a échoué sur
`.next/types/validator.ts`, dans une déclaration que nous n'écrivons pas.

**Je n'ai pas réussi à le reproduire** : trois tentatives — build propre, deux
builds successifs, build après suppression du seul `validator.ts` — toutes
avec un `tsc` muet. L'anomalie passe donc en **partie F du registre, « non
reproductible »**, avec la trace de ces tentatives. C'est la première entrée
de cette partie.

**Les deux conditions qui la neutralisent** :

1. **`tsc` AVANT `build`**, jamais après ;
2. **`.next` propre** au début de chaque exécution (`rm -rf .next`), ce qu'un
   exécuteur de CI fait de toute façon sur un clone neuf.

Une CI respectant ces deux conditions n'y est pas exposée. Un développeur qui
enchaîne build et `tsc` dans le même répertoire de travail, lui, peut l'être.

### Ce que la CI devra aussi faire

| # | Exigence | Pourquoi |
| --- | --- | --- |
| 1 | `check:bundle` **obligatoire** | Le CDC §8.2 l'exige, et il n'existe aujourd'hui que les jours où on y pense |
| 2 | Échouer si **aucun** secret n'a pu être testé | Un contrôle qui ne peut pas échouer n'est pas un contrôle — `check:bundle` le fait déjà |
| 3 | Les secrets de la CI dans un coffre, jamais dans le fichier de workflow | Même règle que le §0 |
| 4 | Ne **jamais** exécuter `supabase db push` depuis la CI | Une CI qui peut migrer une base peut migrer la mauvaise |
| 5 | Garder la trace des décomptes de contrôles | 3 035 aujourd'hui ; une chute signale un contrôle supprimé plutôt que réparé |

**Je n'ai pas créé le fichier de workflow** : il relève de l'infrastructure, et
votre autorisation du 8 novembre exclut la création de ressources. Les
conditions sont ici ; le déclencheur attend votre décision.

---

## 7. Conditions de validation du Lot C

Inchangées depuis le dossier d'audit, avec leur état réel.

| # | Condition | État |
| --- | --- | --- |
| V1 | Les 177 migrations s'appliquent sur un projet vide, et la commande est rejouable | ❌ non — étape 6 |
| V2 | La semence se charge intégralement | 🟠 **corrigée mais non éprouvée** : les 13 clauses `on conflict` sont posées, aucune base ne les a encore reçues |
| V3 | Les six comptes couvrent les rôles | ❌ non — étape 8 |
| V4 | Aucune intégration sortante raccordée, preuve par son message de refus | 🟠 le mécanisme est en place et testé ; le **message** reste à voir à l'écran |
| V5 | Un `db push` ou `db reset` lancé par erreur ne peut pas atteindre la production | 🟠 `verif:cible` le **signale** ; il ne l'empêche pas. Seule l'étape 5 l'empêche |
| V6 | Les dix tests de sécurité passent, preuve consignée | 🟠 **1 sur 10** fait (S3 : 0 fuite sur 113 fichiers) |
| V7 | La production est intacte | ✅ à ce jour : aucune opération |
| V8 | La procédure est rejouable par quelqu'un d'autre que moi | ✅ ce document |

**2 sur 8 remplies.** C'est une étape de plus qu'hier, et le Lot C reste
ouvert. **Ce dossier est une procédure, pas un environnement.**

---

## 8. Ce que j'attends de vous

| # | Décision | Conséquence si elle tarde |
| --- | --- | --- |
| 1 | **Autoriser la création du projet** de recette (§1), ou me dire de l'attendre | Les étapes 1 à 11 restent bloquées |
| 2 | **Vérifier la place du plan gratuit** dans l'organisation de production | Détermine si le coût reste nul |
| 3 | **Lancer les deux commandes du §D11** sur le VPS (lecture seule) | D11 ne peut pas se fermer, et une hypothèse reste ouverte : que le cron n'ait jamais fonctionné |
| 4 | **Arbitrer la voie de rotation** de la clé (voie 1 ou voie 2, §D14) | D14 reste ouverte ; le risque est théorique mais indémontrable |
| 5 | **Autoriser la correction de `docs/CRON.md`** (Option A bis fausse) | Le runbook continue de prescrire une commande qui n'authentifie pas |
