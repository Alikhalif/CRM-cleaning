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

# Partie A — Anomalies OUVERTES

23 entrées. Dix anomalies ont quitté cette partie le 8 novembre pour la
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
| I1 | 🟠 | **19 autres jetons CSS invalides** hors de l'éditeur de devis. Une `var()` non définie et sans repli rend la propriété invalide à la valeur calculée. | Balayage du dépôt, Lot A | ✅ | Corriger par écran, avec relecture visuelle. |
| I2 | 🟠 | **24 cellules de tableau sans `data-label`.** En mode carte (≤1024 px) elles s'affichent sans intitulé. | Balayage du dépôt, Lot A | ✅ | Ajouter les attributs manquants. |
| I3 | 🟠 | **163 cellules sans adaptation mobile.** | Balayage du dépôt, Lot A | ✅ | Même traitement qu'I2. |
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

| D17 | 🟠 | **L'IBAN des sociétés n'est PAS chiffré**, contrairement au CDC. Deux sociétés ont un IBAN réel qui s'imprime sur leurs factures. | Recherche exhaustive des appels à `encryptField()`, 8 novembre | ✅ | **Temps 1 fait** : la lecture tolère les deux formes (`lireCoordonneeBancaire()`), et **crie dans les journaux** si une valeur chiffrée devient illisible — sans quoi une facture partirait sans coordonnées bancaires, en silence. Mesuré en analysant : **rien n'écrit ces colonnes depuis l'application** (champs retirés du formulaire le 2026-11-05 pour ne pas les effacer), donc une approche « chiffrer à l'écriture » ne se déclencherait jamais. **Temps 2 — la conversion des deux lignes — est une modification de DONNÉES : votre autorisation, recette d'abord.** Recommandé : la joindre à la rotation D14, même script, même fenêtre. |

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

**Une entrée.** La règle tient : une ligne n'entre ici qu'accompagnée de la trace de la tentative. Une ligne
n'entre ici qu'accompagnée de la trace de la tentative : ce qui a été essayé,
sur quelle version, avec quel compte. « Je n'ai pas réussi à le reproduire »
sans cette trace n'est pas un état, c'est un abandon.

| # | Anomalie | Signalée par | Tentative de reproduction | Décision |
| --- | --- | --- | --- | --- |
| E6 | **`tsc --noEmit` a échoué une fois sur `.next/types/validator.ts`** — du code **généré par Next**, dans une déclaration que nous n'écrivons pas (`LayoutConfig<Route extends LayoutRoutes>`). `tsconfig.json` inclut `.next/types/**` et `.next/dev/types/**`, d'où leur présence dans la vérification. | moi-même, le 8 novembre, en enchaînant build puis `tsc` | **Trois tentatives, aucune reproduction** : (1) `rm -rf .next` + build + `tsc` → muet ; (2) deux builds successifs + `tsc` → muet ; (3) build après suppression du seul `validator.ts` + `tsc` → muet. L'occurrence unique a suivi deux builds ET deux démarrages de `next dev` dans le même répertoire de travail. | **Classée non reproductible**, avec deux conditions qui la neutralisent : `tsc` **avant** `build`, et `.next` propre au début de chaque exécution. Les deux sont consignées comme conditions de CI. Rouvrir si elle se reproduit avec un déclencheur identifié. |

---

## Ce qui n'est PAS dans ce registre

- Ce qui n'a jamais été mesuré. Une anomalie supposée n'est pas une anomalie.
- Les choix produit en attente d'arbitrage **qui ne découlent d'aucun constat** :
  ils figurent dans les rapports de lot.

## Journal

| Date | Évènement |
| --- | --- |
| 2026-11-07 | Ouverture du registre à la livraison du Lot B. **19 entrées** (et non 21 : le décompte annoncé ce jour-là était faux). |
| 2026-11-07 | Lot E : 4 entrées ajoutées (historique et visualisation). **23 entrées** — et non 25 comme annoncé dans le rapport de Lot E. Le décompte était propagé d'une erreur antérieure ; il est corrigé ici par comptage. |
| 2026-11-08 | **Restructuration en quatre parties** à la demande du client. La règle « une anomalie corrigée n'entre jamais au registre » est abandonnée : les 21 corrections des lots A, B et E entrent en partie B, où elles resteront. Quatre anomalies **nouvelles** constatées en préparant le Lot C : D5 (clé de production en clair sur le poste), D6 (CLI liée à la production), D7 (semence non chargeable sur un projet neuf), D8 (semence rattachée à des comptes réels), plus E3 (intégrations sortantes raccordées au réel). Sept entrées reclassées en partie D. **Totaux établis par comptage : 21 ouvertes · 21 corrigées · 13 à vérifier en recette · 7 recommandations.** |
| 2026-11-09 | **Voie 2 du chiffrement développée, runbook du cron corrigé, guide pas à pas livré.** **D18 corrigée** et passée en partie B : `docs/CRON.md` prescrivait une forme d'en-tête que curl abandonne en silence ; le runbook gagne une **étape 3 bis** de vérification en lecture seule. **D14** : la capacité technique de la voie 2 est développée et testée (62 assertions, 6 mutations détectées), **inerte par défaut** — l'écriture reste en `encv1`. **D17** : temps 1 fait (lecture tolérante + alerte bruyante) ; la conversion des données attend votre autorisation. **D15** : les deux motifs nés de l'activation par société sont désormais **signalés** au commercial, sans quoi une mention absente et une mention héritée se lisaient toutes deux comme « rien à signaler ». ⚠️ **Un piège que j'ai moi-même créé** : deux empreintes de la même clé coexistent (12 caractères pour le garde-fou, 8 pour le `kid`), et je les ai confondues dans le guide. Corrigé, et **8 assertions** ferment la confusion. **Totaux par comptage : 23 ouvertes · 31 corrigées · 13 à vérifier · 7 reportées · 0 validée · 1 non reproductible — 75 entrées.** |
| 2026-11-08 (soir) | **Trois analyses demandées par le client, et une correction.** **D15 corrigée** et passée en partie B : la mention des produits dépend désormais de la SOCIÉTÉ ÉMETTRICE, en couche additive — le réglage par pays reste lu comme repli signalé, pour ne pas éteindre ce qui fonctionne. La formulation française passe à celle arrêtée par le client. **E6 classée NON REPRODUCTIBLE** et passée en partie F, première entrée de cette partie : trois tentatives de reproduction, toutes muettes. **D11 vérifiée sans toucher au service** : `docs/CRON.md` prescrit l'en-tête dans ses quatre formes, et le dépôt ne contient aucune trace d'appel par URL. **D14 analysée** : 10 colonnes, 2 tables, et l'enveloppe `encv1:` sans identifiant de clé rend une rotation interrompue irrécupérable. Deux anomalies nouvelles, trouvées en analysant : **D17** (l'IBAN n'est pas chiffré, contrairement au CDC) et **D18** (l'Option A bis de `docs/CRON.md` n'authentifie pas — mesuré : curl abandonne l'en-tête en silence). **Totaux par comptage : 24 ouvertes · 30 corrigées · 13 à vérifier · 7 reportées · 0 validée · 1 non reproductible — 75 entrées.** |
| 2026-11-08 | **Corrections locales du Lot C (phase 4 partielle, autorisation du client du 8 novembre).** Huit anomalies corrigées et déplacées en partie B, dont **cinq 🔴** : D5 (clé de production en commentaire), D7 et D8 (semences), D9 (25 variables non documentées), D12 (WF2 — élucidé : retiré volontairement le 4 novembre, pas oublié), E3, E4 et E5 (les trois chemins d'envoi et de lien vers le réel). D10 et D11 sont **partiellement** corrigées et le disent. Trois anomalies nouvelles : D14, D15, D16. Une quatrième anomalie nouvelle, **E6**, a été constatee en enchainant build puis `tsc`. **Totaux par comptage : 24 ouvertes · 29 corrigées · 13 à vérifier · 7 reportées · 0 validée · 0 non reproductible — 73 entrées.** |
| 2026-11-08 | **Audit technique du Lot C (phases 1-2).** Passage à **six états** (§15 du Master Prompt) : les parties E « validée en recette » et F « non reproductible » sont créées **vides**, et le resteront tant qu'aucun environnement de recette n'existera. L'ancienne partie D devient « Reportée ». **Sept anomalies nouvelles**, dont trois 🔴 qui invalidaient le plan d'isolation de la veille : D9 (25 variables d'environnement lues par le code et absentes de `.env.example`), E4 (un **second** transport e-mail SMTP prend le relais quand Brevo est absent — neutraliser Brevo ne coupe pas l'envoi, il le bascule), E5 (le repli `https://crmoptimum.com` écrit en dur ferait pointer un lien de signature de recette vers la **production**). Plus D10 (aucune CI), D11 (secret du cron accepté en paramètre d'URL), D12 (WF2 documenté mais non câblé), D13 (types déclarant des colonnes absentes de la base). **Totaux par comptage : 28 ouvertes · 21 corrigées · 13 à vérifier · 7 reportées · 0 validée · 0 non reproductible — 69 entrées.** |
