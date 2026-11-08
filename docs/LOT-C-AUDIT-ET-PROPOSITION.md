# Lot C — Audit et proposition (phases 1 et 2)

> 8 novembre 2026. Branche `lot-b/unification-gabarits`.
>
> **Ce document n'est pas un environnement de recette.** C'est l'audit de
> l'existant et la proposition d'architecture. Aucune ressource n'a été créée,
> aucune migration appliquée, aucun déploiement fait, rien n'a été poussé.
>
> Il complète et **corrige** la note de faisabilité du matin
> ([LOT-C-ENVIRONNEMENT-RECETTE.md](LOT-C-ENVIRONNEMENT-RECETTE.md)) : l'audit
> technique a révélé trois défauts qui **invalidaient son plan d'isolation**.
> Les deux documents sont conservés ; celui-ci fait foi.

---

## L1 — Rapport d'audit de l'infrastructure

### Ce qui a été mesuré, pas supposé

| Couche | Constat | Mesure |
| --- | --- | --- |
| Frontend | Next.js **16.2.6** App Router + Turbopack, React **19.2.4**, TypeScript strict, Sass (SCSS modules) | `package.json` |
| Backend | **Pas de backend séparé.** Server Components + **25 fichiers `actions.ts`** (server actions) + **23 routes API** réservées aux appelants machine | décompte du dépôt |
| Pages | **46 pages** sous `app/(app)` | décompte |
| Base | Supabase Postgres **17.6.1** · **83 tables** · **17 énumérations** | types générés + `supabase/.temp` |
| Accès aux données | **123 `create policy`** · **67 `enable row level security`** · **24 fonctions `security definer`** | somme sur les 176 migrations |
| Authentification | Supabase Auth (GoTrue **2.193.1**) via `@supabase/ssr`, garde dans `proxy.ts` (`getUser()`, pas `getSession()`) | lecture |
| Hébergement | VPS Infomaniak, Docker, reverse-proxy Traefik, `crmoptimum.com` | `Dockerfile` + mémoire projet |
| Stockage | **6 buckets privés** : `lead-media`, `signed-documents`, `devis-optimivv`, `client-documents`, `document-archive`, `subcontractor-documents` | migrations |
| PDF | **Deux moteurs** : `@react-pdf/renderer` (documents génériques) et `pdfkit` (devis OPTIMIVV, certificat de hotte — portage au pixel, figé) | `package.json` + `lib/pdf`, `lib/devis` |
| Signature | **Deux systèmes** : auto-hébergé (`/sign/[token]`, jeton 256 bits, seul le SHA-256 est stocké) **et** DocuSign (contrats de sous-traitance) | lecture |
| Notifications | Table `notifications` + Realtime + `RealtimeNotifications` | lecture |
| E-mail | Brevo **et** un repli SMTP/nodemailer — voir L3 | `lib/brevo.ts`, `lib/devis/email.ts` |
| Téléphonie | `ringover-sdk` 1.1.3, webphone embarqué + webhook | lecture |
| Migrations | **176 fichiers**, dont **90 contenant un `insert`**. Schéma initial complet (`20260515000001`→`5`) | décompte |
| Variables d'env. | **44 lues par le code**, **21 documentées** → **25 manquantes** (anomalie D9) | comparaison exhaustive |
| Déploiement | `Dockerfile` multi-étages + `.dockerignore`. **Pas de `docker-compose.yml`** | listage |
| Intégration continue | **AUCUNE.** `.github/workflows/` n'existe pas (anomalie D10) | listage |
| Outils de test | **Aucun exécuteur de tests.** 3 suites maison esbuild+node : `check:devis`, `check:docusign`, `check:superviseur` | `package.json` |

### Démonstration de l'absence d'un environnement de recette

Le Master Prompt l'exige : *« Ne présume pas qu'un service de recette existe. Démontre son existence ou son absence. »*

| Preuve | Résultat |
| --- | --- |
| Fichiers d'environnement du dépôt | **un seul** : `.env.local`, qui pointe sur la production |
| Second projet Supabase référencé (`zscnvebnizliyuwwchyt`, commenté « compte 1 ») | **supprimé** — `nslookup` : *Non-existent domain*. Témoin : le projet actif résout et répond **HTTP 401** |
| Pile Supabase locale | **impossible** : `docker` absent du poste, et pas de `supabase/config.toml` |
| Lien de la CLI Supabase | pointe sur la **production** (`supabase/.temp/project-ref`) |
| Procédure de recette documentée | aucune. Les documents « RECETTE-CRM » sont des **audits statiques**, pas des environnements |

**Conclusion : il n'existe aucun environnement de recette, et il n'en a jamais existé.**

---

## L2 — Architecture de recette proposée

### Le choix : un projet Supabase hébergé + l'application en local

Trois options ont été examinées. Deux sont écartées **par constat**.

| Option | Verdict |
| --- | --- |
| **Pile Supabase locale** (`supabase start`) | ❌ Impossible : pas de Docker sur le poste, pas de `config.toml` |
| **Branching Supabase** (branches de prévisualisation) | ❌ Écarté : exige un plan payant, et une branche **dérive du schéma de production** — on veut précisément éprouver les 176 migrations depuis zéro |
| **Second projet Supabase + application en local** | ✅ **Retenu.** Gratuit, isolé par construction, et rejoue les migrations sur une base réellement vide |

```
   POSTE LOCAL                          SUPABASE (projet RECETTE)
   ┌──────────────────────────┐         ┌───────────────────────────┐
   │ npm run dev              │         │ Postgres 17 — 83 tables   │
   │ localhost:3000           │────────▶│ Auth — comptes fictifs    │
   │                          │         │ Storage — 6 buckets vides │
   │ .env.recette             │         │ Realtime                  │
   │ CGK_ENV=recette          │         └───────────────────────────┘
   │ garde-fou de démarrage   │
   └──────────┬───────────────┘         SERVICES EXTERNES
              │                         ┌───────────────────────────┐
              └────────── ✗ ───────────▶│ Brevo · SMTP · Ringover   │
                 AUCUN raccordement     │ DocuSign · n8n            │
                                        │  → non configurés         │
                                        └───────────────────────────┘
   ┌──────────────────────────────────────────────────────────────┐
   │ PRODUCTION — inatteignable : URL différente, clés            │
   │ différentes, clé de chiffrement différente, CLI déliée        │
   └──────────────────────────────────────────────────────────────┘
```

### Ce que l'architecture ne fera pas

- **Pas de recette déployée.** Déployer la recette sur le VPS reviendrait à mettre un second service en production : ce n'est pas demandé et j'en augmenterais la surface de risque. La recette tourne en local, sur `localhost`.
- **Pas de copie de données de production.** Jamais (RGPD).
- **Pas de services de simulation maison.** Les intégrations se **désactivent** proprement, c'est plus sûr qu'un simulateur à maintenir (voir L3).

---

## L3 — Inventaire des services externes

Les huit champs demandés au §2.2, par service.

### 1. Supabase — Postgres, Auth, Storage, Realtime

- **Fonction** : base, authentification, stockage, temps réel. Tout le CRM en dépend.
- **Environnement actuel** : un seul projet, de production.
- **Dépendances** : aucune en amont. Tout le reste en dépend.
- **Risques** : 🔴 la CLI y est liée (D6) ; `.env.local` y pointe (R2).
- **Isolation** : **totale** par un second projet.
- **Configuration** : 4 clés + mot de passe de base.
- **Coût** : 0 € (plan gratuit, 2 projets actifs).

### 2. Brevo — e-mail transactionnel et SMS

- **Fonction** : devis, factures, relances, liens de signature, SMS.
- **Environnement actuel** : **clé de production active sur le poste**.
- **Dépendances** : expéditeur vérifié côté Brevo.
- **Risques** : 🔴 un clic « Envoyer » part réellement (E3). Aucune garde d'environnement : la seule condition est la présence de la clé.
- **Isolation** : clé absente → refus propre, message nommant ce qui manque. **Mais voir le service 3.**
- **Configuration** : aucune en recette.
- **Coût** : 0 €.

### 3. SMTP / nodemailer — **le second transport, non documenté**

- **Fonction** : **repli d'envoi d'e-mail** dans `lib/devis/email.ts`, activé *« si Brevo n'est pas configuré »*, ou forcé par `DEVIS_EMAIL_TRANSPORT=smtp`.
- **Environnement actuel** : variables absentes du poste — donc inerte aujourd'hui, **par accident et non par conception**.
- **Dépendances** : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_BCC` — **aucune n'est dans `.env.example`**.
- **Risques** : 🔴 **anomalie E4** — retirer `BREVO_API_KEY` ne coupe pas l'envoi, il le **bascule** sur ce transport. Le plan d'isolation de ce matin était faux sur ce point.
- **Isolation** : les six variables absentes **et** `DEVIS_EMAIL_TRANSPORT` non forcé.
- **Configuration** : aucune en recette.
- **Coût** : 0 €.

### 4. Ringover — téléphonie

- **Fonction** : webphone embarqué, remontée d'appels, SMS, screen-pop.
- **Environnement actuel** : `RINGOVER_API_KEY` **active** sur le poste.
- **Dépendances** : ligne Ringover active.
- **Risques** : 🟠 appels ou SMS réels ; événements parasites dans les journaux.
- **Isolation** : clé absente → le webphone ne se monte pas. **Pas de bac à sable connu chez Ringover** : la simulation se fera par insertion directe d'événements **marqués comme fictifs**, jamais présentés comme réels (règle du §5.3 du Master Prompt).
- **Configuration** : aucune en recette.
- **Coût** : 0 €.

### 5. DocuSign — signature des contrats de sous-traitance

- **Fonction** : enveloppes, signature, webhook Connect, archivage.
- **Environnement actuel** : raccordé, **en mode `demo`** — ce qui signifie que les contrats signés en production aujourd'hui **n'ont pas de valeur juridique**. Constat antérieur, hors périmètre du Lot C, à traiter au **Lot D**.
- **Dépendances** : `FIELD_ENCRYPTION_KEY` (les jetons OAuth sont chiffrés avant stockage), un `redirect_uri` déclaré à l'identique.
- **Risques** : 🟠 le `redirect_uri` local pointe aujourd'hui sur la production.
- **Isolation** : les cinq variables absentes → la génération et le téléchargement des contrats continuent, **seul l'envoi en signature est refusé**, avec un message nommant ce qui manque. Rien d'autre n'est dégradé.
- **Configuration** : aucune en recette pour les lots A/B/E. Le Lot D exigera une application DocuSign développeur distincte, avec `redirect_uri` sur `localhost`.
- **Coût** : 0 € (compte développeur).

### 6. n8n — WF1 (capture de leads) et WF2 (séquence de relance)

- **Fonction** : capture des leads depuis les landing pages ; séquence de relance.
- **Environnement actuel** : WF1 appelle `/api/webhooks/leads/inbound`. **WF2 n'est pas câblé côté CRM** : `N8N_WF2_TRIGGER_URL` et `N8N_WF2_TRIGGER_SECRET` sont documentés et **jamais lus** (anomalie D12).
- **Dépendances** : HMAC `LEADS_INBOUND_SECRET`.
- **Risques** : 🟠 en développement, un secret absent fait **accepter les requêtes non signées**.
- **Isolation** : ne pas exposer la recette (règle I8) ; définir malgré tout un secret propre pour éprouver le refus (test S5).
- **Configuration** : `LEADS_INBOUND_SECRET` de recette.
- **Coût** : 0 €.

### 7. Paiements / comptabilité

- **Fonction** : aucun prestataire de paiement n'est raccordé. Les encaissements sont **saisis**, pas prélevés.
- **Risques** : ⚪ **aucune opération bancaire réelle n'est possible** — mesuré : aucune dépendance de paiement dans `package.json`.
- **Isolation** : sans objet. La règle 8 du Master Prompt est satisfaite par construction.

### 8. Google Ads — conversions hors ligne

- **Fonction** : prévue au CDC (Enhanced Conversions, par GCLID).
- **Environnement actuel** : **non implémentée.** Le `gclid` est stocké et chiffré ; aucun appel sortant n'existe.
- **Risques** : aucun.

---

## L4 — Plan d'isolation de la production

**Ce plan remplace celui de ce matin, qui était incomplet sur deux points
(E4 et E5).** Dix mesures, dans l'ordre de pose.

| # | Mesure | Nature | Pourquoi |
| --- | --- | --- | --- |
| **I1** | **Compléter `.env.example`** des 25 variables manquantes (D9). | documentation | On ne peut pas isoler ce qu'on ne sait pas exister. C'est le **préalable absolu** : un environnement bâti sur une documentation à moitié vide hérite de ses trous. |
| **I2** | **Deux fichiers nommés**, hors du dépôt : `.env.production.sauvegarde` et `.env.recette`. `.env.local` devient une **copie** de l'un des deux, jamais un fichier qu'on édite à la main. | organisation | Next.js charge `.env.local` systématiquement ; il n'y a pas de notion de profil. |
| **I3** | **Garde-fou au démarrage** : si `CGK_ENV=recette` et que l'URL Supabase est celle de production → **refus de démarrer**, en nommant la cause. Et l'inverse. | développement | Une protection qui dépend de l'attention humaine n'en est pas une. |
| **I4** | **Aucun des DEUX transports e-mail.** `BREVO_API_KEY` **et** les six `SMTP_*` absentes, `DEVIS_EMAIL_TRANSPORT` non défini. | configuration | **E4** : retirer Brevo seul bascule l'envoi sur SMTP. |
| **I5** | **`SIGNATURE_BASE_URL=http://localhost:3000`**, et remplacer le repli `https://crmoptimum.com` écrit en dur par la reconstruction depuis l'en-tête `host`, comme le font déjà deux des quatre points d'usage. | configuration + développement | **E5** : sinon un lien de signature de recette pointe sur la production. Contamination **par le lien**, qu'aucune isolation de base n'arrête. |
| **I6** | **Ringover et DocuSign non raccordés.** | configuration | E3. |
| **I7** | **Clé de chiffrement propre à la recette.** Conséquence voulue : la recette **ne peut pas** déchiffrer un champ de production. | configuration | D5. |
| **I8** | **Rendre la cible visible** : `npm run db:cible` imprime le projet lié et refuse une cible inattendue. D'ici là, j'annonce la cible avant **chaque** commande `supabase`. | développement + discipline | D6 : `supabase db reset --linked` détruit la base distante. |
| **I9** | **Aucune donnée de production copiée.** Semence fictive uniquement. | règle | RGPD. |
| **I10** | **La recette n'est jamais exposée** : `localhost` seulement, pas de tunnel, pas de domaine. | règle | Tant que c'est vrai, les webhooks non signés en développement n'ont aucune surface. |

### Vérification explicite des destinations (§3.2 du Master Prompt)

Le garde-fou I3 contrôlera, au démarrage, **quatre** destinations et non une :

1. l'URL Supabase ; 2. le transport e-mail (les deux) ; 3. `SIGNATURE_BASE_URL` ; 4. la présence des clés Ringover/DocuSign.

---

## L5 — Plan de migration M1 en recette

Les huit points du §4.3, traités.

| # | Point | Résultat de l'audit |
| --- | --- | --- |
| 1 | **Contenu** | `docs/MIGRATION-M1-HISTORIQUE-DEVIS.md` : `create table if not exists document_versions`, 2 index, RLS activée, 2 politiques, trigger *append-only*, plan de retour arrière. **Mais ce n'est pas un fichier de migration** : il vit dans `docs/`, hors de `supabase/migrations/` — donc `db push` ne l'appliquera jamais (H1). |
| 2 | **Dépendances** | `documents(id)` avec `on delete cascade`, `users(id)`. Les deux tables existent. |
| 3 | **Compatibilité** | **Purement additive.** Aucune colonne modifiée ou supprimée, aucune donnée réécrite, aucune politique existante touchée, aucun enum modifié. `origine` est un `text` + `check` et non un enum — élargir un `check` est immédiat. |
| 4 | **Droits d'accès** | 2 politiques, calquées sur celles de `documents`. ⚠️ **Elles sont dupliquées, pas dérivées** : si la RLS de `documents` évolue, les deux divergent. À l'application, ajouter une suite de contrôles qui vérifie que les deux accordent les mêmes accès. |
| 5 | **Risques** | Croissance de table (~75 Mo/an à 80 devis/mois) : faible. Trigger bloquant une correction légitime : voulu. **Divergence de RLS : moyenne.** **Croire qu'on a l'historique d'un devis ancien alors qu'il n'y en a pas : moyenne** — l'interface doit dire « historique commencé le … ». |
| 6 | **Préparation** | Transformer le SQL en `supabase/migrations/2026…_document_versions.sql`. **À faire sur votre autorisation, sans l'appliquer.** |
| 7 | **Test** | Après application sur la **recette seule** : écrire une version par chacune des 4 origines, vérifier le refus d'`UPDATE`, l'unicité `(document_id, version)`. |
| 8 | **Les quatre origines** | `moteur` à la génération · `manuel` / `assiste` à l'enregistrement selon ce qui a servi · `emission` **après** un envoi réussi, jamais avant. |

**Les devis déjà émis n'auront pas d'historique**, et c'est le choix honnête :
fabriquer une version `emission` rétroactive depuis le `notes` actuel
affirmerait que ce texte est celui qui a été envoyé, ce que personne ne peut
vérifier.

### L'autre migration en attente

`20261105000001_superviseur_perimetre_ferme.sql` — Lot 1 du superviseur, **non appliquée**. L'audit a vérifié trois choses :

- l'**Option A est déjà dans le code** (`perimetreConfigure()` refuse tout axe vide) — elle ne dépend pas de la migration ;
- le code **détecte l'absence des quatre colonnes de droits à l'exécution** et refuse le périmètre : **fail-closed**, vérifié par lecture ;
- conséquence réelle : le module superviseur est **inerte** tant que la migration n'est pas appliquée — pas dangereux, **non fonctionnel**.

Les types générés déclarent pourtant ces colonnes (D13) : `tsc` ne peut donc pas signaler l'écart. À régénérer après l'application en recette.

---

## L6 — Comptes et jeux de données de test

### Comptes (à créer à l'étape 5, pas avant)

⚠️ **L'ordre d'inscription compte** : le **premier** compte inscrit reçoit automatiquement `admin` (`20260517000001_auth_user_setup.sql`).

| Ordre | Compte fictif | Rôle | Sert à éprouver |
| --- | --- | --- | --- |
| 1 | `admin.recette@example.invalid` | `admin` | accès global, réglages, sociétés |
| 2 | `commercial.nettoyage@example.invalid` | `commercial`, profil `appel_entrant` | cloisonnement `mine`, provenance invisible |
| 3 | `commercial.demenagement@example.invalid` | `commercial`, profil `debarras_demenagement` | routage par profil, second cloisonnement |
| 4 | `planif.recette@example.invalid` | `planification` | back-office, dossiers, sous-traitants |
| 5 | `superviseur.recette@example.invalid` | `superviseur` | périmètre fermé par défaut |
| 6 | `commercial.attente@example.invalid` | `commercial`, profil `en_attente` | absence de capacités |

**Deux précisions qui comptent** :

- **Il n'y a pas de rôle « comptable ».** L'énumération `role_slug` contient `admin`, `commercial`, `planification`, `assistant` (phase 2) et `superviseur`. La comptabilité est un **module de back-office**, pas un rôle : elle est ouverte à `admin` + `planification`. Le §6 du Master Prompt le demandait « selon l'architecture réelle » — la voici.
- Le rôle `superviseur` existe dans l'énumération, mais **n'a pas d'interface** (anomalie I4, Lot G). Le compte 5 servira surtout à vérifier qu'il **ne voit rien** sans périmètre configuré.

### Jeux de données

Les trois fichiers existants (879 lignes, suivis par Git) sont **réutilisés** — règle 5 : ne pas reconstruire ce qui fonctionne. Trois réparations nécessaires :

| Fichier | État | Réparation |
| --- | --- | --- |
| `seed.sql` (434 l.) | ❌ **ne se charge pas sur un projet neuf** : 14 `insert`, **un seul** `on conflict`, et 3 collisions garanties avec les migrations de secteur (D7) | `on conflict` sur chaque `insert` ; compléter les 9 activités (`nettoyage_difficile` et `transport` manquent) |
| `seed_bulk_demo.sql` (357 l.) | ❌ rattache 25 leads à **deux adresses Gmail réelles** (D8) | les remplacer par les comptes fictifs ci-dessus |
| `seed_test_data.sql` (88 l.) | ✅ idempotent par construction | aucune |

**Couverture à compléter** pour répondre au §4.2 : les semences couvrent leads, commerciaux, sociétés, activités, devis, documents, dossiers, intervenants. **Manquent** : les 5 pays, les découvertes, les sous-traitants fictifs, les contrats, les notifications, l'historique, les paiements fictifs. À ajouter dans un quatrième fichier, `seed_recette_lots_abe.sql`, pour ne pas toucher aux trois existants.

---

## L7 — Matrice des permissions

**Source unique** : `lib/access-shared.ts`. Mesure encourageante : **12 modules restreints, 12 `layout.tsx` de garde — correspondance exacte, 1 pour 1.** Le cloisonnement ne peut pas dériver entre la barre latérale, la palette ⌘K et le serveur.

| Module | Portée | Commercial | Planification | Admin | Superviseur |
| --- | --- | --- | --- | --- | --- |
| `/` `/leads` `/pipeline` `/clients` `/devis` `/suivi` `/ma-journee` `/notifications` | `all` | ✅ **ses** lignes (RLS) | ✅ | ✅ | selon périmètre |
| `/planification` `/chiffrage` `/sous-traitants` `/certificat-hotte` `/comptabilite` `/documents` `/a-affecter` `/settings` | `backOffice` | **404** | ✅ | ✅ | ❌ |
| `/commerciaux` `/presence` `/grilles-tarifaires` `/settings/superviseurs` | `admin` | **404** | **404** | ✅ | ❌ |

Trois couches, non interchangeables : **RLS** (la vraie frontière, 123 politiques) · **portée de module** (`access-shared.ts` + layouts) · **capacités dérivées** (`profileCapabilities()` : `canUseRingover`, `canAddLead`).

Axes à éprouver en recette : **par rôle** · **par profil commercial** (7 valeurs) · **par pays** (5) · **par activité** (9) · **par société** (7) · **par action** (émission, envoi, réaffectation).

**Scénarios d'accès interdit à préparer** : URL d'un module back-office avec le compte 2 → attendu **404** et non « interdit » ; lecture d'un lead d'autrui **par la clé anon** → attendu **0 ligne** ; lecture de la provenance par un commercial → attendu **invisible**.

---

## L8 — Catalogue des scénarios de recette

**13 vérifications** héritées de la partie C du registre, plus les parcours
ci-dessous. Chaque scénario nomme son résultat attendu **avant** l'exécution.

### Parcours commercial complet (§9)

`Lead entrant → Affectation → Découverte → Génération → Devis à réaliser → Visualisation 👁 → Validation → Envoi manuel → Suivi → Signature`

Points de contrôle : aucune ressaisie entre deux étapes · aucun doublon de numéro · **aucun envoi automatique** · la garde d'identité refuse au cran 1 **sans consommer de numéro** · le PDF reçu porte PRESTATION / DÉTAIL / RÉSERVES · les montants sont lisibles · le double-clic sur « Émettre » ne produit qu'un devis.

### Lots A, B et E (§8)

Moteur de rédaction (prestations, détails, réserves, reprise intelligente de la découverte, mentions par pays) · PDF (gabarits, identité juridique, logos, montants, pagination, débordement, pièces jointes) · visualisation sur **trois** écrans (ouverture, fermeture clavier, focus, mobile, correspondance avec le PDF final) · historique M1 (4 origines, permissions, message d'erreur, comportement **sans** migration) · préremplissage sur les **trois** parcours · les trois corrections critiques (réserves présentes, montants lisibles, cohérence éditeur/aperçu/document).

### Multipays (§7) — cinq scénarios, pas un

France · Suisse · Belgique · Luxembourg · Canada. À contrôler : entité juridique, libellé de l'identifiant légal (SIRET/IDE/BCE/RCS/NEQ), mentions réglementaires, mention des produits par pays, article 293 B **sur la France seule**, terminologie (« soumission » au Québec), format des téléphones et adresses.

⚠️ **Deux limites connues d'avance** : la **devise** est l'euro partout (G7) et le libellé « TVA » reste français au Canada (G6). Les deux attendent un arbitrage ; la recette les **constatera** sans les corriger.

### Superviseur (§10), planificatrice (§11), comptabilité (§12)

Scénarios préparés, **exécutables seulement après les lots G, H et I**. Deux règles à figer dès maintenant : **une notification lue ne résout pas une alerte métier**, et **aucune opération bancaire réelle n'est possible** (aucun prestataire de paiement n'est raccordé — mesuré).

---

## L9 — Matrice des interconnexions

Ce que chaque module transmet, et à qui. C'est la carte de ce qui doit continuer à circuler « sans ressaisie, sans perte, sans doublon ».

| Émetteur | Transmet | Destinataire | Vérifié |
| --- | --- | --- | --- |
| Formulaire LP / WF1 | lead + provenance **chiffrée** | fiche lead, routage | 🟠 |
| Routage (`lib/routing.ts`) | propriétaire selon profil + pays + activité | fiche lead | 🟠 |
| Découverte | champs métier structurés | moteur de rédaction | ✅ script |
| Moteur de rédaction | PRESTATION / DÉTAIL / RÉSERVES + désignation | éditeur de devis | ✅ script |
| Sociétés émettrices | identité, pays, gabarit, mentions | **point de rendu unique** | ✅ script |
| Point de rendu unique | le PDF | visualisation **et** envoi | ✅ script |
| Émission | numéro sans trou + archive | comptabilité, suivi | 🟠 |
| Envoi manuel | lien suivi, pixel d'ouverture | statut `envoye` → `ouvert` | 🟠 |
| Signature | dossier + mode (`logiciel`/`planificateur`) | planification | 🟠 |
| Planification | mission, montants | sous-traitants, contrats | 🟠 |
| `audit_logs` (service role) | faits | moteur d'actions commerciales (**réconcilie**, idempotent) | 🟠 |
| Cron `/api/presence/evaluate` | 3 passes isolées | présence, relances, alertes de contrats | 🟠 |
| Tout module | événements | `notifications` + Realtime | 🟠 |

✅ = vérifié par script · 🟠 = **jamais vérifié dans une session authentifiée**. Onze liaisons sur treize sont dans ce second cas : c'est la mesure de ce que le Lot C doit rendre possible.

⚠️ **Deux liaisons manquantes, mesurées** : ni la génération ni l'envoi d'un devis n'émettent de **notification** (D1) ; le déclenchement de **WF2** n'est pas câblé (D12).

---

## L10 — Rapport des tests réellement exécutés

Exécutés aujourd'hui, 8 novembre. **Aucun ne nécessite l'environnement de recette** — c'est précisément pourquoi ils ne suffisent pas.

| Test | Résultat |
| --- | --- |
| `check:devis` | **1 437** contrôles · **0 échec** · 13 suites |
| `check:docusign` | **1 163** contrôles · **0 échec** · 11 suites + colonnes des `select` |
| `check:superviseur` | **201** contrôles · **0 échec** · 4 suites |
| **Total** | **2 801 contrôles · 0 échec · 28 suites** |
| `tsc --noEmit` | ✅ aucune erreur |
| `npm run lint` | ✅ **0 erreur**, 1 avertissement préexistant (`SignatureAttestationPdf.tsx`, texte alternatif) |
| `npm run build` | ✅ réussi |
| **S3 — secrets dans le bundle navigateur** | ✅ **0 occurrence** de **8 secrets serveur** dans les **113 fichiers** de `.next/static` : service-role, chiffrement, Brevo, DocuSign (×2), cron, leads, Ringover |

**Le chiffre de 2 801 est reproduit**, et la méthode est consignée : comptage des lignes de contrôle unitaire des trois suites. Elle était implicite jusqu'ici, ce qui m'a d'ailleurs fait propager deux décomptes faux dans le registre.

**Ce qui n'a pas pu être testé** : tout le reste. Aucun écran ouvert, aucun bouton cliqué, aucun PDF reçu par un destinataire, aucune permission éprouvée en session. **Un test automatisé ne remplace pas une vérification réelle** (règle 6) — et 2 801 contrôles statiques n'ont jamais prouvé qu'une interface s'affiche.

---

## L11 — Rapport UX/UI

**Non produit, et il ne peut pas l'être à cette phase.** Aucun écran n'est observable sans environnement de recette.

Ce qui est livré à la place : la **procédure**. Pour chacune des 46 pages — fonctionnalités attendues · éléments visibles · boutons · formulaires · filtres · tableaux · messages · navigation · responsive (≥1025 / 640–1024 / ≤768 / paysage téléphone) · permissions · erreurs.

Trois contrôles systématiques issus des conventions du dépôt :

1. **une fonctionnalité développée mais inaccessible est une anomalie** — c'était le cas de `/ma-journee` et `/notifications`, atteignables par URL seulement (corrigé, LA-4). À rechercher ailleurs ;
2. **chaque `<td>` doit porter son `data-label`** — 24 cellules n'en ont pas (I2), 163 n'ont aucune adaptation mobile (I3) ;
3. **aucune `var()` CSS non définie** — 19 jetons invalides subsistent hors de l'éditeur de devis (I1).

---

## L12 — Registre consolidé des anomalies

Dans [REGISTRE-CORRECTIONS-FINALES.md](REGISTRE-CORRECTIONS-FINALES.md), restructuré ce jour en **six états** (§15). **69 entrées**, totaux par comptage :

| État | Nombre |
| --- | --- |
| Ouverte | **28** |
| Corrigée | **21** |
| À vérifier | **13** |
| Reportée | **7** |
| Validée en recette | **0** |
| Non reproductible | **0** |

**Correction d'un chiffre que je vous ai transmis** : le registre n'a jamais compté 25 entrées. Il en comptait **19** à la livraison du Lot B et **23** après le Lot E. L'erreur a été propagée de rapport en rapport, y compris dans le rapport de livraison du Lot E. Les totaux sont désormais établis par comptage automatique, pas à la main.

Les parties **E** et **F** sont vides : aucune anomalie de ce projet n'a jamais été validée dans une session authentifiée. Les laisser vides **est** l'information.

---

## L13 — Fonctionnalités existantes non reprises dans le Master Prompt

Le Master Prompt Lot C est consacré à la recette. Les fonctionnalités
suivantes **existent, restent en place, et aucune ne sera supprimée au motif
qu'elle n'est plus mentionnée.**

**1 · Garde d'identité à trois crans**
Origine Lot B · Module Devis · `lib/devis/garde-identite.ts` · Trois niveaux : cran 1 **bloquant** (dénomination, adresse, pays), cran 2 **signalé** (identifiant légal, TVA), cran 3 **journalisé** · État : actif, jamais vu à l'écran · Tests : contrôles statiques · Dépend des fiches sociétés · **Recommandation** : éprouver le refus **avant** l'allocation du numéro. Un refus binaire bloquerait 6 sociétés sur 7 (D2).

**2 · Réglage des gabarits par société et activité**
Origine Lot B · Réglages · `lib/devis/gabarits.ts`, `app/(app)/settings/integrations/GabaritsDevis.tsx` · Résolution par spécificité `<entité>|<secteur>` → `*|<secteur>` → `<entité>|*` → `*|*` · État : écran jamais ouvert · **Recommandation** : sans ce réglage, une société reste sur le gabarit d'origine, où une valeur corrigée reste lisible sous son rectangle (G3).

**3 · Voie 0 — gabarit neutralisé**
Origine Lot B · Devis nettoyage · `scripts/gabarit-neutre/neutraliser.py` · **23 éléments retirés du flux de contenu** du PDF, pas masqués · État : actif · Tests : extraction de la couche texte · **Recommandation** : la **photo de fond** porte encore des tenues marquées OPTIMIVV (G1) — une image neutre est attendue de vous.

**4 · Pages de suite paginées du descriptif**
Origine Lot B · `lib/devis/debordement.ts` · L'encadré garde sa taille ; au débordement, il porte les premières lignes et un renvoi, le texte complet part sur des pages paginées · État : actif · **Recommandation** : né d'une troncature qui supprimait **toutes les réserves** (LB-9). À revoir à l'écran **et** à l'impression.

**5 · Projection terminologique québécoise**
Origine Lot B · Moteur · « soumission » au Québec · État : actif · **Recommandation** : vérifiable seulement sur un devis réellement émis.

**6 · Mention des produits par pays, activée par société**
Origine Lots A + B · Réglages › Intégrations · **Aucune valeur par défaut, volontairement** · État : **non saisie** → la phrase « 100 % français » a disparu de tous les devis depuis `693c31f` · **Recommandation** : à saisir société par société. **Ne jamais remettre de constante par défaut** : une société porterait une allégation qu'elle n'a pas assumée.

**7 · Fenêtre de visualisation partagée**
Origine Lot E · `components/ApercuDocument/` · Trois écrans · État : jamais ouverte · **Recommandation** : vérifier la correspondance avec le PDF final — elle lit le point de rendu unique, donc elle ne peut pas diverger ; à confirmer.

**8 · Historique des versions (M1)**
Origine Lot E · `lib/devis/versions-server.ts` · 4 origines · État : **n'enregistre rien** (H1) · **Recommandation** : le panneau **dit** son indisponibilité au lieu de se taire. Un historique vide affiché sans mention se lirait « personne n'a rien modifié », ce qui est faux.

**9 · Préremplissage du troisième parcours**
Origine Lot E · `app/(app)/devis/new/page.tsx` · Seulement à la **création** depuis un dossier — reprendre un brouillon porte déjà son texte · État : jamais vu · **Recommandation** : vérifier qu'un brouillon repris n'est **pas** écrasé.

**10 · Module superviseur, Lot 1**
Origine antérieure · `supervisor_scopes` + `lib/supervision-perimetre*.ts` · **Option A : périmètre vide = aucun accès**, l'inverse du reste du CRM · État : **inerte** — migration `20261105000001` non appliquée, et le code refuse le périmètre *fail-closed* · **Recommandation** : appliquer en recette d'abord. Une erreur y est **silencieuse** : un superviseur qui ne voit rien ressemble à un superviseur sans dossiers.

**11 · Sous-traitants · documents & contrats · médias par dossier**
Origine antérieure · `/sous-traitants`, `/documents`, onglet médias · Bibliothèque documentaire, conformité, contrats, passages, certificats, photos/vidéos par dossier (URLs signées ≤ 60 min) · État : modules complets **jamais vus en session** · **Recommandation** : les charger de données fictives à l'étape 4.

**12 · Présence, actions commerciales et relances**
Origine antérieure · `/ma-journee`, `/presence`, `lib/commercial-actions/` · Moteur qui **réconcilie** depuis `audit_logs`, idempotent · État : actif en production · Dépend du **cron toutes les 1–2 minutes** · **Recommandation** : en recette il faudra le déclencher à la main ; sans lui, rien ne se déclenche jamais seul. ⚠️ Le secret est accepté en **paramètre d'URL** (D11).

**13 · Chiffrement applicatif des champs confidentiels**
Origine antérieure · `lib/crypto/field-encryption.ts` · AES-256-GCM sur l'annotation Immobilier/Travaux **et** la provenance marketing · État : actif ; **3 annotations et 71 provenances encore en clair** en production · **Recommandation** : clé **distincte** en recette (I7). Hors périmètre du Lot C, mais à ne pas perdre de vue.

**14 · Cloisonnement du commercial — la signature est la frontière**
Origine antérieure · `lib/access-shared.ts` · Le commercial possède le dossier du lead à la signature ; tout l'après appartient au back-office · État : actif, **12 modules / 12 gardes** · **Recommandation** : c'est la règle d'accès la plus structurante du CRM. Test S6, et un 404 plutôt qu'un « interdit ».

**15 · Numérotation sans trou**
Origine antérieure · `lib/devis/numero.ts` · RPC `security definer` + verrou de ligne ; un numéro n'est consommé qu'à l'émission réelle, **jamais à l'aperçu** · État : actif · **Recommandation** : éprouver le double-clic et la concurrence (test S9). Une séquence trouée ne se répare pas.

---

## L14 — Recommandations complémentaires

1. **Compléter `.env.example` avant tout le reste.** 25 variables manquantes, dont un transport e-mail entier. Tout plan d'isolation bâti sur cette documentation hérite de ses trous — le mien l'a fait ce matin.
2. **Faire du contrôle du bundle un script, puis une étape de CI.** Le CDC §8.2 l'exige ; il n'existe aujourd'hui que parce que je l'ai lancé à la main. `npm run check:bundle`.
3. **Trancher la branche suivie par le VPS.** Il déploie depuis `feature/docusign-sandbox`, pas `main` : un commit poussé sur `main` **n'atteint pas la production**. Tant que ce n'est pas réglé, « poussé » et « déployé » désignent deux choses différentes, et la confusion est un risque en soi.
4. **Traiter le mode `demo` de DocuSign au Lot D.** Les contrats signés en production aujourd'hui n'ont **pas de valeur juridique**. C'est le point le plus grave encore ouvert du projet, et il ne relève pas du Lot C.
5. **Ne pas déployer la recette.** La garder locale réduit la surface de risque et rend le §3.3 (accès réservé) trivial.
6. **Régénérer les types après chaque migration**, dans un commit distinct, comme le dépôt le faisait déjà (`b345f98`, `48c321f`). L'écart D13 vient d'un écart à cette convention.

---

## L15 — Rapport de livraison technique

| | |
| --- | --- |
| **Lot** | C — phases 1 (audit) et 2 (proposition) **uniquement** |
| **Branche** | `lot-b/unification-gabarits` |
| **Fichiers modifiés** | `docs/REGISTRE-CORRECTIONS-FINALES.md` (six états, 7 anomalies nouvelles) · `docs/LOT-C-AUDIT-ET-PROPOSITION.md` (créé) |
| **Code applicatif modifié** | **aucun** |
| **Migrations appliquées** | **aucune**, ni en recette ni en production |
| **Ressources créées** | **aucune** |
| **Déploiement** | **aucun** |
| **Push** | **aucun** — `origin/main` reste à `2dab6a2` |
| **Tests exécutés** | 2 801 contrôles · `tsc` · `lint` · `build` · **S3** (secrets dans le bundle) — tous au vert |
| **Opérations sur la production** | **aucune.** Les seules commandes réseau : l'aide de la CLI (locale) et une requête **non authentifiée** vers deux noms d'hôte, sans lecture de données |

### §20 — Conditions de validation du Lot C : état réel

| # | Condition | État |
| --- | --- | --- |
| 1 | L'environnement de recette existe réellement | ❌ **non** — rien n'a été créé, par respect de la phase 3 |
| 2 | Il est isolé de la production | ❌ non — plan établi (L4), non posé |
| 3 | Les comptes de test fonctionnent | ❌ non — définis (L6), non créés |
| 4 | Les données de test sont disponibles | ❌ non — **et elles ne se chargeraient pas** en l'état (D7, D8) |
| 5 | Les permissions sont vérifiées | ❌ non — matrice établie (L7), non éprouvée en session |
| 6 | Les services externes sont sécurisés | ❌ non — inventaire fait (L3), **deux fuites trouvées** (E4, E5) |
| 7 | Les migrations autorisées ont été testées | ❌ non — aucune autorisation, aucune application |
| 8 | Les parcours prioritaires peuvent être exécutés | ❌ non |
| 9 | Les anomalies sont tracées | ✅ **oui** — 69 entrées, six états |
| 10 | Les limites et tests restants sont documentés | ✅ **oui** — L8, L10, L11 |

**Le Lot C n'est pas terminé, et ne peut pas l'être à cette phase.** Deux conditions sur dix sont remplies : celles qui ne dépendent que de documentation. Les huit autres attendent votre autorisation de passer en phase 4.

---

## §18 — Tableau de traçabilité

| Demande initiale | Origine | Lot | Fonctionnalité | Emplacement | Dépendances | Test | Résultat | Preuve | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Audit de l'infrastructure (§2) | Master Prompt C | C | L1 — 19 couches mesurées | ce document | — | comptages du dépôt | 🟢 | sorties de commande | livré |
| Démontrer l'absence d'un service de recette (§2.3) | Master Prompt C | C | Preuve par DNS + témoin | L1 | — | `nslookup`, `curl` | 🟢 **absent** | NXDOMAIN vs HTTP 401 | livré |
| Architecture de recette (§3) | Master Prompt C | C | L2 — 3 options, 2 écartées par constat | L2 | accord client | — | 🟢 proposée | le schéma | **attend phase 3** |
| Inventaire des services externes (§2.2, §5) | Master Prompt C | C | L3 — 8 services, 8 champs | L3 | — | lecture du code | 🟢 | `lib/devis/email.ts` et autres | livré |
| Plan d'isolation (§3.1, §3.2) | Master Prompt C | C | L4 — 10 mesures, 4 destinations contrôlées | L4 | I1 d'abord | — | 🟢 **corrigé** après E4/E5 | le plan | **attend phase 3** |
| Migration M1 (§4.3) | Master Prompt C | C | L5 — les 8 points | L5 | autorisation | audit du SQL | 🟢 additive, *rollback* prévu | le document M1 | **attend autorisation** |
| Comptes et données (§4.2, §6) | Master Prompt C | C | L6 — 6 comptes, 3 semences + 1 nouvelle | L6 | projet créé | — | 🟠 **2 semences cassées** | D7, D8 | **attend phase 4** |
| Matrice des permissions (§6) | Master Prompt C | C | L7 — 3 couches, 6 axes | L7 | — | comptage modules/gardes | 🟢 **12 / 12** | `access-shared.ts` | livré |
| Catalogue des scénarios (§7–§13) | Master Prompt C | C | L8 — 13 vérifications + parcours + 5 pays | L8 | recette | — | 🟢 catalogué | partie C du registre | **attend phase 6** |
| Matrice des interconnexions (§4 Lot B) | Master Prompt C | C | L9 — 13 liaisons | L9 | — | lecture | 🟠 **11 sur 13 jamais vérifiées en session** | la matrice | livré |
| Tests réellement exécutés (§14) | Master Prompt C | C | L10 — 2 801 + tsc + lint + build + S3 | L10 | — | exécution réelle | 🟢 **0 échec** · S3 : 0/8 secrets | sorties | livré |
| Rapport UX/UI (§13) | Master Prompt C | C | L11 — **procédure seule** | L11 | recette | — | ❌ **non exécutable** | E1 | **attend phase 6** |
| Six états du registre (§15) | Master Prompt C | C | L12 — A à F | registre | — | comptage | 🟢 69 entrées, 0 perdue | `comm` avant/après | livré |
| Fonctionnalités oubliées (§16) | Master Prompt C | C | L13 — **15 entrées**, 9 champs | L13 | — | rapprochement A/B/E + antérieurs | 🟢 | les lots cités | livré |
| Recommandations (§L14) | Master Prompt C | C | L14 — 6 recommandations | L14 | — | — | 🟢 | — | livré |
| « Aucune intervention sur la production » (règle 1) | Master Prompt C | C | aucune | — | — | journal des commandes | 🟢 **respectée** | aucune commande n'a visé un projet Supabase | livré |
| « Aucun push non autorisé » (règle 3) | Master Prompt C | C | aucune | — | — | `git rev-parse` | 🟢 `origin/main` = `2dab6a2` | état Git | livré |

---

## Ce qu'il me faut de vous pour passer en phase 4

| # | Décision | Sans elle |
| --- | --- | --- |
| 1 | **Créer le projet Supabase de recette** (région `eu-west-1`) et me transmettre les 4 clés + le mot de passe de base | le Lot C ne commence pas |
| 2 | **Autoriser trois développements d'isolation** : compléter `.env.example` (I1), le garde-fou de démarrage (I3), le script de cible (I8) — plus le remplacement du repli `crmoptimum.com` en dur (I5) | la recette pourrait écrire en production ou envoyer un lien vers elle |
| 3 | **Autoriser la réparation des deux semences** et la création de la migration M1 **comme fichier**, sans l'appliquer | les données de test ne se chargent pas |
| 4 | **Confirmer que la production reste hors périmètre** du lot entier, M1 et superviseur comprises — appliquées **d'abord et seulement** en recette | — |
| 5 | **Deux gestes immédiats, indépendants du Lot C** : retirer la clé de production du commentaire de `.env.local` (D5), et neutraliser `BREVO_API_KEY` **et** les `SMTP_*` sur le poste (E3, E4) | un essai local peut encore joindre un vrai client |
