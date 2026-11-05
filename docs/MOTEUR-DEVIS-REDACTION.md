# Moteur universel de génération intelligente des devis

**Date :** 2026-11-05 · **Demande :** master prompt « Moteur universel de
génération intelligente des devis — référentiel expert de rédaction »
(Parties 1 à 22). · **Référentiel :** version `2026-11-05.1`.

---

## 1. Audit de l'existant (§21)

Avant toute modification, voici ce qui existait. **Rien n'a été dupliqué.**

| Pièce | État au 2026-11-05 avant intervention |
| --- | --- |
| Moteur de rédaction | `lib/generation/devis-contenu.ts`, 790 lignes, **déterministe** |
| Pont découverte → moteur | `lib/generation/devis-depuis-decouverte.ts` |
| Bouton « Générer le devis » | fiche lead, `DiscoveryCard.tsx` → `genererDevisDepuisDecouverte` |
| Écriture du devis | `createDevis` / `updateDevisBrouillon` — le **même** chemin que l'éditeur manuel |
| Éditeur du brouillon | `/devis/new?brouillon=<id>` → `QuoteEditor.tsx` |
| Garde-fous de rédaction | `INTERDITS` : 5 expressions proscrites |
| Activités couvertes | nettoyage · nettoyage difficile · Diogène · débarras · déménagement · transport |
| Découverte | 17 types de nettoyage, 4 compléments, origines de décontamination et de désodorisation, 17 champs de vitrerie |

**Le processus du §16 existait déjà en entier** : découverte → génération →
brouillon → validation humaine → envoi manuel. Il n'a pas été modifié.

### Ce qui manquait

1. **Aucune introduction professionnelle** (§4). Le devis commençait par une
   reprise du titre sur une ligne.
2. **Aucune section numérotée** (§2, §5). Le détail était une liste de puces à
   plat : **une puce par champ saisi** — soit exactement le « MAUVAIS
   RÉSULTAT » que le §5 proscrit.
3. **Aucun savoir-faire métier écrit.** Le moteur savait lire la découverte
   sans rien inventer ; il ne savait pas développer les opérations qu'un
   professionnel décrit habituellement.
4. **Les 17 types de nettoyage étaient écrasés sur 7 libellés**, dont dix
   finissaient en « Nettoyage approfondi ». Un nettoyage de fin de chantier et
   un nettoyage après sinistre produisaient le même texte.
5. **Aucun niveau de développement** (§10).
6. **Les compléments n'apparaissaient pas au titre** (§3.3) : ni « AVEC
   VITRERIE », ni « AVEC LESSIVAGE DES MURS ET PLAFONDS ».
7. **Les formulations imposées n'étaient pas celles du §11 et du §12.2.**
8. **Un double intitulé** : `notesDevis()` préfixait « DÉTAIL DE LA
   PRESTATION » à un texte qui commençait déjà par « PRESTATION » puis
   « DÉTAIL DES PRESTATIONS ».
9. **Aucune des huit fonctions du §17**, en dehors de « Générer » et de la
   modification manuelle.

### Trois bugs trouvés pendant l'audit, et corrigés

| Bug | Conséquence réelle | Correctif |
| --- | --- | --- |
| `dioDechets` est une liste à **choix multiples**, lue comme une chaîne | La ligne « Évacuation des déchets » ne sortait **jamais**, et « nature des déchets » figurait dans les informations manquantes alors que le commercial l'avait renseignée | Lecture en liste |
| `dioNuisiblesTypes` saisi mais **ignoré** par la rédaction | Le devis écrivait « traitement des nuisibles constatés » sans nommer blattes, punaises ou rongeurs — contraire au §7.16 | Les nuisibles identifiés sont nommés |
| Le niveau de détail testait `etatSalete === "tres_sale"` / `"insalubre"` — **deux valeurs qui n'existent pas** (les vraies sont `tres_important` et `extreme`) | Le niveau n'était jamais relevé sur un logement très sale | Valeurs réelles |

Deux autres bugs ont été **révélés par les contrôles automatiques** pendant le
développement, et c'est la raison pour laquelle ils existent :

| Révélé par | Bug | Interdiction violée |
| --- | --- | --- |
| Test 9 du §20 | Un nettoyage après incendie avec nuisibles **perdait** la section « Traitement des nuisibles » | **5 — oublier une prestation validée** |
| Interdiction 7 | Un chantier Diogène avec un four facturé **perdait** la section « Nettoyage des équipements » | **5** |

Cause commune : l'ordre de rédaction de la famille servait aussi de filtre
d'inclusion. La famille gouverne désormais l'**ordre**, jamais l'inclusion.

---

## 2. Ce qui a été développé

### 2.1 Un référentiel rédactionnel centralisé (§7, §15)

**`lib/generation/bibliotheque-redaction.ts`** — nouveau, commun à toutes les
sociétés, sans aucune dépendance à une marque.

- **13 familles de nettoyage** avec, chacune, son titre, sa nature
  d'intervention, son niveau de développement par défaut et son **ordre de
  rédaction** : courant · approfondi · fin de bail · avant emménagement ·
  avant vente · après déménagement · après chantier · après occupation sans
  droit · insalubre · Diogène · après décès · après incendie · après dégât des
  eaux.
- **25 thèmes d'opérations**, chacun avec trois paliers de développement.
- **Les opérations des sections « espaces intérieurs », « cuisine »,
  « sanitaires » et « vitrerie » sont reprises VERBATIM du résultat attendu
  donné au §5.** C'est votre méthode, pas une interprétation : le contrôle
  automatique vérifie les 13 lignes une par une.
- **17 réserves professionnelles**, dont la clause de réévaluation du §12.2 et
  la mention produits du §11, **mot pour mot**.
- Le référentiel est **versionné** (`VERSION_REFERENTIEL`) et porte son
  **historique** (`HISTORIQUE_REFERENTIEL`).

### 2.2 Les trois niveaux du §14, réellement séparés

**`lib/generation/devis-contenu.ts`** — réécrit.

```
NIVEAU A  Decouverte    les données brutes saisies
NIVEAU B  analyser()    quelles prestations validées, quelles contraintes,
                        quelles exclusions, quel niveau, qu'est-ce qui manque
NIVEAU C  rediger()     titre · introduction · sections numérotées · réserves
```

Le résultat de l'analyse (`Analyse`) **ne contient aucun texte rédigé** — un
contrôle automatique le vérifie. Les trois fonctions de rédaction
(`construireTitre`, `construireIntroduction`, `construireSections`) sont
appelables séparément, ce qui rend les boutons du §17 possibles sans
dupliquer le moteur.

### 2.3 Titre, introduction, sections

- **Titre (§3)** : `prestation + nature du chantier + compléments validés`,
  en majuscules, trois compléments au plus, sans répétition. Un logement très
  sale n'est **jamais** qualifié de « type Diogène » : seul le secteur,
  choisi par un humain, le permet.
- **Introduction (§4)** : deux phrases. La première situe le bien, la
  superficie **si elle est saisie** et le niveau d'encrassement ; la seconde
  annonce trois opérations du socle « ainsi que » la prestation
  complémentaire — la tournure de votre modèle.
- **Sections (§2, §5)** : une section numérotée par thème validé, avec les
  opérations du référentiel au niveau retenu, **puis** les précisions tirées
  de la découverte. Aucun champ saisi n'est perdu, aucune opération n'est
  répétée d'une section à l'autre.
- **Ordre du §7.8 tenu** pour un chantier Diogène : débarras → nettoyage
  approfondi → désinfection → décontamination, chaque phase séparée.

### 2.4 Niveau de développement (§10)

Trois niveaux. Le niveau de la famille est un **plancher** : un encrassement
extrême, une infestation, des déchets biologiques le relèvent à 3. Il n'est
**jamais abaissé**, y compris par un bouton d'interface — le §10 interdit une
description superficielle pour une intervention complexe.

Mesuré : un nettoyage courant sur une découverte minimale produit
**2 sections et 5 opérations** ; un chantier Diogène complet en produit
**14 sections et 72 opérations**.

### 2.5 Les garde-fous (§19)

`INTERDITS` passe de 5 à 7 motifs, dont deux nouveaux : **promesse de résultat
sanitaire** (interdiction 26) et **prestation présentée comme déjà réalisée**
(interdiction 27). Les devises étrangères sont ajoutées au motif de prix.

Un contrôle **structurel** complète le contrôle textuel :
`aucunThemeComplementaireNonValide()` compare les sections rédigées aux thèmes
que l'analyse a retenus. C'est la garantie mécanique des interdictions 11 à 15.

> **Note sur un garde-fou qui s'est retourné contre nous.** La première
> version du motif « promesse sanitaire » cherchait « garantie d'absence ». Il
> se déclenchait donc sur la réserve du §7.9 — « ni une expertise, ni une
> garantie d'absence totale d'agents biologiques » — qui dit exactement le
> contraire. Un garde-fou qui sanctionne la clause protectrice pousse à la
> retirer. Le motif ne relève plus que les promesses **positives**.

### 2.6 L'interface du §17

**`app/(app)/devis/new/RedactionAssistee.tsx`** + `redaction-actions.ts`,
dans l'éditeur du brouillon (`/devis/new?brouillon=<id>`).

Sept boutons, plus la modification libre du champ :

| § | Bouton | Ce qu'il fait |
| --- | --- | --- |
| 17.1 | Générer le devis | contenu complet depuis la découverte |
| 17.2 | Améliorer le descriptif | reprise au niveau de détail maximal |
| 17.3 | Développer les prestations | idem, sur toutes les sections |
| 17.4 | Corriger les répétitions | retire les puces en double du texte **courant**, renumérote, supprime les sections vidées |
| 17.5 | Régénérer le titre | le titre seul |
| 17.6 | Régénérer les réserves | le bloc RÉSERVES seul, le descriptif intact |
| 17.7 | Régénérer le devis | proposition complète et neuve |
| 17.8 | Modifier manuellement | le champ reste un simple champ de texte |

**La sécurité du §17 est tenue en trois temps :**

1. **L'action serveur ne fait que PROPOSER.** Rien n'est écrit en base : c'est
   le bouton « Enregistrer » existant qui écrit.
2. **Confirmation avant remplacement.** Le texte courant est comparé à notre
   dernière proposition ; s'il en diffère, c'est qu'un humain y a touché, et
   la confirmation nomme ce qui va être remplacé.
3. **« Annuler le remplacement »** restitue la valeur précédente.

Les informations absentes de la découverte et les formulations à corriger sont
affichées après chaque génération.

### 2.7 La structure du document (§2, §22)

`notesDevis()` émet désormais les **trois blocs**, et un seul intitulé de
chaque :

```
PRESTATION                 titre en majuscules + introduction
DÉTAIL DE LA PRESTATION    sections numérotées
RÉSERVES                   clauses adaptées au chantier
```

La zone de saisie des notes passe de 3 à 16 lignes : elle porte maintenant
tout le devis.

---

## 3. Exemple de sortie réelle

Dossier du §4 : appartement de 90 m², encrassement important, vitrerie
comprise, cuisine équipée, 3 pièces, 1 salle de bain, 1 WC, sols carrelés.

```
PRESTATION

NETTOYAGE APPROFONDI D'UN APPARTEMENT DE 90 M² AVEC VITRERIE

Intervention de nettoyage approfondi d'un appartement d'environ 90 m²
présentant un niveau d'encrassement important.

La prestation comprend le nettoyage minutieux des espaces intérieurs, le
traitement des sols, le nettoyage approfondi et le dégraissage de la cuisine
ainsi que la vitrerie comprise dans le périmètre de l'intervention.

DÉTAIL DE LA PRESTATION

1. Nettoyage approfondi des espaces intérieurs

- Dépoussiérage minutieux de l'ensemble des surfaces accessibles.
- Nettoyage des portes, poignées, encadrements et huisseries.
- Élimination des traces et salissures présentes sur les surfaces concernées.
- Nettoyage des plinthes, angles, recoins et zones difficiles d'accès.
- Nettoyage des interrupteurs et éléments fixes accessibles.
- Intervention portant sur les 3 pièces concernées.
- Traitement renforcé des zones présentant un encrassement important.

2. Traitement des sols
3. Nettoyage approfondi et dégraissage de la cuisine
4. Nettoyage et détartrage des sanitaires
5. Nettoyage de la vitrerie

                            [sections 2 à 5 abrégées ici]

Intervention réalisée avec des produits de nettoyage 100 % français et
écoresponsables, adaptés aux surfaces et aux opérations prévues.

RÉSERVES

Le présent devis est établi sur la base des informations communiquées lors de
la découverte commerciale. Toute différence significative constatée […]
```

La sortie complète s'affiche en lançant `npm run check:devis`.

---

## 4. Tests exécutés (§20, §21)

**`npm run check:devis`** — 3 suites, **369 assertions, toutes passantes.**

### 4.1 Les 14 tests du §20

Chaque test vérifie en plus les neuf critères de validation du §20 : qualité
du titre · cohérence de l'introduction · développement des désignations ·
respect des exclusions · absence de prestations inventées · pertinence des
réserves · absence de répétitions · intégration · absence d'envoi automatique.

| Test | Objet | Résultat |
| --- | --- | --- |
| 1 | Nettoyage approfondi avec vitrerie | **passe** |
| 2 | Fin de bail sans vitrerie | **passe** — exclusion portée aux réserves |
| 3 | Approfondi avec lessivage des murs | **passe** — « et plafonds » absent car non demandés |
| 4 | Diogène avec vitrerie et lessivage | **passe** — 4 phases séparées, dans l'ordre du §7.8 |
| 5 | Débarras insalubre avec nettoyage et désinfection | **passe** |
| 6 | Après décès avec désinfection et décontamination | **passe** — réserve sanitaire, aucune promesse |
| 7 | Après incendie | **passe** — « traitement des suies » au titre |
| 8 | Après chantier | **passe** — finition en première section |
| 9 | Traces de fumée + indices de rongeurs | **passe** — *a révélé le bug de l'interdiction 5* |
| 10 | Exclusions explicites | **passe** — aucune réserve contradictoire |
| 11 | Nombreuses informations secondaires | **passe** — contraintes traitées comme faits, pas comme prestations |
| 12 | Régénération d'un devis déjà modifié | **passe** — génération déterministe |
| 13 | Prestation suggérée mais non validée | **passe** — 8 sections interdites, aucune créée |
| 14 | Plusieurs entreprises et pays | **passe** — le moteur ne reçoit ni société ni pays |

### 4.2 Les 28 interdictions du §19

**78 assertions, toutes passantes.** Chacune des 28 est couverte. Les plus
structurantes :

- **16 et 17** — aucun prix, aucun montant : le contenu produit **ne porte
  aucun champ de montant**, et le code du moteur ne contient aucune référence
  à un montant.
- **24** — aucun envoi : le moteur n'importe aucun client Supabase, n'appelle
  ni `fetch`, ni `nodemailer`, et ne lit aucun fichier.
- **25** — le moteur ignore les statuts et le pipeline.
- **28** — générer un devis **ne modifie jamais** le référentiel (vérifié par
  comparaison avant/après 10 générations), et le référentiel ne contient
  aucune écriture.
- **20, 26, 27** — vérifiées dans les deux sens : absentes du texte produit,
  **et détectées** si un commercial les saisit à la main.

### 4.3 Contrôles du projet

| Contrôle | Résultat |
| --- | --- |
| `npx tsc --noEmit` | **propre** |
| `npx eslint lib/generation/ app/(app)/devis/new/` | **propre** |
| `scripts/check-selects/check-selects.py` | **aucune colonne inexistante** |
| `npm run build` | **compilation réussie** |

---

## 5. Tableau de traçabilité (§24)

| Demande initiale | Fonctionnalité | Emplacement | Test | Résultat | État |
| --- | --- | --- | --- | --- | --- |
| Structure en 3 blocs (§2) | `notesDevis()` réécrit | `devis-depuis-decouverte.ts` | 8 assertions | 3 blocs, un seul intitulé | **développé et testé** |
| Titre intelligent (§3) | `construireTitre()` | `devis-contenu.ts` | 11 assertions | titre exact du §4 obtenu | **développé et testé** |
| Introduction (§4) | `construireIntroduction()` | `devis-contenu.ts` | 10 assertions | 2 phrases, aucune invention | **développé et testé** |
| Désignations expertes (§5) | 25 thèmes, 3 paliers | `bibliotheque-redaction.ts` | 13 verbatim + 7 | opérations du §5 reprises mot pour mot | **développé et testé** |
| Opérations vs compléments (§6) | `THEMES_COMPLEMENTAIRES` + contrôle structurel | `devis-contenu.ts` | 23 assertions | aucune prestation non validée | **développé et testé** |
| Bibliothèque métier (§7) | 13 familles | `bibliotheque-redaction.ts` | 14 tests métier | chaque famille a sa rédaction | **développé et testé** |
| Vitrerie (§8) | thème complémentaire + 17 champs | `devis-contenu.ts` | 9 assertions | jamais ajoutée, jamais inventée | **développé et testé** |
| Lessivage (§9) | 3 cas distingués | `devis-contenu.ts` | 8 assertions | validé / non demandé / exclu | **développé et testé** |
| Niveaux (§10) | `Niveau` 1-2-3, plancher | `devis-contenu.ts` | 7 assertions | 5 vs 72 opérations | **développé et testé** |
| Mention produits (§11) | `MENTION_PRODUITS` | `bibliotheque-redaction.ts` | 3 assertions | verbatim, absente des déménagements | **développé et testé** |
| Réserves (§12) | 17 réserves + clause §12.2 | `bibliotheque-redaction.ts` | 14 assertions | verbatim, sans contradiction | **développé et testé** |
| Informations manquantes (§13) | `manquant[]` | `devis-contenu.ts` | 6 assertions | jamais inventées, jamais bloquantes | **développé et testé** |
| Architecture A/B/C (§14) | `analyser()` / `rediger()` | `devis-contenu.ts` | 5 assertions | séparation vérifiée | **développé et testé** |
| Bibliothèque centralisée (§15) | module + version + historique | `bibliotheque-redaction.ts` | 4 assertions | versionnée, non mutable | **développé et testé** |
| Intégration CRM (§16) | aucun changement | chemin existant | build + lint | processus intact | **existant vérifié** |
| 8 fonctions (§17) | 7 boutons + champ libre | `RedactionAssistee.tsx` | 13 assertions sur le moteur | voir §6 ci-dessous | **partiellement opérationnel** |
| Référentiel commun (§18) | moteur sans société ni pays | `devis-contenu.ts` | 5 assertions | mélange impossible | **développé et testé** |
| Adaptation linguistique (§18) | — | — | — | — | **non développé** |
| 28 interdictions (§19) | `INTERDITS` + contrôle structurel | `devis-contenu.ts` | 78 assertions | les 28 couvertes | **développé et testé** |
| Historique des versions (§17) | annulation dans l'éditeur | `RedactionAssistee.tsx` | — | non durable | **partiellement opérationnel** |
| Dépannage et travaux (§7.17) | — | — | — | renvoie `null` | **non développé** |
| Hottes professionnelles (§7.15) | module séparé `cert-hotte` | `lib/cert-hotte/` | — | non fusionné, délibérément | **existant, hors moteur** |
| Fientes de pigeons (§3.2) | — | — | — | aucun champ en découverte | **bloqué — donnée absente** |
| Désinsectisation autonome (§7.16) | nuisibles dans un nettoyage | `devis-contenu.ts` | 4 assertions | pas d'activité autonome en base | **partiellement opérationnel** |
| Vérification en session réelle | — | — | — | pas de compte, pas d'accès | **non vérifiable ici** |

---

## 6. Ce qui n'est pas tenu, et pourquoi

Je ne présente aucune de ces lignes comme acquise.

**1. Les boutons « Améliorer » et « Développer » ne réécrivent pas, ils
régénèrent plus en détail.** Sans modèle de langage, « améliorer la
rédaction » n'a pas d'autre sens exécutable. Le §17.3 demande plus
précisément d'« enrichir une **section sélectionnée** » : l'enrichissement est
aujourd'hui **global**, pas par section choisie. Sélectionner une section
demande un éditeur structuré, pas un champ de texte libre.

**2. « Corriger les répétitions » ne retire que les puces strictement
identiques.** Deux phrases qui disent la même chose autrement sont conservées
toutes les deux : les départager demanderait de juger du sens, et le §19.19
interdit d'appauvrir un descriptif.

**3. L'historique des versions vit dans l'éditeur, pas en base.** Fermer
l'onglet avant d'enregistrer perd les versions intermédiaires — jamais le
contenu enregistré, puisque rien n'est écrit sans action explicite. Un
historique durable demande une table et votre accord.

**4. Aucune adaptation linguistique (§18).** Tout est en français. Le
référentiel est bien commun aux cinq pays et le mélange entre sociétés est
structurellement impossible, mais un client néerlandophone en Belgique ou
germanophone au Luxembourg recevrait un devis en français. Traduire un
référentiel juridique n'est pas une opération technique.

**5. La mention produits du §11 est portée par tous les devis de
nettoyage.** Vous écrivez qu'elle ne doit l'être que « lorsque l'entreprise
concernée utilise effectivement des produits répondant à ces
caractéristiques ». Il n'existe aucun indicateur de ce type sur les sociétés
émettrices : la rendre conditionnelle demande une colonne et une décision.

**6. Le dépannage et les travaux du bâtiment (§7.17) ne sont pas couverts.**
Le moteur renvoie `null` pour `urgence`, `enr` et `renovation` — il ne produit
rien plutôt qu'un texte inadapté. Les couvrir demande d'abord une découverte
pour ces métiers.

**7. « Nettoyage et décontamination de surfaces souillées par des fientes de
pigeons » (§3.2) n'est pas générable.** Aucun champ de la découverte ne
permet de le valider, et l'inventer violerait l'interdiction 10.

**8. Le certificat de hotte (§7.15) reste son module séparé.** Il a sa propre
chaîne, au pixel près, et sa propre numérotation. Le fondre dans ce moteur
créerait le doublon que vous refusez. Il n'atteste jamais une opération avant
son exécution — c'est déjà le cas.

**9. L'interface du §17 n'a pas été testée en session réelle.** Elle compile,
elle passe le lint, et le moteur qu'elle appelle est couvert par 369
assertions. Mais **je n'ai pas de compte pour me connecter au CRM** : je n'ai
donc ni cliqué sur les sept boutons, ni vu la confirmation de remplacement
s'afficher, ni vérifié le rendu sur téléphone. **C'est à vous de le faire**,
et c'est la seule chose qui vaudra validation.

---

## 7. Décisions à prendre

| # | Décision | Pourquoi |
| --- | --- | --- |
| **D1** | Historique des versions en base : oui ou non ? | Demande une table `document_revisions` et une migration |
| **D2** | Mention produits conditionnelle par société ? | Demande une colonne sur `legal_entities` |
| **D3** | Créer les activités désinfection / désinsectisation ? | Même décision ouverte que pour le module Superviseur |
| **D4** | Champ d'exclusions explicites en découverte ? | Aujourd'hui « Non » à une question vaut exclusion ; une exclusion libre n'est pas saisissable |
| **D5** | Adaptation linguistique pour la Belgique et le Luxembourg ? | Traduction d'un référentiel juridique, pas une tâche technique |
| **D6** | Enrichir une section **sélectionnée** (§17.3) ? | Demande un éditeur structuré en remplacement du champ libre |

---

## 8. Fichiers

**Créés**

- `lib/generation/bibliotheque-redaction.ts` — le référentiel
- `app/(app)/devis/new/RedactionAssistee.tsx` + `.module.scss` — §17
- `app/(app)/devis/new/redaction-actions.ts` — actions de proposition
- `scripts/devis-redaction-check/` — `run.mjs`, `commun.ts`, `structure.ts`,
  `metier.ts`, `interdictions.ts`
- `docs/MOTEUR-DEVIS-REDACTION.md` — ce journal

**Modifiés**

- `lib/generation/devis-contenu.ts` — réécrit (niveaux A/B/C, 3 bugs corrigés)
- `lib/generation/devis-depuis-decouverte.ts` — `notesDevis()` en 3 blocs
- `app/(app)/devis/new/QuoteEditor.tsx` — panneau + poseur de titre + notes à
  16 lignes
- `package.json` — `check:devis`

**Non touchés** : le processus commercial, les statuts, le pipeline, les
montants, l'envoi, la découverte, les PDF, la numérotation.

---

*Aucune migration créée, aucune donnée modifiée, aucun droit utilisateur
touché, aucun envoi activé.*
