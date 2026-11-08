# Lot C — trois analyses demandées le 8 novembre 2026

> D11 (authentification du cron) · D14 (rotation de la clé de chiffrement) ·
> D15 (mentions par société émettrice).
>
> **Aucune clé de production modifiée. Aucune opération sur le VPS. Aucune
> migration. Rien n'est poussé.**

---

# D11 — Le mode d'authentification du cron

**Demande** : *« Vérifie le mode d'authentification existant sans interrompre
le service. Présente les preuves et la correction éventuelle avant toute
modification. »*

## Ce que j'ai pu vérifier, et comment

Je n'ai **ni accès SSH ni accès Docker** au VPS : je ne peux pas lire son
`crontab`. La vérification s'est donc faite sur ce qui est vérifiable depuis
le dépôt, **sans toucher au service**.

### Preuve 1 — le runbook prescrit l'en-tête, dans ses quatre formes

`docs/CRON.md` ne documente **aucun** appel par paramètre d'URL :

| Forme | Ligne du runbook |
| --- | --- |
| Contrat d'appel | `En-tête : x-cron-secret: <PRESENCE_CRON_SECRET>` |
| Option A — crontab | `curl -fsS -X POST … -H "x-cron-secret: LE_MEME_SECRET"` |
| Option A bis — systemd | `ExecStart=/usr/bin/curl -fsS -X POST … -H "x-cron-secret=%i"` |
| Option B — n8n | `Header x-cron-secret = {{$env.PRESENCE_CRON_SECRET}}` |
| Commande de vérification | `curl -i -X POST … -H "x-cron-secret: LE_SECRET"` |

### Preuve 2 — recherche exhaustive d'un appel par URL

Zéro occurrence d'un `?secret=` visant `/api/presence/evaluate` dans tout le
dépôt — documentation, scripts et configuration comprises.

**Conclusion de la vérification** : le paramètre d'URL est un chemin de
commodité que **rien n'a jamais documenté ni employé dans le dépôt**. Le
basculer en refus ne devrait donc rien couper. « Ne devrait pas » n'est pas
« ne coupera pas » : seul le `crontab` du VPS le dit.

## 🔴 Ce que la vérification a trouvé en plus : l'Option A bis ne peut pas fonctionner

La ligne systemd du runbook écrit `-H "x-cron-secret=%i"` — avec un **signe
égal** au lieu de `: `. J'ai mesuré ce que curl envoie réellement, contre un
serveur d'écho local :

```
forme Option A      : -H "x-cron-secret: SECRET_TEST"
  → EN-TETE RECU : [x-cron-secret] = [SECRET_TEST]

forme Option A bis  : -H "x-cron-secret=SECRET_TEST"
  → AUCUN en-tête reçu
```

**curl abandonne l'en-tête en silence.** Une installation qui a suivi
l'Option A bis n'envoie donc **aucun secret**, et la route répond `403` : le
moteur d'alertes et de relances ne tourne pas, sans qu'aucun message ne le
dise.

Second défaut dans la même ligne : `%i` ne s'étend que dans une unité
*template* (`nom@.service`). Dans une unité simple, il n'est pas substitué.

**Portée** : si le VPS a suivi l'Option A, tout va bien. S'il a suivi
l'Option A bis, le cron n'a **jamais** fonctionné. Les deux hypothèses sont
ouvertes, et c'est pourquoi la question du `crontab` n'est pas une formalité.

## État du code, et ce que j'ai déjà fait

Depuis le 8 novembre, le paramètre d'URL est **refusé hors production** et
**toléré-journalisé en production**, avec un avertissement qui nomme la
correction. Rien n'est coupé en production.

## La correction, à votre autorisation

**Une commande à lancer sur le VPS, en lecture seule :**

```bash
crontab -l | grep -i evaluate
systemctl list-timers --all | grep -i crm       # si un timer est employé
```

Trois issues :

| Ce que la commande montre | Action |
| --- | --- |
| `-H "x-cron-secret: …"` | ✅ Rien à faire. Poser `CGK_CRON_SECRET_URL=refuse` ferme D11 définitivement. |
| `?secret=…` | Corriger la ligne du `crontab` **avant** de poser la variable. L'ordre compte : l'inverse coupe le moteur. |
| `-H "x-cron-secret=…"` (sans deux-points) | 🔴 Le cron ne tourne pas. Corriger la ligne — et cela expliquerait des alertes jamais déclenchées. |

**Et dans tous les cas** : corriger l'Option A bis de `docs/CRON.md`, qui est
fausse. Je ne l'ai pas encore fait pour que vous voyiez d'abord la preuve.

---

# D14 — Conséquences d'une rotation de la clé de chiffrement

**Demande** : *« Prépare une analyse des conséquences d'une rotation,
notamment sur les données déjà chiffrées. Ne modifie aucune clé de production
sans mon autorisation. »*

**Aucune clé n'a été modifiée. Aucune donnée n'a été lue.**

## 1. Le périmètre exact — 10 colonnes, 2 tables

Mesuré par recherche des appels à `encryptField()` / `decryptField()` :

| Table | Colonnes | Ce que perdrait une rotation mal conduite |
| --- | --- | --- |
| `leads` | `immob_travaux_annotation` | L'annotation Immobilier/Travaux — une information commerciale que personne ne pourra reconstituer |
| `leads` | `source_url`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid` | **7 colonnes** de provenance marketing. Leur perte fait perdre l'attribution d'acquisition — et le `gclid` est ce qui permettrait les conversions Google Ads |
| `docusign_connections` | `access_token_enc`, `refresh_token_enc` | Le raccordement DocuSign. **Pas grave** : il se refait par un nouveau consentement OAuth |

**L'IBAN n'est PAS chiffré**, contrairement à ce qu'annonce le CDC
(« encrypted IBAN/BIC »). Mesuré : aucun appel de chiffrement ne le touche.
Cela réduit le périmètre d'une rotation — et c'est un écart à part entière,
qui n'était pas au registre. Il y entre sous **D17**.

## 2. 🔴 Le fait qui commande tout : l'enveloppe ne porte pas d'identifiant de clé

```
encv1:<iv_b64>:<tag_b64>:<ciphertext_b64>
```

Il n'y a **rien** dans cette enveloppe qui dise avec quelle clé elle a été
scellée, et `lib/crypto/field-encryption.ts` ne connaît qu'**une seule** clé,
lue dans `FIELD_ENCRYPTION_KEY`.

Trois conséquences, et ce sont elles le cœur de l'analyse :

1. **Changer la clé rend tout l'existant indéchiffrable.** AES-256-GCM
   authentifie : avec une mauvaise clé, le tag ne vérifie pas et le
   déchiffrement **échoue** — il ne rend pas une valeur fausse, il lève.
2. **Il n'y a pas de cohabitation possible.** On ne peut pas déchiffrer
   l'ancien avec l'ancienne clé et écrire le nouveau avec la nouvelle : le
   module ne sait pas lequel est lequel.
3. **La bascule n'est donc pas atomique par nature.** Entre le premier et le
   dernier enregistrement réécrit, une partie des données est scellée par
   l'ancienne clé et l'autre par la nouvelle, et **rien ne les distingue**.

C'est ce dernier point qui rend une rotation « naïve » dangereuse : une
interruption au milieu laisse une base dont une moitié est illisible, **sans
moyen de savoir laquelle**.

## 3. Ce qui amortit le risque

| Fait mesuré | Effet |
| --- | --- |
| `decryptField()` rend la valeur **telle quelle** si elle ne commence pas par `encv1:` | Les valeurs en clair héritées traversent une rotation **sans dommage** |
| Il reste 3 annotations et 71 provenances **en clair** | Autant de valeurs qu'une rotation ne peut pas casser |
| Les jetons DocuSign se **refont** par un nouveau consentement | Leur perte coûte un raccordement, pas une donnée |
| Les champs sont **confidentiels, pas structurants** | Aucun calcul, aucune jointure, aucun document n'en dépend : leur perte n'empêche pas le CRM de fonctionner |

## 4. Les deux voies, et celle que je recommande

### Voie 1 — rotation simple, en une passe (déconseillée)

Déchiffrer tout avec l'ancienne clé, réécrire avec la nouvelle, en une
transaction. Simple à décrire, mais : fenêtre sans écriture obligatoire,
aucune reprise possible en cas d'échec au milieu, et **aucun moyen de savoir
où ça s'est arrêté**.

### Voie 2 — ajouter un identifiant de clé d'abord (recommandée)

Un changement **additif** du format d'enveloppe :

```
encv2:<kid>:<iv_b64>:<tag_b64>:<ciphertext_b64>
```

`decryptField()` apprend à lire les trois formes — clair hérité, `encv1:`
(= ancienne clé par convention), `encv2:<kid>` — et le module accepte une
**liste** de clés. Alors :

- la rotation devient **reprenable** : on sait toujours ce qui est déjà
  converti et ce qui ne l'est pas ;
- elle devient **progressive** : aucune fenêtre d'interruption ;
- et elle devient **rejouable** : si la conversion s'arrête, on la relance.

**Coût** : un développement sur le module de chiffrement, ses contrôles, et un
script de conversion par lots. **Bénéfice** : la rotation devient une
opération ordinaire, et la prochaine ne coûtera presque rien.

## 5. La procédure, voie 2, dans l'ordre

| # | Étape | Où |
| --- | --- | --- |
| 1 | Générer la nouvelle clé (`openssl rand -hex 32`), la déposer **directement** dans votre coffre à secrets | chez vous |
| 2 | Développer `encv2` + la liste de clés + les contrôles | local |
| 3 | Éprouver la rotation **complète** sur la recette, dont une interruption volontaire au milieu puis une reprise | recette |
| 4 | **Sauvegarde de la base de production** — non négociable | production |
| 5 | Déployer le code `encv2`, l'ancienne clé toujours en place. Rien ne change encore | production |
| 6 | Ajouter la nouvelle clé **à côté** de l'ancienne. Les écritures passent en `encv2`, les lectures acceptent les deux | production |
| 7 | Lancer la conversion par lots. Compter les valeurs restées en `encv1:` jusqu'à zéro | production |
| 8 | Retirer l'ancienne clé **seulement** quand ce compte est à zéro | production |
| 9 | Re-raccorder DocuSign (nouveau consentement OAuth) | production |

**Point de non-retour : l'étape 8.** Avant elle, tout est réversible. Après,
une valeur oubliée en `encv1:` est perdue définitivement.

## 6. Ce qu'il faut décider

1. **Faut-il roter ?** La clé a séjourné en clair sur un poste de travail. Si
   ce poste n'a pas été compromis, le risque est théorique — mais il ne se
   démontre pas. Mon avis : oui, et sans urgence, en voie 2.
2. **Voie 1 ou voie 2 ?** La voie 2 demande un développement et rend
   l'opération sûre. La voie 1 est plus rapide et ne pardonne rien.
3. **Qui détient la clé ?** Aujourd'hui elle vit dans `.env.local` et dans le
   conteneur. Un coffre à secrets serait le bon endroit — c'est une décision
   d'organisation, pas de code.

---

# D15 — Les mentions dépendent désormais de la société émettrice

**Demande** : *« Je confirme que les mentions doivent dépendre de la société
émettrice et respecter son pays. […] Prépare la correction sans perturber les
devis existants. Vérifie également les règles applicables au Canada. »*

## 1. La formulation française, telle que vous l'avez arrêtée

```
Produits 100 % écologiques et 100 % français.
```

Elle remplace « Utilisation de produits 100 % français et 100 % écologiques. »
— même couple d'allégations, attaque de phrase et ordre différents. Le texte
est **verrouillé au mot** par une assertion, dans cinq fichiers de contrôle :
une reformulation silencieuse du code changerait ce que la société affirme
devant un client.

Suisse, Belgique, Luxembourg : **inchangés**, conformité aux normes
européennes. Un contrôle vérifie qu'ils n'affirment **ni** origine française
**ni** caractère écologique.

## 2. Ce qui change dans le mécanisme

Avant, l'activation était **par pays**. Activer la France faisait porter
l'allégation par **toutes** les sociétés françaises — y compris celle qui
n'emploie pas ces produits.

Désormais, l'ordre de résolution est :

1. **la société a assumé l'allégation pour son pays** → on la porte ;
2. sinon, l'ancien réglage par pays est actif → on la porte **quand même**,
   marquée `pays_herite` ;
3. sinon, aucune mention, avec le motif.

## 3. « Sans perturber les devis existants » — comment

C'est l'étape 2 qui le garantit. **Le réglage par pays est conservé et reste
lu.** Le supprimer éteindrait d'un coup les mentions déjà activées ; ce repli
évite cela, et il est **signalé** pour que la configuration société par
société reste visible comme restant à faire.

Les devis **déjà émis** ne sont pas touchés : leur PDF est archivé.

Les deux couches vivent dans le **même** enregistrement `app_settings`, sous
une sous-clé réservée `societes`. L'ancien lecteur n'examine que les codes
pays : il ignore cette sous-clé sans rien savoir d'elle. Un contrôle le
vérifie.

## 4. L'écran

Dans `Réglages › Intégrations`, chaque pays liste désormais **ses sociétés**,
avec un interrupteur chacune. Une société non cochée affiche ce qu'elle fait :
« hérite du réglage par pays — à confirmer », ou « aucune mention ».

**Pas de texte libre par société** : l'allégation reprend la formulation de
son pays. Un texte libre par société multiplierait par sept les formulations
opposables, pour un bénéfice nul.

L'action applique **les mêmes** contrôles d'allégation à la couche société, et
journalise **qui a assumé quoi**.

## 5. Le Canada — vérifié, et la réponse est « ne rien ajouter »

Vous demandiez de vérifier les règles applicables. Voici ce que j'ai établi,
et ce que je n'ai pas pu établir.

| Fait | Source |
| --- | --- |
| Une déclaration sur l'avantage environnemental d'un **produit** relève de l'alinéa **74.01(1)b.1)** de la Loi sur la concurrence, qui exige une **« épreuve suffisante et appropriée »** faite **avant** que la déclaration soit émise | lignes directrices du Bureau de la concurrence |
| Les modifications sont en vigueur depuis le **26 mars 2026** | analyses juridiques 2026 |
| Le Bureau a **actualisé** ses lignes directrices le **23 octobre 2026** | Gowling WLG |
| Les allégations doivent être **claires et précises**, les termes vagues évités | Bureau de la concurrence, juin 2025 |
| La défense de **diligence raisonnable** (par. 74.1(3)) reste invocable | lignes directrices définitives |

**Ce que je n'ai pas pu établir** : les sources secondaires **se
contredisent** sur le fardeau de la preuve. Une analyse de 2025 affirme qu'il
repose désormais sur l'entreprise ; une analyse KPMG de 2026 indique qu'il n'a
pas changé de camp et qu'une partie du régime a reculé vers la diligence
raisonnable. **Je ne tranche pas**, et aucun développement ne repose sur une
interprétation que je ne peux pas vérifier.

**Ma recommandation** : **n'introduisez pas d'allégation écologique au
Canada.** La formulation canadienne reste une déclaration de **conformité
réglementaire**, pas une allégation environnementale. Si vous voulez l'y
porter, il faut d'abord un justificatif d'essai par produit, et un conseil
juridique canadien — pas une décision de code.

L'avertissement affiché au Super Admin avant activation dit tout cela, et
renvoie aussi à la réglementation provinciale (SIMDUT / LCPE, et au Québec la
Loi sur la protection du consommateur).

## 6. Tests

| | |
| --- | --- |
| Contrôles ajoutés | **+43** (31 sur la résolution, 12 sur le câblage) |
| `check:devis` | 1 437 → **1 480**, 0 échec |
| Mutation | **5 défauts injectés, 5 détectés**, restauration au md5 |

Les cinq mutations : la couche société ignorée · l'ancienne formulation de
retour · la lecture de la couche société rendue vide · le repli plus signalé
comme hérité · le serveur revenu à la résolution par pays.

⚠️ **Une limite, assumée.** Ma première mutation du câblage serveur injectait
une panne **à l'exécution** en laissant le nom de la fonction dans le source —
un contrôle d'inspection de source ne peut structurellement pas la voir. Je
n'ai pas tordu le contrôle pour qu'il la « détecte » : j'ai remplacé la
mutation par la régression réaliste (le retour à l'ancien appel), que le
contrôle voit. **Une panne purement d'exécution ne sera détectable qu'avec une
base**, donc en recette.

## Sources — Canada

- [Bureau de la concurrence — lignes directrices définitives (juin 2025)](https://www.canada.ca/fr/bureau-concurrence/nouvelles/2025/06/le-bureau-de-la-concurrence-publie-la-version-definitive-de-ses-lignes-directrices-sur-les-declarations-environnementales.html)
- [Gowling WLG — mise à jour des lignes directrices (23 octobre 2026)](https://gowlingwlg.com/fr/insights-resources/articles/2026/competition-bureau-updates-its-environmental-claims)
- [KPMG — modification des lois canadiennes sur l'écoblanchiment (2026)](https://kpmg.com/ca/fr/insights/2026/04/changes-to-canadas-anti-greenwashing-laws.html)
- [McMillan — C-59 et les représentations environnementales](https://mcmillan.ca/fr/perspectives/publications/le-projet-de-loi-c-59-etend-la-portee-du-terme-pratiques-commerciales-trompeuses-de-la-loi-sur-la-concurrence-lecoblanchiment-et-comment-rester-a-lecar/)
- [Davies — lignes directrices du Bureau](https://www.dwpv.com/fr-ca/insights/2025/canadian-competition-bureau-guidance-environmental-claims)
