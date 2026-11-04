# DocuSign eSignature — configuration et exploitation

Signature électronique des contrats de sous-traitance. Ce document est le
runbook : quoi créer chez DocuSign, quoi mettre dans l'environnement, comment
raccorder une société, et quoi surveiller.

> **État réel au 3 novembre 2026.** Le code est écrit et testé hors réseau
> (131 assertions). **Aucune enveloppe réelle n'a été envoyée** : il n'existe
> ni compte DocuSign Developer, ni identifiants dans ce CRM. Le premier envoi
> en bac à sable est l'étape de validation qui reste à faire, et elle demande
> votre autorisation explicite.

---

## 1. Ce qui est en place

| Élément | Fichier | État |
|---|---|---|
| Configuration et séparation démo/production | `lib/docusign/config.ts` | écrit, testé |
| PKCE, `state`, expiration des jetons | `lib/docusign/pkce.ts` | écrit, testé |
| Échange, rafraîchissement, stockage chiffré | `lib/docusign/oauth-server.ts` | écrit, non testé en réseau |
| Client API (enveloppe, état, téléchargements, annulation) | `lib/docusign/client.ts` | écrit, non testé en réseau |
| Envoi d'un contrat | `lib/docusign/envoi-server.ts` | écrit, non testé en réseau |
| Webhook Connect | `app/api/webhooks/docusign/route.ts` | écrit, HMAC testé |
| Traitement, reprise, rattrapage | `lib/docusign/notifications-server.ts` | écrit, logique testée |
| Archivage PDF signé + certificat | `lib/docusign/archivage-server.ts` | écrit, non testé en réseau |
| Machine à états | `lib/docusign/statuts.ts` | existant, testé |
| Interface planificatrice | `app/(app)/planification/[id]/` | écrit |
| Migration | `supabase/migrations/20261103000001_docusign_oauth.sql` | **préparée, NON appliquée** |

---

## 2. Créer l'application DocuSign Developer

1. Ouvrir un compte sur <https://developers.docusign.com> (gratuit, bac à sable).
2. **Settings → Apps and Keys → Add App and Integration Key.**
3. Nommer l'application, par exemple `CRM OPTIMUM`.
4. **Authentication :** choisir **Authorization Code Grant**.
5. **Secret Key :** cliquer *Add Secret Key*. La valeur ne s'affiche qu'une
   fois — la recopier immédiatement.
6. **Redirect URIs :** ajouter l'URL **exacte** du retour. Elle doit
   correspondre au caractère près à `DOCUSIGN_REDIRECT_URI` :

   ```
   développement : http://localhost:3000/api/docusign/callback
   production    : https://crmoptimum.com/api/docusign/callback
   ```

   DocuSign refuse toute redirection non déclarée, et le CRM vérifie de son
   côté que l'URI employée est bien celle de la configuration — jamais une
   valeur déduite d'un en-tête de requête.

7. Noter l'**Integration Key** (= `DOCUSIGN_CLIENT_ID`).

### Scopes

Le CRM demande `signature extended`.

- `signature` autorise l'envoi et la lecture des enveloppes.
- `extended` est ce qui délivre un **jeton de rafraîchissement**. Sans lui,
  l'accès expirerait au bout de huit heures et il faudrait réautoriser chaque
  jour.

---

## 3. Variables d'environnement

Voir `.env.example`. Cinq variables, plus une déjà existante.

```bash
DOCUSIGN_ENV=demo                      # demo | production
DOCUSIGN_CLIENT_ID=<integration-key>
DOCUSIGN_CLIENT_SECRET=<secret-key>
DOCUSIGN_REDIRECT_URI=https://crmoptimum.com/api/docusign/callback
DOCUSIGN_CONNECT_HMAC_SECRET=<clé-hmac-connect>
FIELD_ENCRYPTION_KEY=<déjà requise par le CRM>
```

**`FIELD_ENCRYPTION_KEY` est obligatoire.** Les jetons OAuth sont chiffrés
(AES-256-GCM) avant d'être stockés. Sans elle, le raccordement est **refusé** :
un jeton de rafraîchissement en clair en base équivaudrait à un accès
permanent au compte DocuSign.

**`DOCUSIGN_ENV` vaut `demo` par défaut.** Toute autre valeur que `production`,
ou l'absence de variable, envoie vers le bac à sable. L'erreur silencieuse
acceptable est « rien n'est parti au vrai prestataire », jamais l'inverse.

---

## 4. Appliquer la migration

```bash
npx supabase db push
npx supabase gen types typescript --linked | Out-File -Encoding utf8 lib/supabase/database.types.ts
```

> Sous PowerShell, `>` écrit en UTF-16 et rend le fichier illisible pour ESLint
> et le bundler. Employer `Out-File -Encoding utf8`.

La migration crée :

- `docusign_connections` — un jeu de jetons par entité **et par
  environnement**, chiffrés. Aucune politique de lecture : seule la clé de
  service y accède, car un jeton n'a rien à faire dans un navigateur.
- `docusign_oauth_states` — `state` et `code_verifier` PKCE, à usage unique,
  dix minutes de validité.
- la **RLS activée sur les deux tables, sans aucune politique**. C'est
  volontaire : aucune session — pas même celle du Super Admin — ne lit ces
  lignes. Seule la clé de service y accède, et l'interface n'a jamais besoin
  du jeton, seulement de l'état de la connexion.
- la **révocation des privilèges de table** pour `anon` et `authenticated`.
  Supabase les accorde par défaut aux nouvelles tables de `public` ; les
  retirer fait du droit manquant un second verrou, indépendant de la RLS. Si
  quelqu'un ajoutait un jour une politique `select` par inadvertance, les
  jetons resteraient inatteignables.
- les **droits accordés explicitement à `service_role`**
  (`select, insert, update, delete`), plutôt que laissés à l'héritage des
  privilèges par défaut : l'intention est lisible dans la migration, et un
  changement de configuration Supabase ne coupe pas le raccordement en
  silence.
- `purge_docusign_oauth_states()`, appelée par la passe DocuSign du cron.

### Ce que la migration ne fait PAS

Elle est **strictement additive**. Aucun `ALTER` de colonne existante, aucun
`UPDATE`, aucun `DELETE`, aucun `DROP`, aucune politique sur une table
existante. `legal_entities` et `users` ne sont que des cibles de clés
étrangères.

Une première version ajoutait aussi des politiques RLS d'écriture sur
`docusign_envelopes`, `docusign_envelope_events` et `document_archive`, au
motif que la migration du 31 octobre n'avait créé que des politiques `select`.
Elles ont été **retirées** après vérification : toutes les écritures de ce
module passent par `supabaseServiceRole()`, qui contourne la RLS. Aucun chemin
de code n'en avait besoin, et les accorder aurait permis à un compte
back-office d'insérer des lignes arbitraires dans `document_archive` depuis un
navigateur.

Après régénération des types, les deux constantes `T_CONNEXIONS` et `T_ETATS`
de `lib/docusign/oauth-server.ts` peuvent redevenir des littéraux : le cast
n'existe que parce que les tables sont absentes des types générés.

---

## 5. Raccorder une société

Le raccordement est **par entité juridique** : chaque société peut avoir son
propre compte DocuSign, et les contrats partent au nom de celle qui les émet.

1. Se connecter en **Super Admin**.
2. Ouvrir `/api/docusign/connect?entity=<id-de-l-entité>`.
3. DocuSign demande l'autorisation ; l'accorder.
4. Le retour affiche le compte raccordé.

Réservé au Super Admin : raccorder un compte engage la société.

### Prérequis : le représentant légal

Raccorder DocuSign ne suffit pas. Le contrat s'ouvre sur le bloc
« ENTRE LES SOUSSIGNÉS », qui nomme la personne engageant la société — sans
elle le document n'est pas opposable, et `controlerEntite()` refuse l'envoi
avec le motif exact.

Deux champs sont concernés, dans **Réglages › Sociétés émettrices**, sur la
fiche de chaque société :

| Champ | Exemple |
|---|---|
| Représentant légal | `M. Jean DUPONT` |
| Qualité du représentant | `Président`, `Gérant`, `Directeur général` |

> **À faire avant le premier envoi.** Les colonnes existent depuis la
> migration `20261031000002`, mais aucun écran ne les renseignait jusqu'au
> 2026-11-04 : **les sept sociétés du CRM en sont dépourvues**. Tant qu'elles
> le restent, aucun contrat de sous-traitance ne peut partir, quelle que soit
> la qualité du raccordement DocuSign.
>
> La liste des sociétés signale désormais chaque fiche incomplète. Les
> valeurs ne sont pas devinables — elles doivent être saisies par quelqu'un
> qui connaît les statuts de chaque société.

Les deux champs restent facultatifs à l'enregistrement : les imposer aurait
bloqué toute modification sans rapport sur les sept fiches existantes. Le
refus intervient là où il compte, à l'émission du contrat.

### La limite de trente jours

DocuSign limite le jeton de rafraîchissement à **30 jours**. Chaque
rafraîchissement en délivre un nouveau et remet le compteur à zéro — un CRM
utilisé régulièrement reste donc connecté indéfiniment. Mais **trente jours
sans aucun envoi ni aucune notification coupent le raccordement**, et une
personne doit réautoriser.

La fiche dossier affiche un avertissement dès qu'il reste sept jours ou moins.

> **Recommandation.** Pour un envoi réellement sans utilisateur présent, le
> flux **JWT Grant** de DocuSign n'a pas cette limite : il s'authentifie avec
> une clé privée RSA, sans jeton à renouveler. C'est le flux que visaient les
> colonnes `legal_entities.docusign_key_env` et `docusign_user_id`, déjà
> présentes depuis le 31 octobre. Le flux Authorization Code + PKCE a été
> implémenté parce qu'il a été explicitement demandé ; si la coupure à trente
> jours devient gênante en exploitation, le basculement vers JWT Grant ne
> remet en cause que `oauth-server.ts` — le client, l'envoi, le webhook et
> l'archivage restent inchangés.

---

## 6. Configurer DocuSign Connect (webhook)

1. **Settings → Connect → Add Configuration → Custom.**
2. **URL to Publish :** `https://crmoptimum.com/api/webhooks/docusign`
3. **Include HMAC Signature :** activer, puis *Add Secret*. Recopier la valeur
   dans `DOCUSIGN_CONNECT_HMAC_SECRET`.
4. **Events :** cocher au minimum
   `Envelope Sent`, `Envelope Delivered`, `Envelope Completed`,
   `Envelope Declined`, `Envelope Voided`.
5. **Include Data :** cocher *Recipients*. Sans eux, « partiellement signé »
   ne peut pas se déduire.
6. **Require Acknowledgment :** activer. DocuSign réémet en cas d'échec, et le
   CRM est idempotent — un rejeu ne produit qu'un seul archivage.

### Sans la clé HMAC, aucune notification n'est acceptée

L'URL du webhook est publique : le proxy du CRM laisse passer `/api/*` sans
session. L'authentification repose donc **entièrement** sur la vérification
HMAC du corps brut. Sans clé configurée, le CRM **refuse** toute notification —
il n'accepte pas « parce que ce n'est pas configuré ». Un contrat ne doit pas
pouvoir être déclaré signé par un inconnu.

---

## 7. Le cron est load-bearing

`POST /api/presence/evaluate` exécute désormais **quatre** passes isolées,
dont une pour DocuSign :

- rejeu des notifications en échec (attente croissante : 1, 5, 15, 60, 240,
  720 minutes, puis abandon et alerte) ;
- rattrapage des enveloppes signées mais non archivées ;
- purge des états OAuth expirés, dans son **propre** try/catch imbriqué : cet
  entretien ne doit pas masquer les deux traitements précédents, dont dépend
  l'exactitude des signatures. Le filtre vit dans la fonction `security
  definer` — expiration dépassée de plus d'une heure — et non dans le code :
  impossible de l'élargir par erreur.

Sans ce cron, une notification perdue ou un téléchargement échoué laisserait un
contrat signé chez DocuSign mais **non archivé** dans le CRM. Voir
[CRON.md](CRON.md) pour la fréquence (toutes les 1–2 minutes).

---

## 8. Ce que fait l'envoi, dans l'ordre

L'ordre **est** la garantie. On n'écrit « envoyé » qu'après confirmation de
l'API.

1. Le contrat doit être **émis** (numéroté). Un brouillon est refusé.
2. Aucune enveloppe active sur ce contrat — protection contre le double clic.
3. Le connecteur est configuré, le chiffrement actif, l'entité raccordée.
4. Le prestataire a un courriel ; l'entité a un courriel de contact et un
   représentant légal.
5. Le PDF est régénéré depuis l'**instantané figé** à l'émission : c'est bien
   le document numéroté qui part.
6. Appel DocuSign, avec `X-DocuSign-Idempotency-Key` = référence du contrat.
7. **Seulement alors** : enveloppe enregistrée, contrat passé à « envoyé »,
   journal d'audit.

Si l'appel échoue, le contrat **reste dans son état réel** et le message dit
pourquoi. Jamais de confirmation verte sur un échec.

### Positionnement des signatures

Les champs sont posés par **ancrage** sur deux jetons invisibles écrits dans le
PDF (`lib/docusign/ancres.ts`), à la couleur du papier. Ni les coordonnées
absolues — la page du bloc de signature varie selon que le contrat compte
trente ou trente-et-un articles — ni une expression du contrat : « Le
Sous-traitant » revient des dizaines de fois dans les articles, et DocuSign
poserait un champ à chaque occurrence.

**Aucun mot du contenu contractuel n'est modifié.**

---

## 9. Archivage

Après signature complète, deux fichiers sont téléchargés et déposés dans le
bucket privé `document-archive` :

- le **PDF signé** (`documents/combined`) — ce qui a été signé ;
- le **certificat de réalisation** (`documents/certificate`) — qui a signé,
  quand, depuis quelle adresse, avec quelle empreinte.

L'un sans l'autre prouve beaucoup moins. Chaque fichier est enregistré dans
`document_archive` avec son empreinte SHA-256, son instantané d'entité et sa
date de conservation.

**L'archivage n'est terminé que quand le fichier est en place.** Si le
téléchargement échoue, l'événement reste en file et sera rejoué ; le contrat
n'est pas marqué « signé » tant que les pièces ne sont pas déposées.

### Confidentialité

Ces documents portent le **prix d'achat** du sous-traitant.

- Bucket **privé**, aucune URL permanente.
- Accès par **URL signée d'une heure au plus**, mintée par une action serveur
  qui vérifie le rôle.
- `document_archive` n'est lisible que par le back-office (RLS
  `is_admin() or is_planificateur()`).
- Le commercial n'a accès ni au module `/planification`, ni à la route PDF du
  contrat, ni aux pièces archivées.

---

## 10. Surveillance

| Quoi regarder | Où |
|---|---|
| Notifications en échec | `docusign_webhook_queue` où `etat = 'echec'` |
| Enveloppes signées non archivées | `docusign_envelopes` où `statut = 'signe_toutes_parties'` et `archive_le is null` |
| Erreurs de raccordement | `docusign_connections.last_error` |
| Réautorisation imminente | `docusign_connections.refresh_expires_at` |
| Historique des transitions | `docusign_envelope_events` |

Le bouton **Actualiser** de la fiche dossier relit l'état réel chez DocuSign
sans attendre le cron.

---

## 11. Ce qui n'a pas été testé

```bash
npm run check:docusign   # 151 assertions, hors réseau et hors base
```

Les suites sont dans [`scripts/docusign-check/`](../scripts/docusign-check/).
Elles ne touchent ni la base ni DocuSign : elles sont donc lançables à tout
moment, y compris avant un déploiement et sur une machine sans secret.

| Testé | Comment |
|---|---|
| PKCE, `state`, expirations | hors réseau |
| HMAC Connect | signature valide, falsifiée, absente, clé absente |
| Machine à états, non-régression des statuts | transitions, rejeu, désordre |
| Idempotence, paliers de reprise | clés d'événement, attente croissante |
| Lecture des deux formats Connect | récent et ancien |
| Représentant légal → contrat | contrôle, variables, en-tête, instantané |
| TypeScript, ESLint, build | zéro erreur sur le dépôt |

| **Non testé** | Pourquoi |
|---|---|
| Échange OAuth réel | aucun compte DocuSign Developer |
| Création d'enveloppe réelle | idem |
| Réception d'une notification réelle | Connect non configuré |
| Téléchargement et archivage réels | aucune enveloppe signée |
| Parcours cliqué dans l'interface | aucun identifiant de test |

**Le premier envoi en bac à sable reste à faire, et il demande votre
autorisation.** Rien n'a été simulé, aucun statut de signature n'a été
fabriqué.

---

## 12. Déploiement

Ne pas passer en production sans :

1. un envoi réussi en **bac à sable**, de bout en bout — enveloppe, signature
   par les deux parties, notification, archivage ;
2. la vérification que les pièces archivées sont bien inaccessibles à un
   compte commercial ;
3. le basculement `DOCUSIGN_ENV=production` **et** un nouveau raccordement :
   les comptes démo et production sont distincts, les jetons ne sont pas
   transférables ;
4. la reconfiguration de DocuSign Connect sur le compte de production, avec
   une **nouvelle** clé HMAC.
