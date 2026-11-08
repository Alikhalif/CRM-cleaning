# Lot C — Environnement de recette · rapport de faisabilité

> Rédigé le 8 novembre 2026, avant toute opération. **Aucune action n'a été
> menée sur la production pour établir ce document** : tout ce qui suit vient
> de la lecture du dépôt, de la structure des fichiers d'environnement, de
> l'aide de la CLI Supabase et d'une requête non authentifiée vers deux noms
> d'hôte. Aucune donnée n'a été lue, modifiée ni copiée.
>
> **Rien ne sera entrepris sans votre accord sur ce plan.**

## Pourquoi ce lot passe devant les autres

Trois lots ont été livrés — A, B, E — et **aucun n'a pu être essayé dans une
session authentifiée**. 2 801 contrôles automatisés passent, et ils ne
prouvent qu'une chose : le code dit ce qu'il doit dire. Ils n'ont jamais
ouvert un écran, cliqué sur un bouton, ni regardé un devis arriver.

Treize vérifications attendent en partie C du registre consolidé. Elles ne
peuvent pas commencer tant que l'application n'a pas une base où se tromper
sans conséquence.

---

## 1 · Ressources nécessaires

| Ressource | État | Remarque |
| --- | --- | --- |
| **Un projet Supabase distinct** | **à créer** | Le dépôt référence un second projet (`zscnvebnizliyuwwchyt`, commenté dans `.env.local` sous « compte 1 »). **Il est supprimé** : son nom d'hôte ne résout plus (NXDOMAIN), là où le projet actif répond HTTP 401. Il n'y a donc rien à récupérer. |
| **Une machine pour exécuter l'application** | disponible | Le poste local suffit : `npm run dev`. |
| **Une pile Supabase locale** | **impossible** | `docker` est absent du poste, et il n'y a pas de `supabase/config.toml`. L'option « tout en local » est écartée par constat, pas par préférence. |
| **Un jeu de données fictives** | **à réparer** | Les trois fichiers de semence existent (879 lignes, suivis par Git) mais ne se chargent pas en l'état — voir le point 6. |
| **Des comptes de test** | à créer | 6 comptes fictifs couvrant les rôles et les profils commerciaux. |
| **Une clé de chiffrement propre** | à générer | `openssl rand -hex 32`. **Jamais celle de la production.** |
| **Des comptes de bac à sable** | **inutiles** | Choix délibéré : en recette, on ne raccorde aucune intégration sortante. Voir la mesure I3. |

**Ce que je ne peux pas faire moi-même** : je n'ai ni accès SSH, ni Docker,
ni identifiants Supabase. Je ne peux à aucun moment opérer le VPS ni créer un
projet. Les étapes marquées « vous » ci-dessous sont des blocages réels, pas
des formalités.

---

## 2 · Accès requis

| # | Accès | Qui | Pour quoi |
| --- | --- | --- | --- |
| 1 | Tableau de bord Supabase | **vous** | Créer le projet de recette. Région : la même que la production (`eu-west-1`) pour que les latences observées soient comparables. |
| 2 | Les quatre valeurs du projet | **vous → moi** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| 3 | Mot de passe de la base du projet de recette | **vous → moi** | `supabase link` puis `db push` l'exigent |
| 4 | Création des comptes de test | **vous ou moi** | Par inscription dans l'application. Le **premier** inscrit reçoit automatiquement le rôle Super Admin (`20260517000001_auth_user_setup.sql`) : l'ordre d'inscription compte. |
| 5 | Rien sur le VPS | — | Aucun accès production n'est nécessaire à ce lot, et je n'en ai aucun. |

---

## 3 · Risques

Classés par gravité. Chacun est **constaté**, pas supposé.

| # | Risque | Constaté | Portée |
| --- | --- | --- | --- |
| **R1** 🔴 | **La CLI Supabase est liée à la production.** `supabase/.temp/project-ref` désigne le projet de production. Or `supabase db reset --linked` « resets the linked project » — c'est-à-dire **détruit et reconstruit** la base distante. Lancée aujourd'hui, cette commande effacerait les leads réels (687 au dernier dénombrement, le 4 novembre — chiffre repris d'une mesure antérieure, pas d'une lecture de ce jour). `db push` y appliquerait des migrations non validées. | `supabase/.temp/project-ref` + `supabase db reset --help` | Perte de données de production |
| **R2** 🔴 | **`.env.local` est le seul fichier d'environnement, et il pointe sur la production.** Next.js charge `.env.local` systématiquement : il n'existe aucune notion de profil. Basculer entre prod et recette revient à commenter et décommenter des lignes à la main — une erreur d'un caractère suffit à écrire en production. | Structure de `.env.local` | Écriture en production |
| **R3** 🔴 | **Les intégrations sortantes sont raccordées au réel.** `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `RINGOVER_API_KEY` et les cinq variables DocuSign sont actives. Un essai local qui clique « Envoyer » expédie **un vrai e-mail au vrai destinataire**. Aucun garde-fou d'environnement n'existe dans `lib/brevo.ts` : la seule condition est la présence de la clé. | `.env.local` + `lib/brevo.ts` | Contact involontaire de clients réels |
| **R4** 🔴 | **La clé de chiffrement de production est en clair sur le poste**, recopiée en commentaire dans `.env.local` avec le nom d'hôte du serveur et la commande qui l'a extraite. | Lecture de `.env.local` | Lisibilité des champs confidentiels de production |
| **R5** 🟠 | **Copier des données de production en recette serait un manquement RGPD.** 687 leads réels, des annotations confidentielles, des provenances marketing. | Mémoire de projet + registre | Conformité |
| **R6** 🟠 | **En mode développement, les webhooks acceptent les requêtes non signées** quand le secret est absent. Six gardes `NODE_ENV === "production"` font ce choix, documenté et volontaire en local. Une recette exposée sur Internet serait un point d'entrée ouvert. | Six occurrences mesurées dans `app/api/` | Intrusion si exposition |
| **R7** 🟠 | **176 migrations n'ont jamais été rejouées depuis zéro.** 90 d'entre elles contiennent un `insert` : ce sont les fragiles. Personne ne sait si la série s'applique à une base vide. | Comptage sur `supabase/migrations/` | Le Lot C peut durer plus que prévu |
| **R8** ⚪ | **Un projet Supabase gratuit se met en pause après 7 jours d'inactivité.** La recette se fera par salves : il faudra le réveiller. | Documentation Supabase | Confort |

**Bonne nouvelle mesurée** : aucune migration ne résout un utilisateur par
adresse e-mail (0 occurrence). Aucune ne se taira donc silencieusement sur un
projet neuf pour cette raison. Et les buckets de stockage sont créés **par
migration** (six fichiers touchent `storage.buckets`) : un projet neuf les
obtient sans intervention.

---

## 4 · Coûts

| Poste | Coût | Base |
| --- | --- | --- |
| **Projet Supabase de recette** | **0 €** si le plan gratuit a encore une place | Le plan gratuit autorise **deux projets actifs** par organisation. Le second projet historique étant supprimé, la place est a priori libre. Contrepartie : pause après 7 jours d'inactivité. |
| Passage au plan payant | **à confirmer** | Les sources publiques **divergent** sur le prix d'un projet supplémentaire et sur le coût du *branching* Supabase. Je ne retiens aucun chiffre : **à lire sur `supabase.com/pricing` avant tout engagement.** Mon avis : inutile pour ce lot — le plan gratuit suffit à une recette fonctionnelle. |
| Brevo | **0 €** | On ne configure pas la clé. |
| DocuSign | **0 €** | Compte développeur gratuit ; la production tourne déjà en `demo`. |
| Ringover | **0 €** | Pas de bac à sable : non raccordé. |
| VPS | **0 €** | Aucun serveur supplémentaire. La recette tourne en local. |

**Coût attendu du Lot C : nul en argent.** Le coût est en temps, et il est
concentré sur l'étape 3 (le rejeu des 176 migrations), dont la durée dépend
de ce qu'elle révélera.

---

## 5 · Mesures d'isolation de la production

C'est le cœur du lot. Huit mesures, dans l'ordre où elles doivent être posées.

| # | Mesure | Nature |
| --- | --- | --- |
| **I1** | **Rendre la cible visible avant toute commande.** Un script `npm run db:cible` qui imprime le projet lié et refuse de continuer si ce n'est pas celui attendu. Tant qu'il n'existe pas : je vous annonce la cible avant chaque commande `supabase`, sans exception. | développement + discipline |
| **I2** | **Deux fichiers d'environnement nommés**, hors du dépôt : `.env.production.sauvegarde` et `.env.recette`. `.env.local` devient une copie explicite de l'un des deux, jamais un fichier qu'on édite à la main. | organisation |
| **I3** | **Un garde-fou au démarrage** : si `CGK_ENV=recette` et que l'URL Supabase est celle de la production, l'application **refuse de démarrer** en nommant la cause. L'inverse aussi. Une protection qui dépend de l'attention humaine n'en est pas une. | développement |
| **I4** | **Aucune intégration sortante en recette.** `BREVO_API_KEY`, `RINGOVER_*` et `DOCUSIGN_*` restent **absentes**. Mesuré : chaque intégration refuse alors proprement, avec un message qui nomme ce qui manque — rien d'autre n'est dégradé. C'est plus sûr qu'un bac à sable, parce qu'il n'y a rien à mal configurer. | configuration |
| **I5** | **Une clé de chiffrement propre à la recette.** Conséquence voulue : la recette **ne peut pas** déchiffrer un champ de production, même si on y copiait des données par erreur. | configuration |
| **I6** | **Aucune donnée de production copiée.** Semence fictive uniquement. Non négociable (RGPD). | règle |
| **I7** | **Retirer la clé de production du commentaire de `.env.local`** et la conserver là où vous conservez vos secrets. | hygiène |
| **I8** | **La recette n'est jamais exposée.** `localhost:3000` seulement, pas de tunnel, pas de domaine. Tant que c'est vrai, le risque R6 (webhooks non signés en dev) n'a pas de surface. | règle |

---

## 6 · Migrations à prévoir

### Ce qui va bien

- Le schéma initial est complet (`20260515000001` à `20260515000005` :
  énumérations, tables, index, fonctions, RLS).
- Les buckets de stockage sont créés par migration.
- Aucune migration ne dépend d'un utilisateur résolu par e-mail.

### Ce qui bloquera

| # | Blocage | Mesure |
| --- | --- | --- |
| **D7** 🔴 | **`seed.sql` ne peut pas se charger sur un projet neuf.** Il compte 14 `insert` et **un seul** `on conflict`. Son insertion des activités (ligne 9) n'en a pas, alors que cinq migrations de secteur ont déjà créé `debarras`, `demenagement`, `diogene`, `nettoyage_difficile` et `transport`. Trois collisions sur une colonne unique → le chargement s'arrête à la première. | Comptage |
| | **`seed.sql` ne connaît que 7 des 9 activités** : `nettoyage_difficile` et `transport` lui manquent. Ils viennent des migrations — donc l'ordre est seul garant de la cohérence. | Vérification slug par slug |
| **D8** 🟠 | **`seed_bulk_demo.sql` rattache ses 25 leads à deux adresses Gmail réelles de l'équipe.** Sur un projet neuf ces comptes n'existent pas : les leads se créent sans propriétaire, ou la semence échoue. | Lecture du fichier |
| | **`--include-seed` est inerte** : il lit la semence « from your config », et il n'y a pas de `config.toml`. La semence devra être chargée explicitement (éditeur SQL ou `psql`). | `supabase db push --help` |
| **H1** 🔴 | **La migration M1 n'existe pas comme fichier.** Le SQL de `document_versions` vit dans `docs/MIGRATION-M1-HISTORIQUE-DEVIS.md`, hors de `supabase/migrations/`. Tant qu'il n'est pas un fichier numéroté, il ne sera jamais appliqué par `db push`, ni sur la recette ni ailleurs. | Listage du répertoire |

### Migrations non appliquées à ce jour

| Migration | État |
| --- | --- |
| `20261105000001_superviseur_perimetre_ferme.sql` | écrite, **non appliquée** (Lot 1 du module superviseur) |
| M1 — `document_versions` | **pas encore un fichier de migration** |

La recette est l'endroit où les appliquer **d'abord**. C'est tout l'intérêt
du lot : une migration qui n'a jamais tourné nulle part ne devrait pas avoir
la production pour première cible.

---

## 7 · Étapes de mise en place

| # | Étape | Qui | Sortie attendue |
| --- | --- | --- | --- |
| **0** | Créer le projet Supabase de recette, région `eu-west-1`. Transmettre les 4 clés + le mot de passe de base. | **vous** | un projet vide |
| **1** | Poser l'isolation **avant** d'écrire la moindre ligne de données : `.env.recette`, sauvegarde de l'environnement de production, garde-fou de démarrage (I3), script d'annonce de cible (I1), retrait de la clé en commentaire (I7). | moi | la production devient inatteignable par erreur |
| **2** | Réparer la semence : `on conflict` sur les 13 `insert` non protégés, les 9 activités, des comptes fictifs à la place des deux adresses réelles. Créer la migration M1 à partir de son document. | moi | semence rejouable |
| **3** | `supabase link` vers la recette, puis `db push --dry-run`, puis l'application réelle des 176 migrations. **Constater les échecs, corriger, recommencer.** | moi | une base vide devenue le schéma du CRM |
| **4** | Charger la semence, puis vérifier le dénombrement par table. | moi | un CRM utilisable |
| **5** | Créer les comptes de test par inscription, **en commençant par l'administrateur** (le premier inscrit reçoit Super Admin). Attribuer les rôles et profils. | vous + moi | 6 comptes couvrant les rôles |
| **6** | Exécuter les dix tests de sécurité du point 8, chacun avec sa preuve. | moi | un rapport de sécurité |
| **7** | Dérouler la partie C du registre : les 13 vérifications jamais faites. | nous | la première recette fonctionnelle du projet |

L'étape 3 est la seule dont je ne peux pas prédire la durée. 176 migrations
jamais rejouées depuis zéro, dont 90 porteuses de données : l'honnêteté
consiste à dire que ce qu'elles cachent se découvrira en les appliquant.

---

## 8 · Tests de sécurité

Chacun doit produire une **preuve**, pas une impression.

| # | Test | Méthode | Attendu |
| --- | --- | --- | --- |
| **S1** | Fuite RLS entre commerciaux | Requête directe avec la **clé anon** du compte A sur un lead du compte B — pas par l'interface, qui filtre déjà | 0 ligne |
| **S2** | Confidentialité de la provenance | Lecture d'un lead par un commercial : `source_url`, `utm_*`, `gclid` | invisibles |
| **S3** | Clé service-role dans le bundle | Recherche de la clé dans `.next/` après `npm run build` | 0 occurrence |
| **S4** | URLs signées | TTL des URLs de `lead-media` et `signed-documents` ; état public/privé des buckets | ≤ 60 min, aucun bucket public |
| **S5** | Webhooks | Requête non signée, **secret défini** | refusée · et constat écrit qu'en dev sans secret elle passe |
| **S6** | Cloisonnement des modules | URL d'un module hors périmètre, compte commercial | **404**, pas « interdit » |
| **S7** | Chiffrement *fail-closed* | Démarrage sans `FIELD_ENCRYPTION_KEY` sur un champ confidentiel | refus, pas d'écriture en clair |
| **S8** | Superviseur en Option A | Périmètre vide | **rien** n'est visible (inverse du reste du CRM) |
| **S9** | Numérotation sans trou | Double-clic et appels concurrents sur l'émission | un seul numéro, aucune série trouée |
| **S10** | Mélange d'identités | Un devis réellement **émis** par société, les cinq pays | aucune identité d'une autre société, y compris dans la couche texte |

---

## 9 · Conditions de validation du Lot C

Le lot est validé quand **les huit** sont vraies et prouvées.

| # | Condition |
| --- | --- |
| **V1** | Les 176 migrations s'appliquent sur un projet vide, sans intervention manuelle, et la commande est **rejouable** sur un autre projet neuf. |
| **V2** | La semence se charge **intégralement** et produit un CRM utilisable : leads, devis, dossiers, sociétés, prestations, intervenants. |
| **V3** | Les six comptes couvrent les rôles et les profils commerciaux, et chacun ouvre l'application. |
| **V4** | Aucune intégration sortante n'est raccordée — preuve par le **message de refus** de chacune. |
| **V5** | Un `db push` ou un `db reset` lancé par erreur **ne peut pas** atteindre la production. Démontré, pas annoncé. |
| **V6** | Les dix tests de sécurité passent, chacun avec sa preuve consignée. |
| **V7** | **La production est intacte** : même dénombrement de leads, même commit déployé, aucun e-mail parti, aucune migration appliquée. |
| **V8** | La procédure est écrite dans `docs/` et **rejouable par quelqu'un d'autre que moi**. |

---

## Fonctionnalités existantes non reprises dans le nouveau prompt

Rubrique demandée le 8 novembre 2026. Elle existe pour qu'une fonctionnalité
développée ne disparaisse pas faute d'avoir été mentionnée.

Le prompt du Lot C porte sur l'environnement de recette. Il ne mentionne pas
les fonctionnalités suivantes, **qui existent, qui restent en place, et que
la recette devra couvrir** :

| Fonctionnalité | Lot d'origine | Pourquoi elle compte ici |
| --- | --- | --- |
| **Garde d'identité à trois crans** | B | Elle **refuse** une émission au cran 1. La recette doit vérifier qu'elle refuse pour de bon, et sans consommer de numéro. |
| **Réglage des gabarits par société et activité** | B | Un écran de Réglages jamais ouvert. Sans lui, une société reste sur le gabarit d'origine (voir G3). |
| **Pages de suite paginées du descriptif** | B | Née d'une troncature qui faisait disparaître les réserves. À revoir à l'écran et à l'impression. |
| **Projection terminologique québécoise** | B | « Soumission » au Québec. Vérifiable seulement sur un devis réellement émis. |
| **Mention des produits par pays, activée par société** | A + B | **Aucune valeur par défaut, volontairement.** Tant qu'elle n'est pas saisie société par société, elle n'apparaît sur aucun devis. Action en attente depuis le 6 novembre. |
| **Fenêtre de visualisation partagée** | E | Trois écrans concernés. |
| **Historique des versions (M1)** | E | Codé, branché à quatre origines, **n'enregistre rien** tant que la migration n'existe pas. |
| **Préremplissage depuis un dossier** | E | Le troisième parcours de création. |
| **Module superviseur, Lot 1** | antérieur | Migration `20261105000001` **non appliquée**. L'Option A est *fermée par défaut* — l'inverse du reste du CRM : à éprouver, car une erreur y est silencieuse. |
| **Sous-traitants, documents & contrats, médias par dossier** | antérieurs | Modules complets jamais vus dans une session authentifiée. |
| **Présence, actions commerciales, relances (cron)** | antérieur | Le moteur ne tourne que si `/api/presence/evaluate` est appelé toutes les 1–2 min. En recette, il faudra le déclencher. |
| **Ringover (webphone, SMS) et DocuSign** | antérieurs | **Volontairement non raccordés** en recette (mesure I4). Leur recette réelle demandera une décision séparée. |
| **Cloisonnement du commercial — la signature est la frontière** | antérieur | Test S6. C'est la règle d'accès la plus structurante du CRM. |
| **Chiffrement applicatif des champs confidentiels** | antérieur | Test S7. Trois annotations et 71 provenances sont encore en clair en production — hors périmètre du Lot C, mais à ne pas perdre de vue. |

**Aucune de ces fonctionnalités ne sera retirée, contournée ni dégradée pour
faciliter le Lot C.**

---

## Traçabilité

| Demande initiale | Origine | Fonctionnalité | Emplacement | Dépendances | Test | Résultat | Preuve |
| --- | --- | --- | --- | --- | --- | --- | --- |
| « Conserver une traçabilité des anomalies critiques corrigées » | client, 2026-11-08 | Registre en quatre états, règle de tenue inversée | `docs/REGISTRE-CORRECTIONS-FINALES.md` | — | relecture + comptage | 🟢 21 ouvertes · 21 corrigées · 13 à vérifier · 7 recommandations | le document |
| « Conserver les quatre points du Lot E » | client, 2026-11-08 | H1, H2 en partie A ; H3, H4 en partie D | idem | — | relecture | 🟢 conservés, identifiants inchangés | le document |
| « Présente-moi les 9 points avant toute opération » | client, 2026-11-08 | Ce rapport de faisabilité | `docs/LOT-C-ENVIRONNEMENT-RECETTE.md` | accord client | mesures du point 3 | 🟢 remis | les constats datés |
| « Rubrique : fonctionnalités existantes non reprises » | client, 2026-11-08 | Rubrique ci-dessus, 14 entrées | idem | — | rapprochement des lots A/B/E et des modules antérieurs | 🟢 | les lots d'origine cités |
| « N'effectue aucune opération sur la production » | client, 2026-11-08 | Aucune | — | — | journal des commandes de cette séance | 🟢 aucune commande n'a visé un projet Supabase ; une requête **non authentifiée** a servi à constater la suppression d'un projet tiers | sorties de commande |

---

## Décisions qui vous appartiennent

1. **Créer le projet de recette** — c'est le seul vrai blocage. Sans lui, le
   Lot C ne commence pas.
2. **Autoriser les deux développements d'isolation** (I1 le script de cible,
   I3 le garde-fou de démarrage). Ce sont des développements, donc hors du
   périmètre autorisé aujourd'hui ; ils sont aussi la condition pour que les
   suivants soient sans danger.
3. **Autoriser la réparation de la semence** et la création de la migration M1
   comme fichier — sans application nulle part à ce stade.
4. **Confirmer que la production reste hors périmètre** du lot entier, y
   compris pour la migration superviseur et M1, qui seront appliquées
   **d'abord et seulement** sur la recette.
