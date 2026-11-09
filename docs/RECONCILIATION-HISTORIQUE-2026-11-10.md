# Réconciliation de l'historique — 10 novembre 2026

> Enquête demandée après le rapport `dc1f05c`, cinq commits annoncés par des
> rapports antérieurs ne correspondant à rien de ce que je constate.
>
> **Aucune opération destructive. Aucune migration. Aucun push. Aucune donnée
> modifiée.** Tout ci-dessous est établi par mesure, et chaque mesure est
> nommée.

## La réponse, en une ligne

**Les cinq commits n'existent pas** — ni dans le dépôt local, ni dans sa base
d'objets complète, ni dans aucun reflog, ni sur GitHub. Et **aucun travail
n'est perdu** : il n'y a rien à retrouver, parce qu'il n'y a jamais rien eu à
cet endroit.

Ce n'est pas une divergence entre deux copies du dépôt. C'est un écart entre
**des rapports** et **un dépôt**.

---

# 1 · Le dépôt réellement utilisé

| | |
| --- | --- |
| Chemin | `C:/Users/dell/Documents/EOS_Marketing/ADS/Nettoyage-Project-2026/CRM/cleaning-crm` |
| `--git-dir` = `--git-common-dir` | `.git` — donc **pas** un worktree rattaché |
| Remote `origin` | `https://github.com/Alikhalif/CRM-cleaning.git` (fetch **et** push) |
| Worktrees | **un seul**, celui-ci |
| Autres copies sur le poste | **aucune** — recherche de `cleaning-crm*`, `CRM-cleaning*`, `crm-cleaning*` sous `C:/Users/dell` : **1 résultat**, ce dossier |
| Branche courante | `lot-b/unification-gabarits` |
| HEAD | `dc1f05c6fc8bcbc1102138d297c87a6eea1e2218` |

## L'état de la branche avant et après `dc1f05c`

| | Commit | Remarque |
| --- | --- | --- |
| Avant `dc1f05c` | **`326549c`** | identique à `origin/main` — le push précédent était un fast-forward |
| `dc1f05c` | 5 fichiers, +661 / −1 | l'audit numérotation et périmètres |
| Après | `dc1f05c` | **non poussé** : `origin/main` est toujours à `326549c` |

## ⚠️ Un décalage réel, trouvé en chemin

**La branche locale `main` est à `2dab6a2`, soit 17 commits en retard sur
`origin/main`.** Ce n'est pas une perte : les 17 commits sont bien sur
`origin/main`, poussés depuis `lot-b/unification-gabarits` en fast-forward.
Mais quiconque ferait `git checkout main` localement verrait un dépôt
**amputé de 17 commits**, et pourrait croire à une perte de travail.

**C'est probablement la source de confusion la plus plausible du côté du
dépôt**, et elle se corrige par un `git checkout main && git merge --ff-only
origin/main` — sans risque, mais j'attends votre accord puisqu'elle change la
branche courante.

## Les branches, toutes

| Branche | Commit | État |
| --- | --- | --- |
| `lot-b/unification-gabarits` ← **courante** | `dc1f05c` | 1 commit devant `origin/main` |
| `main` (locale) | `2dab6a2` | **17 commits en retard** |
| `lot-a/corrections-devis` | `f4cae59` | ancienne, contenu intégré |
| `feature/docusign-sandbox` | `d9f29e9` | ⚠️ **celle que le VPS déploie** |
| `feat/actions-relances-commerciales` | `f6c6ede` | ancienne |
| `feature/finish-crm-jul2026` | `046ba37` | ancienne |
| `origin/main` | **`326549c`** | la référence de publication |

Côté distant, **4 refs seulement** : `main`, `feature/docusign-sandbox`,
`feat/actions-relances-commerciales`, et `refs/pull/1/head`.

---

# 2 · Les commits retrouvés et introuvables

## Méthode — et pourquoi elle est concluante

Quatre recherches indépendantes, chacune capable de trouver un commit que les
autres manqueraient :

1. `git cat-file -e <sha>^{commit}` — l'objet existe-t-il ;
2. **la base d'objets entière**, `git cat-file --batch-all-objects` : **337
   commits**, y compris ceux qu'aucune branche ne référence ;
3. **tous les reflogs**, `git reflog --all` — ce qui retrouve un commit même
   après un `reset` ou une branche supprimée ;
4. **`git fsck --dangling`** — les objets orphelins ;
5. et **le dépôt distant**, `git fetch --dry-run origin <sha>`, qui interroge
   GitHub directement.

## Le résultat

| Commit annoncé | Local | Base d'objets (337) | Reflogs | GitHub |
| --- | --- | --- | --- | --- |
| `22f2a23` | ❌ | ❌ | ❌ | ❌ *not our ref* |
| `39d7552` | ❌ | ❌ | ❌ | ❌ *not our ref* |
| `7e7b1f8` | ❌ | ❌ | ❌ | ❌ *not our ref* |
| `0c86c7e` | ❌ | ❌ | ❌ | ❌ *not our ref* |
| `c3ba9b7` | ❌ | ❌ | ❌ | ❌ *not our ref* |
| `dc1f05c` | ✅ | ✅ | ✅ | non poussé |
| `326549c` | ✅ | ✅ | ✅ | ✅ = `origin/main` |

**Les deux seuls objets orphelins du dépôt sont de vieilles remises**
(`WIP on main: …` du 22 août, `On main: verif-prealable` du 6 novembre). Ce
n'est pas du travail perdu, et ce ne sont pas les commits cherchés.

**Le reflog est continu** du 7 au 9 novembre : aucune rupture, aucun
`reset --hard`, aucune réécriture. On peut suivre chaque commit un par un.

---

# 3 · L'origine des divergences

## Ce que j'ai mesuré, et comment

J'ai analysé **les 34 transcriptions de sessions Claude Code enregistrées sur
ce poste**, en distinguant pour chaque occurrence sa **nature** — votre prose,
ma prose, mon raisonnement, un appel d'outil, ou un résultat de commande.
Cette distinction est indispensable : Claude Code enregistre les résultats
d'outils sous le rôle `user`, et un décompte naïf m'aurait fait conclure que
vous aviez écrit ce qui n'était que la sortie de mes propres commandes.

## Le résultat

| Référence | Première apparition | Nature |
| --- | --- | --- |
| `22f2a23` | session courante, ligne 48970 | **votre message collé** — « *J'ai pris connaissance du rapport relatif au commit 22f2a23* » |
| `39d7552`, `7e7b1f8`, `0c86c7e`, `c3ba9b7` | session courante, ligne 49523 | **votre message collé** (celui-ci) |
| « 185 migrations » | session courante, ligne 49523 | **votre message collé** |
| « 109 anomalies » | session courante, ligne 49523 | **votre message collé** |
| D32 à D36 | session courante, ligne 48970 | **votre message collé** |

**Aucune de ces références n'apparaît dans aucune des 33 autres
transcriptions du poste.** Mes propres occurrences sont toutes
**postérieures** aux vôtres, et elles consistent à les citer — pour dire
qu'elles sont introuvables, ou dans la sortie des commandes de vérification.

## Et dans le dépôt lui-même

| Vérification | Résultat |
| --- | --- |
| « 109 entrées », « 109 anomalies » ou « 185 migrations » dans **tout l'historique git** de `docs/` | **jamais**, aucune version d'aucun fichier |
| D25 à D31 dans `docs/` | **absents partout** |
| D32 à D36 dans `docs/` | présents **uniquement** dans les documents que j'ai écrits le 9 novembre, où je **cite vos libellés** pour établir la correspondance |

## Les écarts de chiffres, expliqués

| Annoncé | Réel | Écart |
| --- | --- | --- |
| 185 migrations | **177** (comptées : `ls supabase/migrations/*.sql`) | −8 |
| 109 anomalies | **81** (comptées par programme, jamais à la main) | −28 |
| corrections D23 → D36 | **D23 et D24 existent**, créées par moi le 9 novembre ; **D25 à D36 n'ont jamais existé** | −12 |

⚠️ **Une coïncidence à ne pas surinterpréter** : D23 et D24 portent bien ces
numéros, mais parce que mon registre s'arrêtait à D22 et que j'ai pris les
deux suivants — pas parce qu'ils correspondraient à des D23/D24 annoncés
ailleurs.

## Les hypothèses, et ce que je peux en dire

Je constate d'où ces références **sont arrivées dans cette conversation**. Je
ne peux pas constater où elles ont été **produites** — cela se passe hors de
ce poste. Trois possibilités, que je ne hiérarchise pas :

1. **Un rapport produit sur un autre dépôt.** Les SHA seraient réels, mais
   d'un autre projet. Rien ici ne permet de le vérifier ni de l'exclure.
2. **Un rapport produit sans dépôt.** Un assistant — ou un outil — ayant
   rédigé un compte rendu plausible sans exécuter les commandes : les SHA
   auraient alors la bonne forme sans correspondre à rien. **Les commits
   refusés par GitHub comme *not our ref* sont compatibles avec cette
   hypothèse.**
3. **Une chaîne de rapports** où chaque étape a repris les chiffres de la
   précédente sans les recompter. Le premier de vos messages s'ouvre déjà sur
   « *le rapport relatif au commit 22f2a23* » : la référence y est **déjà
   présentée comme acquise**.

**Ce que je ne dis pas** : que vous auriez inventé ces chiffres. Vous me les
avez transmis comme vous les avez reçus, et vous avez eu raison de demander
la vérification plutôt que de les croire — ou de me croire.

**Ce que je dis** : qu'aucun de ces rapports ne peut être retenu comme preuve
de développement, et c'est exactement votre instruction. Un rapport n'est pas
un dépôt.

---

# 4 · Les fonctionnalités réellement présentes

| Annoncé | Commit annoncé | Présence réelle | Tests | Écart |
| --- | --- | --- | --- | --- |
| **185 migrations** | — | **177 fichiers SQL**, dernière `20261108000001` | `npm run preflight` les rejoue sur Postgres local | **−8 : les 8 manquantes n'ont jamais existé** |
| **109 anomalies** | — | **81 entrées** au registre, recomptées par programme | comptage programmatique dans le registre | **−28** |
| **D23 — numérotation `PUBLIC`** | `22f2a23`… | ✅ **présente**, créée par moi le 9 novembre (`dc1f05c`) | **52 assertions**, 14 mutations détectées | ⚠️ **non corrigée** : migration préparée, non appliquée |
| **D24 — données sans pays ni entité** | `22f2a23`… | ✅ **présente**, créée par moi le 9 novembre (`dc1f05c`) | audit des 78 tables | procédure spécifiée, **script non écrit** |
| **D25 à D31** | annoncés | ❌ **n'ont jamais existé** sous aucune forme | — | **rien à récupérer** |
| **D32 — activation progressive** | `22f2a23` | 🟠 **analysé** (`LOT-C-PERIMETRES…` §3) | — | **4 colonnes sur 8 sans source** : non réalisable en l'état |
| **D33 / D34 — numérotation** | `22f2a23` | ✅ **audité**, c'est mon D23 | 52 assertions | correction **préparée**, non appliquée |
| **D35 — bibliothèque sous-traitants** | `22f2a23` | 🟠 **analysé** (§2) ; module réel présent et cloisonné | 14 gardes sur 14 vérifiées | **rattachement multi-société inexistant** |
| **D36 — données sans rattachement** | `22f2a23` | ✅ **inventaire livré** (§1), c'est mon D24 | audit des 78 tables | procédure spécifiée, non exécutée |

## Et ce qui existe vraiment, lui

Pour que la comparaison soit juste, voici ce que le dépôt contient
**réellement** et qui est vérifiable commit par commit :

| | |
| --- | --- |
| Commits sur `origin/main` | **17** poussés les 8 et 9 novembre, de `2dab6a2` à `326549c` |
| Migrations | **177** |
| Contrôles automatisés | **3 341**, 0 échec — devis 1 480 · DocuSign 1 163 · superviseur 201 · recette 497 |
| Suites | 4 vérificateurs, **8 suites** pour `check:recette` |
| Documents | **30** fichiers dans `docs/`, chacun rattaché à un commit |

⚠️ **J'ai dû corriger ce total en l'écrivant** : j'avais d'abord annoncé
2 235, en sommant les lignes de bilan avec un motif trop strict qui en
manquait la moitié. Le comptage fiable est celui des assertions elles-mêmes.
C'est la même erreur de méthode que celle qui est à l'origine de toute cette
enquête — un chiffre repris sans être recompté.

---

# 5 · Les corrections absentes

**Aucune correction annoncée n'a été perdue**, puisqu'aucune n'a existé. Mais
voici ce qui reste **réellement** à faire, et qui est bloqué :

| # | Correction | État | Bloqué par |
| --- | --- | --- | --- |
| **D23** | `revoke` + `grant` sur 3 fonctions | **migration écrite**, hors du chemin de `db push` | votre autorisation + la recette |
| **D20** | politique RLS sur `subcontractor_profiles` | analysée, migration non écrite | votre autorisation |
| **D24** | rattachement pays / société | procédure spécifiée | la recette, et vos arbitrages sur les cas ambigus |
| **D35** | table `subcontractor_scopes` | conception proposée | votre accord sur la conception |
| **D32** | activation progressive | 4 colonnes sans source | dépend de D35 |
| **D21 / D22** | Clients et Certificat de hotte absents de la navigation | une ligne chacun | votre arbitrage sur leur place |
| Recette | l'environnement entier | **n'existe pas** | création du projet Supabase |

---

# 6 · Les anomalies consolidées

**81 entrées**, recomptées par programme — jamais à la main :

| Partie | Nombre |
| --- | --- |
| A — **ouvertes** | **27** |
| B — corrigées | 33 |
| C — à vérifier en recette | 13 |
| D — reportées | 7 |
| E — **validées en recette** | **0** |
| F — non reproductible | 1 |
| **Total** | **81** |

⚠️ **La partie E est à zéro, et c'est le chiffre le plus important du
tableau.** Rien n'a jamais été validé en recette, pour une raison simple : la
recette n'existe pas. Tous les ✅ de ce projet signifient « mesuré sur le code
et le schéma », jamais « vu fonctionner ».

**Aucune entrée n'a été supprimée ni renumérotée.** D23 et D24 sont des
ajouts ; les 79 précédentes sont intactes.

---

# 7 · Les risques de perte de travail

| Risque | Gravité | Réalité mesurée |
| --- | --- | --- |
| Les 5 commits annoncés sont perdus | — | 🟢 **nul** : ils n'ont jamais existé. Rien à récupérer |
| `dc1f05c` non poussé | 🟠 | existe **en un seul endroit**, ce poste. Un disque perdu le perd |
| `main` locale 17 commits en retard | 🟠 | **aucune perte** — tout est sur `origin/main` — mais un `checkout main` donne l'illusion d'un dépôt amputé |
| Branches anciennes non fusionnées | 🟢 | `lot-a`, `feat/actions-…`, `feature/finish-…` : contenu déjà intégré dans `main` |
| ⚠️ **Migration du 8 novembre dans le chemin de `db push`** | 🔴 | `20261108000001_document_versions_historique_devis.sql` **n'est pas appliquée** et **sera appliquée au premier `db push`**, même autorisé pour autre chose |
| ⚠️ **Le VPS déploie `feature/docusign-sandbox`** | 🔴 | un commit poussé sur `main` **n'atteint pas la production**. Point ouvert depuis le 5 novembre |
| Remises orphelines | 🟢 | 2 vieilles remises, récupérables, sans intérêt apparent |

---

# 8 · Le plan de reprise sécurisé

## Immédiat — sans risque, sur votre accord

| # | Opération | Pourquoi | Risque |
| --- | --- | --- | --- |
| 1 | **Pousser `dc1f05c` vers `origin/main`** | il n'existe qu'ici ; fast-forward depuis `326549c` | 🟢 nul |
| 2 | **Aligner `main` locale** : `git merge --ff-only origin/main` | supprime l'illusion d'un dépôt amputé | 🟢 nul — fast-forward seul, refusé s'il divergeait |
| 3 | **Décider du sort de la migration du 8 novembre** | elle part au premier `db push`, autorisé ou non | 🟠 à trancher, pas à corriger sans vous |

## Ensuite — la règle que je propose d'adopter

**Un rapport ne vaut rien sans son commit, et un commit ne vaut rien sans sa
mesure.** Concrètement, pour chaque livrable à venir :

1. le **SHA** est donné, et il est **vérifiable** (`git cat-file -e`) ;
2. les **chiffres** sont obtenus par **comptage programmatique**, jamais
   recopiés d'un rapport précédent ;
3. la distinction **Développé / Testé techniquement / Testé réellement /
   Validé en recette** est portée pour chaque ligne ;
4. tout écart entre un rapport antérieur et une mesure est **signalé**, pas
   réconcilié en silence.

C'est déjà ma discipline depuis le 8 novembre — c'est ce qui a fait apparaître
l'écart. Je propose de l'écrire comme règle du projet.

## Avant toute migration

| # | Contrôle | Commande |
| --- | --- | --- |
| 1 | vérifier formellement la cible | `npm run verif:cible` (refuse une cible de production) |
| 2 | rejouer les 177 migrations localement | `npm run preflight` |
| 3 | dépendances, extensions, fonctions, RLS | le preflight les rejoue intégralement |
| 4 | déplacer la migration dans le chemin | `git mv supabase/migrations-preparees/… supabase/migrations/` |
| 5 | appliquer **sur la recette d'abord** | `npx supabase db push` |
| 6 | rejouer les contrôles | `npm run check:recette` |

⚠️ **L'étape 5 est impossible aujourd'hui** : la recette n'existe pas. Donc
aucune migration ne peut être appliquée ailleurs que sur la production — ce
qui est précisément ce qu'il faut éviter.

---

# 9 · Traçabilité

| Demande | Origine | Vérification | Preuve | Résultat |
| --- | --- | --- | --- | --- |
| Identifier le dépôt réel | client 10-11 M1 | `rev-parse`, `remote -v`, `worktree list`, recherche de copies | §1 | ✅ **un seul dépôt, un seul worktree, aucune autre copie** |
| État avant / après `dc1f05c` | client 10-11 M1 | reflog continu | §1 | ✅ `326549c` → `dc1f05c`, non poussé |
| Retrouver les commits | client 10-11 M1 | 5 recherches dont GitHub | §2 | 🔴 **les 5 sont introuvables partout** |
| Origine des divergences | client 10-11 M5.3 | 34 transcriptions analysées par rôle **et par nature** | §3 | ✅ **arrivées par message collé**, absentes de tout le reste |
| Comparer les livrables | client 10-11 M2 | présence réelle + tests | §4 | 🔴 **D25–D31 n'ont jamais existé** |
| Conserver les constats numérotation | client 10-11 M3 | registre + suite | **D23** intacte | ✅ conservée, **enrichie** du piège du `grant` |
| Correction `revoke` + `grant` | client 10-11 M3 | migration préparée + 19 assertions | `migrations-preparees/` | ✅ **écrite, non appliquée, hors du chemin de `db push`** |
| L'émission continuera de fonctionner | client 10-11 M3 | appelants relevés, rôles appariés | §4 de l'autre document | 🟠 **vérifié statiquement ; à éprouver en recette** |
| Préserver D35 et D36 | client 10-11 M4 | registre + document | **D24** et §2 intactes | ✅ aucune modification |
| Aucune donnée modifiée | client 10-11 M4 | empreintes md5 avant/après | — | ✅ **migrations identiques à l'octet** |
