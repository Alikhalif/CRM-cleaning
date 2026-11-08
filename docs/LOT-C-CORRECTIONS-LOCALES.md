# Lot C — Corrections locales de sécurisation

> 8 novembre 2026. Branche `lot-b/unification-gabarits`.
>
> Autorisation du client du 8 novembre : *« Je t'autorise à préparer et
> développer localement les corrections de sécurité nécessaires à la mise en
> place de la recette. »*
>
> **Aucune ressource cloud créée · aucune migration appliquée · aucun
> déploiement · aucun push · aucun envoi réel · aucune signature · aucune
> donnée de production modifiée.**
>
> Ce document est le dernier des trois du Lot C. Les deux premiers sont
> conservés : [la faisabilité](LOT-C-ENVIRONNEMENT-RECETTE.md) et
> [l'audit](LOT-C-AUDIT-ET-PROPOSITION.md).

---

## Ce qu'il faut savoir avant tout le reste

**`npm run dev` refuse désormais de démarrer sur votre poste.** C'est voulu,
et c'est la correction la plus importante du lot : dans l'état d'hier, un
serveur de développement visait la base de production avec les clés Brevo et
Ringover actives. Le garde-fou nomme ce qui l'empêche de démarrer.

Deux façons de repartir, documentées dans
[.env.recette.example](../.env.recette.example) :

1. **la recette** — remplir `.env.recette` et le copier en `.env.local` ;
2. **la production, délibérément** — ajouter `CGK_ENV=production` à votre
   `.env.local`. Le garde-fou n'empêche jamais la production de démarrer ; il
   exige seulement que ce soit **déclaré**, et non le résultat d'un fichier
   qu'on avait oublié de relire.

Pour voir ce que l'application verrait, sans rien lancer : `npm run verif:cible`.

---

## L1 — Rapport des corrections effectuées

Huit anomalies corrigées, dont **cinq 🔴**. Trois d'entre elles invalidaient le
plan d'isolation que je vous avais présenté la veille.

| # | Anomalie | Correction | Preuve |
| --- | --- | --- | --- |
| **E4** 🔴 | Retirer `BREVO_API_KEY` ne coupait pas l'envoi : il le **basculait** sur un repli SMTP | Goulet unique sur les **trois** accès réseau d'envoi, et **au-dessus du choix du canal** | 56 assertions · mutation détectée |
| **E5** 🔴 | Un lien de signature de recette pointait sur la **production** | `domainForSector()` ne rend son domaine en dur qu'en production ; liste blanche partout | 65 assertions · mutation détectée |
| **D9** 🔴 | 25 variables lues par le code, absentes de `.env.example` | 56 variables documentées, 9 champs chacune | **couverture 56/56, écart nul** |
| **E3** 🔴 | Intégrations sortantes raccordées au réel sur le poste | Garde-fou de démarrage + goulet d'envoi | **`next dev` réel : refusé** |
| **D5** 🔴 | Clé de production en clair dans un commentaire | Commentaire retiré, variables actives intactes | 19 = 19 avant/après |
| **D7** 🟠 | La semence ne se chargeait pas sur un projet neuf | 13 `on conflict do nothing` + diagnostic | comptage |
| **D8** 🟠 | Semences rattachées à deux adresses réelles | **47 adresses** sur domaine réservé RFC 2606 | vérification exhaustive |
| **D12** 🟠 | WF2 documenté mais jamais lu | **Élucidé** : retiré volontairement le 4 novembre | `lib/app-settings.ts` |

**Partiellement corrigées, et le registre le dit** : D10 (le contrôle du
bundle est une commande, il manque le déclencheur) et D11 (le secret du cron
en URL est refusé hors production, toléré-journalisé en production).

**Trois anomalies nouvelles** : D14 (la clé exposée demande une rotation),
D15 (la mention des produits ne dépend pas de la société émettrice), D16 (il
n'y a toujours pas de CI).

### Fichiers créés

| Fichier | Rôle |
| --- | --- |
| `lib/env/mode.ts` | Détection du mode. **Sans `node:crypto`**, pour pouvoir être consulté par du code pouvant finir dans un graphe client |
| `lib/env/cible.ts` | La décision : cinq familles de danger. **Pur** |
| `lib/env/garde-demarrage.ts` | La seule couche qui lit `process.env` |
| `instrumentation.ts` | Point d'entrée au démarrage du serveur |
| `lib/envoi/decision.ts` | Un envoi réel part-il ? **Pur** |
| `lib/envoi/garde-server.ts` | Le goulet, et la capture sur disque |
| `lib/urls/base-publique.ts` | Résolution d'URL publique + liste blanche. **Pur** |
| `lib/urls/base-publique-server.ts` | Lecture de l'environnement et des en-têtes |
| `scripts/verif-cible/` | « Sur quoi vais-je taper ? » |
| `scripts/check-bundle/` | Le contrôle du CDC §8.2, en commande |
| `scripts/recette-check/` | 191 contrôles : refus, transports, URL |
| `supabase/migrations/20261108000001_…` | M1, **préparée, non appliquée** |
| `.env.recette.example` | Gabarit de l'environnement de recette |

### Fichiers modifiés

`lib/brevo.ts` · `lib/devis/email.ts` · `lib/devis/sender.ts` ·
`lib/devis/sign.ts` · `lib/cert-hotte/send.ts` ·
`app/(app)/_shared/signature-actions.ts` · `app/api/devis/envoyer/route.ts` ·
`app/api/presence/evaluate/route.ts` · `.env.example` (réécrit) ·
`supabase/seed.sql` · `supabase/seed_bulk_demo.sql` · `.gitignore` ·
`package.json` (3 commandes) · `.env.local` (un commentaire retiré).

**Le découpage pur / serveur n'est pas une élégance** : c'est ce qui permet à
la suite de contrôles d'exercer la décision sans fabriquer de variables
d'environnement — donc de **prouver** qu'une configuration dangereuse est
refusée. Une garde qui lit elle-même son environnement ne se teste pas.

---

## L2 — Inventaire des variables d'environnement

[.env.example](../.env.example) réécrit : **906 lignes, 56 variables**, les
neuf champs demandés pour chacune — service · utilisation · obligatoire ·
environnement · valeur attendue · si absente · repli · protection.

**Aucune valeur secrète réelle n'y figure**, et un contrôle le vérifie (ni
valeur renseignée, ni clé Brevo, ni jeton JWT).

### Les écarts de décompte, mesurés

| | Avant | Après |
| --- | --- | --- |
| Variables lues par le code | 56 | 56 |
| Documentées | **21** | **56** |
| **Manquantes** | **25** | **0** |
| Documentées mais jamais lues | 3 | 3, conservées **et expliquées** |

Le fichier est **généré depuis une table**, puis comparé à la liste des
variables réellement lues. Un inventaire « exhaustif » affirmé à la main est
exactement ce qui a produit l'écart de 25.

**Mon premier inventaire avait lui-même un angle mort** : les accès
**dynamiques** `process.env[nom]`, où le nom vient d'une table du code. C'est
par là que les domaines par secteur — la vraie fuite E5 — avaient échappé au
comptage. Le contrôle de couverture cherche désormais les trois formes.

Les 3 variables jamais lues sont conservées commentées : les retirer en
silence ferait croire qu'elles n'ont jamais existé.

---

## L3 — Rapport de sécurisation des e-mails

### Tous les transports, inventoriés

Il y a **exactement trois accès réseau d'envoi** dans le dépôt :

| # | Point | Transport |
| --- | --- | --- |
| 1 | `lib/brevo.ts` → `api.brevo.com/v3/smtp/email` | Brevo e-mail |
| 2 | `lib/brevo.ts` → `api.brevo.com/v3/transactionalSMS/sms` | Brevo SMS |
| 3 | `lib/devis/email.ts` → `transport.sendMail()` | **SMTP/nodemailer** |

**Onze points d'appel métier** s'appuient dessus (pipeline, chiffrage,
contrats, médias, signature, certificat, centralisation…). Le goulet est posé
sur les **trois transports**, pas sur les onze appels : deux endroits à tenir,
pas onze à surveiller.

Un contrôle **compte** les accès réseau : un quatrième fera échouer la suite
plutôt que de passer inaperçu.

### Le défaut, et pourquoi il comptait

`lib/devis/email.ts` basculait sur SMTP *« si Brevo n'est pas configuré »*. Et
`SMTP_HOST` a un **défaut en dur** (`smtp.hostinger.com`) : le repli n'avait
besoin que de `SMTP_USER` et `SMTP_PASS` pour partir réellement. Aucune des
six variables SMTP n'était documentée.

Le goulet est donc posé **au-dessus du choix du canal** — car c'était le choix
du canal qui était le défaut — y compris sur le cas « aucun canal configuré »,
qui levait une exception sans rien capturer.

### En recette

| Exigence du client | Réalisation |
| --- | --- |
| Aucun envoi réel par défaut | `deciderEnvoi()` refuse hors production |
| Aucun transport de secours ne contourne | goulet sur les 3, **au-dessus** du choix du canal |
| Destinations contrôlées | `CGK_DESTINATAIRES_AUTORISES` : adresse exacte, domaine `@…`, ou numéro comparé **sur les chiffres** (un espace ne contourne pas) |
| Erreurs explicites | le refus nomme son code, son motif et le geste qui l'autorise |
| Tentatives traçables | capture sur disque : JSON + **pièces jointes**, et `console.warn` |
| Mécanisme de simulation | la capture **est** la simulation |

**Un message capturé rend `{ ok: false }`.** Faire croire à l'interface que
l'envoi a réussi serait une validation fictive — on vérifierait un écran
affichant « Envoyé » alors que rien n'est parti. Un contrôle vérifie qu'il
n'existe **qu'un seul** `return { ok: true }` dans la garde.

Et une capture qui échoue **ne devient pas une autorisation**.

---

## L4 — Rapport de sécurisation des signatures

### Les cinq points, et lequel fuyait vraiment

| # | Point | Produisait | État |
| --- | --- | --- | --- |
| 1 | `app/(app)/_shared/signature-actions.ts` | lien `/sign/{token}` | en-tête **non validé** |
| 2 | `app/api/devis/envoyer/route.ts` | lien `/devis-signer/{token}` | en-tête non validé **+ point 5** |
| 3 | `lib/devis/sign.ts` | bannière de l'e-mail signé | repli `crmoptimum.com` en dur |
| 4 | `lib/cert-hotte/send.ts` | bannière du certificat | repli `crmoptimum.com` en dur |
| 5 | `lib/devis/sender.ts` `domainForSector()` | base par **secteur** | **domaines de production en dur** |

**Je vous avais nommé le mauvais vecteur.** J'avais désigné le repli
`|| "https://crmoptimum.com"` ; il n'alimente que les **bannières**. Le lien
de signature OPTIMIVV vient du point 5 :

```ts
const sectorBase = domainForSector(sector) ?? (await baseUrl());
signUrl = `${sectorBase}/devis-signer/${…}`;
```

`domainForSector()` rendait `https://devis.optimivv-nettoyage.com` — une
constante de production — **quel que soit le mode**. Un devis de recette
partait donc avec un lien vers le site réel, et le client fictif aurait signé
contre la base réelle. C'est une fuite **par le lien**, qu'aucune isolation de
base de données n'arrête.

### Ce qui est imposé maintenant

| Exigence | Réalisation |
| --- | --- |
| Plus de repli dangereux | retiré des points 3 et 4 ; le point 5 ne s'applique qu'en production |
| Aucun lien vers la production en recette | liste blanche + refus explicite |
| Pas d'URL depuis un en-tête non validé | l'en-tête est **comparé à la liste blanche**, sinon refusé |
| Domaines explicitement définis | `CGK_DOMAINES_PUBLICS`, **obligatoire hors production** (le garde-fou refuse de démarrer sans) |
| Configuration manquante → refus explicite | `configuration_absente`, avec le geste à faire |
| Liens vérifiés avant émission | `verifierLien()` sur le lien **final** |

**Les parcours de production sont préservés** : en mode `production`, le repli
subsiste sur le premier domaine autorisé et il est **journalisé**. Le code
tourne aujourd'hui sans `SIGNATURE_BASE_URL` ; le retirer partout couperait la
signature en production, ce qui n'est pas demandé.

Une amélioration de robustesse au passage : dans `signature-actions.ts`, l'URL
est résolue **avant** de créer la demande de signature. L'ordre inverse
laissait une demande orpheline quand l'e-mail ne pouvait pas partir.

---

## L5 — Rapport du garde-fou de démarrage

`instrumentation.ts` → `register()`, qui s'exécute **une fois** et doit se
terminer **avant que le serveur accepte des requêtes** (vérifié dans
`node_modules/next/dist/docs/`, comme l'impose AGENTS.md). C'est le seul
endroit où « refuser de démarrer » signifie vraiment refuser de démarrer.

### Les cinq contrôles demandés

| # | Contrôle | Code du grief |
| --- | --- | --- |
| 1 | La base cible correspond à la production | `base_production` |
| 2 | Un service externe pointe vers le réel | `brevo_actif` · `smtp_actif` · `transport_force_smtp` · `ringover_actif` · `docusign_production` |
| 3 | Une URL de signature est incorrecte | `url_signature_absente` · `_hors_liste` · `_illisible` · `_production` |
| 4 | Des secrets de production sont détectés | `cle_production_detectee` |
| 5 | Une configuration critique manque | `base_absente` · `domaines_non_declares` · `chiffrement_absent` · `cron_absent` |

**Mode restrictif** : en cas d'incertitude, refus. Une valeur de `CGK_ENV` non
reconnue n'est jamais devinée — elle est ignorée **et signalée**, et le repli
ne vaut jamais `production`.

### Détecter la clé de production sans la stocker

On compare des **empreintes** : `CGK_EMPREINTE_CLE_PRODUCTION` porte un
sha256 tronqué à 12 caractères, non réversible. Aucun secret ne figure dans un
fichier de configuration, un script ou un rapport, et la détection fonctionne.

### La production ne peut pas être mise à l'arrêt

En mode `production`, tous les griefs sont ramenés à des **avertissements**. La
production tourne aujourd'hui sans aucune de ces variables ; un garde-fou qui
l'empêcherait de démarrer serait une panne que personne n'a demandée.

Quatre assertions figent cette promesse, dont une configuration de production
« la plus chargée possible » — base de production, Brevo réel, SMTP forcé,
Ringover réel, DocuSign en production, clé de production — qui **démarre**.

### Prouvé par exécution

```
── CGK CRM · vérification de la cible ──
  [BLOQUANT] brevo_actif
  [BLOQUANT] ringover_actif
  [BLOQUANT] url_signature_absente
VERDICT : CIBLE REFUSÉE.
Error: An error occurred while loading instrumentation hook: Démarrage refusé…
```

Et vérifié ensuite : `curl http://localhost:3132/login` → **aucune connexion**,
aucun processus `node` survivant. Le refus n'est pas cosmétique.

---

## L6 — Rapport du script de vérification de cible

`npm run verif:cible` — lecture seule, aucun appel réseau, aucune commande
Supabase. Il lit **le fichier d'environnement lui-même**, parce que `.env.local`
est chargé par Next et non par Node : c'est ce que l'**application** verrait.

Il rapporte : le mode · l'hôte de la base · la production déclarée · l'URL de
signature · les domaines autorisés · l'état `CONFIGURÉ / absent` des six
services sortants · tous les griefs · le **projet lié à la CLI** · le nombre de
migrations et leurs trois dernières.

**Il n'imprime aucun secret** : seuls le mode, des hôtes (publics) et des
*noms* de variables sortent. Quatre assertions le vérifient en lui soumettant
des secrets factices et en cherchant leur trace dans la sortie.

Il **signale** le cas le plus traître : *« le projet LIÉ à la CLI n'est PAS
celui que l'application vise »*. Et il rappelle que
`supabase db reset --linked` détruit la base du projet lié.

Sortie **0** si la cible est acceptable, **1** si elle est refusée : il peut
donc garder une commande de migration.

Exécuté aujourd'hui sur `.env.local`, il **refuse** — en nommant Brevo actif,
Ringover actif et l'absence d'URL de signature.

---

## L7 — État des migrations et des semences

### Les 177 fichiers de migration

| Période | Fichiers |
| --- | --- |
| 2026-05 | 17 (schéma initial : énumérations, tables, index, fonctions, RLS) |
| 2026-07 | 18 |
| 2026-08 | 80 |
| 2026-09 | 17 |
| 2026-10 | 39 |
| 2026-11 | 6 **dont M1, préparée et non appliquée** |

**176 existantes + M1.** Contenu : **123 `create policy`**, 67 `enable row
level security`, 24 fonctions `security definer`, 6 buckets de stockage.

### Les 90 migrations porteuses de données, et leur risque propre

| Classe | Nombre | Risque au rejeu |
| --- | --- | --- |
| `insert` seul — données de référence (activités, modèles, grilles, compteurs) | **81** | **Collision d'unicité** si la ligne existe déjà. C'est exactement ce qui cassait la semence (D7). |
| `insert` + `update` — reprise de données | **9** | Les plus délicates : elles **réécrivent** des lignes existantes. Rejouées sur une base déjà reprise, elles peuvent écraser une correction postérieure. |

Autres mesures de rejouabilité : **1** migration fait un `drop table/column`,
**0** renomme, **9** contiennent un `delete from`. **23** emploient
`create table if not exists`, **31** `add column if not exists` — donc une
majorité **n'est pas** idempotente, ce qui est normal pour une migration
appliquée une fois, et décisif pour le rejeu depuis zéro.

### Ordre, dépendances, contraintes, RLS

- **Ordre** : lexicographique sur l'horodatage du nom. Les six derniers mois
  respectent la convention `AAAAMMJJ` + index.
- **Dépendances** : le schéma initial crée tout le socle avant les 159 autres.
  Mesuré : **aucune** migration ne résout un utilisateur par adresse e-mail —
  aucune ne se taira donc silencieusement sur un projet neuf pour cette raison.
- **Fonctions de sécurité** : `is_admin()` et `is_planificateur()`, créées par
  `20260515000005_init_rls.sql`, sont la dépendance de la RLS de M1. Vérifié.
- **Reprise après échec** : `supabase db push` s'arrête à la première migration
  en échec et **enregistre les précédentes** comme appliquées. Une reprise
  reprend donc où elle s'est arrêtée — à condition de corriger le fichier
  fautif sans renuméroter.

**Ce qu'aucune de ces mesures ne remplace** : les 177 migrations n'ont
**jamais** été rejouées depuis une base vide. Ce qu'elles cachent se
découvrira en les appliquant, et je ne prétends pas le prédire.

### M1, préparée

`supabase/migrations/20261108000001_document_versions_historique_devis.sql`.
**Non appliquée.** Purement additive, deux politiques RLS calquées sur celles
de `documents`, trigger *append-only*, plan de retour arrière complet.

⚠️ **Risque connu, consigné** : ces politiques sont **dupliquées, pas
dérivées**. Si celle de `documents` évolue, les deux divergent. Une suite de
contrôles devra vérifier qu'elles accordent les mêmes accès.

### Les semences

| Fichier | Avant | Après |
| --- | --- | --- |
| `seed.sql` | **ne se chargeait pas** : 14 `insert`, 1 `on conflict` | 13 clauses ajoutées + diagnostic final |
| `seed_bulk_demo.sql` | 2 adresses **réelles** de l'équipe | comptes `@example.invalid` + avertissement |
| `seed_test_data.sql` | idempotent | inchangé |

La forme `on conflict do nothing` **sans cible** est volontaire : elle
fonctionne quelle que soit la contrainte, et survit à son évolution.

`legal_entities` et `prestations` n'ont **aucune** unicité hors `id` : un
double chargement ne échoue pas, il **duplique**. Rien en base ne l'empêche,
donc un bloc de diagnostic le **rend visible** — une recette bâtie sur
quatorze sociétés dont sept sont des copies serait pire qu'une qui refuse.

**47 adresses** basculées sur `example.invalid` (RFC 2606). Mon premier
correctif n'avait traité que les deux adresses de l'équipe ; le contrôle que
j'ai écrit pour le vérifier en a trouvé **douze autres** — des noms fictifs
sur gmail, outlook et yahoo. Un nom inventé sur un domaine réel n'est pas une
donnée de test : c'est une adresse qui peut joindre quelqu'un.

**Ce que je n'ai PAS écrit** : le quatrième fichier de semence couvrant les 5
pays, les découvertes, les sous-traitants, les contrats, les notifications et
les paiements fictifs (§4.2). **Délibérément.** Du SQL qui n'a jamais tourné
contre une base n'est pas un livrable, c'est un brouillon — et il porterait sur
13 types d'entités réparties sur 83 tables. Il s'écrira en phase 4, contre la
base de recette, où chaque insertion se vérifie.

---

## L8 — Rapport de sécurité des secrets

### Les trois problèmes

**1. Secret de production dans un commentaire (D5).** Retiré. Deux lignes : la
commande `docker compose exec … printenv` et sa sortie. **Les 19 variables
actives sont vérifiées identiques avant et après** — le client avait été
explicite, « ne modifie pas silencieusement les identifiants de production ».
La valeur active reste en place : l'application locale en a besoin pour lire la
base qu'elle vise.

**2. Secret du cron en paramètre d'URL (D11).** **Refusé hors production.**
**Toléré et journalisé** en production, avec un avertissement qui nomme la
correction. Je ne l'ai pas coupé en production : si le planificateur du VPS
appelle la route par l'URL, le moteur d'alertes et de relances s'arrêterait
**en silence** — et il porte `/ma-journee`, les alertes photos, la présence et
l'expiration des contrats. `CGK_CRON_SECRET_URL=refuse` bascule l'interdiction
partout, en une variable, le jour où l'appel du VPS est vérifié.

**3. Aucun contrôle automatisé du bundle (D10).** `npm run check:bundle` :
**14 secrets cherchés, 8 testables, 0 fuite sur 113 fichiers**. Aucune valeur
n'est imprimée — seuls le nom, le nombre de fichiers touchés et leur chemin.
Il échoue aussi quand **aucun** secret n'a pu être testé : un contrôle qui ne
peut pas échouer n'est pas un contrôle.

### Rotation de la clé de chiffrement — procédure

⚠️ **La clé doit être considérée comme exposée** : elle a séjourné en clair sur
un poste de travail. C'est l'anomalie **D14**, et c'est votre décision.

La rotation **n'est pas anodine** : tout champ déjà chiffré doit être relu avec
l'ancienne clé et réécrit avec la nouvelle, sans quoi il devient **illisible**.
Les champs concernés : l'annotation Immobilier/Travaux, la provenance
marketing (`source_url`, `utm_*`, `gclid`), les jetons OAuth DocuSign, et les
IBAN des sociétés.

1. Générer la nouvelle clé : `openssl rand -hex 32`. La conserver hors du dépôt.
2. **Sur la recette d'abord.** Appliquer la rotation, vérifier qu'un champ
   chiffré se relit.
3. Écrire un script de ré-encryption qui lit avec l'ANCIENNE clé et écrit avec
   la NOUVELLE, table par table, **avec une sauvegarde préalable**. Le format
   d'enveloppe `encv1:<iv>:<tag>:<ciphertext>` permet de distinguer le chiffré
   du legacy en clair.
4. En production : sauvegarde, fenêtre sans écriture, rotation, vérification.
5. Révoquer l'ancienne clé **seulement** après avoir vérifié qu'aucun champ ne
   reste illisible.
6. Les jetons OAuth DocuSign ne se ré-encryptent pas : **re-raccorder** DocuSign.

**Je n'ai lancé aucune étape de cette procédure** : elle touche les données de
production.

---

## L9 — État réel de WF2

Les six questions du §9, répondues par mesure.

| Question | Réponse |
| --- | --- |
| Existe-t-il ? | **Non, côté CRM.** Zéro occurrence de `N8N_WF2_TRIGGER_URL` et `N8N_WF2_TRIGGER_SECRET` dans tout le dépôt |
| Est-il utilisé ? | Non |
| Est-il déclenché ? | Non. Aucun appel sortant vers n8n pour la séquence |
| Est-il connecté au CRM ? | Non |
| Quelles fonctionnalités en dépendent ? | **Aucune** |
| Quelles actions sont attendues ? | **Aucun développement** — voir ci-dessous |

**Ce n'est pas un oubli : WF2 a été retiré volontairement.**
`lib/app-settings.ts` le dit :

> *« Le drapeau `n8n_sequence_enabled` et son lecteur `isN8nSequenceEnabled()`
> ont été retirés le 2026-11-04 avec l'envoi automatique des devis. »*

Le besoin historique est donc **confirmé comme abandonné**, et par votre propre
règle : *« Les devis ne doivent jamais être envoyés automatiquement. »*
Recâbler WF2 contredirait cette règle.

Les deux variables sont conservées dans `.env.example`, **commentées et
expliquées** : documenter une intégration qui n'existe pas fait croire qu'elle
fonctionne ; la supprimer sans un mot ferait croire qu'elle n'a jamais existé.

**WF1, lui, est bien raccordé** et reste en place : `/api/webhooks/leads/inbound`,
HMAC sur `LEADS_INBOUND_SECRET`.

---

## L10 — Résultats des tests

### Contrôles statiques

| Suite | Contrôles | Échecs |
| --- | --- | --- |
| `check:devis` | 1 437 | 0 |
| `check:docusign` | 1 163 | 0 |
| `check:superviseur` | 201 | 0 |
| **`check:recette`** (nouvelle) | **191** | **0** |
| **Total** | **2 992** | **0** |

Avant le lot : 2 801 sur 28 suites. Après : **2 992 sur 31 suites.**

### Outillage

| | Résultat |
| --- | --- |
| `tsc --noEmit` | ✅ aucune erreur |
| `npm run lint` | ✅ **0 erreur**, 1 avertissement préexistant |
| `npm run build` | ✅ **code de sortie 0**, compilé en 73 s |
| `npm run check:bundle` | ✅ 8 secrets testés, **0 fuite** sur 113 fichiers |
| `npm run verif:cible` | ✅ **refuse** la configuration actuelle, en la nommant |

### Tests fonctionnels — et la distinction demandée

Le §13 demande de **distinguer les contrôles statiques des tests
fonctionnels**. La distinction est nette, et elle n'est pas flatteuse :

**Un seul test fonctionnel a pu être exécuté** : le démarrage réel du serveur.
`npx next dev` → refus nommé, erreur du *hook* d'instrumentation, **aucun
processus survivant**, et `curl` sur le port → aucune connexion. C'est un vrai
test : un processus a été lancé, il a refusé, et l'absence de service a été
vérifiée de l'extérieur.

**Tout le reste est statique.** Aucun écran ouvert, aucun e-mail capturé par
un parcours réel, aucun lien de signature produit par un vrai devis, aucune
permission éprouvée en session. **2 992 contrôles statiques n'ont jamais
prouvé qu'une interface s'affiche.**

### Test par mutation — 8/8

« Un test qui ne sait pas échouer ne prouve rien. » Huit défauts **réels**
injectés, chacun reproduisant exactement ce que le lot vient de fermer :

| Mutation | Détectée |
| --- | --- |
| le repli SMTP n'est plus refusé (E4 réintroduite) | ✅ |
| la base de production n'est plus refusée | ✅ |
| `domainForSector` rend son domaine partout (la vraie fuite) | ✅ |
| un repli vers la production est réintroduit | ✅ |
| l'en-tête de requête n'est plus validé | ✅ |
| un message capturé se fait passer pour envoyé | ✅ |
| l'autorisation d'envoi n'exige plus de liste blanche | ✅ |
| `sendBrevoSms` n'appelle plus la garde | ✅ |

**8/8**, tous les fichiers restaurés au **md5**.

Deux de mes propres assertions étaient fausses et ont été corrigées, non
contournées : l'une cherchait un motif qui décrivait la forme **correcte** du
code ; l'autre comptait des occurrences d'un littéral présentes dans une
déclaration de type et un commentaire — elle mesurait la prose, pas le
comportement.

---

## L11 — Registre consolidé actualisé

[REGISTRE-CORRECTIONS-FINALES.md](REGISTRE-CORRECTIONS-FINALES.md), six états,
**72 entrées**, totaux par comptage :

| État | Avant | Après |
| --- | --- | --- |
| Ouverte | 28 | **23** |
| Corrigée | 21 | **29** |
| À vérifier | 13 | 13 |
| Reportée | 7 | 7 |
| Validée en recette | 0 | **0** |
| Non reproductible | 0 | 0 |

**Vérifié par comparaison avec la version précédente : aucun identifiant n'a
disparu.** Huit ont changé de partie — corrigées, pas effacées.

Les parties E et F restent **vides**, et le resteront jusqu'à ce qu'un
environnement de recette existe. Les laisser vides **est** l'information.

---

## L12 — Fonctionnalités historiques à préserver

Les **15** entrées de [l'audit](LOT-C-AUDIT-ET-PROPOSITION.md) sont inchangées
et toujours en place. **Aucune n'a été retirée, contournée ni dégradée.**

Trois ont été **touchées** par ce lot, et voici exactement comment :

| Fonctionnalité | Ce qui change | Ce qui ne change pas |
| --- | --- | --- |
| **Expéditeurs et domaines par secteur** (`lib/devis/sender.ts`) | hors production, le domaine en dur n'est plus appliqué | **en production, rien ne change.** Une surcharge explicite par variable est toujours respectée, dans tous les modes |
| **Signature auto-hébergée** | l'URL est validée, et résolue avant la création de la demande | le jeton 256 bits, le hachage SHA-256, le parcours `/sign/[token]` |
| **Cron et moteur d'alertes** | le secret en URL est refusé hors production | **l'appel du VPS continue de fonctionner**, avec un avertissement journalisé |

Une **quatrième** est concernée indirectement : la **numérotation sans trou**.
Le refus d'un lien de signature intervient **avant** l'allocation du numéro,
dans `signature-actions.ts` comme dans `/api/devis/envoyer`. Un refus ne troue
donc pas la séquence.

---

## L13 — Risques résiduels

| # | Risque | Gravité | Portée |
| --- | --- | --- | --- |
| **R1** | **La clé de chiffrement de production reste celle qui a été exposée** (D14). Le commentaire est retiré, la clé est inchangée. | 🔴 | Lisibilité des champs confidentiels si la clé a fui |
| **R2** | **Les 177 migrations n'ont jamais été rejouées depuis zéro.** 81 collisionnent sur une unicité, 9 réécrivent des données. | 🟠 | La durée de la phase 4 est imprévisible |
| **R3** | **La CLI Supabase est toujours liée à la production.** Le script la **signale** ; il ne la délie pas. | 🟠 | `db push`/`db reset` lancés sans vérifier |
| **R4** | **Le garde-fou ne protège que le démarrage.** Un `.env.local` modifié pendant l'exécution n'est pas revu. | ⚪ | Faible : Next redémarre à chaud sur ces fichiers |
| **R5** | **Les politiques RLS de M1 sont dupliquées, pas dérivées.** | 🟠 | Divergence future avec `documents` |
| **R6** | **Le secret du cron en URL reste toléré en production.** | 🟠 | Secret dans les journaux du proxy |
| **R7** | **La mention des produits n'est pas par société** (D15). | 🟠 | Une société pourrait porter une allégation qu'elle n'a pas assumée |
| **R8** | **Aucune CI** (D16). Les huit commandes existent ; rien ne les lance. | ⚪ | Une régression peut passer |
| **R9** | **`npm run dev` refuse désormais sur votre poste.** Voulu, mais c'est un changement de votre quotidien. | ⚪ | Gêne, levée par `.env.recette` ou `CGK_ENV=production` |
| **R10** | **Le quatrième fichier de semence n'existe pas.** Les données de test ne couvrent pas les 5 pays, les découvertes, les sous-traitants, les contrats, les notifications ni les paiements fictifs. | 🟠 | Scénarios des §7, §10, §11 et §12 non exécutables en l'état |

---

## L14 — Procédure de création de l'environnement de recette

**À exécuter après votre décision.** Rien de ceci n'a été fait.

### Étape 0 — vous

Créer le projet Supabase de recette (région `eu-west-1`, la même que la
production pour que les latences soient comparables). Me transmettre les
4 clés et le mot de passe de base.

### Étape 1 — isolation, avant toute donnée

```bash
cp .env.recette.example .env.recette      # puis renseigner
npm run verif:cible -- .env.recette       # doit sortir 0
cp .env.local .env.production.sauvegarde  # hors du dépôt
cp .env.recette .env.local
npm run verif:cible                       # doit sortir 0
```

### Étape 2 — lier la CLI à la recette

```bash
npx supabase link --project-ref <ref-de-recette>
npm run verif:cible    # vérifie que le projet LIÉ est bien celui visé
```

⚠️ **Avant chaque commande `supabase`, lire la sortie de `verif:cible`.**
`supabase db reset --linked` détruit la base du projet lié.

### Étape 3 — les migrations (c'est l'étape longue)

```bash
npx supabase db push --dry-run     # ce qui serait appliqué
npx supabase db push --include-all # l'application réelle
```

Corriger, recommencer. `db push` enregistre les migrations réussies : une
reprise reprend où elle s'est arrêtée, à condition de ne pas renuméroter.

### Étape 4 — la semence

`--include-seed` est **inerte** : il lit la semence « from your config », et il
n'y a pas de `config.toml`. Charger explicitement, dans l'ordre, par l'éditeur
SQL ou `psql` : `seed.sql`, puis `seed_bulk_demo.sql`, puis
`seed_test_data.sql`. Lire le `raise notice` final et vérifier l'absence de
`warning` sur les doublons.

### Étape 5 — les comptes

Par inscription dans l'application, **l'administrateur en premier** : le
premier inscrit reçoit automatiquement le rôle `admin`. Puis les cinq autres
(deux commerciaux de profils différents, planification, superviseur, un
commercial `en_attente`).

### Étape 6 — la sécurité

```bash
npm run check:recette && npm run build && npm run check:bundle
```

Puis les dix tests S1–S10 de [l'audit](LOT-C-AUDIT-ET-PROPOSITION.md), dont la
fuite RLS **par la clé anon directement**, et non par l'interface qui filtre
déjà.

### Étape 7 — M1 et superviseur, sur la recette seulement

```bash
npx supabase db push    # applique 20261108000001 (M1) et 20261105000001
npx supabase gen types typescript --linked > lib/supabase/database.types.ts
```

La régénération des types ferme **D13** : les quatre colonnes du superviseur
cesseront d'être déclarées sans exister.

### Étape 8 — la recette fonctionnelle

Les 13 vérifications de la partie C du registre, puis le catalogue de
scénarios du §L8 de l'audit.

---

## Traçabilité

| Demande initiale | Origine | Lot | Fonctionnalité développée | Emplacement CRM | Dépendances | Test | Résultat | Correction | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Compléter `.env.example`, 9 champs (§2) | client 08-11 | C | Inventaire généré + contrôle de couverture | `.env.example` | — | comparaison code ↔ fichier | 🟢 **56/56, écart nul** | angle mort des accès dynamiques corrigé | livré |
| Identifier tous les transports (§3) | client 08-11 | C | Inventaire : 3 accès réseau, 11 appels | `lib/brevo.ts`, `lib/devis/email.ts` | — | comptage dans la suite | 🟢 3 exactement | — | livré |
| Aucun envoi réel par défaut (§3) | client 08-11 | C | Goulet + capture disque | `lib/envoi/` | mode | 56 assertions + 3 mutations | 🟢 | — | livré |
| Aucun transport de secours ne contourne (§3) | client 08-11 | C | Goulet **au-dessus** du choix du canal | `lib/devis/email.ts` | goulet | mutation E4 | 🟢 détectée | — | livré |
| Supprimer les replis vers crmoptimum (§4) | client 08-11 | C | Résolveur + liste blanche | `lib/urls/` | mode | 65 assertions | 🟢 | **vecteur réel corrigé** : `domainForSector`, pas le repli nommé | livré |
| Valider l'en-tête non fiable (§4) | client 08-11 | C | En-tête comparé à la liste blanche | `lib/urls/base-publique.ts` | — | 2 mutations | 🟢 | — | livré |
| Tester les 5 points d'URL (§4) | client 08-11 | C | Suite dédiée | `scripts/recette-check/urls.ts` | — | 65 assertions | 🟢 | — | livré |
| Garde-fou de démarrage, 5 contrôles (§5) | client 08-11 | C | `instrumentation.ts` + décision pure | `lib/env/` | Next 16 | 70 assertions + **`next dev` réel** | 🟢 **refus prouvé** | — | livré |
| Prouver le refus des configs dangereuses (§5) | client 08-11 | C | 8 mutations | `scripts/recette-check/` | — | 8 injections | 🟢 **8/8** | 2 assertions fausses corrigées | livré |
| Script de vérification de cible (§6) | client 08-11 | C | `npm run verif:cible` | `scripts/verif-cible/` | — | exécution réelle | 🟢 **refuse l'état actuel** | — | livré |
| Corriger les semences (§7) | client 08-11 | C | 13 `on conflict` + 47 adresses + diagnostic | `supabase/seed*.sql` | — | vérification exhaustive | 🟢 | 12 adresses de plus trouvées par mon propre contrôle | livré |
| Préparer M1 (§7) | client 08-11 | C | Fichier de migration | `supabase/migrations/20261108000001_…` | `documents`, `users`, `is_admin()` | audit des dépendances | 🟢 **non appliquée** | — | livré |
| Documenter les 176 migrations (§7) | client 08-11 | C | §L7 | ce document | — | mesures | 🟢 81 + 9 classées | — | livré |
| Secret en commentaire (§8) | client 08-11 | C | Commentaire retiré | `.env.local` | — | 19 variables comparées | 🟢 identiques | — | livré |
| Secret du cron en URL (§8) | client 08-11 | C | Refusé hors production | `app/api/presence/evaluate/` | mode | lecture | 🟠 **partiel, assumé** | toléré en production pour ne pas couper le cron | **D11 ouverte** |
| Contrôle automatisé du bundle (§8) | client 08-11 | C | `npm run check:bundle` | `scripts/check-bundle/` | build | exécution réelle | 🟢 0 fuite / 113 | CI absente | **D16 ouverte** |
| Rotation si clé exposée (§8) | client 08-11 | C | Procédure en 6 étapes | §L8 | votre décision | — | 🟠 **non exécutée** | — | **D14 ouverte** |
| Statut réel de WF2 (§9) | client 08-11 | C | §L9 | ce document | — | recherche exhaustive | 🟢 **retiré volontairement le 04-11** | aucun développement, conformément à votre règle | livré |
| Préserver l'Option A (§10) | client 08-11 | C | Aucune modification | `lib/supervision-*` | — | relecture | 🟢 intacte | — | livré |
| Vérifier la règle des mentions (§11) | client 08-11 | C | Vérification | `lib/generation/mentions-produits.ts` | — | lecture des 5 textes | 🟠 **textes conformes**, mais par PAYS et non par société | non développé : hors périmètre autorisé | **D15 ouverte** |
| Registre à 6 états, totaux calculés (§12) | client 08-11 | C | Mise à jour | registre | — | comptage + comparaison | 🟢 **72 entrées, 0 perdue** | — | livré |
| Tests obligatoires (§13) | client 08-11 | C | §L10 | ce document | — | exécution réelle | 🟢 **2 992 · 0 échec** | — | livré |
| « Ne touche pas à la production » | client 08-11 | C | aucune | — | — | journal des commandes | 🟢 **respecté** | — | livré |
| « Ne pousse rien » | client 08-11 | C | aucune | — | — | `git rev-parse` | 🟢 `origin/main` = `2dab6a2` | — | livré |

---

## Ce que j'attends de vous

| # | Décision |
| --- | --- |
| 1 | **Créer le projet Supabase de recette** et me transmettre les 4 clés + le mot de passe. C'est le seul blocage. |
| 2 | **Arbitrer la rotation de la clé de chiffrement** (D14). La procédure est au §L8 ; elle touche les données de production, je n'en ai lancé aucune étape. |
| 3 | **Vérifier comment le planificateur du VPS appelle `/api/presence/evaluate`** — en-tête ou paramètre d'URL. La réponse permet de fermer D11 en une variable. |
| 4 | **Arbitrer D15** : la mention des produits doit-elle dépendre de la société émettrice ? Et l'ordre des deux allégations françaises doit-il suivre votre formulation ? |
| 5 | **Confirmer que `npm run dev` peut refuser** sur votre poste, ou me dire si vous préférez un avertissement plutôt qu'un blocage en mode développement. |
