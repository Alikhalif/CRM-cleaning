# D14 — Plan technique de la rotation, voie 2

> 8 novembre 2026. Vous avez retenu la **voie 2** : identification des clés et
> rotation progressive.
>
> **La capacité technique est développée et testée. Aucune rotation n'a été
> déclenchée, aucune clé de production n'a été modifiée, aucune donnée n'a été
> lue.** Le code est **inerte par défaut** — voir §2.

Ce document couvre aussi **D17** (l'IBAN non chiffré), qui partage le même
mécanisme et dont vous avez demandé une solution « compatible avec les usages
existants ».

---

## 1. Ce qui est développé

### L'enveloppe porte désormais un identifiant de clé

```
avant :  encv1:<iv>:<tag>:<ciphertext>
après :  encv2:<kid>:<iv>:<tag>:<ciphertext>
```

`kid` est une empreinte **non réversible** de 8 caractères hexadécimaux,
calculée sur les 32 **octets** de la clé. Elle dit avec quelle clé une valeur
a été scellée, sans rien révéler de la clé.

### La lecture accepte plusieurs clés

| Variable | Rôle |
| --- | --- |
| `FIELD_ENCRYPTION_KEY` | la clé **courante** : celle qui chiffre |
| `FIELD_ENCRYPTION_KEYS_ANCIENNES` | une ou plusieurs clés, séparées par des virgules, **qui ne servent qu'à lire** |

Rien n'est jamais réécrit avec une ancienne clé. Et quand l'identifiant ne
correspond à aucune clé déclarée, la lecture **essaie quand même les autres** :
une valeur lisible ne doit pas être déclarée perdue par excès de rigueur.

### Trois fonctions pour l'outillage de conversion

| Fonction | Ce qu'elle rend |
| --- | --- |
| `formeEnveloppe(v)` | `"clair"` · `"v1"` · `"v2"` |
| `kidDeLEnveloppe(v)` | l'identifiant de clé d'une `encv2`, sinon `null` |
| `clesDeLecture()` | les clés disponibles, la courante en tête |

C'est avec elles qu'un script de conversion peut **compter exactement ce qui
reste à faire** — ce que l'absence d'identifiant rendait impossible.

---

## 2. ⚠️ Pourquoi rien ne change aujourd'hui

**L'écriture reste en `encv1`.** Le passage à `encv2` n'a lieu que si
`CGK_CHIFFREMENT_V2=oui`, et la production ne définit pas cette variable.

Conséquence : le comportement observable est **identique** à celui d'avant le
8 novembre, en production comme ailleurs. Quatre assertions figent cette
promesse, dont une qui vérifie que sans la variable, la sortie de
`encryptField()` est bien une enveloppe `encv1`.

Ce n'est pas une précaution de style. Si une instance écrivait `encv2` et
qu'un retour arrière ramenait du code ne sachant lire que `encv1`, les valeurs
écrites entre-temps deviendraient illisibles — et la rotation aurait créé
exactement le problème qu'elle devait éviter.

---

## 3. Les tests, et ce qu'ils prouvent

`npm run check:recette` → suite **« chiffrement : identifiant de clé et
rotation progressive »**, **62 assertions**.

Elles exercent le chiffrement **avec de vraies clés**, générées dans le
processus et jetables. Aucune clé de production n'est lue : la suite pose
elle-même l'environnement autour de chaque cas, et le restaure dans un
`finally`.

| Ce qui est prouvé | Comment |
| --- | --- |
| **Rien ne change sans la variable** | l'écriture produit une `encv1` |
| **La rotation progressive fonctionne** | une valeur scellée par A reste lisible après que B devient courante et A ancienne |
| **La rotation interrompue est récupérable** | les trois formes se distinguent, et on compte **exactement** ce qui reste à convertir |
| **Retirer l'ancienne clé est le point de non-retour** | sans A déclarée, la valeur scellée par A devient illisible — et rend `""`, jamais du chiffré brut |
| **La compatibilité `encv1` tient** | une `encv1` scellée par A reste lisible quand A passe en ancienne |
| **L'identifiant ne révèle rien** | 8 caractères, stable, indifférent à la représentation hex/base64 de la clé |
| **Les cas dégradés ne fuient pas** | enveloppe tronquée, contenu altéré, clé mal formée, aucune clé → `""` |

### Test par mutation — 6 défauts injectés, 6 détectés

| Mutation | Détectée |
| --- | --- |
| l'écriture passe en v2 sans que la variable l'active | ✅ |
| les anciennes clés ne sont plus lues (la rotation progressive casse) | ✅ |
| une seule clé est essayée (une `encv1` ancienne devient perdue) | ✅ |
| l'identifiant de clé devient constant (il ne distingue plus rien) | ✅ |
| un déchiffrement en échec rend le **chiffré brut** | ✅ |
| l'IBAN illisible ne crie plus | ✅ |

Tous les fichiers restaurés au **md5**.

### Un piège que j'ai moi-même créé, et le contrôle qui le ferme

Il existe maintenant **deux** empreintes de la même clé, et je les ai
confondues en rédigeant le guide pas à pas :

| | `CGK_EMPREINTE_CLE_PRODUCTION` | le `kid` de l'enveloppe |
| --- | --- | --- |
| Longueur | **12** | **8** |
| Porte sur | la **chaîne** écrite dans l'environnement | les **32 octets** décodés |
| Sert à | refuser la clé de production en recette | dire quelle clé a scellé une valeur |
| Saisie | **par vous** | jamais, le code la calcule |

Les confondre ferait échouer le garde-fou **en silence**. Huit assertions
vérifient désormais les deux longueurs, le fait que les deux valeurs
diffèrent pour la même clé, et que les trois fichiers qui en parlent annoncent
la bonne.

---

## 4. La procédure de rotation — ce qu'il reste à faire

### Ce qui manque encore : le script de conversion

Il n'est **pas écrit**, délibérément. Un script qui réécrit des colonnes
chiffrées doit être éprouvé contre une base avant d'exister comme livrable, et
la recette n'existe pas encore. Voici sa conception, pour validation.

```
pour chaque table et colonne concernée (10 colonnes, 2 tables) :
    lire par lots de 200 lignes, triées par id
    pour chaque valeur non vide :
        si formeEnveloppe = "clair"           → laisser (ce n'est pas l'objet)
        si formeEnveloppe = "v2" et kid = kid courant → déjà convertie, passer
        sinon :
            clair = decryptField(valeur)       # essaie toutes les clés
            si clair est vide                 → COMPTER et NE PAS ÉCRIRE
            sinon                             → écrire encryptField(clair)
    journaliser : converties / déjà faites / en clair / ILLISIBLES
```

**Le point décisif est la ligne « si clair est vide »** : une valeur qu'on ne
sait pas déchiffrer ne doit **jamais** être réécrite. L'écraser avec du vide
la perdrait définitivement. Le script la compte, la nomme, et s'arrête si le
compte n'est pas nul.

### Les étapes, dans l'ordre

| # | Étape | Où | Réversible |
| --- | --- | --- | --- |
| 1 | Générer la nouvelle clé (`openssl rand -hex 32`), la déposer dans votre coffre | chez vous | — |
| 2 | Écrire le script de conversion, et l'éprouver **dont une interruption volontaire au milieu puis une reprise** | recette | oui |
| 3 | **Sauvegarde de la base de production** | production | — |
| 4 | Déployer le code, `CGK_CHIFFREMENT_V2` **non posée**. Rien ne change | production | oui |
| 5 | Poser `FIELD_ENCRYPTION_KEYS_ANCIENNES` = la clé actuelle, `FIELD_ENCRYPTION_KEY` = la nouvelle, et `CGK_CHIFFREMENT_V2=oui` | production | oui |
| 6 | Lancer la conversion par lots. Compter jusqu'à ce qu'il ne reste **aucune** valeur scellée par l'ancienne clé | production | oui |
| 7 | Retirer `FIELD_ENCRYPTION_KEYS_ANCIENNES` | production | **NON** |
| 8 | Re-raccorder DocuSign (nouveau consentement OAuth) | production | oui |

**Point de non-retour : l'étape 7.** Avant elle, tout est réversible — il
suffit de remettre l'ancienne clé en courante. Après, une valeur oubliée est
perdue.

À l'étape 5, l'ordre compte : poser la nouvelle clé **sans** déclarer
l'ancienne en ancienne rendrait tout l'existant illisible instantanément.

---

## 5. D17 — l'IBAN, et pourquoi le code ne suffit pas

### Ce que l'analyse a trouvé

| Fait mesuré | Conséquence |
| --- | --- |
| `legal_entities.iban` et `.bic` sont stockés **en clair** | L'écart au CDC est réel |
| **Deux** sociétés ont un IBAN réel, qui s'imprime sur leurs factures | La donnée est vivante |
| **Rien ne les écrit depuis l'application** : les champs ont été retirés du formulaire le 2026-11-05, et `buildPayload` ne les touche plus — précisément pour ne pas les effacer | **Une approche « chiffrer à l'écriture » ne se déclencherait jamais** |
| Il n'existe qu'**un seul** point de lecture, `mapEntity()` dans `lib/documents-server.ts` | Un seul endroit à adapter |
| `decryptField()` rend `""` en cas d'échec | Une facture partirait **sans coordonnées bancaires**, en silence |

### La solution, en trois temps

**Temps 1 — fait aujourd'hui.** La lecture tolère les deux formes :
`lireCoordonneeBancaire()` rend une valeur en clair telle quelle, déchiffre
une valeur chiffrée, et **crie dans les journaux** si une valeur chiffrée est
devenue illisible — en nommant la société. Inerte tant que rien n'est
chiffré ; prérequis indispensable.

**Temps 2 — à votre autorisation.** La conversion des **deux** lignes
concernées, par le même script que la rotation. C'est une **modification de
données**, donc hors de ce que j'ai le droit de faire : sur la recette
d'abord, puis en production avec sauvegarde.

**Temps 3 — une décision produit.** Faut-il rendre ces champs modifiables à
nouveau ? Ils ont été retirés du formulaire le 2026-11-05 parce que « le RIB
circule en pièce jointe du devis ». Si la réponse est non, les colonnes
restent en lecture seule et leur chiffrement est un gain de confidentialité
sans coût d'usage. Si la réponse est oui, il faut rouvrir le formulaire **et**
y chiffrer à l'écriture.

### Ce que je recommande

Chiffrer l'IBAN **pendant** la rotation D14, pas avant : les deux opérations
touchent les mêmes lignes avec le même script, et les mener séparément
doublerait les sauvegardes et les fenêtres de risque pour rien.

⚠️ Mais **l'ordre a une conséquence** : si l'IBAN est chiffré pour la première
fois **avec la nouvelle clé**, il n'existera jamais de version scellée par
l'ancienne — donc rien à reprendre pour lui à l'étape 6. C'est plus simple, et
c'est un argument de plus pour les joindre.

---

## 6. Ce qu'il faut décider

| # | Décision | Sans elle |
| --- | --- | --- |
| 1 | **Écrire le script de conversion** une fois la recette disponible | La rotation reste une capacité, pas une opération |
| 2 | **Joindre D17 à la rotation**, ou la traiter à part | Deux fenêtres de risque au lieu d'une |
| 3 | **L'IBAN redevient-il modifiable** depuis la fiche société ? | Le temps 3 reste ouvert |
| 4 | **Où vit la clé** : coffre à secrets, ou fichier d'environnement du conteneur ? | C'est une décision d'organisation ; la clé actuelle a déjà séjourné en clair sur un poste |
