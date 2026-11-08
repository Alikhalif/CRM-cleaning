# D27 — Factures OPTIMIVV : analyse et plan de transition

> 9 novembre 2026, à la demande du client : « Analyse la numérotation
> existante. Prépare un plan de transition sans modifier l'historique
> comptable. La date de bascule et les décisions nécessitant l'expert-comptable
> restent en attente. »
>
> **Aucune facture n'a été renumérotée, aucun compteur touché.**

## 1 · Ce qui existe — établi par lecture intégrale

| | Factures du CRM | Factures OPTIMIVV |
| --- | --- | --- |
| Table | `documents` | `devis_optimivv` (`doc_type = 'facture'`) |
| Compteur | `doc_counters`, clé **(type, année)** | `facture_optimivv_counters`, clé **(année)** |
| Format | `FAC-AAAA-NNNN` (4 chiffres) | `FAC-AAAA-NNNNN` (5 chiffres) |
| Société | colonne `entity_id` | **aucune colonne** — seulement le SIRET imprimé, dans `data` |
| Brouillon | oui (numéro **provisoire** depuis `…03`) | **non** — numéro définitif à la génération |
| Chemins | Planification → préparer → émettre | (a) Planification, repli si le devis est OPTIMIVV — **idempotent par lead** ; (b) `/api/devis` et `/api/devis/envoyer` en mode facture — **un numéro par appel** |

**Niveau de preuve** : *confirmé* pour tout le tableau (fonctions SQL et
routes lues en entier). Les **volumes réels** et les **trous** sont *non
vérifiables* d'ici : la requête `supabase/requetes/inventaire-series-factures.sql`
(lecture seule, **jamais exécutée**) les mesure.

## 2 · Les risques, par ordre de gravité

| # | Risque | Niveau |
| --- | --- | --- |
| R1 | **Chaque renvoi par le chemin (b) créait une NOUVELLE facture** — même contenu, autre numéro. Deux factures pour une même prestation. | confirmé (code) · **réduit le 9 nov.** : réservé au back-office (D30) |
| R2 | **N'importe quel compte connecté pouvait émettre une facture OPTIMIVV** (chemin b). | confirmé · **corrigé** (403 hors back-office) |
| R3 | L'aperçu d'une facture affichait le **prochain vrai numéro** : téléchargé, il passait pour définitif. | confirmé · **corrigé** (« APERÇU ») |
| R4 | **Deux séries « FAC- » pour une même société la même année**, distinguées seulement par le nombre de chiffres. | confirmé (technique) · **juridique : non vérifiable** |
| R5 | **Trous** dans la série OPTIMIVV : un numéro alloué puis jamais archivé (échec d'envoi) est perdu. | probable — requête 3 de l'inventaire |
| R6 | La société n'est pas une colonne : séparer la série par société exige de la lire dans le SIRET imprimé. | confirmé |

## 3 · Le plan — en quatre temps, sans toucher à l'historique

**Temps 0 — fait le 9 novembre** : R2 et R3 fermés ; R1 réduit au
back-office. Rien de l'historique n'est modifié.

**Temps 1 — mesurer (sur votre accord)** : jouer l'inventaire sur la
production, en **lecture seule**. Il donne, par société et par année, le
nombre de factures dans chaque série, les trous, et les sociétés présentes
dans les deux séries. C'est la base de la décision comptable.

**Temps 2 — décider (vous et l'expert-comptable)**, trois questions :

| Question | Options |
| --- | --- |
| Q1 — Une série ou deux par société ? | **(A) une seule** : à la bascule, OPTIMIVV numérote dans la série de la société (D26) · **(B) deux séries distinctes et justifiées**, avec un préfixe sans ambiguïté (ex. `FOV-<code>-AAAA-NNNN`) |
| Q2 — Date de bascule ? | Recommandé : **un 1er janvier**, la même pour toutes les sociétés |
| Q3 — Que faire des trous constatés ? | Les documenter (registre des numéros non attribués), **jamais** les combler par renumérotation |

**Temps 3 — développer (après décision, sur autorisation)** :
1. supprimer le chemin (b) en mode facture, ou le faire passer par
   `ensureOptimivvFactureForLead` (une facture par lead, **pas de second
   numéro au renvoi**) ;
2. donner à OPTIMIVV un **brouillon** et une **émission**, comme le CRM : le
   numéro ne naît qu'à l'émission ;
3. stocker la **société** dans `devis_optimivv` (colonne `entity_id`,
   renseignée pour l'avenir seulement — l'historique garde ses SIRET) ;
4. à la date de bascule, appeler l'allocateur de la série retenue (Q1) ; les
   compteurs `facture_optimivv_counters` sont **figés, pas supprimés**.

**Temps 4 — recette** : C21 (registre) — émissions, renvois et trous éprouvés
sur la recette avant toute mise en production.

## 4 · Ce qui ne change pas, quoi qu'on décide

- Aucun numéro déjà émis n'est modifié, réattribué ou supprimé.
- Les PDF archivés restent tels quels, avec leur numéro.
- La mise en page OPTIMIVV (portage gelé) n'est pas touchée : seul le
  **contenu** du champ numéro change (« APERÇU » en aperçu).
