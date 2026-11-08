# Échantillons PDF — manifeste

> 9 novembre 2026. Les 25 PDF produits pendant les lots A, B et E, ce qu'ils
> prouvent, et pourquoi ils ne sont **pas** dans le dépôt.

## Pourquoi un manifeste et pas les fichiers

**19 Mo de PDF binaires.** Git ne les compresse pas en delta : chaque
régénération ajouterait 19 Mo à l'historique, **définitivement** — on ne peut
les en retirer qu'en réécrivant l'historique, ce que les règles du projet
interdisent.

Les fichiers restent donc **sur le poste**, et `.gitignore` les écarte. Ce
document conserve ce qu'ils démontrent, leur empreinte, et la commande qui les
régénère.

## ⚠️ Ce qu'un md5 prouve ici, et ce qu'il ne prouve pas

**Un PDF n'est pas reproductible à l'octet d'une exécution à l'autre** : les
deux moteurs y écrivent un horodatage, à la seconde. Régénérer un échantillon
et comparer son md5 à celui-ci **échouera**, et ce ne sera pas une régression.

Les empreintes ci-dessous servent donc à **une** chose : identifier
l'artefact exact que j'ai examiné. Pas à vérifier une régénération.

**La preuve durable n'est pas dans ces fichiers** — elle est dans les suites
automatisées, qui extraient la **couche texte** des PDF et vérifient l'absence
de mélange d'identités. Celles-là se rejouent, et elles sont dans le dépôt.

---

## Lot A — ce que le gabarit historique acceptait, et ce qu'il ignorait

⚠️ **« Injection » désigne ici l'injection de l'IDENTITÉ de la société
émettrice**, pas une tentative d'attaque. Les noms de fichiers prêtent à
confusion et je m'y suis moi-même trompé en relisant ce manifeste.

| md5 (12) | Octets | Fichier |
| --- | --- | --- |
| `386c5e6b5299` | 1 032 889 | `1-nettoyage-historique-SANS-injection.pdf` |
| `386c5e6b5299` | 1 032 889 | `2-nettoyage-historique-AVEC-injection-tentee.pdf` |
| `f14682072b08` | 578 131 | `3-demenagement-historique-SANS-injection.pdf` |
| `ea0912305853` | 578 248 | `4-demenagement-historique-AVEC-injection.pdf` |

### Ce que ces quatre fichiers démontrent

**Les deux premiers ont le MÊME md5, à l'octet.** Le gabarit nettoyage
historique **ignorait purement et simplement** l'identité qu'on lui
fournissait : fournie ou non, le PDF était identique. C'est ce constat qui a
justifié la **voie 0** du Lot B — retirer l'identité cuite dans le flux de
contenu, et la redessiner.

**Les deux suivants diffèrent**, et c'est le résultat attendu : le moteur
déménagement acceptait déjà une identité dynamique. L'extraction de la couche
texte le confirme — `OPTIMIVV SAS / 75016 Paris / SIRET 928 083 427 00023`
devient `Helvetia Propreté SA / 1204 Genève / CHE-123.456.789`.

⚠️ **L'égalité des deux premiers md5 n'est concluante que parce qu'ils ont été
rendus dans la même seconde.** Rendus à deux secondes différentes, ils
auraient différé par leur horodatage, et l'égalité n'aurait rien dit. C'est
une preuve valable, et elle n'est pas reproductible.

---

## Lot B — voie 0, cinq pays, neuf activités

### La voie 0 et les acomptes

| md5 (12) | Octets | Fichier | Ce qu'il montre |
| --- | --- | --- | --- |
| `44d8d29d473b` | 1 036 522 | `1-nettoyage-gabarit-origine.pdf` | le gabarit d'origine, identité cuite |
| `06434fd11522` | 1 174 860 | `2-nettoyage-voie0-OPTIMIVV.pdf` | voie 0, identité redessinée, OPTIMIVV |
| `748c905912c0` | 1 173 956 | `3-nettoyage-voie0-SUISSE.pdf` | **même gabarit, société suisse** |
| `046a807b8e39` | 192 794 | `4-demenagement-identite-SUISSE.pdf` | l'autre moteur, même société |
| `ed9acd749b08` | 1 173 475 | `5-nettoyage-voie0-SUISSE-acompte20.pdf` | acompte 20 % |
| `dec03eb491ed` | 1 037 070 | `6-nettoyage-origine-acompte0.pdf` | acompte 0 %, chemin d'origine |

Le couple **2 / 3** est le cœur du Lot B : le **même** gabarit graphique
portant **deux identités juridiques différentes**, sans qu'aucune trace de
l'une subsiste sur l'autre — vérifié par extraction de la couche texte, pas
par lecture d'image.

### Les cinq pays

| md5 (12) | Octets | Fichier |
| --- | --- | --- |
| `c8563acfb399` | 1 177 876 | `pays/devis-FR-EXEMPLE-PROPRETÉ.pdf` |
| `159e0a2802a1` | 1 177 528 | `pays/devis-CH-HELVETIA-PROPRETÉ.pdf` |
| `d2bac79ec999` | 1 177 941 | `pays/devis-BE-BRABANT-PROPRETÉ.pdf` |
| `090d502c3621` | 1 177 950 | `pays/devis-LU-GRAND-DUCHÉ-PROPRETÉ.pdf` |
| `c1a70c67e692` | 1 178 450 | `pays/devis-CA-QUÉBEC-PROPRETÉ.pdf` |

Chacun porte : le libellé d'identifiant légal de son pays (SIRET, IDE, BCE,
RCS, NEQ), sa mention de produits, l'article **293 B sur la France seule**, et
« **soumission** » au Québec là où les quatre autres disent « devis ».

### Les neuf activités

| md5 (12) | Octets | Fichier |
| --- | --- | --- |
| `1ca2e191f875` | 1 177 152 | `activites/activite-nettoyage.pdf` |
| `2fbc7faad08b` | 1 175 811 | `activites/activite-desinfection.pdf` |
| `cfd6d26976c2` | 1 177 216 | `activites/activite-decontamination.pdf` |
| `7e4f3c3b1f0c` | 193 907 | `activites/activite-debarras.pdf` |
| `7ef1ecd393ba` | 194 284 | `activites/activite-demenagement.pdf` |
| `3c65b89d9b58` | 193 404 | `activites/activite-transport.pdf` |
| `8451a6e4ec69` | 196 145 | `activites/activite-diogene.pdf` |

Les douze devis produits par le moteur portent tous leur bloc **RÉSERVES**,
sur deux ou trois pages — c'est ce qui a mis au jour la troncature silencieuse
(5 lignes en nettoyage, 9 en déménagement) corrigée au Lot B.

⚠️ **Sept activités sur neuf.** `urgence`, `enr` et `renovation` ne sont pas
rédigées par le moteur (anomalie **M1** au registre) : leur devis se rédige à
la main, et il n'y a donc pas d'échantillon.

---

## Lot E — le texte contractuel atteint enfin le PDF

| md5 (12) | Octets | Fichier |
| --- | --- | --- |
| `42a8d11971d3` | 19 798 | `reactpdf-nettoyage-AVEC-notes.pdf` |
| `7156e7bf506a` | 19 240 | `reactpdf-nettoyage-SANS-notes.pdf` |
| `426cd003cf27` | 6 692 | `reactpdf-demenagement-AVEC-notes.pdf` |

Le couple **AVEC / SANS** démontre la correction **LE-1** : `getDocumentById`
sélectionnait `notes` en base et ne le rendait jamais, si bien que PRESTATION
/ DÉTAIL / RÉSERVES n'atteignaient **aucun** PDF. Avec descriptif, les
réserves y sont ; sans, le repli générique s'affiche toujours.

Ces trois-là sont minuscules (6 à 20 Ko) parce qu'ils viennent de
`@react-pdf/renderer`, qui n'embarque ni les polices ni l'image de fond du
gabarit `pdfkit`.

---

## Régénérer

```bash
# Comparaison au gabarit de référence (Lot B)
node scripts/devis-compare/run.mjs

# Neutralisation du gabarit (voie 0)
python scripts/gabarit-neutre/neutraliser.py
```

Les échantillons par pays et par activité ont été produits par des scripts
d'un seul usage, avec des **données fictives**. Les régénérer demande de les
réécrire — et c'est volontaire : un script d'échantillonnage conservé finit
par devenir une dépendance qu'il faut maintenir.

## Les données sont fictives

Aucun de ces 25 PDF ne contient de donnée de production. Les sociétés
(`EXEMPLE PROPRETÉ`, `HELVETIA PROPRETÉ`, `BRABANT PROPRETÉ`,
`GRAND-DUCHÉ PROPRETÉ`, `QUÉBEC PROPRETÉ`), leurs identifiants et leurs
clients sont inventés — à l'exception d'`OPTIMIVV`, dont l'identité réelle
figure sur les échantillons du chemin d'origine, puisque c'est précisément ce
que la voie 0 avait pour objet de retirer.
