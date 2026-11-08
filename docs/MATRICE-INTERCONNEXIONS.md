# Matrice des interconnexions — CRM CGK

> 9 novembre 2026. Priorité 5 du client :
> *« Je veux que chaque fonctionnalité communique réellement avec les autres
> modules qui en dépendent. Ne te limite pas à vérifier les imports ou les
> appels de fonctions. »*
>
> Chaque liaison est donc décrite par ce qui **circule** : les données
> transmises avec leurs vrais noms de colonnes, les changements d'état avec
> leurs vraies valeurs d'énumération, les notifications, et les autorisations.

## ⚠️ Avant de lire : trois liaisons de votre liste n'existent pas

C'est le résultat le plus important de cette matrice, et il vaut mieux
l'apprendre ici qu'en essayant de les tester.

| Liaison demandée | Constat mesuré |
| --- | --- |
| **Devis et signature DocuSign** | ❌ **DocuSign ne touche pas les devis.** Il ne signe qu'un seul type d'objet : `contrat_sous_traitance`. Les devis passent par la signature **auto-hébergée** (`/sign/[token]`, jeton 256 bits). Ce sont deux chaînes distinctes, et les confondre ferait chercher un défaut là où il n'y a pas de fonctionnalité. |
| **Encaissements et rapprochement bancaire** | ❌ **Le rapprochement bancaire n'existe pas.** Zéro occurrence dans tout le dépôt. C'est le Lot I, qui attend vos relevés réels. |
| **Intervention et facturation** | 🟠 **Pas de déclenchement.** Le SPEC annonce « la facture finale est émise après que l'intervention est marquée `realise` ». Il n'existe **aucun** état `realise` dans `dossier_status`, et aucun lien de la facture finale vers le dossier. La facture finale se crée **à la main depuis le devis**. |

## Comment lire les colonnes

| Marque | Sens |
| --- | --- |
| ✅ | la liaison existe **et** un contrôle automatisé l'exerce |
| 🟠 | la liaison existe dans le code, **jamais vue fonctionner** |
| ❌ | la liaison **n'existe pas** |

**Aucune liaison n'est marquée « testée »** : il n'existe aucun environnement
de recette. Les ✅ signifient « vérifiée par script », pas « vue marcher ».

---

## L1 · Commercial → Superviseur

| | |
| --- | --- |
| **Scénario métier** | Un commercial laisse un lead sans contact pendant N heures. Le superviseur de son périmètre doit le voir dans son cockpit, et pouvoir demander une action — sans jamais agir à sa place. |
| **Données transmises** | `leads.owner_id`, `leads.country`, `leads.activity_id`, `leads.status`, et l'état dérivé par `lib/supervision-etats.ts` |
| **Changements d'état** | Aucun côté lead. Le superviseur **demande**, il ne modifie pas |
| **Notifications** | Alertes prioritaires et persistantes (`alerts`), alimentées par le cron |
| **Autorisations** | `supervisor_scopes` : trois axes (pays, activités, commerciaux) + 4 droits (`can_intervene`, `can_request_action`, `can_reassign`, `can_set_priority`). **Option A : un axe vide = aucun accès** |
| **État** | 🟠 **inerte** — la migration `20261105000001` n'est pas appliquée, et le code refuse alors le périmètre (*fail-closed*, vérifié) |
| **Scénario de test réel** | Créer un superviseur, périmètre vide → il ne voit **rien**. Lui donner un pays + une activité → il voit les leads correspondants, et **aucun autre**. Vérifier par la clé anon qu'il ne lit pas hors périmètre |

## L2 · Commercial → Planificatrice

| | |
| --- | --- |
| **Scénario métier** | Le commercial fait signer. Le dossier doit apparaître chez la planificatrice **sans ressaisie**, avec les informations de découverte nécessaires pour planifier |
| **Données transmises** | `dossiers.lead_id`, `dossiers.quote_document_id`, `leads.discovery_details`, `leads.intervention_delay`, l'adresse et les contraintes d'accès |
| **Changements d'état** | `documents.status → signe` · création du `dossiers` en `a_planifier` · `dossiers.signature_mode` = `logiciel` ou `planificateur` |
| **Notifications** | — ⚠️ **aucune** n'est émise à la signature (anomalie D1) |
| **Autorisations** | La planification est `backOffice`. Le commercial **perd** la main après la signature : « la signature est la frontière » |
| **État** | 🟠 le dossier est bien créé à la signature (`lib/signature-server.ts`), jamais vu à l'écran |
| **Scénario de test réel** | Signer un devis avec le compte commercial → le dossier doit apparaître dans `/planification` en `a_planifier`, avec la découverte lisible. Puis vérifier que le commercial **ne peut plus** ouvrir `/planification` (404, pas « interdit ») |

## L3 · Découverte → Génération des devis

| | |
| --- | --- |
| **Scénario métier** | Le commercial saisit la découverte, clique une fois, et obtient un devis **rédigé** — pas une recopie des champs |
| **Données transmises** | `leads.discovery_details` (jsonb), `surface_m2`, `etat_salete`, `contexte_intervention`, `sector`, et l'identité de la société émettrice |
| **Changements d'état** | Aucun : la génération produit un **brouillon modifiable** |
| **Notifications** | — ⚠️ aucune (D1) |
| **Autorisations** | Le commercial, pour ses propres leads (`mine`, via RLS) |
| **État** | ✅ **1 480 contrôles** l'exercent : structure PRESTATION / DÉTAIL / RÉSERVES, 25 thèmes, 101 opérations, mentions par pays |
| **Scénario de test réel** | Une découverte complète → le devis doit porter les trois blocs, les réserves correspondant aux refus saisis, la mention du pays de la société, et **aucune prestation qu'une simple observation n'autorise** |

## L4 · Visualisation → Envoi manuel du devis

| | |
| --- | --- |
| **Scénario métier** | Le commercial relit le PDF **tel que le client le recevra**, puis l'envoie — jamais automatiquement |
| **Données transmises** | Le PDF, produit par le **point de rendu unique** (`lib/devis/rendu-document-server.ts`) que l'aperçu et l'envoi partagent |
| **Changements d'état** | `documents.status : brouillon → envoye` à l'envoi · `envoye → ouvert` au clic sur le lien suivi |
| **Notifications** | — ⚠️ aucune à l'envoi (D1) |
| **Autorisations** | Le commercial propriétaire. L'émission traverse la **garde d'identité à trois crans** |
| **État** | ✅ par script (point de rendu unique, garde avant allocation du numéro) · 🟠 jamais vu |
| **Scénario de test réel** | Ouvrir 👁 sur les **trois** écrans, comparer au PDF reçu, vérifier qu'un double-clic sur « Émettre » ne produit **qu'un** numéro, et qu'un refus de cran 1 **ne troue pas** la séquence |

## L5 · Devis → Signature

**⚠️ Pas DocuSign.** Deux chaînes de signature coexistent, et elles ne se
croisent pas :

| | Devis | Contrat de sous-traitance |
| --- | --- | --- |
| Mécanisme | **auto-hébergé** | **DocuSign** |
| Entrée | `/sign/[token]` ou `/devis-signer/[token]` | enveloppe DocuSign |
| Preuve | jeton 256 bits, seul le SHA-256 est stocké | `docusign_envelopes`, `docusign_envelope_events` |
| Archivage | bucket privé `signed-documents` | bucket `document-archive` |
| État | 🟠 | 🟠 — et **en mode `demo`**, voir le Lot D |

**Scénario de test réel (devis)** : envoyer pour signature, ouvrir le lien
depuis une session **non authentifiée**, signer, vérifier que le PDF signé +
l'attestation + le certificat sont archivés, et que le dossier de
planification est créé.

## L6 · Signature → Planification

| | |
| --- | --- |
| **Scénario métier** | La signature crée le dossier. C'est la bascule du commercial vers le back-office |
| **Données transmises** | `dossiers.lead_id`, `quote_document_id`, `signature_mode` |
| **Changements d'état** | `documents.status → signe` · `dossiers.status = a_planifier` · `payment_status = acompte_non_paye` si acompte |
| **Notifications** | — ⚠️ aucune (D1) |
| **Autorisations** | La RLS autorise le planificateur **à signer** (correctif du 2026-08-02) |
| **État** | 🟠 — la migration de ce correctif est notée « à appliquer » |
| **Scénario de test réel** | Signer en mode `planificateur` → le dossier doit exister, et le mode doit être **tracé** |

## L7 · Planification → Sous-traitance

| | |
| --- | --- |
| **Scénario métier** | La planificatrice choisit un prestataire, prépare la mission, émet le contrat, le fait signer, l'archive |
| **Données transmises** | `subcontract_missions`, `subcontract_contracts`, `subcontract_lines`, `technicians` |
| **Changements d'état** | `sub_envoi`, `sub_signature`, `sub_signature_mode` |
| **Notifications** | Alertes de conformité documentaire (kbis, décennale, CNI) |
| **Autorisations** | `backOffice` |
| **État** | 🟠 — migration `20260930000001` notée « à pousser ». ⚠️ **0 fiche sous-traitant** et **aucun représentant légal** renseigné : le contrat ne peut pas s'émettre (D3) |
| **Scénario de test réel** | Créer un sous-traitant **fictif** avec ses pièces, préparer une mission, émettre le contrat → vérifier l'identité légale imprimée |

## L8 · Intervention → Facturation

**🟠 La liaison n'est pas câblée.** Mesuré : aucun état `realise` dans
`dossier_status` (qui vaut `a_planifier`, `planifie`, `en_cours`, …), et
aucun lien de la facture finale vers le dossier.

La facture finale se crée **manuellement depuis le devis**, et rien ne vérifie
que l'intervention a eu lieu.

**Ce qu'il faudrait décider** : faut-il un état `realise` et un contrôle avant
émission ? C'est une question produit, pas un correctif — et le SPEC l'annonce
alors que le code ne le fait pas. **Écart à trancher.**

## L9 · Facturation → Comptabilité

| | |
| --- | --- |
| **Scénario métier** | Une facture émise apparaît en comptabilité avec son état de paiement |
| **Données transmises** | `documents` (type `acompte` ou `finale`), `document_lines`, `entity_id` |
| **Changements d'état** | `document_status : brouillon → envoye → paye` ou `retard` |
| **Notifications** | — ⚠️ aucune |
| **Autorisations** | `backOffice`. ⚠️ **Fuite de provenance relevée sur `/comptabilite`** par l'audit du 30 septembre, **toujours ouverte** |
| **État** | 🟠 |
| **Scénario de test réel** | Émettre un acompte depuis un devis signé « avec acompte », vérifier la **numérotation sans trou** par type et par année, et qu'un commercial ne voit **aucune** provenance sur cet écran |

## L10 · Encaissements → Rapprochement bancaire

**❌ N'existe pas.** Zéro occurrence. Les encaissements sont **saisis**, pas
prélevés : aucun prestataire de paiement n'est raccordé — ce qui satisfait
votre règle « aucune opération bancaire réelle » par construction.

C'est le **Lot I**, qui attend vos relevés réels.

## L11 · Notifications → Suivi des actions

| | |
| --- | --- |
| **Scénario métier** | Une alerte métier ouverte doit se fermer quand l'action est faite, et **pas** quand la notification est lue |
| **Données transmises** | `audit_logs` → `commercial_actions`, `commercial_action_events`, `alerts`, `notifications` |
| **Changements d'état** | Le moteur **réconcilie** depuis `audit_logs` et il est **idempotent** |
| **Notifications** | `notifications` + Realtime |
| **Autorisations** | Chacun voit les siennes ; le manager voit son équipe |
| **État** | 🟠 — dépend du **cron toutes les 1–2 min**, dont la configuration réelle du VPS n'est pas vérifiée (D11, D18) |
| **Scénario de test réel** | Ouvrir une alerte, **lire** la notification sans agir → l'alerte doit rester ouverte. Puis faire l'action → elle se ferme au cycle suivant. ⚠️ **Votre règle : « une notification lue ne doit pas résoudre une alerte métier. »** |

---

## Récapitulatif

| | Nombre |
| --- | --- |
| Liaisons demandées | **11** |
| Qui existent et sont exercées par script | **1** (L3) |
| Qui existent, jamais vues fonctionner | **7** |
| Qui **n'existent pas** | **3** (L5-DocuSign, L8 non câblée, L10) |
| Liaisons **sans aucune notification** | **5** — conséquence de D1 |
| Liaisons bloquées par une migration non appliquée | **3** (L1, L6, L7) |

**Le chiffre à retenir : 1 sur 11.** Une seule liaison est aujourd'hui
exercée autrement que par lecture de code. C'est la mesure de ce que la
recette doit couvrir, et aucune de ces liaisons ne peut être déclarée
fonctionnelle avant.

## Traçabilité

| Demande initiale | Origine | Liaison | Emplacement CRM | Test réel | Résultat | Correction |
| --- | --- | --- | --- | --- | --- | --- |
| Commercial ↔ superviseur | client 09-11 | L1 | `lib/supervision-*` | ❌ | 🟠 inerte | migration |
| Commercial ↔ planificatrice | client 09-11 | L2 | `lib/signature-server.ts` | ❌ | 🟠 | — |
| Découverte → devis | client 09-11 | L3 | `lib/generation/` | ❌ | ✅ 1 480 contrôles | — |
| Visualisation → envoi | client 09-11 | L4 | `lib/devis/rendu-document-server.ts` | ❌ | 🟠 | — |
| Devis → DocuSign | client 09-11 | L5 | — | ❌ | ❌ **n'existe pas** : DocuSign ne signe que les contrats de sous-traitance | aucune — à clarifier |
| Signature → planification | client 09-11 | L6 | `lib/signature-server.ts` | ❌ | 🟠 | migration |
| Planification → sous-traitance | client 09-11 | L7 | `/sous-traitants` | ❌ | 🟠 | migration + saisie |
| Intervention → facturation | client 09-11 | L8 | — | ❌ | 🟠 **non câblée** : aucun état `realise` | arbitrage produit |
| Facturation → comptabilité | client 09-11 | L9 | `/comptabilite` | ❌ | 🟠 | fuite de provenance ouverte |
| Encaissements → rapprochement | client 09-11 | L10 | — | ❌ | ❌ **n'existe pas** | Lot I |
| Notifications → actions | client 09-11 | L11 | `lib/commercial-actions/` | ❌ | 🟠 | D11/D18 |
