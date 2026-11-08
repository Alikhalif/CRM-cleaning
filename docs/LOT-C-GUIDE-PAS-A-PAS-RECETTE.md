# Lot C — Guide pas à pas : créer l'environnement de recette

> 8 novembre 2026. **Rien n'a été créé.** Ce guide est la suite opérationnelle
> du [dossier de création](LOT-C-DOSSIER-CREATION-RECETTE.md), qui en porte la
> justification. Celui-ci se suit, étape par étape.
>
> **Il est écrit pour qu'aucun secret ne me soit transmis.** À chaque étape,
> la colonne « ce que vous m'envoyez » dit exactement quoi — et c'est toujours
> une sortie conçue pour ne rien divulguer.

---

## Avant de commencer : ce que vous aurez besoin d'ouvrir

| Quoi | Pourquoi |
| --- | --- |
| Le tableau de bord Supabase | créer le projet, lire les 4 valeurs |
| Un terminal, dans le dossier du CRM | lancer les vérifications |
| Votre gestionnaire de secrets | y déposer le mot de passe de base et la clé de recette |

**Durée réaliste** : 20 à 30 minutes pour les étapes 0 à 5. L'étape 6 (les 177
migrations) est la seule dont je ne peux pas prédire la durée.

---

# PHASE 1 — Les vérifications préalables (avant toute création)

## Étape 0 — Vérifier la disponibilité du plan gratuit

C'est la condition que vous avez posée. Trois choses à regarder, dans cet
ordre.

### 0.a — Combien de projets actifs dans l'organisation ?

Tableau de bord Supabase → sélecteur d'organisation en haut → la liste des
projets s'affiche.

**Comptez les projets qui ne sont pas en pause.** Le plan gratuit en autorise
**deux actifs**.

| Ce que vous comptez | Conclusion |
| --- | --- |
| **1 projet actif** (la production seule) | ✅ La place est libre. Coût : **0 €**. |
| **2 projets actifs** | Le second est-il encore utile ? S'il ne sert plus, le **mettre en pause** libère la place (les données sont conservées). |
| **2 actifs, tous deux utiles** | Créer le projet de recette dans une **autre organisation** gratuite. C'est sans frais, et cela isole aussi la facturation. |

### 0.b — Quel plan porte l'organisation ?

Organisation → `Billing` (ou `Facturation`). Cherchez le plan courant.

| Plan affiché | Ce que cela veut dire |
| --- | --- |
| `Free` | Rien à payer. La limite des 2 projets actifs s'applique. |
| `Pro` ou supérieur | Un projet de plus peut avoir un coût de calcul. **Lisez la page d'estimation avant de créer** (point 0.c). |

### 0.c — L'estimation de coût, avant de valider

Au moment de créer le projet, Supabase affiche une estimation. **Ne validez
pas sans l'avoir lue.** Si elle affiche autre chose que `$0`, arrêtez-vous et
dites-le moi : il y a alors une décision à prendre, pas une procédure à
suivre.

> ⚠️ Je ne retiens aucun chiffre de prix dans ce guide. Les sources publiques
> **divergent** sur le coût d'un projet supplémentaire, et la page officielle
> de Supabase est la seule qui fasse foi au moment où vous cliquez.

### Ce que vous m'envoyez

> « Organisation en plan **Free** / **Pro**, **N** projet(s) actif(s),
> estimation affichée : **$X** »

Trois informations, aucun secret.

---

# PHASE 2 — La création

## Étape 1 — Créer le projet

Tableau de bord → `New project`.

| Champ | Valeur | Pourquoi |
| --- | --- | --- |
| **Name** | `CRM-CGK-recette` | Le projet de production s'appelle aujourd'hui *« devone75015's Project »* — un nom qui ne dit pas qu'il porte 687 leads réels. Les deux seront côte à côte dans la liste : la confusion est un risque d'exploitation. |
| **Organization** | celle décidée à l'étape 0 | |
| **Region** | `West EU (Ireland)` / `eu-west-1` | La même que la production : les latences observées en recette deviennent comparables. |
| **Database password** | `Generate a password` | **Puis déposez-le immédiatement dans votre gestionnaire de secrets.** Il ne se réaffiche pas. |
| **Postgres version** | la plus récente proposée | La production est en **17.6.1** : une recette plus ancienne ne prouverait rien. |

Puis `Create new project`, et attendez que l'indicateur passe au vert
(1 à 3 minutes).

### Ce que vous m'envoyez

> « Projet créé, référence : `xxxxxxxxxxxxxxxxxxxx` »

**La référence du projet n'est pas un secret** — c'est le sous-domaine public
de son URL. J'en ai besoin pour vous guider et pour que `verif:cible` puisse
comparer la cible à la production.

---

## Étape 2 — Récupérer les quatre valeurs, et les écrire directement

Projet de recette → `Project Settings` → `API`.

Vous y trouvez :

| Sur l'écran | Va dans |
| --- | --- |
| `Project URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` / `secret` | `SUPABASE_SERVICE_ROLE_KEY` |
| `publishable` (si présente) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

Dans le terminal, à la racine du CRM :

```bash
cp .env.recette.example .env.recette
```

Puis **ouvrez `.env.recette` dans votre éditeur** et collez les valeurs.

> ⚠️ **La clé `service_role` contourne la RLS.** Elle a le même pouvoir que
> celle de production sur sa propre base. Collez-la dans le fichier, nulle
> part ailleurs — pas dans un message, pas dans un ticket, pas dans un
> presse-papier partagé.

### Les cinq valeurs à produire vous-même

```bash
# 1. La clé de chiffrement de la RECETTE — jamais celle de production
openssl rand -hex 32

# 2. L'empreinte de la clé de PRODUCTION, pour que le garde-fou la refuse ici.
#    Non réversible : ce n'est pas un secret. 12 caractères attendus.
#    Remplacez <CLE_DE_PRODUCTION> par sa valeur, et effacez ensuite la ligne
#    de votre historique de shell.
node -e "console.log(require('node:crypto').createHash('sha256').update(process.argv[1]).digest('hex').slice(0,12))" "<CLE_DE_PRODUCTION>"

# 3. Un secret de cron propre à la recette
openssl rand -hex 24

# 4. Un secret de webhook propre à la recette
openssl rand -hex 24
```

Et la cinquième, qui n'est pas un secret : `CGK_SUPABASE_URL_PRODUCTION`,
c'est-à-dire l'URL du projet de **production**.

> ⚠️ **Ne confondez pas deux empreintes qui se ressemblent.** Il y en a deux
> dans le CRM, et elles ne sont pas interchangeables :
>
> | | `CGK_EMPREINTE_CLE_PRODUCTION` | le `kid` du chiffrement |
> | --- | --- | --- |
> | Longueur | **12** caractères | **8** caractères |
> | Calculée sur | la **chaîne** telle qu'elle est écrite dans l'environnement | les **32 octets** décodés de la clé |
> | Sert à | refuser la clé de production en recette (garde-fou de démarrage) | dire quelle clé a scellé une valeur (rotation) |
> | Qui la produit | **vous**, avec la commande ci-dessus | le code, automatiquement |
>
> Celle que vous avez à calculer est la **première**, 12 caractères. Le `kid`
> n'est jamais saisi à la main.

### Laissez VIDES — c'est l'isolation principale

```
BREVO_API_KEY=
SMTP_HOST=            SMTP_USER=            SMTP_PASS=
DEVIS_EMAIL_TRANSPORT=
RINGOVER_API_KEY=
DOCUSIGN_CLIENT_ID=   DOCUSIGN_CLIENT_SECRET=
```

Il y a **deux** transports d'e-mail dans ce CRM, et neutraliser le premier
basculait l'envoi sur le second. Les deux doivent rester vides.

---

## Étape 3 — Constater l'isolation (la seule sortie que vous me collez)

```bash
npm run verif:cible -- .env.recette
```

**Sortie attendue** : `VERDICT : cible acceptable.`

Si elle refuse, elle nomme le grief **et le geste qui le lève**. Les refus les
plus probables :

| Grief | Ce qu'il manque |
| --- | --- |
| `base_production` | L'URL collée est celle de la production. À reprendre. |
| `url_signature_absente` | `SIGNATURE_BASE_URL=http://localhost:3000` |
| `domaines_non_declares` | `CGK_DOMAINES_PUBLICS=localhost:3000` |
| `brevo_actif` / `smtp_actif` / `ringover_actif` | Une clé d'envoi est restée renseignée. |
| `cle_production_detectee` | 🔴 La clé de chiffrement collée **est** celle de production. Régénérez-en une. |
| `production_non_declaree` | `CGK_SUPABASE_URL_PRODUCTION` manque (avertissement seulement). |

### Ce que vous m'envoyez

**Toute la sortie, telle quelle.** Elle n'imprime aucune valeur : seuls le
mode, des hôtes publics, des **noms** de variables et leur état
« CONFIGURÉ / absent ». Quatre assertions le vérifient en lui soumettant des
secrets factices et en cherchant leur trace dans la sortie.

C'est ce rapport qui me permet de vous accompagner **sans jamais voir un
secret**.

---

## Étape 4 — Basculer l'environnement actif

```bash
cp .env.local .env.production.sauvegarde   # À DÉPLACER hors du dépôt ensuite
cp .env.recette .env.local
npm run verif:cible                        # doit sortir « cible acceptable »
```

> ⚠️ `.env.production.sauvegarde` contient les clés de production. **Déplacez-le
> hors du dossier du projet** dès que la copie est faite. Il est ignoré par
> Git, mais un fichier de secrets qui traîne dans un répertoire de travail
> finit par être copié, compressé ou partagé.

Vérification que le garde-fou fonctionne :

```bash
npm run dev
```

Attendu : le serveur **démarre**, et affiche `Mode recette · cible acceptable.`
S'il refuse, il dit pourquoi — et c'est exactement son rôle.

---

## Étape 5 — Lier la CLI à la recette

**Cette étape vous revient, et pas seulement par principe** : la commande
demande le mot de passe de la base **de façon interactive**, et mon
environnement d'exécution est non interactif — la commande se bloquerait chez
moi. Le mot de passe n'est donc jamais saisi là où je pourrais le voir.

```bash
npx supabase login                                  # ouvre le navigateur
npx supabase link --project-ref <ref-de-la-recette> # demande le mot de passe
npm run verif:cible
```

Dans la sortie, vérifiez le bloc **CLI Supabase** :

```
CLI Supabase
  projet lié      : <ref-de-la-recette>  « CRM-CGK-recette »
```

S'il affiche encore la référence de production, ou l'avertissement
« le projet LIÉ à la CLI n'est PAS celui que l'application vise », **arrêtez
tout et dites-le moi**.

> 🔴 **C'est le moment le plus dangereux de la procédure.** Tant que l'étape 5
> n'est pas faite, la CLI reste liée à la **production**, et
> `supabase db reset --linked` détruit la base du projet lié. Aucune commande
> `supabase` ne doit être lancée avant que cette vérification soit passée.

### Ce que vous m'envoyez

> La sortie de `npm run verif:cible`, bloc « CLI Supabase » compris.

À partir de là, je peux prendre la main sur les étapes 6 et suivantes.

---

# PHASE 3 — Ce que je fais ensuite (après votre feu vert)

| Étape | Ce que je fais | Ce qui pourrait échouer |
| --- | --- | --- |
| **6** | Appliquer les 177 migrations (`db push --dry-run` puis réel) | 81 insèrent des données de référence et peuvent collisionner ; 9 réécrivent des données. Je corrige et relance ; `db push` reprend où il s'est arrêté. |
| **7** | Charger les trois semences, lire le diagnostic final | Un `warning` sur les doublons de sociétés signalerait un double chargement. |
| **8** | *(vous)* Créer les 6 comptes par inscription, **l'administrateur en premier** | Le premier inscrit reçoit `admin` automatiquement : l'ordre compte. |
| **9** | Appliquer M1 et la migration superviseur, **sur la recette seulement**, puis régénérer les types | Ferme D13. |
| **10** | Les dix tests de sécurité S1 à S10 | Dont la fuite RLS **par la clé anon directement**, pas par l'interface qui filtre déjà. |
| **11** | Les 13 vérifications de la partie C du registre | La première recette fonctionnelle du projet. |

---

# Ce qui peut mal tourner, et quoi faire

| Symptôme | Cause probable | Quoi faire |
| --- | --- | --- |
| `npm run dev` refuse de démarrer | une clé d'envoi est restée, ou `SIGNATURE_BASE_URL` manque | Lire le grief : il nomme la variable. |
| `verif:cible` dit `base_production` | l'URL de production a été collée | Reprendre l'URL dans `Project Settings → API` du projet de **recette**. |
| `verif:cible` dit `cle_production_detectee` | la clé de chiffrement de production a été réutilisée | 🔴 En générer une autre. Une recette portant cette clé peut déchiffrer des champs confidentiels réels. |
| `supabase link` échoue sur le mot de passe | mot de passe perdu | Le réinitialiser : `Project Settings → Database → Reset database password`. |
| Le projet est « paused » au retour | 7 jours d'inactivité sur le plan gratuit | Le réveiller depuis le tableau de bord. Aucune donnée perdue. |
| `db push` s'arrête sur une migration | une donnée de référence existe déjà | Normal et attendu. Je corrige le fichier **sans le renuméroter**, et relance. |
| Un écran affiche « mention non activée » | la couche par société n'est pas configurée | C'est le comportement voulu : `Réglages › Intégrations`, cocher société par société. |

---

# Les deux règles qui ne se négocient pas

1. **Aucun secret ne me parvient.** Vous ne me collez que des sorties de
   `verif:cible`. Si une clé m'arrive par inadvertance, considérez-la comme
   exposée et régénérez-la — la règle vaut aussi pour moi.
2. **Aucune commande `supabase` avant que `verif:cible` ait confirmé la
   cible.** `db reset --linked` détruit la base du projet lié, et jusqu'à
   l'étape 5 ce projet est la production.
