# Lot C — Plan final de l'environnement de recette

> Établi le 9 novembre 2026, à la demande du client (§6 « Environnement de
> recette »). Il **complète** `LOT-C-DOSSIER-CREATION-RECETTE.md` et le
> **corrige** sur un point : le coût (voir §1).
>
> Rien de ce plan n'a été exécuté. Aucune ressource n'a été créée, aucune
> migration lancée.

## 1. Coût — vérifié aux sources officielles le 9 novembre

Pages lues : `supabase.com/pricing`, `…/docs/guides/platform/billing-on-supabase`,
`…/manage-your-usage/compute`, `…/platform/backups`. Aucune ne porte de date de
mise à jour : les chiffres valent **au 9 novembre 2026**.

| Option | Coût | Conditions, citées |
| --- | --- | --- |
| **A — projet gratuit** | **0 €** | « Limit of 2 active projects ». ⚠️ **La limite vaut PAR COMPTE** : « The project limit applies across all organizations where you are an Owner or Administrator ». Un projet en pause ne compte pas. Pause après 1 semaine d'inactivité. 500 Mo de base, 1 Go de fichiers. **Aucune sauvegarde automatique.** |
| **B — projet dans l'organisation payante** | **≈ 10 $ / mois** | Si la production est au plan Pro : « Additional projects add their full compute cost » — Micro ≈ 10 $/mois, **facturé à l'heure** ; arrêter le projet arrête la facture. Une organisation Pro **ne peut pas** contenir de projet gratuit. |
| *Écartée* — *branching* | ≈ 0,013 $ / heure / branche | Dérive du schéma de production : l'inverse de ce qu'on veut éprouver (177 migrations depuis une base vide). |

**Correction du dossier précédent.** Il recommandait de créer la recette
« dans une autre organisation gratuite » pour libérer une place. C'est **faux** :
la limite de deux projets gratuits est commune à toutes vos organisations.

**Ce que vous seul pouvez vérifier**, dans le tableau de bord Supabase :
1. le plan de l'organisation de production (Free ou Pro) ;
2. le nombre de projets gratuits **actifs** dont vous êtes propriétaire ou
   administrateur, toutes organisations confondues.

S'il en reste un de libre : **option A, 0 €**. Sinon, l'option B est **payante**
et demande votre accord explicite.

## 2. Isolation complète

| Garantie | Comment | Preuve aujourd'hui |
| --- | --- | --- |
| Base distincte | Projet Supabase dédié, jamais une branche de la production | — à créer |
| Clés propres | `.env.recette` : URL, clé anonyme et service-role **de la recette** ; **nouvelle** `FIELD_ENCRYPTION_KEY` (`openssl rand -hex 32`) | gabarit fourni |
| Aucun envoi réel | Brevo et SMTP absents ; `CGK_ENVOI_REEL` non posé | suite `envoi.ts`, exécutée |
| Aucun lien vers la production | `SIGNATURE_BASE_URL=http://localhost:3000`, liste blanche `CGK_DOMAINES_PUBLICS` | suite `urls.ts`, exécutée |
| Données fictives | Semences du dépôt + comptes `@example.invalid` (RFC 2606) | — |
| DocuSign | Compte **développeur** (gratuit), jamais celui de production | — Lot D |

## 3. Vérification explicite de la cible — et interdiction technique

Trois verrous **indépendants**. Les trois existent et leurs refus ont été
**exécutés** le 9 novembre.

| Verrou | Ce qu'il refuse | Exécuté |
| --- | --- | --- |
| `npm run verif:cible -- .env.recette` | toute configuration dont la base, les liens ou les clés pourraient être ceux de la production | **oui** — le 9 novembre, sur `.env.recette` absent : refus (sortie 1), et rappel que la CLI est liée à la production |
| `npm run migrer:recette` | toute migration si la CLI n'est pas liée **au même** projet que `.env.recette`, ou si l'un des deux désigne la production. Simulation par défaut ; application seulement avec `--appliquer` | **oui** — refus en 5 motifs, aucune commande Supabase lancée |
| Marqueur `cgk_environnement = recette` | tout script qui ÉCRIT (test de concurrence, comptes de test) — la production n'a pas ce marqueur et ne l'aura jamais | **oui** — `recette:facturation` refuse `.env.local` et une recette absente |

⚠️ **Règle absolue, rappelée** : la CLI de ce poste est liée à la
**production**. Ne lancez **jamais** `supabase db push` ni `supabase db reset`
directement. Passez par `npm run migrer:recette`, qui vérifie d'abord.

## 4. Sauvegarde et retour arrière

**Recette** : ses données sont fictives. Le retour arrière le plus sûr est la
**recréation** : supprimer le projet, le recréer, rejouer les migrations et les
semences (§5). Pour garder un état intermédiaire (plan gratuit = aucune
sauvegarde automatique) :

```
npx supabase db dump --linked -f sauvegardes/recette-schema-AAAAMMJJ.sql
npx supabase db dump --linked --data-only -f sauvegardes/recette-donnees-AAAAMMJJ.sql
```

…à lancer **seulement** après `npm run migrer:recette` (qui prouve le
rattachement). Le dossier `sauvegardes/` ne doit **pas** être versionné.

**Production — pour mémoire, rien n'est autorisé** : au plan Pro, 7 jours de
sauvegardes quotidiennes ; PITR en option (≈ 100 $/mois pour 7 jours). Le plan
réel n'est pas vérifiable d'ici. Avant toute migration de production future :
sauvegarde manuelle, puis application, puis contrôle — chaque étape sur votre
autorisation.

## 5. Plan de migration contrôlé — l'ordre exact

**Où en êtes-vous ?** `npm run recette:pret` le dit à tout moment, sans réseau : il vérifie chaque prérequis et nomme l'étape suivante, **qui** doit la faire, et si elle demande **votre autorisation**.


| # | Étape | Qui | Autorisation |
| --- | --- | --- | --- |
| 1 | Vérifier le plan et les places libres (§1) | **vous** | — |
| 2 | Créer le projet de recette | **vous** | **oui** si option B (payante) |
| 3 | Écrire `.env.recette` (dont `CGK_ENV=recette` et `CGK_SUPABASE_URL_PRODUCTION`) | **vous** | — |
| 4 | `npm run verif:cible -- .env.recette` → me coller la sortie | vous | — |
| 5 | Lier la CLI à la recette (`npx supabase link --project-ref <recette>`) | **vous** | — |
| 6 | `npm run migrer:recette` — **simulation** : liste les 184 migrations | moi | — |
| 7 | `npm run migrer:recette -- --appliquer` | moi | **oui, explicite** |
| 8 | Jouer `supabase/recette/00_marqueur_environnement.sql` dans l'éditeur SQL **de la recette** | vous | — |
| 9 | Charger les semences fictives | moi | oui |
| 10 | Inscrire les six comptes, **l'administrateur en premier** | **vous** | — |
| 11 | Jouer `supabase/recette/10_comptes_de_test.sql`, puis `supabase/recette/20_societes_de_test.sql` (sociétés **fictives** ; il active leurs séries — c'est le seul endroit où une série s'active hors de la procédure de production) | vous | — |
| 12 | Ajouter à `.env.recette` les identifiants de **deux** comptes de test (`CGK_TEST_COMMERCIAL_*`, `CGK_TEST_PLANIFICATION_*` — gabarit fourni) : ils servent au refus d'encaissement **par rôle**, en base | **vous** | — |
| 13 | `npm run recette:facturation` — **10 sections réelles** : verrou d'activation, brouillon, double clic, simultanéité, facture figée, annulation, **cinq pays**, **encaissement par rôle**, **notifications**, **périmètre des notifications (D31)** | moi | — |
| 14 | Recette fonctionnelle : parties **C1 à C25** du registre, par rôle et dans les **cinq pays** | vous + moi | — |

**184 migrations** = les 177 existantes + les 7 du 9 novembre (`…01` à `…07`). Elles n'ont
**jamais** été rejouées depuis une base vide (E7) : l'étape 7 est celle dont la
durée est imprévisible. Si une migration échoue, **on s'arrête**, on corrige le
fichier dans le dépôt, on recrée la recette. Jamais de correction à la main dans
la base.

## 6. Les six comptes de test

Définis au §L6 de `LOT-C-AUDIT-ET-PROPOSITION.md` ; droits posés par
`supabase/recette/10_comptes_de_test.sql`, qui refuse de tourner sans le
marqueur de recette.

| Compte | Rôle | Profil | Pays |
| --- | --- | --- | --- |
| `admin.recette@example.invalid` | Super Admin — **inscrit en premier** | — | les cinq |
| `commercial.nettoyage@example.invalid` | commercial | `appel_entrant` | FR, CH |
| `commercial.demenagement@example.invalid` | commercial | `debarras_demenagement` | LU, BE |
| `planif.recette@example.invalid` | planification | — | les cinq |
| `superviseur.recette@example.invalid` | superviseur | — | aucun (périmètre fermé) |
| `commercial.attente@example.invalid` | commercial | `en_attente` | CA |

Les cinq pays sont couverts sans qu'un seul commercial les porte tous : c'est ce
qui permet de vérifier le cloisonnement **et** chaque pays.
