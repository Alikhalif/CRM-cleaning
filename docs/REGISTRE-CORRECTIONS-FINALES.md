# Registre des corrections finales — CRM CGK

> Ouvert le 7 novembre 2026, à la livraison du Lot B.
>
> Ce registre consigne ce qui a été **constaté et mesuré** pendant les lots,
> et **volontairement reporté** à la phase de corrections consolidées. Il ne
> consigne pas des intentions : chaque ligne nomme ce qui a été observé, par
> quel moyen, et ce qu'il faudrait faire.
>
> **Règle de tenue** : une anomalie ne sort de ce registre que corrigée et
> prouvée. Une anomalie corrigée en cours de lot n'y entre jamais — elle est
> dans le message du commit qui la corrige.

## Comment lire les colonnes

| Colonne | Ce qu'elle dit |
| --- | --- |
| **Gravité** | 🔴 contractuel ou juridique · 🟠 fonctionnel · ⚪ confort |
| **Constaté** | comment l'anomalie a été établie, pas comment elle a été supposée |
| **Vérifié** | ✅ mesuré · 🟠 lu dans le code, jamais vu à l'écran |

---

## 1 · Gabarits et documents

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| G1 | 🔴 | **La photo du gabarit nettoyage montre des tenues marquées OPTIMIVV.** C'est une image de fond : la neutralisation du texte ne l'atteint pas. Tout devis d'une autre société porte donc la marque d'OPTIMIVV sur sa photo. | Lecture du rendu de `nettoyage-template-neutre.pdf` | ✅ | Remplacer la photo par une image neutre, ou la rendre paramétrable par société. Demande une image fournie par le client. |
| G2 | 🟠 | **Les quatre allégations du bandeau de pied** (« Produits écoresponsables », « Matériel professionnel », « Équipe qualifiée », « Satisfaction garantie ») sont cuites dans le design. Une société étrangère les porte sans les avoir assumées. | Relevé pdfplumber du gabarit | ✅ | Arbitrage client : les conserver comme éléments de charte, ou les soumettre au même mécanisme d'activation que la mention des produits. |
| G3 | 🟠 | **Sur le gabarit d'ORIGINE, une valeur corrigée reste lisible sous son rectangle.** Masquer n'est pas retirer : un copier-coller rend l'ancienne et la nouvelle valeur entrelacées. | Extraction de la couche texte de `6-nettoyage-origine-acompte0.pdf` | ✅ | Disparaît en basculant la société sur le gabarit neutre (réglage `devis_gabarits`). Aucun développement. |
| G4 | ⚪ | **Le numéro et la date sont écrits 4,2 pt plus bas que le design** sur le chemin d'origine. La voie 0 écrit sur la vraie ligne de base ; les deux chemins diffèrent donc légèrement. | Comparaison des opérateurs `Tm` du flux et du code | ✅ | Aligner le chemin d'origine sur la ligne de base réelle. Change le rendu en production : à décider. |
| G5 | 🟠 | **Aucune société ne peut fournir son emblème.** `legal_entities.logo_url` existe en base, mais aucun écran ne l'alimente, et c'est une URL de stockage là où le moteur attend un chemin disque. Les devis en voie 0 sortent donc sans emblème. | Recherche exhaustive de `logo_url` dans le dépôt | ✅ | Champ d'envoi sur la fiche société + mise en cache locale de l'image à l'émission. |
| G6 | 🟠 | **Le libellé « TVA : » reste français sur le gabarit déménagement.** Une société canadienne relève de la TPS/TVQ. | Lecture de `render.ts` | ✅ | **Arbitrage fiscal en attente.** Rien n'a été inventé : le libellé canadien n'est pas écrit tant que le client ne l'a pas arrêté. |
| G7 | ⚪ | **La devise est l'euro partout.** CHF et CAD ne sont pas gérés. | Lecture de `euro()` dans `layout.ts` | ✅ | **Arbitrage de change en attente**, au même titre que G6. |

## 2 · Moteur de rédaction

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| M1 | 🟠 | **Trois activités ne sont pas rédigées par le moteur** : `urgence`, `enr`, `renovation`. Leur devis se rédige à la main. | `ACTIVITES_COUVERTES` + contrôle dédié qui le vérifie | ✅ | Écrire les familles correspondantes dans la bibliothèque de rédaction. Demande le vocabulaire métier du client, qui ne s'invente pas. |
| M2 | ⚪ | **Une valeur de liste inconnue ressort telle quelle** dans le texte. C'est voulu pour les champs libres, mais une clé technique mal saisie se lirait dans le devis. | Observé en passant `typeBienNet: "bureaux"`, valeur absente de la liste | ✅ | Signaler au commercial les valeurs non reconnues, plutôt que de les imprimer. |

## 3 · Interface

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| I1 | 🟠 | **19 autres jetons CSS invalides** hors de l'éditeur de devis. Une `var()` non définie et sans repli rend la propriété invalide à la valeur calculée. | Balayage du dépôt, Lot A | ✅ | Corriger par écran, avec relecture visuelle. |
| I2 | 🟠 | **24 cellules de tableau sans `data-label`.** En mode carte (≤1024 px) elles s'affichent sans intitulé. | Balayage du dépôt, Lot A | ✅ | Ajouter les attributs manquants. |
| I3 | 🟠 | **163 cellules sans adaptation mobile.** | Balayage du dépôt, Lot A | ✅ | Même traitement qu'I2. |
| I4 | 🟠 | **Le rôle superviseur n'a pas d'interface.** | Audit du 5 novembre | ✅ | Lot G. |

## 4 · Intégration et données

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| D1 | 🟠 | **Ni la génération ni l'envoi d'un devis n'émettent de notification.** Les notifications existent et fonctionnent pour d'autres événements. | Suite `integration-modules.ts`, §11 | ✅ | Décider quels événements du cycle devis méritent une notification. C'est un choix produit, pas un correctif. |
| D2 | 🔴 | **Six sociétés sur sept portent un identifiant légal invalide.** CGK Services et CGK Énergie ont une clé de Luhn fausse ; quatre autres n'ont ni SIREN exploitable ni numéro de TVA. | Contrôle de Luhn sur les données réelles, 6 novembre | ✅ | **Saisie à corriger en base, pas un développement.** La garde de cran 2 les signale aujourd'hui ; le réglage `devis_garde_identite_stricte` les bloquera le jour où les fiches seront justes. |
| D3 | 🟠 | **Aucune société n'a de représentant légal renseigné**, ce qui bloque l'émission des contrats de sous-traitance. | `controlerEntite()` sur les données réelles | ✅ | Saisie. |
| D4 | 🟠 | **Les deux parcours de devis coexistent toujours** — `devis_optimivv` et `documents`. Ils rédigent désormais pareil et portent la même identité, mais restent deux tables. | Lecture et suites du Lot B | ✅ | La bascule complète se décide après la recette : rien ne presse tant que les deux produisent le même document. |

## 5 · Environnement

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| E1 | 🔴 | **Aucun environnement de recette.** `.env.local` pointe sur la production : aucun parcours authentifié n'a pu être essayé, sur aucun lot. | Constat permanent | ✅ | **Lot C.** C'est le préalable de toute validation fonctionnelle. |
| E2 | 🟠 | `getUnreadCount threw` au build, sur quatre routes rendues dynamiquement. | Sortie de `npm run build` | ✅ | Bruit de prérendu, sans effet à l'exécution. À regarder quand les écrans seront vérifiés. |

---

## Ce qui n'est PAS dans ce registre

- Ce qui a été corrigé pendant les lots A et B : la trace est dans les commits.
- Ce qui n'a jamais été mesuré. Une anomalie supposée n'est pas une anomalie.
- Les choix produit en attente d'arbitrage du client : ils figurent dans les
  rapports de lot, pas ici — un arbitrage n'est pas une correction.

## Journal

| Date | Évènement |
| --- | --- |
| 2026-11-07 | Ouverture du registre à la livraison du Lot B. 21 entrées. |
