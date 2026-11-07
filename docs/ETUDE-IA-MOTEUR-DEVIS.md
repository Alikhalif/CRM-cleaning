# Étude — une IA dans le moteur de devis

**Statut : ÉTUDE. Aucune API n'est branchée, aucune donnée client n'a quitté
le dépôt, aucune dépendance n'a été installée.**
**Date : 2026-11-06.**

---

## 1. Le point de départ, qui n'est pas une opinion

Le moteur de devis **n'est pas une IA**, et ne l'a jamais été. C'est un
automate déterministe : une analyse de la découverte, une bibliothèque de 101
opérations sur 25 thèmes et 13 familles, trois paliers de développement, et
une batterie de contrôles. Deux exécutions sur la même découverte donnent
exactement le même texte.

Vous l'appelez « IA » dans vos briefs, et c'est compréhensible — ce qu'il
produit ressemble à ce qu'une IA produirait. Mais la distinction porte à
conséquence, et c'est pour cela que ce document commence par là : un automate
**garantit** ses règles, un modèle de langue les **respecte le plus souvent**.
Sur un document qui engage l'entreprise, l'écart entre les deux est le sujet.

Ce que l'automate garantit aujourd'hui, par construction :

| garantie | d'où elle vient |
| --- | --- |
| Une observation n'autorise jamais une prestation. | Les quatre états `inclus / exclu / non_renseigne / a_confirmer`, et un contrôle indépendant qui part de la découverte. |
| Une exclusion prime sur tout. | Appliquée **après** la carte des validations : rien ne peut réouvrir un refus. |
| Aucun prix dans le descriptif. | Le texte n'a pas accès aux montants. |
| Aucune promesse de résultat. | Le catalogue n'en contient aucune, et un contrôle de rédaction le vérifie. |
| Aucune allégation non activée. | La mention des produits est fermée par défaut, par pays. |
| Pas de répétition entre sections. | Anti-doublon à l'échelle du devis. |
| Le même texte deux fois de suite. | Déterminisme. |

Une IA ne peut offrir aucune de ces sept garanties **par construction**. Elle
peut les respecter, et on peut le vérifier après coup. Ce n'est pas la même
chose.

## 2. Où une IA apporterait réellement quelque chose

Trois points d'insertion possibles, du moins risqué au plus risqué.

### A. Reformulation du style — risque faible, gain faible

L'IA reçoit un texte **déjà produit par l'automate** et le reformule : rythme,
variété, fluidité. Elle ne décide d'aucune prestation.

- **Ce qu'elle voit** : le texte du devis, sans nom de client, sans adresse,
  sans prix.
- **Gain réel** : des devis moins répétitifs d'un dossier à l'autre. Le
  correcteur déterministe livré aujourd'hui (C5) couvre déjà la typographie,
  les unités, le vocabulaire et les mots doublés — ce qui reste, c'est le
  style, et le style n'a jamais fait perdre une affaire.
- **Risque principal** : une reformulation qui change une promesse. « Les
  parties accessibles des rangements » devenant « les rangements » transforme
  une restriction en engagement. **Contenu** : nous avons déjà le contrôle —
  `retenirSousGardeFou` refuse toute transformation qui augmente le nombre de
  termes engageants, et `controlerTexteConforme` refuse une promesse sur un
  thème non validé. Ils s'appliqueraient à la sortie de l'IA sans une ligne de
  code de plus.

### B. Extraction depuis du texte libre — risque moyen, gain RÉEL

Aujourd'hui le commercial remplit une découverte à champs. Quand il note
quelque chose en texte libre dans « contexte de l'intervention », le moteur
le reporte tel quel comme observation, sans l'exploiter.

L'IA lirait ce texte libre et **proposerait** des valeurs de champs : « il y a
des cafards dans la cuisine et ça sent très fort » → `dioNuisibles: oui`,
`odeurs: oui`. Le commercial valide ou corrige, champ par champ. L'automate,
ensuite, fait exactement ce qu'il fait aujourd'hui.

- **Ce qu'elle voit** : le texte libre de la découverte. **Le plus sensible
  des trois** : c'est là que se trouvent les situations humaines.
- **Gain réel** : c'est le seul des trois points qui résout un vrai problème
  mesuré. Sur 712 leads en production, 663 sont au statut `lead` sans
  découverte remplie. Le frein n'est pas le moteur, c'est la saisie. Une
  extraction depuis des notes dictées ferait baisser ce coût.
- **Risque principal** : une valeur inventée. **Contenu** : la proposition
  n'écrit rien. Elle pré-remplit un formulaire que le commercial valide. Un
  champ proposé et non validé reste `non_renseigne`, donc n'autorise aucune
  prestation — la règle du 6 novembre s'applique sans modification.

### C. Rédaction complète — risque ÉLEVÉ, et c'est celui qu'on imagine

L'IA reçoit la découverte et écrit le devis. C'est probablement ce que vous
avez en tête quand vous dites « IA », et c'est l'option que je ne recommande
pas.

Elle supprime les sept garanties du §1 d'un coup, pour les remplacer par une
vérification a posteriori. Si le contrôle refuse la sortie, il faut
redemander — et un modèle qui se trompe une fois sur cinquante se trompera,
sur 80 devis par mois, environ une fois tous les deux semaines. Sur un
document signé par le client.

Et surtout : **l'automate fait déjà ce travail correctement.** Les trois
scénarios du §6 le montrent sur les cas difficiles. Remplacer une chose qui
marche et qui garantit par une chose qui marche presque et qui n'engage à rien
est le mauvais côté du marché.

### Ma recommandation

**B d'abord, A éventuellement, C jamais sans une raison nouvelle.**

B attaque le problème réel — la découverte n'est pas remplie. A est un confort
dont le gain est esthétique. C échange des garanties contre une impression de
modernité.

## 3. Architecture, si vous retenez A ou B

```
                 ┌──────────────────────────────────────────┐
  Découverte ───►│  lib/generation/ia/                      │
  (texte libre)  │                                          │
                 │  • un SEUL adaptateur, une interface     │
                 │  • aucun appel direct depuis les actions │
                 │  • désactivé par défaut (app_settings)   │
                 └───────────────┬──────────────────────────┘
                                 │ proposition (jamais une écriture)
                                 ▼
                 ┌──────────────────────────────────────────┐
                 │  Contrôles EXISTANTS, inchangés          │
                 │  • controlerConformite (états)           │
                 │  • controlerTexteConforme (texte)        │
                 │  • retenirSousGardeFou (promesses)       │
                 │  • controlerMention (allégations)        │
                 │  • controlerTerminologie (pays)          │
                 └───────────────┬──────────────────────────┘
                                 │ refusé → on garde l'automate
                                 ▼
                 ┌──────────────────────────────────────────┐
                 │  L'automate déterministe, INCHANGÉ       │
                 │  reste la source du devis                │
                 └──────────────────────────────────────────┘
```

Trois principes, non négociables si on y va :

1. **Un seul adaptateur.** Aucun appel à un fournisseur ailleurs dans le code.
   Changer de fournisseur, ou l'arracher, doit être une seule modification.
2. **L'IA propose, elle n'écrit pas.** Ni en base, ni dans le devis, ni dans
   la découverte. La proposition passe par un écran que l'humain valide.
3. **L'automate reste la source.** Si l'IA échoue, est lente, est coupée, ou
   si sa sortie est refusée par un contrôle, le devis est produit comme
   aujourd'hui. Pas de dégradation de service.

## 4. Confidentialité — le vrai verrou, et il n'est pas technique

**C'est ici que la décision se prend, pas sur la qualité du texte.**

Ce que contient une découverte de ce CRM :

- l'adresse du bien et parfois celle du client ;
- l'état du logement — et pour un chantier Diogène, cela décrit une situation
  humaine : accumulation, insalubrité, nuisibles, parfois un décès ;
- des annotations confidentielles (Immobilier/Travaux) **chiffrées en base**
  par `FIELD_ENCRYPTION_KEY` ;
- la provenance marketing (`source_url`, `utm_*`, `gclid`), **également
  chiffrée**, et qu'un commercial n'a pas le droit de voir.

Envoyer tout ou partie de cela à un tiers, c'est un **transfert de données
personnelles à un sous-traitant**. Ce qui est exigé avant, et qui ne relève
pas de moi :

| à faire | qui |
| --- | --- |
| Contrat de sous-traitance (DPA) signé avec le fournisseur. | vous / votre conseil |
| Vérifier que le fournisseur n'entraîne pas ses modèles sur les données envoyées (c'est une option contractuelle, pas un acquis). | vous |
| Localisation du traitement, et transferts hors UE le cas échéant. | vous |
| Mise à jour de la politique de confidentialité et de l'information des personnes. | vous |
| Base légale du traitement. | vous |
| Durée de conservation chez le fournisseur. | vous |
| Inscription au registre des traitements. | vous |

Et deux règles techniques que je poserais quoi qu'il arrive :

- **Les champs chiffrés ne partent jamais.** Ni l'annotation
  Immobilier/Travaux, ni la provenance. Ils sont chiffrés précisément parce
  que même un utilisateur légitime du CRM n'y a pas accès ; un tiers encore
  moins.
- **Aucune donnée directement identifiante.** Pas de nom, pas de téléphone,
  pas de courriel, pas d'adresse complète. Un « 2e étage sans ascenseur,
  68 m², appartement » suffit au moteur ; c'est exactement la discipline déjà
  appliquée aux demandes de tarif aux sous-traitants, et elle a été arbitrée
  par vous le 6 novembre.

**Pour les tests, je n'enverrai aucune donnée réelle sans votre validation
écrite** — c'est votre instruction, et c'est aussi la seule position tenable.

## 5. Coûts — la méthode et les volumes mesurés

Je ne cite pas de tarif. Les prix des fournisseurs changent, et un chiffre
recopié de mémoire dans un document de décision est un chiffre faux. Ce que je
peux donner, et que personne d'autre ne peut : **les volumes réels de ce
projet**, mesurés sur le moteur.

### Volumes mesurés

| grandeur | mesure |
| --- | --- |
| Découverte en entrée (JSON) | 52 à 255 caractères selon le cas |
| Devis produit | 1 484 à 3 581 caractères — **moyenne 2 379** |
| Référentiel complet (101 opérations) | 6 092 caractères, + 726 pour les titres |
| Familles / thèmes | 13 / 25 |

### Le calcul à faire, avec le tarif du jour

Le français consomme environ **3 à 4 caractères par jeton**. Donc :

| hypothèse | entrée (jetons) | sortie (jetons) |
| --- | --- | --- |
| **A — reformulation** : le devis entre, le devis ressort | ~700 | ~700 |
| **B — extraction** : notes libres + liste des champs | ~1 000 | ~200 |
| **C — rédaction complète** : référentiel + découverte en entrée | ~2 500 | ~700 |

Pour l'option C, le référentiel entier doit être dans la requête à chaque
devis — c'est ce qui en fait la plus chère des trois, en plus d'être la plus
risquée. Un mécanisme de cache de requête, proposé par les fournisseurs,
réduirait ce coût ; il faut le vérifier au moment de la décision.

**Le calcul** : `(jetons d'entrée × prix d'entrée par million + jetons de
sortie × prix de sortie par million) ÷ 1 000 000 × nombre de devis par mois`.

Au volume de référence du cahier des charges — **80 devis par mois** — les
trois options restent dans un ordre de grandeur de quelques dizaines
d'euros par mois au plus, pour les modèles courants. **À vérifier sur la
grille tarifaire du fournisseur au moment de décider** : c'est une
multiplication, pas une estimation, et elle ne demande que deux chiffres que
je n'ai pas le droit d'inventer.

Le coût qui compte n'est pas celui-là. C'est le coût d'un devis mal rédigé
qui part chez un client, et il ne se chiffre pas en euros par million de
jetons.

## 6. Protocole de comparaison — trois scénarios

**Les sorties ci-dessous sont RÉELLES : produites par le moteur, extraites
telles quelles.** Aucune n'est écrite à la main — c'est une interdiction
explicite du référentiel. **La colonne « IA » est vide, et elle doit le
rester tant qu'aucune API n'est branchée.** Un tableau comparatif dont une
moitié est imaginée ne compare rien.

### Les trois scénarios, et ce que chacun mesure

| scénario | découverte | ce qu'il met à l'épreuve |
| --- | --- | --- |
| **S1 — le cas simple** | nettoyage courant, studio 32 m², état léger. 2 champs. | L'IA en dit-elle **plus** que ce que le client a demandé ? |
| **S2 — le cas riche, avec refus** | approfondi, maison 145 m², 2 SdB, four + frigo, terrasse, 2 niveaux, radiateurs accessibles, **murs refusés, vitrerie refusée**. | L'IA respecte-t-elle un **refus** ? |
| **S3 — le cas sensible** | Diogène, 68 m², volume à évaluer, **nuisibles constatés**, odeurs, nicotine forte, placards occupés, hauteur + fragile + sans eau. | L'IA transforme-t-elle une **observation** en prestation ? |

### Ce que l'automate produit — mesuré

| | S1 | S2 | S3 |
| --- | --- | --- | --- |
| Palier de détail | 1/3 | 2/3 | 3/3 |
| Sections | 2 | 4 | 2 |
| Caractères | 1 484 | 2 717 | 3 581 |
| Réserves | 2 | 4 | 8 |
| Prestations à confirmer | 0 | 0 | 1 (`nuisibles`) |

Les points de contrôle que l'automate passe, et qu'il faudra vérifier sur
toute sortie d'IA :

- **S2** : aucune section « Nettoyage de la vitrerie », et la réserve
  « Le nettoyage de la vitrerie n'est pas compris dans le présent devis. »
  figure. Le refus est **dit**, pas seulement respecté.
- **S3** : `dioNuisibles: oui` est un **constat**. L'automate l'écrit dans
  « Éléments relevés lors de la découverte : présence de nuisibles relevée »,
  ouvre **aucune** section de traitement, et ajoute la réserve « Le traitement
  des nuisibles ne fait pas partie du présent devis. Il relève d'une
  entreprise habilitée ». L'état de la prestation reste `a_confirmer`.
  **C'est le test décisif** : une IA qui écrit « désinsectisation des locaux »
  parce qu'on lui a parlé de cafards est inutilisable sur ce métier.
- **S3** : les traces de nicotine donnent un nettoyage *adapté* et une réserve
  qui renvoie la remise en peinture **hors devis**. Pas une promesse
  d'élimination.
- **S1** : 2 sections, pas 5. Un modèle a tendance à étoffer ; ici, étoffer
  c'est promettre.

### Comment on noterait

Sur les mêmes trois découvertes, pour chaque sortie d'IA :

| critère | poids | comment on tranche |
| --- | --- | --- |
| Aucune prestation non validée | **éliminatoire** | `controlerConformite` sur les états |
| Aucun refus contourné | **éliminatoire** | `controlerConformite` + lecture du texte |
| Aucun prix, aucun délai | **éliminatoire** | `pointsARevoir` |
| Aucune promesse de résultat | **éliminatoire** | `retenirSousGardeFou` + `pointsARevoir` |
| Réserves présentes et exactes | fort | comparaison à la sortie de l'automate |
| Deux exécutions, même sortie | fort | lancer deux fois |
| Lisibilité, style | faible | lecture humaine |

Quatre critères éliminatoires, et ils sont tous **déjà outillés**. C'est le
point le plus utile de cette étude : le travail des trois derniers mois a
produit, sans que ce soit le but, le banc d'essai qui permettrait de juger
une IA. Rien n'est à écrire pour mesurer.

## 7. Risques, et ce qui les contient

| risque | gravité | contenu par |
| --- | --- | --- |
| Une prestation promise que le client n'a pas commandée. | **critique** | `controlerConformite`, éliminatoire. Déjà écrit. |
| Un refus contourné (« sans vitrerie » → une section vitrerie). | **critique** | Idem, et l'exclusion est appliquée après la validation. |
| Un prix ou un délai dans le descriptif. | élevée | `pointsARevoir` les signale déjà. |
| Une promesse de résultat (« impeccable », « garanti »). | élevée | `retenirSousGardeFou` + `pointsARevoir`. |
| Deux devis différents pour la même découverte. | moyenne | Le déterminisme est perdu par nature. Seule l'option B l'évite (la proposition est validée avant d'entrer dans l'automate). |
| Données personnelles chez un tiers. | **critique** | Rien de technique. Voir §4 : c'est un contrat et une base légale. |
| Dépendance à un fournisseur extérieur. | moyenne | Un seul adaptateur, l'automate reste la source, désactivable par un réglage. |
| Latence ou indisponibilité. | faible | L'automate répond toujours ; l'IA est un supplément, jamais un passage obligé. |
| Coût qui dérive avec le volume. | faible | Quelques dizaines d'euros par mois à 80 devis. À recalculer si le volume est multiplié par cinq. |

## 8. Retour arrière

Prévu avant d'y aller, pas après :

1. **Un réglage dans `app_settings`**, comme `n8n_sequence_enabled` : un
   interrupteur par option (A, B), fermé par défaut. Pas de redéploiement
   pour couper.
2. **L'automate reste la source.** Interrupteur fermé = exactement le
   comportement d'aujourd'hui, au caractère près. C'est la même propriété que
   celle vérifiée pour la projection terminologique : le défaut ne bouge pas.
3. **Un seul adaptateur à supprimer** si l'on arrête : un dossier
   `lib/generation/ia/`, deux points d'appel, aucun autre.
4. **Aucune migration.** Les propositions d'IA ne sont pas stockées. Si un
   jour on veut les tracer, c'est `document_versions` (voir M1) avec une
   origine de plus — pas une table nouvelle.
5. **Aucune donnée perdue** en coupant : rien n'a été écrit par l'IA.

## 9. Ce que je n'ai pas fait

- **Aucune API branchée.** Aucune clé, aucune dépendance installée, aucune
  requête sortante. C'est votre instruction : « ne branche aucune API payante
  sans mon autorisation ».
- **Aucune donnée client transmise à qui que ce soit.**
- **Aucun texte attribué à une IA.** Le §6 ne contient que des sorties
  réelles de l'automate ; la colonne « IA » est vide parce qu'elle n'a pas
  été remplie, et le dire est plus utile que la remplir.
- **Aucun tarif inventé.** §5 donne la méthode et les volumes ; les deux
  chiffres manquants se lisent chez le fournisseur le jour de la décision.

## 10. Ce qu'il faut de vous

1. **Quelle option**, si une : B (extraction depuis le texte libre) est la
   seule que je recommande.
2. **La décision confidentialité** du §4 — c'est elle qui conditionne tout, et
   elle n'est pas technique.
3. **L'autorisation de brancher une API**, avec un plafond de dépense, si vous
   voulez une comparaison réelle sur les trois scénarios.
4. **La validation d'envoyer des données de test** — et je recommande des
   découvertes fabriquées, pas des dossiers réels, pour la première
   comparaison. Les trois scénarios du §6 suffisent, et ils ne contiennent
   aucune donnée personnelle.

---

## Annexe — un écart relevé en produisant les scénarios

Sans lien avec l'IA, mais trouvé en route et vérifié, donc dit :

**Un refus exprimé sur un champ ne se comporte pas de la même façon selon le
thème.** Dans le scénario S2, `vitrerie: "non"` produit la réserve « Le
nettoyage de la vitrerie n'est pas compris dans le présent devis. », tandis
que `murs: "non"` ne produit **rien** — ni réserve, ni mention. La réserve des
murs n'est émise que si les murs **et** les plafonds sont tous deux refusés
([devis-contenu.ts](../lib/generation/devis-contenu.ts), la condition
`mursExclus && plafondsExclus`), ce qui correspond à son texte, qui nomme les
deux.

**Ce n'est pas une faille de protection** — je l'ai vérifié : `murs` figure
dans `THEMES_A_VALIDER`, donc une section « Lessivage des murs » ajoutée
ensuite serait refusée par le contrôle indépendant. Le devis protège
l'entreprise dans les deux cas.

C'est une **incohérence d'information du client** : la même réponse
(« non ») est dite pour un thème et taisée pour un autre. À arbitrer par vous,
en trois options :

1. Laisser tel quel — c'est le §9 du référentiel, qui distingue « non
   demandé » (on se taît) de « exclu » (on le dit), et seule la case
   d'exclusion formelle vaut refus opposable.
2. Faire parler `murs: "non"` seul, avec une réserve qui ne nomme que les
   murs.
3. Faire taire `vitrerie: "non"` seul, par symétrie, et ne garder que la case
   d'exclusion formelle pour les deux.

Je n'ai rien changé : les trois options sont défendables, et ce choix est le
vôtre.
