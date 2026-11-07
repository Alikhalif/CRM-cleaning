# État de référence du CRM CGK

**Version 1.0 — relevé le 2026-11-07**
**Commit de référence : `0a79e85127d6c5ce209e010ff75366b81d816f3b`**

> Ce document est le **point de retour**. Avant chaque lot, il est relu ; après
> chaque lot, il est mis à jour avec un numéro de version et la date. Il ne
> remplace pas les rapports d'audit : il fige ce qui est vrai à un instant,
> avec sa preuve, pour qu'une régression se constate au lieu de se discuter.
>
> **Règle de lecture** : une fonctionnalité n'est jamais « opérationnelle »
> parce que son code existe. Les cinq niveaux de preuve du §3 sont la seule
> échelle admise.

---

## 1. Dépôt et environnement

| | |
| --- | --- |
| Dépôt | `Alikhalif/CRM-cleaning` |
| Branche | `main` — **unique cible de publication** |
| Commit HEAD | `0a79e85` — *docs(devis): le SQL de l'historique à valider, et l'étude IA sans API branchée* |
| Horodatage | 2026-11-07 02:05:55 +0100 |
| `origin/main` | `0a79e85` — **0 commit en avance, 0 en retard** |
| Arbre de travail | **propre**, aucune modification non enregistrée |
| Worktrees | un seul, celui du dépôt principal |
| Migrations | **176**, de `20260515000001_init_enums` à `20261105000001_superviseur_perimetre_ferme` |

### Volume

| | |
| --- | --- |
| Pages sous `app/(app)` | 46 |
| Modules `lib/*.ts` | 156 |
| Composants partagés | 14 |
| Fichiers de contrôles | 27 |

### Environnement — un constat qui conditionne tout

`.env.local` pointe sur un projet Supabase **hébergé**, avec la clé de service
et `FIELD_ENCRYPTION_KEY`. **Il n'existe aucune base de recette.** Les clés
Brevo, Ringover et DocuSign sont celles de production.

**Conséquence** : lancer l'application en local et y cliquer agit sur la
production. Un simple maintien de session écrit dans `user_presence` ;
l'ouverture d'une fiche lead écrit un `audit_logs` `lead.open`, qui alimente
la métrique « lead traité » du superviseur. Aucun test fonctionnel
authentifié n'est donc possible sans environnement de recette.

---

## 2. Résultats de référence — mesurés le 2026-11-07

| Contrôle | Résultat | Détail |
| --- | --- | --- |
| `npm run check:devis` | ✅ | **9 suites · 1 101 assertions** |
| `npm run check:docusign` | ✅ | **11 suites · 1 156 assertions** |
| `npm run check:superviseur` | ✅ | **4 suites · 201 assertions** |
| `npx tsc --noEmit` | ✅ | 0 erreur |
| `npm run lint` | ✅ | 0 erreur, 1 avertissement *(préexistant : `jsx-a11y/alt-text` sur un `<Image>` react-pdf, faux positif)* |
| `npm run build` | ✅ | compilé en 51 s |

**Total : 24 suites, 2 458 assertions, toutes vertes.**

> ⚠️ **Piège rencontré au relevé, à connaître.** Un premier passage a rapporté
> 2 erreurs `tsc` et un `build` en échec. Le fichier fautif,
> `.next/dev/types/validator.ts`, est **généré** : il avait été tronqué en
> plein identifiant (`er>`) par l'arrêt brutal d'un serveur de développement.
> **Ce n'était pas une régression du code source.** La suppression de
> `.next/dev/types` a suffi. Avant de conclure à une régression, vérifier
> toujours si le fichier cité appartient à `.next/`.

---

## 3. Échelle de preuve

| Niveau | Signification | Ce qui le prouve |
| --- | --- | --- |
| **N1 — Dans le code** | le code existe | lecture |
| **N2 — Testé automatiquement** | une suite le couvre | assertion qui sait échouer (mutation) |
| **N3 — Visible dans l'interface** | atteignable par la navigation | entrée de menu ou lien vérifié |
| **N4 — Testé dans l'interface** | l'action produit le résultat | capture + session authentifiée |
| **N5 — Vérifié en réel** | fonctionne en production | observation |

**Au 2026-11-07, rien n'atteint N4 au-delà des quatre pages publiques**, faute
d'environnement de recette. C'est la limite principale de cet état de
référence, et elle est assumée plutôt que masquée.

---

## 4. Inventaire des fonctionnalités — par niveau de preuve

### 4.1 Moteur de devis et rédaction

| Fonctionnalité | Emplacement | Niveau |
| --- | --- | --- |
| 101 opérations · 25 thèmes · 13 familles | `lib/generation/bibliotheque-redaction.ts` | **N2** |
| 3 paliers de développement | `devis-contenu.ts` | **N2** |
| 4 états de prestation (`inclus`/`exclu`/`non_renseigne`/`a_confirmer`) | `devis-contenu.ts` | **N2** |
| Contrôle indépendant partant de la découverte | `prestations-validation.ts` | **N2** |
| Exclusions prioritaires sur tout | `devis-contenu.ts` | **N2** |
| Mentions produits par pays (5 pays) | `mentions-produits.ts` | **N2** |
| Terminologie par pays (Québec : soumission) | `terminologie.ts` | **N2** |
| Reprise d'une section unique | `devis-sections.ts` | **N2** |
| Correcteur déterministe + garde-fou | `devis-reformulation.ts` | **N2** |
| Structure PRESTATION / DÉTAIL / RÉSERVES | `devis-depuis-decouverte.ts` | **N2** |
| Numérotation sans trou, 4 compteurs | RPC `SECURITY DEFINER` | **N1** |

### 4.2 Les trois activités prioritaires

| Activité | Ce qui est couvert | Niveau |
| --- | --- | --- |
| **Nettoyage** | 41 listes d'options · types, niveaux, vitrerie (quantité, accès, faces, encadrement), murs, plafonds, sols, extérieurs, équipements, radiateurs, niveaux, placards, nicotine, suie, 9 particularités, 10 exclusions · réserves dédiées · gabarit `nettoyage-template.pdf` | **N2** |
| **Déménagement** | villes départ/arrivée · volume · accès · étages · ascenseur · préremplissage `demenagementFromDiscovery` · gabarit dessiné `render.ts` · réserves de volume | **N2** |
| **Débarras** | volume · types de déchets · tri · évacuation · accès · débarras préalable et inclus · réserves `RESERVE_VOLUME`, `RESERVE_BIENS_CONSERVES`, `RESERVE_DECHETS_REGLEMENTES` | **N2** |

**Les trois partagent la même bibliothèque et le même moteur.** Toute
modification d'un champ commun doit être contrôlée sur les trois.

### 4.3 Parcours commercial

| Étape | Emplacement | Niveau |
| --- | --- | --- |
| Lead entrant, webhook HMAC | `app/api/webhooks/leads/inbound` | **N1** |
| Affectation et routage | `lib/routing.ts` | **N1** |
| Déclaration d'appel, NRP | `DeclarerAppelCard.tsx` | **N1** |
| Découverte, enregistrement automatique | `DiscoveryCard.tsx` | **N1** |
| Statut « Découverte effectuée » | `discovery_done_at` | **N1** |
| Génération du devis | `devis-actions.ts` | **N2** |
| Devis à réaliser | `/devis-a-realiser` | **N1** |
| Visualisation 👁 | `QuoteEditor.tsx:836` | **N1** *(6 jetons CSS invalides — voir §6)* |
| Modification en place, brouillon seul | `updateDevisBrouillon` | **N1** |
| **Envoi exclusivement manuel** | aucun envoi automatique | **N1** |
| Signature interne | `signature-server.ts` | **N1** · 7 devis signés |
| Pipeline horizontal 4 étapes | `PipelineSummary` | **N1** |

### 4.4 Planificatrice

9 modèles de contrat · 2 annexes (bon de mission, rapport de fin) · **blocage
si le montant sous-traitant manque** (`actions.ts:311`) · **prix client jamais
transmis** (`demande-prestataire.ts`) · bibliothèque de sous-traitants ·
DocuSign · archivage · planification · médias. **Tous en N1, le blocage et la
confidentialité du prix en N2.**

### 4.5 Superviseur, comptabilité, administration

| | État | Niveau |
| --- | --- | --- |
| 9 KPI superviseur | `supervision-shared.ts` | **N2** |
| 4 alertes | idem | **N2** |
| Périmètres `supervisor_scopes` | migration `20261015000002` | **N1** |
| Comptabilité : 4 onglets, filtres, recherche | `Comptabilite.tsx` | **N1** |
| Cloisonnement par rôle | `access-shared.ts` | **N2** |
| 5 règles d'alerte paramétrables | `/presence/parametres` | **N1** |
| Thème sombre | jetons | **N4** — mesuré sur 4 pages × 3 largeurs |

---

## 5. Données de production — photographie du 2026-11-07

### 5.1 Ce qui est mesuré, et pourquoi pas un comptage

**Un nombre qui augmente ne prouve rien** : des leads arrivent tous les jours,
des devis se créent. Comparer 706 à 712 ne dit pas si un enregistrement a
disparu — il peut en être parti trois et arrivé neuf.

Le contrôle de non-régression porte donc sur la **conservation et
l'intégrité** des enregistrements **déjà présents** :

| Contrôle | Méthode |
| --- | --- |
| **Conservation** | chaque identifiant présent avant le lot est toujours présent après |
| **Intégrité** | pour chaque enregistrement antérieur, les champs immuables sont **inchangés** (empreinte comparée) |
| **Non-suppression douce** | aucun `deleted_at` posé sur un enregistrement qui n'en avait pas |
| **Croissance** | les créations postérieures sont listées à part, et leur légitimité se constate |

**Mise en œuvre** : avant le lot, on relève pour chaque table protégée
l'ensemble des identifiants et une empreinte des champs qui ne doivent pas
bouger. Après le lot, on recompare. Un identifiant manquant ou une empreinte
différente est une régression ; un identifiant nouveau ne l'est pas.

### 5.2 Volumes au moment du relevé — contexte, pas témoin

Ces chiffres situent l'ampleur. Ils ne servent **pas** de critère de
non-régression.

| Table | Au 2026-11-07 | Remarque |
| --- | --- | --- |
| `leads` | 706 | dont **690 sans `entity_id` (98 %)** |
| `devis_optimivv` | 22 | tous envoyés, 9 leads, type devis |
| `documents` type devis | 18 | 3 brouillons, 6 envoyés, 2 ouverts, **7 signés** |
| `dossiers` | 11 | |
| `legal_entities` | **7**, toutes `FR` | |
| `subcontract_contracts` | 0 | aucun contrat jamais généré |
| `document_archive` | 0 | |
| `signature_requests` | 0 | les 7 devis signés le sont en interne |
| `client_documents` | 0 | |

**Répartition des leads par activité** : nettoyage 598 · déménagement 61 ·
diogène 21 · urgence 10 · nettoyage difficile 6 · ENR 4 · rénovation 4 ·
débarras 2. **659 leads (93 %) relèvent du parcours à identité figée.**

### 5.3 Tables protégées et champs immuables

| Table | Clé | Champs dont la modification est une régression |
| --- | --- | --- |
| `leads` | `id` | `created_at`, `external_id`, `client_*`, `discovery_details`, `discovery_done_at`, `notes`, `owner_id`, `status` |
| `documents` | `id` | `num`, `type`, `status`, `issued_at`, `signed_at`, `total_ht`, `total_ttc`, `entity_id`, `notes` |
| `devis_optimivv` | `id` | `numero`, `data`, `pdf_path`, `sent_at`, `montant_ht` |
| `legal_entities` | `id` | **tous** — aucune correction automatique n'est autorisée |
| `dossiers` | `id` | `status`, `planned_at`, `realized_at`, `technician_id` |
| `audit_logs` | `id` | **tous** — table append-only par construction |

⚠️ **Un devis déjà envoyé ou signé ne doit jamais changer**, quel que soit le
lot. C'est le contrôle le plus important de cette liste.

---

## 6. Anomalies connues au 2026-11-07

Elles sont **antérieures** à tout lot à venir. Les retrouver après une
intervention n'est pas une régression ; en trouver d'autres, si.

| # | Anomalie | Gravité | Preuve |
| --- | --- | --- | --- |
| A1 | Deux parcours de génération de devis | P0 | 22 vs 18 devis |
| A2 | Identité juridique figée sur le parcours OPTIMIVV | P0 | `types.ts:69`, `render-nettoyage.ts:51` |
| A3 | 4 sociétés sur 7 ont `À renseigner` en SIRET ; 2 ont une clé de Luhn fausse | P1 | contrôle Luhn |
| A4 | Aucune des 7 sociétés n'a de logo | P1 | `logo_url` nul |
| A5 | Réserve « murs seuls » jamais émise | P1 | `devis-contenu.ts:529` |
| A6 | 6 jetons CSS invalides sur la fenêtre de Visualisation | P1 | `QuoteEditor.module.scss:376-418` |
| A7 | 19 autres jetons CSS invalides | P2 | sous-traitants, Topbar, notifications |
| A8 | `/ma-journee` et `/notifications` hors navigation | P1 | `lib/nav.ts` |
| A9 | Double création de devis possible | P1 | aucune garde croisée |
| A10 | 24 cellules sans `data-label` dans des modules qui convertissent | P2 | 7 fichiers |
| A11 | 163 cellules sans adaptation mobile | P2 | 17 fichiers |
| A12 | 5 cibles tactiles sous 44 px sur la connexion | P2 | mesuré |
| A13 | Les 3 textes de mention diffèrent des textes validés | P1 | comparaison |
| A14 | Rôle `superviseur` sans interface ni entrée de menu | P1 | `nav.ts` |
| A15 | Aucune infrastructure de traduction | P1 | 6 bibliothèques vérifiées absentes |
| A16 | Aucun environnement de recette | P0 | `.env.local` → production |

---

## 7. Dépendances entre modules — à vérifier avant toute modification

| Si l'on modifie… | …vérifier impérativement |
| --- | --- |
| `lib/generation/bibliotheque-redaction.ts` | les 3 activités prioritaires, les 9 suites `check:devis` |
| `lib/generation/devis-contenu.ts` | idem + les réserves + les 4 états |
| `devis_optimivv` | **13 modules** : signature, facture, archive, Brevo, pipeline, certificat de hotte, 4 lecteurs de KPI |
| `documents` | éditeur, visualisation, DocumentView, comptabilité, signatures |
| `lib/access-shared.ts` | sidebar, palette ⌘K, gardes de route, RLS |
| `lib/nav.ts` | sidebar **et** palette ⌘K |
| `legal_entities` | devis, factures, contrats, mentions, terminologie, DocuSign |
| Un champ de découverte | les 3 activités, le moteur, le préremplissage |
| `lib/supervision-*.ts` | `/leads`, dashboard, fiche lead |

---

## 8. Intégrations configurées

| Intégration | État | Preuve |
| --- | --- | --- |
| Supabase | ✅ actif, projet unique partagé local/production | `.env.local` |
| Brevo | ✅ clé présente, **clé de production** | `.env.local` |
| Ringover | ✅ clé présente, **production** | `.env.local` |
| DocuSign | ⚠️ `DOCUSIGN_ENV=demo` **en local** · **aucune société configurée**, `docusign_base_uri` nul sur les 7 · 0 enveloppe, 0 contrat | base + `.env.local` |
| Signature interne | ✅ opérationnelle, 7 devis signés | base |
| Cron de présence | ⚠️ non vérifiable sans accès VPS | — |

**Aucun test ne doit être lancé contre ces intégrations** tant que
l'environnement de recette n'existe pas : un envoi partirait réellement.

---

## 9. Procédure de retour arrière

| Scénario | Procédure |
| --- | --- |
| Annuler un lot non commité | `git restore .` — l'arbre revient à `0a79e85` |
| Annuler un lot commité, non poussé | `git reset --soft 0a79e85` puis relecture — **jamais `--hard`** |
| Annuler un lot poussé | `git revert <commit>` — **jamais de réécriture d'historique** |
| Une migration a été appliquée | le SQL de retour arrière de la migration concernée, **présenté avant exécution** |
| Un cache de build est corrompu | `rm -rf .next` — aucune source perdue |

**Point de retour de référence : `0a79e85`.** Tant qu'il existe sur
`origin/main`, aucun travail validé ne peut être perdu.

---

## 10. Journal des versions

| Version | Date | Commit de référence | Changement |
| --- | --- | --- | --- |
| 1.0 | 2026-11-07 | `0a79e85` | Création. 24 suites vertes, 2 458 assertions. 16 anomalies connues. Aucun lot exécuté. |
| 1.1 | 2026-11-07 | `0a79e85` | §5 réécrit : le contrôle porte sur la **conservation et l'intégrité** des enregistrements antérieurs, non sur des comptages qui augmentent naturellement (correction du client). Ajout des tables protégées et de leurs champs immuables. |
