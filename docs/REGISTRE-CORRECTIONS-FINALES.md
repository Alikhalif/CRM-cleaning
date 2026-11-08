# Registre consolidé — CRM CGK

> Ouvert le 7 novembre 2026 à la livraison du Lot B. **Restructuré le
> 8 novembre 2026** à la demande du client, en quatre états distincts.
>
> Ce registre consigne ce qui a été **constaté et mesuré** pendant les lots.
> Il ne consigne pas des intentions : chaque ligne nomme ce qui a été observé,
> par quel moyen, et ce qu'il faudrait faire.

## Règle de tenue

**Rien ne disparaît.** Une anomalie corrigée ne sort pas du registre : elle
change de partie. L'ancienne règle — « une anomalie corrigée en cours de lot
n'y entre jamais, sa trace est dans le commit » — est **abandonnée**. Elle
faisait reposer l'historique sur les messages de commit seuls, et le client a
demandé que les corrections restent visibles ici.

**Les identifiants ne sont jamais réattribués.** `G4` désigne la même
anomalie pour toujours, où qu'elle se trouve dans ce document. Un identifiant
libéré par une correction n'est pas réemployé.

## Les six états

Six parties, une par état, à la demande du client (Master Prompt Lot C §15).

| Partie | État | Ce qu'elle contient | Qui agit |
| --- | --- | --- | --- |
| **A** | **Ouverte** | Constatée, non corrigée : demande un développement, une saisie ou un arbitrage | selon la ligne |
| **B** | **Corrigée** | Historique permanent, avec le lot, le commit et la preuve | fait |
| **C** | **À vérifier** | Développé et mesuré par script, **jamais vu dans une session authentifiée** | Lot C puis recette |
| **D** | **Reportée** | Ni défaut ni régression : une amélioration dont l'opportunité se décide | client |
| **E** | **Validée en recette** | Vérifiée dans un environnement de recette, avec sa preuve | — |
| **F** | **Non reproductible** | Signalée puis non reproduite, avec la trace de la tentative | — |

Les parties **E** et **F** sont **vides à ce jour**, et le resteront tant
qu'aucun environnement de recette n'existera (anomalie E1). Les laisser
vides est l'information : aucune anomalie de ce projet n'a jamais été
validée dans une session authentifiée.

## Comment lire les colonnes

| Colonne | Ce qu'elle dit |
| --- | --- |
| **Gravité** | 🔴 contractuel ou juridique · 🟠 fonctionnel · ⚪ confort |
| **Constaté** | comment l'anomalie a été établie, pas comment elle a été supposée |
| **Vérifié** | ✅ mesuré · 🟠 lu dans le code, jamais vu à l'écran |

---

## Niveaux de preuve — règle du client du 2026-11-09

« Je veux désormais que chaque anomalie soit accompagnée d'une preuve
vérifiable. Ne déclare plus une anomalie critique sur la seule base d'une
recherche textuelle. » Cette règle est née de trois erreurs de ma part : D20
(une politique créée en boucle, invisible à mon motif), un index unique écrit
sur deux lignes que j'ai déclaré absent, et la présence d'un PostgreSQL local
annoncée sans avoir été éprouvée (E7).

| Niveau | Ce qu'il exige | Ce qu'il ne permet PAS |
| --- | --- | --- |
| **Confirmé** | Une **exécution** dont la sortie est citée (commande, test, mesure sur données), **ou** la lecture **intégrale** du code ou du schéma qui gouverne le comportement, avec `fichier:ligne` | — |
| **Probable** | Cohérent avec ce qui a été lu, mais un maillon n'a été ni lu en entier ni exécuté — **toute conclusion tirée d'une recherche textuelle s'arrête ici** | une gravité 🔴 sans revérification |
| **Non vérifiable** | Dépend d'un état hors d'atteinte : production, VPS, compte tiers | une conclusion sur cet état |
| **Faux positif** | Signalé, puis **réfuté**, avec la preuve de la réfutation (partie F) | — |
| **Développée** | Code écrit, contrôles statiques et unitaires passés | « ça marche » |
| **Réellement testée** | Exercée dans une **session authentifiée**, sur la **recette** | — aucune à ce jour (E1) |

### Classement des anomalies ouvertes au 9 novembre (revérifiées ce jour)

| # | Niveau | Preuve, ou ce qui manque |
| --- | --- | --- |
| G1 | Confirmé | Rendu de `nettoyage-template-neutre.pdf` lu |
| G2 | Confirmé | Relevé pdfplumber du gabarit |
| G5 | **Confirmé** (était une recherche textuelle) | Revérifié le 9 novembre par lecture **intégrale** de `buildPayload` (`lib/entities-shared.ts`) : les 15 colonnes écrites n'incluent pas `logo_url` — aucun écran ne peut le renseigner |
| G6 | Confirmé | Lecture de la ligne du libellé dans `render.ts` |
| G7 | Confirmé | Lecture de `euro()` dans `layout.ts` |
| M1 | Confirmé | `ACTIVITES_COUVERTES` + contrôle exécuté |
| I2 | Confirmé (attribut manquant) · Probable (effet à l'écran) | Balayage par script ; le rendu en cartes n'a pas été vu |
| I3 | Confirmé (règle absente) · Probable (effet) | Idem |
| I4 | Probable | Audit du 5 novembre ; l'écran d'attribution existe (`/settings/superviseurs`), la vue du superviseur n'a pas été recherchée de bout en bout |
| D2 | Confirmé au 6 novembre · **Non vérifiable** depuis | Clé de Luhn exécutée sur les données réelles le 6 ; elles ont pu être corrigées depuis |
| D3 | Confirmé au 6 novembre · Non vérifiable depuis | `controlerEntite()` exécuté le 6 |
| D6 | **Confirmé** | `supabase/.temp/project-ref` relu le 9 novembre : présent (20 octets — valeur non imprimée) |
| D10 · D16 | **Confirmé** | `.github/workflows` absent, revérifié le 9 novembre |
| D11 | **Confirmé, mais le texte de l'entrée est périmé** | Relu le 9 novembre (`app/api/presence/evaluate/route.ts:19-58`) : le secret en URL est **déjà refusé hors production**, et en production **toléré et journalisé** jusqu'à `CGK_CRON_SECRET_URL=refuse`. Ce qui reste : l'appel réel du VPS — **non vérifiable** sans accès |
| D13 | Confirmé | Historique Git du fichier |
| D14 | **Non vérifiable** (risque, pas un défaut observé) | Conséquence de D5 : on ne sait pas si la clé a été lue par un tiers, on sait qu'elle a pu l'être |
| D17 | Confirmé (données) · Correction développée | Lecture des données le 8 ; conversion des lignes en attente d'autorisation |
| H1 | **Confirmé, texte périmé** | « n'existe même pas comme fichier » est **faux depuis le 8 novembre** : `20261108000001_document_versions_historique_devis.sql` existe. Ce qui reste vrai : **non appliquée** — sur la production, **non vérifiable** |
| H2 | Confirmé | Lecture de `versions-server.ts` |
| E1 | Confirmé | Aucun `.env.recette`, revérifié le 9 novembre |
| E2 | Confirmé (à la date du build) | Sortie de `npm run build` |
| E7 | Confirmé | `npm run preflight -- --garder` exécuté, `Get-Service`, recherche de `psql.exe` |
| D26 à D29 | voir chaque ligne | nouvelles, ci-dessous |


# Partie A — Anomalies OUVERTES

31 entrées. Après `39d7552`, D33, D34, D35 et D36 sont entrées (trouvées en développant D32, qui reste ici tant qu'elle n'est pas appliquée et validée).

Après `7e7b1f8`, D31 est passée en partie B (corrigée sur décision du client) et D32 est entrée ici (la RLS des dossiers ne cloisonne pas par pays).

Dans la nuit du 9 novembre, D29 est passée en partie B (décision du client, développée), D30 y est entrée corrigée, et D31 est entrée ici (les notifications existantes ignorent le cloisonnement par pays).

Le 9 novembre au soir, D23 est passée en partie B (développée),
et quatre anomalies y sont entrées : D26 (série de factures commune à toutes
les sociétés), D27 (série OPTIMIVV parallèle), D28 (la facture finale n'était
jamais émise), D29 (encaissement sans garde de rôle). Plus tôt le même jour,
D21 et D22 étaient passées en partie B, D20 en partie F (fausse détection),
et D23 et E7 étaient entrées.

Onze anomalies avaient quitté cette partie le 8 novembre pour la
partie B — corrigées, pas effacées — et trois nouvelles y sont entrées :
D14 (la clé exposée demande une rotation), D15 (la mention des produits ne
dépend pas de la société émettrice), D16 (il n'y a toujours pas de CI) et E6
(un `tsc` lancé après un build échoue sur du code généré par Next).

## A.1 · Gabarits et documents

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| G1 | 🔴 | **La photo du gabarit nettoyage montre des tenues marquées OPTIMIVV.** C'est une image de fond : la neutralisation du texte ne l'atteint pas. Tout devis d'une autre société porte donc la marque d'OPTIMIVV sur sa photo. | Lecture du rendu de `nettoyage-template-neutre.pdf` | ✅ | Remplacer la photo par une image neutre, ou la rendre paramétrable par société. Demande une image fournie par le client. |
| G2 | 🟠 | **Les quatre allégations du bandeau de pied** (« Produits écoresponsables », « Matériel professionnel », « Équipe qualifiée », « Satisfaction garantie ») sont cuites dans le design. Une société étrangère les porte sans les avoir assumées. | Relevé pdfplumber du gabarit | ✅ | Arbitrage client : les conserver comme éléments de charte, ou les soumettre au même mécanisme d'activation que la mention des produits. |
| G5 | 🟠 | **Aucune société ne peut fournir son emblème.** `legal_entities.logo_url` existe en base, mais aucun écran ne l'alimente, et c'est une URL de stockage là où le moteur attend un chemin disque. Les devis en voie 0 sortent donc sans emblème. | Recherche exhaustive de `logo_url` dans le dépôt | ✅ | Champ d'envoi sur la fiche société + mise en cache locale de l'image à l'émission. |
| G6 | 🟠 | **Le libellé « TVA : » reste français sur le gabarit déménagement.** Une société canadienne relève de la TPS/TVQ. | Lecture de `render.ts` | ✅ | **Arbitrage fiscal en attente.** Rien n'a été inventé : le libellé canadien n'est pas écrit tant que le client ne l'a pas arrêté. |
| G7 | ⚪ | **La devise est l'euro partout.** CHF et CAD ne sont pas gérés. | Lecture de `euro()` dans `layout.ts` | ✅ | **Arbitrage de change en attente**, au même titre que G6. |

## A.2 · Moteur de rédaction

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| M1 | 🟠 | **Trois activités ne sont pas rédigées par le moteur** : `urgence`, `enr`, `renovation`. Leur devis se rédige à la main. | `ACTIVITES_COUVERTES` + contrôle dédié qui le vérifie | ✅ | Écrire les familles correspondantes dans la bibliothèque de rédaction. Demande le vocabulaire métier du client, qui ne s'invente pas. |

## A.3 · Interface

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| I2 | 🟠 | **168 cellules de tableau sans `data-label`**, sur 21 écrans. En mode carte (≤1024 px) elles s'affichent sans intitulé — une ligne de valeurs nues sur un téléphone. | Balayage du dépôt, recompté le 9 novembre | ✅ | **15 corrigées** le 9 novembre sur les écrans que le client a nommés (DocumentView 6, Comptabilité 6, Planification 3) : 187 → 168. Un **plafond** dans `check:recette` empêche le nombre d'augmenter. Les 168 restantes ne s'automatisent pas sans risque — colonnes conditionnelles, `colSpan`, fragments — et se corrigeront écran par écran, avec la relecture visuelle que la recette rendra possible. |
| I3 | 🟠 | **Trois modules servent un tableau sans règle de bascule en cartes** : `Dashboard`, `QuoteEditor`, `PipelineBoard`. | Balayage du dépôt, recompté le 9 novembre | ✅ | `DocumentView` est **fait** (règle calquée sur `SuiviCommercial`, scopée sous `.lines`). ⚠️ **Les trois autres ne sont PAS touchés, délibérément** : leur ajouter une règle de cartes à l'aveugle casserait des mises en page jamais vues — un kanban est déjà fait de cartes, un éditeur de devis est un formulaire. Cela demande les écrans, donc la recette. |
| I4 | 🟠 | **Le rôle superviseur n'a pas d'interface.** | Audit du 5 novembre | ✅ | Lot G. |

## A.4 · Intégration et données

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| D2 | 🔴 | **Six sociétés sur sept portent un identifiant légal invalide.** CGK Services et CGK Énergie ont une clé de Luhn fausse ; quatre autres n'ont ni SIREN exploitable ni numéro de TVA. | Contrôle de Luhn sur les données réelles, 6 novembre | ✅ | **Saisie à corriger en base, pas un développement.** La garde de cran 2 les signale aujourd'hui ; le réglage `devis_garde_identite_stricte` les bloquera le jour où les fiches seront justes. |
| D3 | 🟠 | **Aucune société n'a de représentant légal renseigné**, ce qui bloque l'émission des contrats de sous-traitance. | `controlerEntite()` sur les données réelles | ✅ | Saisie. |
| D6 | 🔴 | **La CLI Supabase est liée à la PRODUCTION et rien ne le signale.** `supabase/.temp/project-ref` désigne le projet de production : un `db push` ou un `db reset` lancé par distraction frappe les données réelles. | Lecture de `supabase/.temp/`, 8 novembre | ✅ | Garde-fou du Lot C — mesure I1, point 5 du plan de recette. |
| D10 | 🟠 | **Aucune intégration continue.** `.github/workflows/` n'existe pas. Le CDC §8.2 exige qu'une CI vérifie l'absence de la clé service-role dans l'artefact de build. | Absence du répertoire, 8 novembre | ✅ | **Partiellement corrigé le 8 novembre** : le contrôle est devenu une commande, `npm run check:bundle` (8 secrets cherchés dans 113 fichiers de bundle, 0 fuite, aucune valeur imprimée). Il reste à le DÉCLENCHER automatiquement — suite ouverte en **D16**. |
| D11 | 🟠 | **Le secret du cron est accepté en paramètre d'URL** autant qu'en en-tête. Un secret dans une URL se retrouve dans les journaux du proxy, l'historique et les traces. | Lecture de la route, 8 novembre | ✅ | **Partiellement corrigé** : refusé hors production, toléré-journalisé en production. Le runbook est corrigé (**D18**) et porte désormais une **étape 3 bis** de quatre commandes **en lecture seule**, avec le tableau de lecture du résultat. **Reste ouvert, comme le client l'a demandé, jusqu'à ce que la configuration réelle du VPS soit constatée** — je n'ai ni SSH ni Docker. Ensuite : poser `CGK_CRON_SECRET_URL=refuse`. |
| D13 | ⚪ | **Les types générés déclarent quatre colonnes absentes de la base.** `can_request_action`, `can_reassign`, `can_set_priority` ont été ajoutés à `lib/supabase/database.types.ts` dans le **même commit** que la migration qui les crée (`be943d7`), sans régénération ultérieure — alors que la convention du dépôt est un commit « régénérer les types après la migration ». `tsc` ne peut donc pas signaler l'écart. | Historique Git du fichier, 8 novembre | ✅ | **Contenu** : le code détecte l'absence des colonnes à l'exécution et refuse le périmètre (*fail-closed*, vérifié). Régénérer les types après l'application de la migration en recette. |

| D14 | 🔴 | **La clé de chiffrement de production doit être considérée comme exposée.** Elle a séjourné en clair, en commentaire, dans un fichier du poste de travail (D5). | Conséquence directe de D5, 8 novembre | ✅ | **Voie 2 retenue par le client et DÉVELOPPÉE** : enveloppe `encv2:<kid>` avec identifiant de clé, liste de clés de lecture (`FIELD_ENCRYPTION_KEYS_ANCIENNES`), rotation progressive et reprenable. **62 assertions · 6 mutations, 6 détectées.** ⚠️ **Inerte par défaut** : l'écriture reste en `encv1` sans `CGK_CHIFFREMENT_V2=oui`, donc le comportement de production est inchangé. Reste : le **script de conversion** (à écrire contre la recette) et la rotation elle-même. Plan dans `docs/D14-PLAN-TECHNIQUE-ROTATION.md`. **Aucune clé modifiée.** |
| D16 | ⚪ | **Aucune intégration continue n'existe toujours.** Le contrôle du bundle exigé par le CDC §8.2 est désormais une commande (`npm run check:bundle`, 8 secrets × 113 fichiers, 0 fuite), mais rien ne la lance automatiquement. | Reste de D10 après correction, 8 novembre | ✅ | Une étape de CI qui enchaîne `check:devis`, `check:docusign`, `check:superviseur`, `check:recette`, `tsc`, `lint`, `build`, `check:bundle`. Tout est déjà en commandes : il ne manque que le déclencheur. |

| D17 | 🟠 | **L'IBAN des sociétés n'est PAS chiffré**, contrairement au CDC. Deux sociétés ont un IBAN réel qui s'imprime sur leurs factures. | Recherche exhaustive des appels à `encryptField()`, 8 novembre | ✅ | **Le CODE est fait** (2026-11-09) : lecture tolérante aux deux formes, modification depuis la fiche société **réservée au Super Admin**, chiffrement à l'écriture, refus si la clé manque, écriture limitée aux deux colonnes, trace dans `audit_logs` **avec la valeur MASQUÉE** — aucune migration, le journal append-only EST l'historique. **105 assertions · 7 mutations, 7 détectées.** ⚠️ **Ce qui reste : la conversion des deux lignes en clair**, qui est une modification de DONNÉES. Elle est portée par la procédure unifiée `docs/D14-D17-PROCEDURE-UNIFIEE.md` et attend votre autorisation. |
| D26 | 🔴 | **La série de numérotation des factures est COMMUNE à toutes les sociétés émettrices.** `doc_counters` a pour clé `(doc_type, year)` : chaque numéro pris par une société manque à la série des autres. Pour une société donnée, ses factures ont donc des trous — ce que la numérotation continue (FR, BE, LU) interdit. | **Confirmé** — clé primaire lue dans `20260515000002_init_tables.sql:153-158`, et `next_doc_num(p_type, p_year)` sans paramètre de société (`20260515000004_init_functions.sql:26`) | ✅ | **Développé, non appliqué** (`20261109000003`) : série par société, activée en renseignant `legal_entities.code_numerotation`. Sans code, la série historique continue **à l'identique**. ⚠️ **Décision client + expert-comptable** : la date de bascule (recommandé : un 1er janvier) et le traitement des numéros déjà émis cette année. **Mise à jour du 9 novembre (nuit)** : série par société **datée** (`numerotation_depuis`) : on la prépare, elle ne bascule qu'à sa date ; année et date lues à l'heure **légale** de la société (Canada : America/Toronto) ; série active ou employée **immuable en base** ; écran Super Admin (Paramètres › Sociétés). Développé, non appliqué. Date de bascule : **en attente** (vous + expert-comptable). **Mise à jour (après `7e7b1f8`)** : **préparer ≠ activer.** Une série préparée (code + date) ne sert PAS : l'allocation exige une ACTIVATION, posée par `activer_serie_societe()` — qu'aucun rôle applicatif ne peut appeler (ni session, ni service-role), avec validateur et justification, irréversible, gardée aussi à la création d'une société. Procédure : `supabase/procedures/activation-serie-societe.sql` (modèle, ROLLBACK). **Aucune série activée** ; les séries existantes continuent. |
| D27 | 🟠 | **Les factures OPTIMIVV ont leur propre série `FAC-AAAA-NNNNN`**, parallèle à `FAC-AAAA-NNNN` de `documents`, et elles sont **numérotées à la génération** — sans brouillon ni émission distincte. | **Confirmé** (technique) — deux compteurs : `next_facture_optimivv_num` (`20260807000021`) et `next_doc_num` ; appel dans le repli de `generateFactureFinale`. **Non vérifiable** (juridique) : la légalité de deux séries pour une même société relève de l'expert-comptable | ✅ | Non corrigé dans cette livraison (seule la MISE EN PAGE du moteur OPTIMIVV est gelée, pas sa numérotation). Décision : fusionner la série, ou la distinguer explicitement (préfixe), puis lui appliquer brouillon → émission. **Mise à jour du 9 novembre (nuit)** : **analysé** — `docs/D27-PLAN-TRANSITION-OPTIMIVV.md` : deux séries « FAC- » parallèles, aucune ne connaît la société, et chaque renvoi par `/api/devis/envoyer` créait un **nouveau** numéro (R1). Plan en quatre temps, **sans toucher à l'historique** ; inventaire en lecture seule prêt (`supabase/requetes/`, jamais exécuté). **Mise à jour (après `7e7b1f8`)** : opérations de transition **préparées seulement** : `supabase/procedures/d27-preparation-optimivv.sql` — colonne `entity_id` nullable pour les factures FUTURES, rattachement proposé de l'historique par SIRET **montré, jamais écrit**, compteurs montrés et non touchés ; ROLLBACK. Rien ne s'applique avant vos décisions Q1-Q3. |
| D28 | 🔴 | **Une facture finale n'était jamais « émise ».** Elle naissait en brouillon déjà numérotée, et l'envoi par courriel ne faisait passer à « envoyé » que les DEVIS : une finale pouvait partir chez le client en restant brouillon, sans contrôle d'émission. | **Confirmé** — lecture intégrale de `sendDocumentByEmail` (`document-actions.ts`, condition `detail.doc.type === "devis" && …`) et de `generateFactureFinale` (`status: "brouillon"`, numéro posé par le trigger d'insertion) | ✅ | **Développé, non appliqué** : `emettreFacture` (seul chemin, back-office, identité de la société vérifiée), envoi refusé tant qu'elle est brouillon. Voir C15. **Mise à jour du 9 novembre (nuit)** : **tous les circuits d'envoi vérifiés**, anciens compris (6 routes PDF, 14 modules d'envoi). Ajouts : le PDF d'un brouillon porte « NON ÉMISE, SANS VALEUR DE FACTURE » sur chaque page (**rendu réel vérifié**) ; l'aperçu d'une facture OPTIMIVV n'affiche plus le prochain vrai numéro. Le circuit OPTIMIVV ne connaît pas encore le brouillon : D27. |
| D32 | 🔴 | **Le cloisonnement par pays d'une planificatrice n'existe qu'à l'ÉCRAN, pas en base.** La RLS de LECTURE de `dossiers`, `documents`, `leads` et `clients` accorde `is_planificateur()` sur TOUTES les lignes ; seule la page Planification filtre par `users.countries` (A17). Une planificatrice qui interroge l'API directement lit les dossiers des autres pays. | **Confirmé** — les quatre politiques lues en entier dans `20260515000005_init_rls.sql` : leads `:151-161`, clients `:185-200`, documents `:215-231`, dossiers `:315-324` — toutes `… or is_planificateur() or …`, sans pays ; filtre de la page lu (`planification/page.tsx`, « A17 — sécurité par défaut ») | ✅ | **Non corrigé** : trouvé en appliquant D31. Le corriger, c'est réécrire la RLS de plusieurs tables métier — un chantier en soi, à éprouver sur la recette. Les NOTIFICATIONS, elles, sont désormais cloisonnées en base (D31). **Décision : ouvrir ce chantier.** **Mise à jour (après `39d7552`) — DÉVELOPPÉ, non appliqué, non testé réellement** : inventaire GÉNÉRÉ depuis les migrations (`docs/D32-INVENTAIRE-GENERE.md`) — **40 tables** ouvertes à toute planificatrice avant D32 ; migration `20261109000008`, **générée** (`scripts/d32/generer.ts`) : **69 politiques réécrites sur 34 tables**, chacune reprise À L'IDENTIQUE sauf `is_planificateur()`, remplacé par le contrôle de périmètre de la table ; 6 tables gardées et justifiées (numérotation, paramètres, annuaire des sous-traitants — D35). **Effectif seulement pour les comptes STRICTS** : tout nouveau compte l'est ; les planificatrices existantes passent en mode hérité (accès d'avant D32) jusqu'à leur bascule, compte par compte (`supabase/procedures/d32-passage-strict.sql`). Serveur : `/documents` et la fiche client lisent par la session ; le Certificat de hotte exige un dossier visible. |
| D33 | 🔴 | **Quatre compteurs de numérotation étaient SANS RLS** — `cert_hotte_counters`, `contract_counters`, `devis_optimivv_counters`, `facture_optimivv_counters` : avec les privilèges par défaut de Supabase, la clé anonyme pouvait les lire et les RÉÉCRIRE (sauter ou réutiliser des numéros de contrats et de factures OPTIMIVV). | **Confirmé** (schéma) — aucune activation de RLS dans leurs migrations, vérifié par un lecteur PUIS par une recherche indépendante (le lecteur s'était d'abord trompé sur neuf autres tables, cf. journal) · **probable** (exploitabilité : dépend des privilèges par défaut, standards chez Supabase) | ✅ | **Développé, non appliqué** (`…08`) : RLS posée, sans politique — seules leurs fonctions SECURITY DEFINER y écrivent. |
| D34 | 🟠 | **Trois fonctions de numérotation restaient exécutables par PUBLIC**, donc par la clé anonyme : `next_contract_num`, `allocate_subcontract_ref`, `allocate_document_archive_ref`. Chaque appel brûle un numéro. | **Confirmé** — un `grant … to authenticated` sans `revoke … from public` (PostgreSQL accorde EXECUTE à PUBLIC par défaut) ; recherche des `revoke`/`grant` sur les trois fonctions | ✅ | **Développé, non appliqué** (`…08`) : retirées à PUBLIC et à anon, accordées à `authenticated` et `service_role`. Le reste des fonctions SECURITY DEFINER est inventorié (§4 de l'inventaire). |
| D35 | 🟠 | **L'annuaire des sous-traitants n'est pas cloisonné** : `technicians` est lisible par TOUT compte connecté (commerciaux compris), et les fiches et pièces de conformité par toute planificatrice — ni pays ni entité n'existent pour un sous-traitant. | **Confirmé** — politiques lues (`technicians readable to authenticated`, `subcontractor_*_select`) ; colonnes : seulement `service_departments` | ✅ | **Décision** : un sous-traitant est-il une ressource commune, ou rattachée à des pays / sociétés ? Si rattachée : colonnes à créer, puis même mécanisme que D32. |
| D36 | 🟠 | **Des données sans périmètre déterminable deviendront invisibles en mode strict** : leads sans pays ou sans société, clients directs sans pays ni société, et ce qui en dépend. | **Non vérifiable** d'ici — volumes réels inconnus ; la requête 1c de `d32-passage-strict.sql` les compte | 🟠 | **Avant toute bascule en strict** : jouer l'inventaire, rattacher ces données (pays, société), puis basculer. |

## A.5 · Historique et visualisation

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| H1 | 🔴 | **La migration M1 n'est pas appliquée, et n'existe même pas comme fichier de migration.** La table `document_versions` n'existe pas : l'historique est codé, branché aux quatre origines, et **n'enregistre rien**. Le panneau le dit à l'écran au lieu de se taire. Son SQL vit dans `docs/MIGRATION-M1-HISTORIQUE-DEVIS.md`, hors de `supabase/migrations/`. | Décision en attente depuis le 2026-11-06 ; absence du fichier vérifiée le 8 novembre | ✅ | **Votre autorisation.** Le SQL est additif. À transformer en migration numérotée au Lot C, puis appliquer d'abord sur la recette. |
| H2 | 🟠 | **L'auteur d'une version n'est pas résolu.** `cree_par` porte l'identifiant, mais l'écran n'affiche pas le nom. | Lecture de `versions-server.ts` | ✅ | Jointure sur `users` à la lecture. Sans intérêt tant que H1 n'est pas levée. |

## A.6 · Environnement

| # | Gravité | Anomalie | Constaté | Vérifié | Correction envisagée |
| --- | --- | --- | --- | --- | --- |
| E1 | 🔴 | **Aucun environnement de recette.** `.env.local` pointe sur la production, et c'est le seul fichier d'environnement du projet : aucun parcours authentifié n'a pu être essayé, sur aucun lot. | Constat permanent, structure de `.env.local` relevée le 8 novembre | ✅ | **Lot C.** C'est le préalable de toute validation fonctionnelle. |
| E2 | 🟠 | `getUnreadCount threw` au build, sur quatre routes rendues dynamiquement. | Sortie de `npm run build` | ✅ | Bruit de prérendu, sans effet à l'exécution. À regarder quand les écrans seront vérifiés. |
| E7 | 🟠 | **Les 177 migrations n'ont toujours JAMAIS été rejouées.** `npm run preflight` échoue dès la première ligne : **aucun PostgreSQL sur ce poste** — ni service, ni `psql`, ni Docker. Le commit `d738f20` annonçait « un PostgreSQL 15 installé et à l'écoute » ; son propre message ne rapporte qu'un refus de mot de passe, **aucun rejeu**. Et même exécuté, il ne prouverait aucun refus d'accès : sa couche de compatibilité fige `auth.uid()` sur une valeur constante. | `npm run preflight -- --garder`, `Get-Service *postgre*`, recherche de `psql.exe`, 9 novembre | ✅ | Le rejeu se fera **sur la recette** (Lot C), qui donne aussi de vrais rôles pour éprouver la RLS. Localement : installer PostgreSQL ne coûte rien, mais c'est une installation sur votre poste — **à votre décision**. |

---

# Partie B — Anomalies CORRIGÉES

Historique permanent. **Aucune ligne ne sort de cette partie.** Chaque
correction nomme le lot, le commit, et par quel moyen elle a été prouvée.

## Lot A — commit `f4cae59`

| # | Gravité | Anomalie corrigée | Preuve |
| --- | --- | --- | --- |
| LA-1 | 🟠 | **Mentions produits sur des textes non arrêtés.** France et les trois pays européens passent aux formulations validées. Le Canada est conservé tel quel, sur demande expresse. | Contrôles qui figent les quatre textes et le refus d'aligner le Canada |
| LA-2 | 🔴 | **`RESERVE_MURS_EXCLUS` ne sortait que si les murs ET les plafonds étaient refusés.** Refuser le lessivage des murs en gardant les plafonds ne produisait **rien** : le devis se taisait sur un refus explicite du client. Deux réserves ajoutées (murs seuls, plafonds seuls) ; la réserve de vitrerie nomme désormais les encadrements. | Contrôles par combinaison, une seule phrase sur le lessivage quoi qu'il arrive |
| LA-3 | 🟠 | **Six jetons CSS invalides dans la fenêtre de visualisation.** `--surface`, `--border`, `--text`, `--bg` ne sont définis nulle part : le panneau était transparent et sans bordure, posé sur un voile noir à 55 %. | Six déclarations corrigées vers les jetons réels |
| LA-4 | 🟠 | **`/ma-journee` et `/notifications` n'étaient atteignables que par URL.** Développées et invisibles, donc non livrées côté interface. | Deux entrées dans `lib/nav.ts`, source unique de la barre latérale et de la palette ⌘K |
| LA-5 | 🔴 | **`/api/devis` en mode final n'avait aucune garde contre le doublon.** Un double-clic allouait deux numéros d'une séquence sans trou — qui ne se récupère pas — et archivait deux PDF sur la même affaire. | Vérification posée avant l'allocation ; `genererDevisDepuisDecouverte` signale désormais un devis OPTIMIVV existant |

## Lot B, phase 1 — commit `4a32c55`

| # | Gravité | Anomalie corrigée | Preuve |
| --- | --- | --- | --- |
| LB-1 | 🔴 | **Une assertion de `check:docusign` cassée par le Lot A.** Un contrôle figeait le comportement d'avant le Lot A. **Mon rapport de Lot A avait déclaré cette suite verte : c'était faux.** | 1 assertion devenue 3, suite au vert |
| LB-2 | 🔴 | **L'identité de la société émettrice venait du navigateur.** `/api/devis` acceptait `prestataire`, `marque` et `logoPath` depuis le corps de la requête : l'identité juridique d'un devis était falsifiable côté client. | L'identité est résolue en base à partir du dossier ; les champs du corps sont écartés |
| LB-3 | 🔴 | **L'identité OPTIMIVV était cuite dans le gabarit.** Masquer par un rectangle blanc la retire de l'œil, pas de la couche texte : un devis suisse portait encore « OPTIMIVV SAS » et son SIRET au copier-coller. | 23 éléments retirés du flux de contenu, gabarit neutre vérifié par extraction de texte |
| LB-4 | 🔴 | **Trois valeurs contractuelles écrites en dur dans le gabarit** — elles s'appliquaient à toutes les sociétés. | Relevées, retirées, réécrites dynamiquement |
| LB-5 | 🟠 | **Trois points de rendu distincts** pour le même document : l'aperçu pouvait diverger de l'envoi. | `rendu-document-server.ts`, point de rendu unique |
| LB-6 | 🔴 | **Aucun contrôle d'identité à l'émission.** Un devis pouvait partir avec une société incomplète. | Garde à trois crans : refus bloquant, signalement, journalisation |
| LB-7 | 🟠 | **Le gabarit ne pouvait pas changer de société.** | Résolution par spécificité société/activité, réglable depuis Réglages |
| LB-8 | ⚪ | **Trois fautes dans le texte déménagement** : étage écrit « Ne », unité de volume répétée, formulation d'emballage. | Corrigées, contrôles associés |

## Lot B, phase 2 — commit `00dc4db`

| # | Gravité | Anomalie corrigée | Preuve |
| --- | --- | --- | --- |
| LB-9 | 🔴 | **Troncature silencieuse du descriptif.** Le gabarit nettoyage n'imprimait que les **cinq** premières lignes, le déménagement **neuf**. Depuis l'harmonisation, le moteur rédige quarante à soixante lignes : les suivantes partaient à la poubelle sans un mot. Parmi elles **toutes les réserves**, la clause de réévaluation, les exclusions murs et vitrerie, la mention des produits. Un devis contractuel amputé de ses réserves n'oppose plus rien au client. | Pages de suite paginées ; les douze devis d'échantillon du moteur portent tous leur bloc RÉSERVES |
| LB-10 | 🟠 | **L'écran « nouveau devis » annonçait OPTIMIVV à tout le monde**, titre en dur et modèle graphique choisi par un ternaire sur le secteur. | Les deux viennent de la base : société du dossier et gabarit associé |
| LB-11 | 🟠 | **Les deux parcours de création ne rédigeaient pas le même texte.** | Référentiel de rédaction commun, vérifié par contrôle |

## Lot E — commit `be531c3`

| # | Gravité | Anomalie corrigée | Preuve |
| --- | --- | --- | --- |
| LE-1 | 🔴 | **Le texte contractuel n'atteignait aucun PDF.** `getDocumentById` sélectionnait `notes` en base et ne le rendait jamais : un type de frontière ne déclarait pas la colonne, donc le compilateur ne pouvait pas signaler qu'aucun mappeur ne la recopiait. Le moteur rédigeait PRESTATION / DÉTAIL / RÉSERVES, l'éditeur l'affichait, le commercial le relisait — et le PDF envoyé au client n'en contenait rien. | Rendu vérifié sur les deux moteurs react-pdf, avec et sans descriptif |
| LE-2 | 🔴 | **Les montants s'imprimaient « 4/850 € ».** L'espace fine insécable (U+202F) n'a pas de glyphe dans les polices intégrées de react-pdf : son encodage tombe sur la barre oblique. Tout devis et toute facture à quatre chiffres partait illisible. | Extraction de la couche texte, pas lecture d'image : le PDF contenait bien U+002F |
| LE-3 | 🟠 | **La visualisation n'existait que dans l'éditeur.** La fiche du document et la comptabilité ouvraient le PDF dans un onglet : on quittait son écran et on y revenait à la main. | Fenêtre partagée, les trois écrans l'emploient |
| LE-4 | 🟠 | **`/devis/new?lead=` ouvrait un éditeur vide** alors que le moteur avait de quoi rédiger. Dernière divergence entre les trois parcours de création. | Les trois appellent `redigerPourLead` |
| LE-5 | ⚪ | **Mes propres contrôles étaient aveugles aux conditions mortes.** `if (false)` et `{false &&` neutralisent un comportement sans retirer la ligne qu'un contrôle textuel cherche : quatre mutations sur vingt passaient inaperçues. | Garde générale sur les onze fichiers du lot ; seconde passe 20 mutations / 20 détectées |

---

## Lot C — commit à venir (corrections locales du 2026-11-08)

Huit anomalies, dont **cinq 🔴**. Trois d'entre elles — D9, E4, E5 — sont
celles qui rendaient faux le plan d'isolation présenté la veille.

| # | Gravité | Anomalie corrigée | Preuve |
| --- | --- | --- | --- |
| D5 | 🔴 | **La clé de chiffrement de production était recopiée en clair, en commentaire, dans le `.env.local` du poste**, avec le nom d'hôte du serveur et la commande qui l'avait extraite. | Deux lignes de commentaire retirées, et **les 19 variables actives vérifiées identiques avant et après**. Une note les remplace, qui renvoie à la procédure de rotation. ⚠️ Suite ouverte en **D14** : la clé doit être considérée comme exposée. |
| D7 | 🟠 | **La semence ne pouvait pas se charger sur un projet neuf.** 14 `insert`, un seul `on conflict`, et trois tables en collision dure avec les migrations (`activities`, `roles`, `doc_counters` ont une contrainte d'unicité ; `legal_entities` et `prestations` dupliquaient en silence). | 13 clauses `on conflict do nothing` ajoutées — la forme SANS CIBLE, qui fonctionne quelle que soit la contrainte et survit à son évolution. Plus un bloc de diagnostic final qui **rend visible** un doublon de sociétés, puisque rien ne l'empêche en base. |
| D8 | 🟠 | **`seed_bulk_demo.sql` rattachait ses 25 leads de démonstration à deux adresses Gmail réelles de l'équipe.** | Remplacées par des comptes `@example.invalid`. Et le contrôle que j'ai écrit pour le vérifier en a trouvé **12 autres** : des noms fictifs sur des domaines réels (gmail, outlook, yahoo). **47 adresses** des trois semences basculées sur un domaine réservé par la RFC 2606, qui ne peut pas exister. |
| D9 | 🔴 | **25 variables d'environnement étaient lues par le code et absentes de `.env.example`** — dont les six d'un second transport d'e-mail. Un environnement bâti sur cette documentation héritait de ses trous. | `.env.example` réécrit : **56 variables, les neuf champs demandés chacune**, plus les 3 déclarées-mais-jamais-lues conservées et expliquées. **Couverture vérifiée par comparaison : 56 lues, 56 documentées, écart nul.** Un contrôle de la suite `check:recette` empêche désormais l'écart de se réouvrir — y compris pour les accès dynamiques `process.env[nom]`, invisibles à une recherche textuelle. |
| D12 | 🟠 | **`N8N_WF2_TRIGGER_URL` et `N8N_WF2_TRIGGER_SECRET` étaient documentés et jamais lus.** Le déclenchement de la séquence WF2 décrit dans `.env.example` et dans le SPEC n'est pas câblé. | **Ce n'était pas un oubli : WF2 a été RETIRÉ volontairement le 2026-11-04**, avec l'envoi automatique des devis — `lib/app-settings.ts` le dit explicitement. Le recâbler contredirait la règle « les devis ne doivent jamais être envoyés automatiquement ». Les deux variables sont conservées dans `.env.example`, commentées et expliquées : les retirer en silence ferait croire qu'elles n'ont jamais existé. |
| E3 | 🔴 | **Les intégrations sortantes étaient raccordées au réel sur le poste de développement.** Un essai local qui cliquait « Envoyer » expédiait un vrai e-mail au vrai destinataire. | Garde-fou de démarrage sur `instrumentation.ts` : **prouvé par un `next dev` réel** — refus nommé, aucun processus survivant, le serveur ne sert aucune requête. Plus le goulet d'envoi, qui capture au lieu d'envoyer hors production. |
| E4 | 🔴 | **Retirer la clé Brevo ne suffisait pas à empêcher un envoi** : `lib/devis/email.ts` bascule sur un repli SMTP « si Brevo n'est pas configuré ». Neutraliser Brevo ne coupait pas l'envoi, il le **basculait**. | Goulet unique posé sur les **trois** accès réseau d'envoi (Brevo e-mail, Brevo SMS, nodemailer), et **au-dessus du choix du canal** dans `email.ts` — car c'était le choix du canal qui était le défaut. Un contrôle compte les accès réseau : un quatrième ferait échouer la suite. Mutation vérifiée : neutraliser la garde du SMS est détecté. |
| E5 | 🔴 | **Un lien de signature émis depuis la recette aurait pointé sur la PRODUCTION.** Le vecteur réel n'était pas le repli `crmoptimum.com` — c'était `domainForSector()`, dont les domaines sont des constantes de production et qui alimente le lien de signature OPTIMIVV. | `domainForSector()` ne rend son domaine en dur qu'en **production** ; ailleurs on retombe sur une base **validée contre une liste blanche**. Les quatre autres points passent par le même résolveur, l'en-tête `host` est validé au lieu d'être cru, et le lien final est vérifié avant émission. **65 assertions** sur les cinq points. |
| D15 | 🟠 | **La mention des produits dépendait du PAYS, pas de la société émettrice.** Deux sociétés françaises partageaient la même allégation : activer la France la faisait porter par toutes, y compris celle qui n'emploie pas ces produits. | **Couche par société ajoutée, en plus et non à la place** : le réglage par pays reste lu comme repli, et ce repli est **signalé** (`pays_herite`) — le supprimer éteindrait les mentions déjà actives, ce que le client a exclu. La formulation française passe à celle qu'il a arrêtée, **verrouillée au mot** dans 5 fichiers de contrôle. CH/BE/LU inchangés. Le Canada reste une déclaration de **conformité** et non une allégation écologique — vérifié : l'alinéa 74.01(1)b.1) de la Loi sur la concurrence exige une « épreuve suffisante et appropriée » faite avant la déclaration. **+43 contrôles · 5 mutations, 5 détectées.** |
| D18 | 🟠 | **L'Option A bis de `docs/CRON.md` ne pouvait pas authentifier.** La ligne systemd écrivait `-H "x-cron-secret=%i"` — signe égal au lieu de `: `. Mesuré : curl abandonne l'en-tête **en silence**. Une installation qui l'a suivie n'envoie aucun secret, la route répond 403, et le moteur d'alertes ne tourne pas sans qu'aucun message ne le dise. `%i` ne s'étendait pas non plus dans une unité simple. | **Runbook corrigé** le 8 novembre, autorisation du client : `EnvironmentFile` + `-H "x-cron-secret: ${CRON_SECRET}"`, un encadré qui explique l'ancien défaut, et une **étape 3 bis** de quatre commandes en lecture seule pour constater la configuration réellement en place, avec un tableau de lecture du résultat. ⚠️ **Ce qui reste ouvert est D11** : savoir ce que le VPS fait vraiment. |
| D19 | 🟠 | **Les documents imprimaient « IBAN » pour une société canadienne.** Trouvé en vérifiant les cinq pays à votre demande : **le Canada n'utilise pas l'IBAN** — une société canadienne identifie son compte par institution, transit et numéro de compte. Un document comptable annonçant « IBAN » devant un numéro de transit est faux, et une validation IBAN aurait refusé toutes les coordonnées canadiennes. | L'intitulé suit désormais le **pays de la société émettrice** (`libelleCoordonnee`), sur les deux moteurs PDF. La validation est **par pays** : clé mod-97 et longueur pour FR/CH/BE/LU, forme locale pour le CA, et un IBAN dont le pays contredit celui de la société est **refusé**. Mutation vérifiée : imprimer « IBAN » partout est détecté. |
| I1 | 🟠 | **19 jetons CSS employés sans être définis**, donc sans repli : la propriété devient **invalide à la valeur calculée** et l'élément perd sa couleur, sa bordure ou sa taille, en silence. `--text-strong` (14 emplacements, deux fichiers) et `--fs-2xs` (5). | `--text-strong` → `--text-primary`, le jeton réel. `--fs-2xs` → l'échelle s'arrêtait à 12 px : **étendue à 11 px** plutôt que de rabattre ces badges sur `xs`, ce qui les agrandirait. ⚠️ **Et j'ai failli en casser 55 qui fonctionnent** : six jetons sur huit que mon balayage brut signalait sont **posés en ligne depuis le TSX** (`style={{ ["--sc" as string]: … }}`) ou fournis par Next. Le contrôle encode désormais cette distinction — sans elle, il crierait au loup 55 fois. |

## D21 · D22, et deux trouvailles en chemin — commit à venir (2026-11-09)

Quatre anomalies corrigées. **Développé et testé techniquement** : 75
assertions nouvelles dans `npm run check:superviseur` (suite
`navigation-rls.ts`), `tsc` propre, lint 0 erreur sur les fichiers touchés.
**Pas testé réellement** : aucune session authentifiée possible sans recette
(E1) — voir C14.

| # | Gravité | Anomalie corrigée | Preuve |
| --- | --- | --- | --- |
| D21 | 🟠 | **Le module Clients était absent de la navigation.** | Entrée `/clients` dans `NAV_GROUPS` (icône `clients`), donc dans la barre latérale ET la palette ⌘K. **Place tranchée par les permissions existantes**, pas par moi : `/clients` n'est pas restreint, et la RLS de `clients` limite le commercial aux clients de SES leads — il voit l'entrée, et seulement ses clients. **La création d'un client direct** (`/clients/new`), que la RLS réservait déjà au back-office, l'est désormais aussi à l'écran : préfixe dans `RESTRICTED_MODULES`, garde de layout, bouton et lien du devis masqués, garde dans `createDirectClient`. Le commercial garde `ensureClientFromLead` : son client naît de son lead. |
| D22 | 🟠 | **Le module Certificat de hotte était absent de la navigation, et inatteignable.** | Entrée `/certificat-hotte` (icône `certificate`). Visible de l'admin et de la planification seulement — le filtrage passe par `canAccessPath()`, le même calcul que la garde du layout, qui rend un 404 aux autres. Vérifié pour les trois rôles par la suite. ⚠️ **Correction du 9 novembre (soir)** : « aucun lien du dépôt n'y mène » était **faux** — le menu de Planification y mène (`Planification.tsx`, « Certificat Hotte », `/certificat-hotte?dossier=…`), pour les dossiers nettoyage. L'absence de la navigation, elle, était réelle. |
| D24 | 🔴 | **Les actions de l'onglet « Documents & Contrats » de la fiche client n'étaient gardées QUE par l'écran.** Huit server actions — création, renouvellement, statut, envoi et suppression de contrat, passages, dépôt et suppression de document — ne vérifiaient que la session. La RLS d'insertion n'exige que `created_by = auth.uid()`, pas que le client appartienne à l'appelant : un commercial pouvait rattacher un document ou tenter un contrat sur le client d'un autre. Et `createContract` **consommait un numéro de la séquence sans trou** avant tout refus de la base. Trouvé en préparant D21 : rendre le module visible rendait ces actions bien plus faciles à atteindre. | `assertBackOffice()` en **première instruction** des huit actions, avant toute lecture, numérotation ou écriture — vérifié par position dans la suite. Aucune permission légitime ne change : l'écran ne montrait déjà l'onglet qu'au back-office. La fiche ne charge plus ce registre pour un commercial, et son compteur lui est masqué plutôt qu'affiché à 0. |
| D25 | 🔴 | **N'importe quel utilisateur connecté pouvait modifier les étiquettes d'activité de N'IMPORTE QUEL client**, à partir de son seul identifiant : `updateClientActivityTags` écrivait par le **service-role** (hors RLS) sans autre contrôle que la session. | L'écriture reste au service-role — le commercial étiquette ses propres clients depuis la fiche, et la RLS d'UPDATE le lui refuserait — mais la **session doit d'abord voir le client** : c'est la RLS de lecture qui tranche (admin, planification, propriétaire du lead source). Hors périmètre → refus explicite, aucune écriture. |

## Facturation, D23 — commit à venir (2026-11-09, soir)

**Développé et testé techniquement, NON appliqué, NON testé réellement.**
Quatre migrations préparées (`20261109000001` à `20261109000004`), aucune
jouée nulle part. 165 contrôles nouveaux, dont **4 mutations volontaires sur
4 détectées**. Le test de concurrence (`npm run recette:facturation`) est
écrit et ses deux refus ont été **exécutés** ; le test lui-même n'a **jamais
tourné** — aucune base de recette.

| # | Gravité | Anomalie corrigée | Preuve |
| --- | --- | --- | --- |
| D23 | ⚪ | **Le contrat client partait avec un lien de stockage valable 7 jours.** | Décision du client : 60 minutes, renouvelable, contrôlé, tracé, sans pièce jointe. Le courriel porte un **jeton de 256 bits** (empreinte seule en base), qui ouvre une URL de 5 minutes. Expiré : la page propose un nouveau lien, **envoyé à l'adresse enregistrée**, 3 fois par 24 h au plus, dans les 30 jours de l'envoi ; l'ancien est révoqué, tout est tracé et le back-office notifié. La durée est inscrite **en base** (`contrat_liens_acces_duree`). ⚠️ **Conséquence** : les liens de 7 jours déjà envoyés restent valides jusqu'à leur échéance — une URL signée ne se révoque pas une à une ; elle tombe au plus 7 jours après l'envoi. **Parcours de signature : inchangés** (les contrats clients ne se signent pas en ligne ; devis par `/sign`, sous-traitance par DocuSign). |

## D29 · D30 et notifications — commit à venir (2026-11-09, nuit)

**Développé et testé techniquement — NON appliqué, NON testé réellement.**
Deux migrations de plus (`20261109000005`, `…06`) ; aucune jouée.

| # | Gravité | Anomalie corrigée | Preuve |
| --- | --- | --- | --- |
| D29 | 🟠 | **Un commercial pouvait marquer une facture payée** (`markDocumentPaid` sans garde ; RLS « propriétaire du lead » en écriture). | **Décision du client** : back-office et Super Admin seuls. **Trois niveaux** : en base, un trigger refuse le passage à « payé » d'une facture et à « encaissé » d'un lead pour toute session ni admin ni planification (`20261109000005`) ; côté serveur, `markDocumentPaid` et `updateLeadStatus(encaissé)` exigent le back-office ; à l'écran, le pipeline du commercial explique au lieu de tenter — les autres colonnes et la **lecture** de l'état de paiement sont inchangées. Le refus réel sous une session commerciale : section 7 de `recette:facturation`. |
| D30 | 🔴 | **N'importe quel compte connecté émettait une facture OPTIMIVV**, numéro définitif compris, par `/api/devis` et `/api/devis/envoyer` ; et l'aperçu imprimait le prochain vrai numéro. | **Confirmé** par lecture intégrale des deux routes (seule la session était vérifiée). Facture réservée au back-office (403), **la garde précède l'allocation du numéro** ; le bouton « Facture » n'est plus proposé au commercial ; l'aperçu d'une facture porte « APERÇU ». Le devis du commercial : inchangé. |

## D31 — notifications cloisonnées — commit à venir (2026-11-09, après `7e7b1f8`)

**Développé et testé techniquement — NON appliqué, NON testé réellement.**
Migration `20261109000007`, jouée nulle part.

| # | Gravité | Anomalie corrigée | Preuve |
| --- | --- | --- | --- |
| D31 | 🟠 | **Les notifications ignoraient le cloisonnement par pays** — et aucune autorisation par **entité juridique** n'existait. | **Décision du client** : périmètre strict, pays ET entités, au serveur ET en base. **Serveur** : un seul service, `notifierBackOffice()`, qui retient chaque destinataire par la règle de périmètre ; les cinq appels `notifyRole(« planification »)` — devis signé (deux circuits), réponse client, contrat à renouveler, lien renouvelé — et toutes les actions (planification, intervention, facturation, encaissement) y passent ; **pays inconnu = aucune planificatrice** (fail-closed). **Base** : la même règle en SQL ; une notification hors périmètre est **refusée à l'insertion** et **masquée à la lecture** ; sa portée est **immuable** depuis une session (pas de démasquage). **Entités** : `users.entites_autorisees`, **vide = toutes** (comportement antérieur), réglé par un administrateur ; la vue Planification le suit. **Notifications déjà enregistrées** : procédure `supabase/procedures/notifications-hors-perimetre.sql` — inventaire en lecture seule, puis pose de la portée qui les **masque sans rien supprimer**, ROLLBACK par défaut. **Compatibilité** : sans la migration, `notify()` réessaie sans les colonnes de portée — aucune notification perdue — mais **jamais** quand la base a refusé pour périmètre. |

# Partie C — À VÉRIFIER EN RECETTE

Développé, mesuré par script, **jamais vu dans une session authentifiée** :
aucun environnement de recette n'existe (E1). Cette partie est la liste de
contrôle d'entrée du Lot C.

| # | À vérifier | Écran / chemin | Résultat attendu | Lot d'origine |
| --- | --- | --- | --- | --- |
| C1 | La fenêtre de visualisation | éditeur de devis · fiche document · comptabilité | S'ouvre sans quitter l'écran, se ferme au clavier, prend le focus | E |
| C2 | Le panneau d'historique | fiche document | Dit son indisponibilité tant que M1 n'est pas appliquée ; se remplit ensuite | E |
| C3 | L'éditeur prérempli | `/devis/new?lead=…` | Porte le texte du moteur, modifiable en place | E |
| C4 | L'encart de signalements | émission d'un devis, société au cran 2 | Signale sans bloquer, nomme ce qui manque | B |
| C5 | Le refus d'émission | émission, société au cran 1 | Refuse, nomme la cause, **ne consomme aucun numéro** | B |
| C6 | Réglages › Gabarits de devis | `/settings/integrations` | Associe un gabarit à une société et à une activité | B |
| C7 | Le parcours complet | Lead → Découverte → Générer → Éditer → 👁 → Valider → Envoi manuel | Aucune ressaisie, aucun doublon, aucun envoi automatique | B + E |
| C8 | Les pages de suite | devis au descriptif long | Encadré + renvoi, texte complet paginé, identité en pied | B |
| C9 | La mention des produits | Réglages, société par société | Absente tant qu'elle n'est pas saisie — **aucune constante par défaut** | B |
| C10 | Les cinq pays | un devis réellement émis par pays | Identité juste, aucun mélange entre sociétés | B |
| C11 | Le cloisonnement du commercial | fiche lead, compte commercial | La provenance reste invisible | antérieur |
| C12 | Le cron et les alertes | `/presence`, `/ma-journee` | Les relances et alertes se déclenchent seules | antérieur |
| C13 | Les modules jamais vus à l'écran | superviseur · sous-traitants · documents & contrats · médias · Ringover · DocuSign | S'ouvrent et fonctionnent pour le rôle attendu | antérieurs |
| C14 | Navigation et refus, par rôle (D20 à D25) | barre latérale · ⌘K · `/clients` · `/clients/new` · `/certificat-hotte` · `/sous-traitants`, avec un compte **commercial**, un compte **planification**, un compte **admin** | Commercial : voit Clients (ses seuls clients), pas Certificat de hotte ni « Créer un client » ; `/certificat-hotte`, `/clients/new` et `/sous-traitants` en 404. Back-office : tout s'ouvre ; la fiche sous-traitant affiche raison sociale, SIRET et dirigeant **une fois saisis**, et le contrat les reprend. En SQL, sous le rôle `authenticated` d'un commercial : `select` sur `subcontractor_profiles` → **0 ligne**. | Lot C |
| C15 | Intervention → facture finale | Planification : terminée → **valider** (commentaire) → **préparer** la facture → fiche facture → **émettre** | Pas de facture avant validation ; brouillon « non numérotée » ; lignes du devis + acomptes nommés ; numéro attribué à l'émission seulement ; plus de modification ensuite ; historique des validations lisible | Facturation 9 nov. |
| C16 | Lien de contrat (D23) | Envoyer un contrat à une adresse de test ; l'ouvrir ; attendre 61 min ; renouveler ; rouvrir l'ancien | Ouverture < 60 min ; page « expiré » ensuite ; nouveau courriel à la même adresse ; l'ancien lien dit « remplacé » ; 4e demande en 24 h refusée | D23 |
| C17 | Encaissement par un commercial (D29) | Compte `commercial.nettoyage`, facture de son dossier ; puis compte `planif.recette` | Le commercial **voit** l'état de paiement mais ne peut **ni** « Marquer payée » **ni** glisser la carte en « encaissé » — refus à l'écran, au serveur **et en base** ; la planification, elle, encaisse | D29 |
| C18 | Concurrence réelle | `npm run recette:facturation` | 1 émission sur 10 en double clic ; 20 numéros consécutifs sur 20 émissions simultanées ; facture émise inaltérable, y compris par le service-role | Facturation 9 nov. |
| C19 | Signature interne d'un devis (circuit conservé) | « Envoyer pour signature » → ouvrir `/sign/<jeton>` **hors session** → signer | Statut `signe` ; PDF signé + attestation + certificat dans le bucket privé `signed-documents` ; **ré-hacher le PDF archivé = empreinte stockée** ; URL d'archive qui expire ; dossier de planification créé ; acompte émis si « avec acompte » | Décision 9 nov. §5 |
| C20 | Contrat de sous-traitance par DocuSign (circuit conservé) | Compte DocuSign **développeur** ; émettre un contrat depuis Planification ; signer | Webhook HMAC accepté ; document signé **et** certificat archivés ; contrat signé non annulable ; ⚠️ aujourd'hui **aucune notification** à la signature (voir livrable §Notifications) | Décision 9 nov. §5 |
| C21 | Factures OPTIMIVV (D27, D30) | Compte commercial puis back-office sur `/devis/nouveau` ; aperçu d'une facture ; deux envois du même document | Commercial : pas de bouton « Facture », 403 par l'API ; aperçu « APERÇU » ; ⚠️ deux envois = deux numéros tant que le plan D27 n'est pas appliqué — à constater, pas à corriger en recette | D27 · D30 |
| C22 | Notifications intermodules | Les six actions (planifier, valider, préparer, émettre, impayé, acompte) et le contrat DocuSign signé ; comptes de deux pays différents | Alerte dès l'action attendue ; reçue par les seuls planificateurs du pays ; **lue, elle reste dans « Actions attendues »** ; fermée quand l'action est faite ; escalade au Super Admin au délai réglé ; aucun doublon avec `quote.signed`. Base : section 8 de `recette:facturation` | Notifications |
| C23 | Séries des cinq pays (D26) | Une société par pays, série préparée puis active ; émissions croisées | Chaque société numérote dans **sa** série, consécutive ; aucun numéro partagé ; série employée non modifiable. Base : section 6 de `recette:facturation` | D26 |
| C24 | Périmètre des notifications (D31) | Deux planificatrices de pays différents, puis l'une restreinte à une entité ; les cinq types de notifications ; procédure sur les notifications existantes | Chacune ne reçoit et ne lit que ses pays et ses entités ; pays inconnu : personne ; une ancienne notification hors périmètre disparaît de sa liste **mais reste en base** ; le Super Admin voit tout. Base : section 9 de `recette:facturation` | D31 |
| C25 | Verrou d'activation des séries (D26) | Préparer une série depuis l'écran ; tenter de l'activer depuis l'écran, par l'API, par le service-role ; créer une société déjà activée | Préparée : la série historique continue ; **toute** tentative d'activation hors procédure est refusée ; la procédure SQL, elle, active — après votre validation. Base : section 0 de `recette:facturation` | D26 |
| C26 | Cloisonnement des données (D32) | Section 10 de `recette:facturation` ; puis à l'écran, compte `planif.recette` STRICT sur deux pays et une société : Leads, Clients, Documents, Comptabilité, Planification, Sous-traitance, ⌘K, recherche | Ne voit que ses pays ET sa société, à l'écran comme par l'API ; un document, une ligne, un contrat hors périmètre : invisibles ; écriture et création hors périmètre : refusées ; ce qui est autorisé continue de fonctionner ; Super Admin et commercial inchangés | D32 |
| C27 | Bascule d'un compte existant (D32) | `supabase/procedures/d32-passage-strict.sql` sur un compte de test en mode hérité | Inventaire lisible (ce qu'il perdrait, données sans périmètre) ; bascule d'UN compte nommé ; refus sans pays ou sans entité | D32 · D36 |
| C28 | Performance des politiques (D32) | Listes de leads, documents, dossiers sur un volume représentatif | Temps de réponse dans les cibles du CDC (filtre sur 1 000 leads < 500 ms) malgré les fonctions de périmètre ligne par ligne | D32 |

---

# Partie D — REPORTÉES (améliorations recommandées)

Ni défaut, ni régression. Leur opportunité se décide ; elles sont
**volontairement reportées** à la phase de corrections consolidées.

| # | Recommandation | Pourquoi | Décision attendue |
| --- | --- | --- | --- |
| G3 | **Basculer chaque société sur le gabarit neutre.** Sur le gabarit d'origine, une valeur corrigée reste lisible sous son rectangle : un copier-coller entrelace l'ancienne et la nouvelle. | Disparaît par réglage, sans développement | Réglage `devis_gabarits`, société par société |
| G4 | **Aligner le chemin d'origine sur la ligne de base réelle.** Le numéro et la date y sont écrits 4,2 pt plus bas que le design ; la voie 0 écrit juste. | Les deux chemins diffèrent légèrement | Change le rendu en production : à décider |
| M2 | **Signaler au commercial une valeur de liste non reconnue** plutôt que de l'imprimer. Une clé technique mal saisie se lirait dans le devis. | Voulu pour les champs libres, risqué pour les listes | Produit |
| D1 | **Décider quels événements du cycle devis méritent une notification.** Ni la génération ni l'envoi n'en émettent aujourd'hui ; le mécanisme existe et fonctionne pour d'autres événements. | Choix produit, pas correctif | Produit |
| D4 | **Faire converger les deux parcours de devis** — `devis_optimivv` et `documents`. Ils rédigent pareil et portent la même identité, mais restent deux tables. | Rien ne presse tant qu'ils produisent le même document | Après la recette |
| H3 | **Comparer deux versions.** On lit une version, pas l'écart entre deux. | Le besoin réel est de produire **la** version envoyée, et elle est repérée | À arbitrer |
| H4 | **Intituler « Descriptif de la prestation »** quand le texte vient du moteur. Le rendu générique l'intitule « Notes », ce qui est faible pour un texte portant PRESTATION / DÉTAIL / RÉSERVES. | Confort de lecture côté client | Produit |

---

---

# Partie E — VALIDÉE EN RECETTE

**Vide.** Aucune anomalie de ce projet n'a jamais été validée dans une
session authentifiée : l'environnement de recette n'existe pas (E1). Cette
partie se remplira à partir du Lot C, une ligne par anomalie vérifiée, avec
le compte utilisé, l'écran, la date et la preuve.

| # | Anomalie | Vérifiée le | Compte | Écran | Preuve |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |

---

# Partie F — NON REPRODUCTIBLE

**Deux entrées.** La règle tient : une ligne n'entre ici qu'accompagnée de la trace de la tentative. Une ligne
n'entre ici qu'accompagnée de la trace de la tentative : ce qui a été essayé,
sur quelle version, avec quel compte. « Je n'ai pas réussi à le reproduire »
sans cette trace n'est pas un état, c'est un abandon.

| # | Anomalie | Signalée par | Tentative de reproduction | Décision |
| --- | --- | --- | --- | --- |
| E6 | **`tsc --noEmit` a échoué une fois sur `.next/types/validator.ts`** — du code **généré par Next**, dans une déclaration que nous n'écrivons pas (`LayoutConfig<Route extends LayoutRoutes>`). `tsconfig.json` inclut `.next/types/**` et `.next/dev/types/**`, d'où leur présence dans la vérification. | moi-même, le 8 novembre, en enchaînant build puis `tsc` | **Trois tentatives, aucune reproduction** : (1) `rm -rf .next` + build + `tsc` → muet ; (2) deux builds successifs + `tsc` → muet ; (3) build après suppression du seul `validator.ts` + `tsc` → muet. L'occurrence unique a suivi deux builds ET deux démarrages de `next dev` dans le même répertoire de travail. | **Classée non reproductible**, avec deux conditions qui la neutralisent : `tsc` **avant** `build`, et `.next` propre au début de chaque exécution. Les deux sont consignées comme conditions de CI. Rouvrir si elle se reproduit avec un déclencheur identifié. |
| D20 | **« `subcontractor_profiles` : RLS activée SANS AUCUNE POLITIQUE »** — le profil sous-traitant serait illisible, et le contrat privé de l'identité du prestataire. | moi-même, audit statique du 9 novembre (`51c6b81`) | **La politique existe**, depuis la même migration `20260930000001` : `subcontractor_profiles_select` et `_write`, `is_admin() or is_planificateur()`, créées dans une boucle `foreach … execute format('create policy %I on %I …')`. Le motif de l'audit, `on subcontractor_profiles`, **ne peut pas voir une politique écrite en `%I`** — rejoué le 9 novembre : 0 occurrence, d'où le faux constat. **Troisième détection fautive** de la même journée, même cause : un motif trop étroit. Vérifié ensuite : aucune migration ne supprime ces politiques ni ne redéfinit `is_planificateur()`, qui teste bien le slug `planification` ; la table figure dans les types générés depuis la production dès le 14 octobre (`2e74659`) ; les trois lectures demandent des colonnes qui existent. | **Classée non reproductible : il n'y avait pas de défaut.** Aucune migration écrite — elle n'aurait rien changé. Le motif fautif est **remplacé** par un lecteur qui comprend les politiques littérales, en boucle et supprimées, rejouées dans l'ordre des 177 fichiers (`navigation-rls.ts`) : il retrouve les politiques des trois tables sous-traitants, et prouve que leur prédicat **refuse le commercial**. Il fige aussi la liste des 4 tables sans politique, toutes réservées au service-role. ⚠️ **« 0 fiche sous-traitant » reste donc à expliquer autrement** — vraisemblablement aucune fiche saisie. Une seule requête en lecture sur la production le trancherait ; **non lancée, faute d'autorisation**. |

---

## Ce qui n'est PAS dans ce registre

- Ce qui n'a jamais été mesuré. Une anomalie supposée n'est pas une anomalie.
- Les choix produit en attente d'arbitrage **qui ne découlent d'aucun constat** :
  ils figurent dans les rapports de lot.

## Journal

| Date | Évènement |
| --- | --- |
| 2026-11-09 (après `39d7552`) | **D32 — cloisonnement des données, développé.** Inventaire **généré** depuis les migrations, avant et après : 40 tables ouvertes à toute planificatrice → 34 cloisonnées par pays ET entité, 6 justifiées ; plus aucune table sans RLS. Politiques **générées** (69), reprises à l'identique sauf le rôle ; arguments qualifiés par leur table. Nouveaux comptes **stricts** ; existants en **mode hérité**, sans blocage, jusqu'à leur bascule validée. Serveur : `/documents` et la fiche client par la session ; Certificat de hotte gardé. **Trouvées en chemin** : D33 (compteurs sans RLS), D34 (numérotations exécutables par la clé anonyme), D35 (annuaire des sous-traitants), D36 (données sans périmètre). **Erreurs de mon lecteur, rattrapées par vérification croisée avant toute déclaration** : neuf tables de présence déclarées « sans RLS » (activée en boucle), puis des politiques d'ÉCRITURE invisibles (blocs DO sans boucle) — sans ce second rattrapage, la réécriture les aurait laissées ouvertes. Une garde neutralisable (`if (false && …)`) passait mes contrôles : assertion durcie. **Tests** : 3 801 contrôles, 0 échec, 46 suites ; 6 mutations sur 6 détectées. **Rien n'est testé réellement.** **Totaux par comptage des lignes : 31 ouvertes · 41 corrigées · 28 à vérifier · 7 reportées · 0 validée · 2 non reproductibles — 109 entrées.** |
| 2026-11-09 (après `7e7b1f8`) | **D31 validée par le client et corrigée** : notifications cloisonnées par pays ET entités, au serveur et en base (insertion refusée, lecture masquée, portée immuable) ; les cinq appels existants et toutes les actions passent par un seul service ; périmètre d'entités créé (vide = toutes) ; procédure pour les notifications déjà enregistrées, sans suppression. **D32 trouvée** en l'appliquant : la RLS des dossiers ne cloisonne pas par pays — non corrigée, chantier à ouvrir. **D26** : préparer ≠ activer — activation par une fonction qu'aucun rôle applicatif ne peut appeler ; aucune série activée. **D27** : opérations de transition préparées, rien d'écrit. **Recette** : `npm run recette:pret` désigne l'étape suivante et qui la fait. **Erreur de ma part rattrapée** : le test réel aurait planté dès sa section 0 (`refuse` employé avant sa déclaration) — trouvée par `tsc`, invisible pour esbuild. **Tests** : 3 728 contrôles, 0 échec, 45 suites ; 6 mutations sur 6 détectées. **Rien n'est testé réellement.** **Totaux par comptage des lignes : 27 ouvertes · 41 corrigées · 25 à vérifier · 7 reportées · 0 validée · 2 non reproductibles — 102 entrées.** |
| 2026-11-09 (nuit) | **Instructions après `0c86c7e`.** **D29 tranchée par le client et développée** sur trois niveaux (base, serveur, écran), pipeline du commercial préservé. **D30 trouvée et corrigée** en vérifiant « tous les circuits d'envoi » : toute session émettait une facture OPTIMIVV, et chaque renvoi créait un nouveau numéro. **D28** : six routes PDF et quatorze modules d'envoi vérifiés ; mention « non émise » sur le PDF d'un brouillon, **rendu réel vérifié**. **D26** : séries datées, à l'heure légale de chaque société, immuables une fois employées, configurées par le Super Admin. **D27** : analysé, plan de transition sans toucher à l'historique. **Notifications développées** : six actions attendues, persistantes jusqu'à l'acte, sans colonne « lue », escalade paramétrable, **ciblées par pays** — ce qui a fait apparaître **D31**. **Erreurs de ma part, rattrapées avant livraison** : trois jetons CSS inventés, deux assertions vides (dont une `&& false`), un motif qui prenait un commentaire pour un bouton. **Tests** : 3 639 contrôles, 0 échec, 43 suites (107 nouveaux) ; 6 mutations sur 6 détectées. **Rien n'est testé réellement.** **Totaux par comptage des lignes : 27 ouvertes · 40 corrigées · 23 à vérifier · 7 reportées · 0 validée · 2 non reproductibles — 99 entrées.** |
| 2026-11-09 (soir) | **Décisions du client : facturation en deux étapes, numéro à l'émission, D23, recette.** **Niveaux de preuve** instaurés, et les 24 anomalies ouvertes **revérifiées une à une** : G5 passe de recherche textuelle à confirmé ; **H1 et D11 avaient un texte périmé** (M1 existe comme fichier depuis le 8 ; le secret de cron en URL est déjà refusé hors production). **Trois erreurs de ma part, consignées** : « aucun lien vers le Certificat de hotte » (faux, le menu de Planification y mène — D22) ; « doublon de facture finale non interdit en base » dans la préparation du matin (faux, `uq_one_finale_per_devis` existait, écrit sur deux lignes que mon motif ne lisait pas) ; et le même piège a failli me faire déclarer `documents` sans politique RLS — rattrapé par une recherche multiligne. **Développé, non appliqué** : intervention terminée → **validée** (historisée, append-only) → facture finale **préparée** en brouillon sans numéro, qui reprend les lignes du devis signé et nomme chaque acompte émis ; **numéro attribué à l'émission**, par la base, dans la transaction ; séries **par société** sur activation ; facture émise **figée** (numéro, montants, lignes, suppression — même pour le service-role) ; annulation Super Admin motivée ; D23. Nouvelles : D26, D27, D28, D29 ; vérifications C15 à C20. **Tests** : 165 contrôles nouveaux, 4 mutations volontaires sur 4 détectées ; refus des gardes `recette:facturation` et `migrer:recette` **exécutés**. **Rien n'a été testé réellement**, rien n'a touché la production. **Totaux par comptage des lignes : 27 ouvertes · 38 corrigées · 20 à vérifier · 7 reportées · 0 validée · 2 non reproductibles — 94 entrées.** |
| 2026-11-09 (nuit) | **D20, D21, D22 — corrections avant recette, demandées par le client.** **D20 était une fausse détection de ma part** : la politique existe, créée en boucle dynamique ; classée en partie F avec sa trace, et le motif fautif remplacé par un lecteur de politiques. **D21 et D22 corrigées** (partie B) : Clients et Certificat de hotte dans la barre latérale et la palette ⌘K, selon les permissions existantes. En préparant D21, **deux failles 🔴 trouvées et corrigées** : D24 (huit actions de la fiche client gardées par l'écran seul) et D25 (étiquettes de n'importe quel client modifiables par n'importe qui). **Deux ouvertures** : D23 (lien de contrat signé 7 j — arbitrage) et E7 (aucun Postgres sur le poste, les migrations n'ont jamais été rejouées). Une vérification de recette : C14. **3 366 contrôles, 0 échec, 36 suites.** Aucune donnée, migration ni ressource de production touchée. **Totaux par comptage des lignes : 24 ouvertes · 37 corrigées · 14 à vérifier · 7 reportées · 0 validée · 2 non reproductibles — 84 entrées.** |
| 2026-11-07 | Ouverture du registre à la livraison du Lot B. **19 entrées** (et non 21 : le décompte annoncé ce jour-là était faux). |
| 2026-11-07 | Lot E : 4 entrées ajoutées (historique et visualisation). **23 entrées** — et non 25 comme annoncé dans le rapport de Lot E. Le décompte était propagé d'une erreur antérieure ; il est corrigé ici par comptage. |
| 2026-11-08 | **Restructuration en quatre parties** à la demande du client. La règle « une anomalie corrigée n'entre jamais au registre » est abandonnée : les 21 corrections des lots A, B et E entrent en partie B, où elles resteront. Quatre anomalies **nouvelles** constatées en préparant le Lot C : D5 (clé de production en clair sur le poste), D6 (CLI liée à la production), D7 (semence non chargeable sur un projet neuf), D8 (semence rattachée à des comptes réels), plus E3 (intégrations sortantes raccordées au réel). Sept entrées reclassées en partie D. **Totaux établis par comptage : 21 ouvertes · 21 corrigées · 13 à vérifier en recette · 7 recommandations.** |
| 2026-11-09 (fin) | **Priorités 4 à 7.** **I1 corrigée** (19 occurrences) et passée en partie B ; I2 et I3 **actualisées par recomptage** — 15 cellules étiquetées, 168 restantes sous plafond, et trois modules volontairement non touchés faute d'avoir vu les écrans. **Matrice des interconnexions** : 11 liaisons décrites, **3 n'existent pas** (DocuSign ne signe pas les devis, le rapprochement bancaire est absent, intervention→facturation n'est pas câblée), et **1 seule sur 11** est exercée autrement que par lecture de code. **Audit statique DocuSign** : les 10 volets sont développés et testés techniquement, **zéro testé réellement**. Trois anomalies nouvelles : **D20** (RLS sans politique sur `subcontractor_profiles` — le profil sous-traitant est illisible, ce qui explique peut-être « 0 fiche »), **D21** et **D22** (les modules Clients et Certificat de hotte sont **absents de la navigation**). ⚠️ **Deux détections fautives de ma part en dix minutes** — une sortie tronquée par `head`, puis un motif ne tolérant pas un double espace — m'ont fait croire à une élévation de privilège et à deux tables sans RLS. **Les deux étaient faux**, recomptés, et les 14 actions sont gardées. **Totaux par comptage : 25 ouvertes · 33 corrigées · 13 à vérifier · 7 reportées · 0 validée · 1 non reproductible — 79 entrées.** |
| 2026-11-09 (suite) | **Priorités 1 et 2 du client.** **Procédure unifiée D14+D17** : script de rotation inactif par défaut, qui **refuse la production sans condition** — trois refus prouvés par exécution réelle. La règle centrale est posée et testée : *une valeur qu'on ne sait pas déchiffrer n'est jamais réécrite*, et une seule illisible refuse le lot entier. **D17 : le code est fait** — modification Super Admin seul, chiffrée, tracée dans `audit_logs` avec la valeur masquée, sans migration. **D19 corrigée** : les documents imprimaient « IBAN » pour une société canadienne, alors que **le Canada n'utilise pas l'IBAN**. ⚠️ **Un piège de mes propres contrôles, pour la troisième fois** : une assertion qui se déclenche sur la prose qui l'explique. Cause traitée à la racine — `sansCommentaires()` retire les commentaires avant toute inspection structurelle. **Totaux par comptage : 23 ouvertes · 32 corrigées · 13 à vérifier · 7 reportées · 0 validée · 1 non reproductible — 76 entrées.** |
| 2026-11-09 | **Voie 2 du chiffrement développée, runbook du cron corrigé, guide pas à pas livré.** **D18 corrigée** et passée en partie B : `docs/CRON.md` prescrivait une forme d'en-tête que curl abandonne en silence ; le runbook gagne une **étape 3 bis** de vérification en lecture seule. **D14** : la capacité technique de la voie 2 est développée et testée (62 assertions, 6 mutations détectées), **inerte par défaut** — l'écriture reste en `encv1`. **D17** : temps 1 fait (lecture tolérante + alerte bruyante) ; la conversion des données attend votre autorisation. **D15** : les deux motifs nés de l'activation par société sont désormais **signalés** au commercial, sans quoi une mention absente et une mention héritée se lisaient toutes deux comme « rien à signaler ». ⚠️ **Un piège que j'ai moi-même créé** : deux empreintes de la même clé coexistent (12 caractères pour le garde-fou, 8 pour le `kid`), et je les ai confondues dans le guide. Corrigé, et **8 assertions** ferment la confusion. **Totaux par comptage : 23 ouvertes · 31 corrigées · 13 à vérifier · 7 reportées · 0 validée · 1 non reproductible — 75 entrées.** |
| 2026-11-08 (soir) | **Trois analyses demandées par le client, et une correction.** **D15 corrigée** et passée en partie B : la mention des produits dépend désormais de la SOCIÉTÉ ÉMETTRICE, en couche additive — le réglage par pays reste lu comme repli signalé, pour ne pas éteindre ce qui fonctionne. La formulation française passe à celle arrêtée par le client. **E6 classée NON REPRODUCTIBLE** et passée en partie F, première entrée de cette partie : trois tentatives de reproduction, toutes muettes. **D11 vérifiée sans toucher au service** : `docs/CRON.md` prescrit l'en-tête dans ses quatre formes, et le dépôt ne contient aucune trace d'appel par URL. **D14 analysée** : 10 colonnes, 2 tables, et l'enveloppe `encv1:` sans identifiant de clé rend une rotation interrompue irrécupérable. Deux anomalies nouvelles, trouvées en analysant : **D17** (l'IBAN n'est pas chiffré, contrairement au CDC) et **D18** (l'Option A bis de `docs/CRON.md` n'authentifie pas — mesuré : curl abandonne l'en-tête en silence). **Totaux par comptage : 24 ouvertes · 30 corrigées · 13 à vérifier · 7 reportées · 0 validée · 1 non reproductible — 75 entrées.** |
| 2026-11-08 | **Corrections locales du Lot C (phase 4 partielle, autorisation du client du 8 novembre).** Huit anomalies corrigées et déplacées en partie B, dont **cinq 🔴** : D5 (clé de production en commentaire), D7 et D8 (semences), D9 (25 variables non documentées), D12 (WF2 — élucidé : retiré volontairement le 4 novembre, pas oublié), E3, E4 et E5 (les trois chemins d'envoi et de lien vers le réel). D10 et D11 sont **partiellement** corrigées et le disent. Trois anomalies nouvelles : D14, D15, D16. Une quatrième anomalie nouvelle, **E6**, a été constatee en enchainant build puis `tsc`. **Totaux par comptage : 24 ouvertes · 29 corrigées · 13 à vérifier · 7 reportées · 0 validée · 0 non reproductible — 73 entrées.** |
| 2026-11-08 | **Audit technique du Lot C (phases 1-2).** Passage à **six états** (§15 du Master Prompt) : les parties E « validée en recette » et F « non reproductible » sont créées **vides**, et le resteront tant qu'aucun environnement de recette n'existera. L'ancienne partie D devient « Reportée ». **Sept anomalies nouvelles**, dont trois 🔴 qui invalidaient le plan d'isolation de la veille : D9 (25 variables d'environnement lues par le code et absentes de `.env.example`), E4 (un **second** transport e-mail SMTP prend le relais quand Brevo est absent — neutraliser Brevo ne coupe pas l'envoi, il le bascule), E5 (le repli `https://crmoptimum.com` écrit en dur ferait pointer un lien de signature de recette vers la **production**). Plus D10 (aucune CI), D11 (secret du cron accepté en paramètre d'URL), D12 (WF2 documenté mais non câblé), D13 (types déclarant des colonnes absentes de la base). **Totaux par comptage : 28 ouvertes · 21 corrigées · 13 à vérifier · 7 reportées · 0 validée · 0 non reproductible — 69 entrées.** |
