# D14 + D17 — Procédure unifiée de rotation et de chiffrement

> 9 novembre 2026. **Aucune clé modifiée. Aucune donnée touchée. Aucune
> opération de production.**
>
> Le script existe, il est **inactif par défaut**, et il **refuse la
> production sans condition** — il n'existe aucun drapeau pour y écrire.
>
> Remplace et unifie les deux plans séparés, à votre demande : *« Regrouper
> D14 et D17 dans une seule procédure sécurisée. »*

---

## 1. Ce que la procédure couvre — 12 colonnes, 3 tables

| Table | Colonnes | Volet | État aujourd'hui |
| --- | --- | --- | --- |
| `leads` | `immob_travaux_annotation` | **D14** | chiffrée `encv1` |
| `leads` | `source_url`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid` | **D14** | chiffrées `encv1` (7 colonnes) |
| `docusign_connections` | `access_token_enc`, `refresh_token_enc` | **D14** | chiffrées `encv1` |
| `legal_entities` | `iban`, `bic` | **D17** | **EN CLAIR** |

**Ce périmètre est fermé.** Il est déclaré dans `COLONNES_CHIFFREES`
(`lib/crypto/rotation.ts`), et le script ne touche rien d'autre : une erreur
de paramètre ne peut pas atteindre une table métier. Quatre assertions le
vérifient, dont deux qui exigent l'absence de `documents` et de `users`.

### Pourquoi les réunir

Les deux volets réécrivent les mêmes lignes avec le même mécanisme. Les mener
séparément doublerait les sauvegardes, les fenêtres de risque et les
vérifications, pour un bénéfice nul.

Et l'ordre a une conséquence heureuse : l'IBAN étant chiffré **pour la
première fois** avec la clé cible, il n'existera jamais de version scellée par
l'ancienne clé — donc rien à reprendre pour lui.

---

## 2. Vos huit exigences, et où chacune est tenue

| # | Exigence | Comment elle est tenue | Vérifiée par |
| --- | --- | --- | --- |
| 1 | **Sauvegarde préalable** | `CGK_ROTATION_SAUVEGARDE` doit porter la référence de votre sauvegarde. Sans elle, l'écriture est refusée. Le script ne prétend pas vérifier qu'elle existe — il vérifie que vous l'avez **affirmée**, et il la journalise | 3 assertions |
| 2 | **Simulation obligatoire** | **Mode par défaut.** Sans `--ecrire`, le script lit, décide, compte, rapporte. Aucune écriture | 2 assertions |
| 3 | **Vérification de l'intégrité** | Chaque valeur écrite est **relue** et son déchiffrement comparé au clair d'origine. Un écart **arrête tout** (`exit 2`) | 3 assertions |
| 4 | **Reprise après interruption** | L'état se **recalcule entièrement depuis la base** : l'identifiant de clé dit toujours ce qui est fait. Aucun fichier de reprise à conserver, donc rien à perdre. Curseur sur `id`, lots de 200 | 4 assertions |
| 5 | **Aucune perte de données** | **Une valeur illisible n'est JAMAIS réécrite**, et une seule refuse le lot entier | 8 assertions |
| 6 | **Retour arrière documenté** | §6 de ce document | — |
| 7 | **Aucun secret exposé** | Aucune valeur de colonne, aucune clé n'est imprimée. Seul sort l'identifiant de clé, non réversible | 3 assertions |
| 8 | **Aucune modification de production** | Le script **refuse** le mode production et la base de production. **Aucun drapeau ne permet de passer outre** | 4 assertions |

---

## 3. La règle qui commande tout

> **Une valeur qu'on ne sait pas déchiffrer n'est jamais réécrite.**

L'écraser avec du vide la perdrait définitivement. Le script refuse donc le
**lot entier** dès qu'une seule valeur est illisible — mieux vaut s'arrêter et
comprendre que convertir 199 valeurs sur 200 et découvrir la 200ᵉ trop tard.

Il continue malgré tout à **compter** après un refus : vous saurez combien de
valeurs sont concernées, et lesquelles, avant de décider.

---

## 4. La procédure, étape par étape

### Phase A — sans rien écrire

| # | Action | Qui |
| --- | --- | --- |
| A1 | Générer la nouvelle clé : `openssl rand -hex 32`. La déposer **dans votre coffre** | vous |
| A2 | Dans l'environnement : `FIELD_ENCRYPTION_KEYS_ANCIENNES` = la clé actuelle · `FIELD_ENCRYPTION_KEY` = la nouvelle · `CGK_CHIFFREMENT_V2=oui` | vous |
| A3 | `npm run rotation` → **simulation**. Elle annonce combien de valeurs sont à convertir, et **zéro illisible** | moi |

⚠️ **À l'étape A2, l'ordre compte** : poser la nouvelle clé **sans** déclarer
l'ancienne en ancienne rendrait tout l'existant illisible instantanément.

**Si la simulation annonce ne serait-ce qu'une illisible, on s'arrête.** Soit
une clé manque et il faut la déclarer, soit la valeur est déjà perdue — et
c'est un constat à faire avant, pas après.

### Phase B — la conversion, sur la recette

| # | Action |
| --- | --- |
| B1 | Sauvegarde de la base de recette |
| B2 | `CGK_ROTATION_SAUVEGARDE=<référence>` |
| B3 | `npm run rotation -- --ecrire` |
| B4 | Interrompre volontairement au milieu, puis relancer : la reprise doit être transparente |
| B5 | `npm run rotation` → doit annoncer **« rien à convertir »** |
| B6 | Vérifier **à l'écran** qu'une provenance, une annotation et un IBAN se lisent toujours |

**B4 n'est pas une précaution de style.** C'est le seul moyen de prouver que
la reprise fonctionne, et c'est la propriété qui n'existait pas avant.

### Phase C — la production

**Elle n'est pas dans ce document, et le script ne la permet pas.** Elle
demandera votre autorisation explicite, et une levée du refus visible dans un
diff.

Elle suivra la même séquence, plus : fenêtre sans écriture, re-raccordement
DocuSign (nouveau consentement OAuth), et un dénombrement avant/après.

---

## 5. Le retour arrière

### Pendant la phase A — rien à défaire

Aucune écriture n'a eu lieu. Retirer les variables suffit.

### Pendant la phase B — réversible tant que l'ancienne clé est déclarée

| Situation | Geste |
| --- | --- |
| La conversion s'est arrêtée au milieu | **Rien à défaire.** Les deux formes cohabitent et restent lisibles. Relancer, ou en rester là |
| On veut annuler la rotation | Remettre l'ancienne clé en `FIELD_ENCRYPTION_KEY`, la nouvelle en ancienne, et relancer : le script reconvertit **dans l'autre sens**. Le mécanisme est symétrique |
| Un écart d'intégrité a été détecté | Le script s'est arrêté de lui-même (`exit 2`). **La sauvegarde est la référence** : restaurer, comprendre, recommencer |

### ⚠️ Le point de non-retour

**Retirer `FIELD_ENCRYPTION_KEYS_ANCIENNES`.**

Avant : tout est réversible. Après : une valeur restée scellée par l'ancienne
clé est **définitivement perdue**.

Ne le faire qu'après avoir obtenu, en **simulation**, « rien à convertir ».

### Pour l'IBAN (D17), le retour arrière est particulier

Les deux valeurs sont aujourd'hui **en clair**. Les chiffrer est leur premier
chiffrement : il n'y a pas d'« état antérieur chiffré » où revenir. Pour les
remettre en clair, il faudrait les déchiffrer et les réécrire — ce que le
script ne fait pas, délibérément : **remettre en clair une donnée bancaire
n'est pas un retour arrière, c'est une régression de sécurité.**

Le retour arrière de D17 est donc la **sauvegarde**, et elle seule.

---

## 6. Ce que le script n'a PAS encore prouvé

**Il n'a jamais tourné contre une base.** Aucune ne lui est accessible.

| Prouvé aujourd'hui | Reste à prouver |
| --- | --- |
| La **décision** sur chaque forme de valeur (logique pure) | Que la lecture par lots fonctionne sur du volume |
| Qu'une illisible n'est jamais réécrite | Que la relecture détecte un vrai écart |
| Que les cinq gardes sont dans le code | Que le refus de production se déclenche sur une vraie URL de production |
| Que le refus de production fonctionne **par exécution réelle** sur un environnement inexistant | Que la reprise après interruption est transparente **sur des données réelles** |

Je ne déclare donc pas cette fonctionnalité validée. Elle est **développée,
testée dans sa logique, et prête à être éprouvée** dès que la recette existe.

---

## 7. Ce qu'il faut de vous

| # | Décision | Quand |
| --- | --- | --- |
| 1 | Rien pour l'instant | La phase A ne peut pas commencer sans base de recette |
| 2 | Au moment de la phase B : générer la clé et poser les trois variables | après la recette |
| 3 | Pour la phase C : une autorisation explicite, et la levée du refus de production | plus tard |
| 4 | **L'IBAN redevient-il modifiable** depuis la fiche société ? (vous avez répondu oui le 2026-11-09 — voir la priorité 2) | fait |
