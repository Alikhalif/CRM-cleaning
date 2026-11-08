# Préparation des interconnexions — avant développement

> Établi le 9 novembre 2026, à la demande du client (« commence par D20, D21
> et D22, puis prépare les interconnexions manquantes »). **Rien de ce
> document n'est développé.** Il dit ce qui existe, ce qui manque, ce que je
> propose, et ce qui vous appartient.
>
> Toutes les affirmations ci-dessous ont été **lues dans le code** le
> 9 novembre. Aucune n'a été vue dans une session authentifiée : il n'existe
> pas d'environnement de recette (E1).

## ⚠️ Deux corrections à la matrice du 9 novembre

La matrice (`MATRICE-INTERCONNEXIONS.md`) se trompe deux fois, et dans le
sens pessimiste :

| Liaison | La matrice disait | Ce que dit le code |
| --- | --- | --- |
| **L8** Intervention → Facturation | « **pas câblée** : aucun état `realise` » | **Largement câblée.** L'état existe sous le nom **`finalise`** (`dossier_status`), posé par « Marquer comme réalisé » (`finalizeDossier`). La facture finale se génère **depuis le dossier** (`generateFactureFinale`), et **seulement** s'il est `finalise`. J'ai cherché le mot `realise` ; le code dit `finalise`. Même famille d'erreur que D20. |
| **L6** Signature → Planification | Notifications : « aucune (D1) » | `lib/signature-server.ts` notifie **le commercial propriétaire ET la planification** à la signature. |

---

## 1 · Intervention → Facturation (L8)

### Ce qui existe

Tout est dans `app/(app)/planification/actions.ts`, gardé `assertBackOffice()` :

| Étape | Action | État |
| --- | --- | --- |
| Intervention démarrée | `startDossierRealisation` | `planifie → en_cours` |
| Intervention terminée | `finalizeDossier` | `→ finalise`, `realized_at` posé, audit `dossier.finalize` |
| Facture finale | `generateFactureFinale` | **refusée si le dossier n'est pas `finalise`** · reprend client, société émettrice, activité, conditions de paiement du **devis signé** · **déduit l'acompte** · lien `related_devis_id` · statut **`brouillon`** · audit `dossier.finale.create` |
| Solde | `soldDossier` | **refuse** de solder si la finale émise n'est pas `paye` (A17) |

L'émission reste **manuelle** et contrôlée : la finale naît en brouillon, et
part depuis la fiche document. C'est déjà ce que vous demandez.

### Ce qui manque, par ordre de gravité

| # | Écart | Pourquoi c'est un problème |
| --- | --- | --- |
| **F1** | **Le numéro est consommé à la création du BROUILLON**, pas à l'émission : le trigger `assign_doc_num` numérote toute ligne insérée sans numéro. Et si l'insertion de la ligne de facture échoue, le code **supprime** le document — **le numéro est perdu**. | Trou dans la séquence `FAC-AAAA-NNNN`. C'est exactement ce que la numérotation sans trou interdit, et ce que la règle du projet (« un numéro n'est consommé qu'à l'émission réelle ») exclut. ⚠️ **À vérifier pour les autres types** — le trigger est commun. |
| **F2** | **Le doublon n'est empêché que par une lecture préalable.** Aucun index unique ne l'interdit en base : deux clics simultanés, ou deux onglets, passent tous deux le contrôle. | Deux factures finales pour la même intervention. |
| **F3** | **« Terminée » n'est pas « validée ».** `finalise` est posé en un clic, sans contrôle ni second regard. | Votre demande dit « terminée **et validée** ». |
| **F4** | **La finale porte une seule ligne** « Solde après acompte sur devis N° » — ni le détail des prestations, ni la date d'intervention, ni l'intervenant. | « Les informations doivent être reprises automatiquement depuis le dossier » : seuls les montants le sont. |
| **F5** | **La finale ne pointe pas vers le dossier**, seulement vers le lead et le devis. Le contrôle de doublon est **par lead**. | Un client récurrent (plusieurs dossiers sur un même lead) ne pourrait recevoir **qu'une seule** facture finale. |
| **F6** | **Personne n'est averti** qu'une intervention est terminée et attend sa facture. | Voir §2. |

### Ce que je propose

1. **F1** — ne numéroter qu'à l'émission. Le brouillon garde `num` vide ;
   l'émission alloue le numéro par la RPC verrouillée déjà employée pour les
   devis (`lib/devis/numero.ts`). Le trigger cesse de numéroter les
   brouillons. **Migration** — à éprouver sur la recette.
2. **F2 + F5** — colonne `documents.dossier_id`, et **index unique partiel**
   `(dossier_id) where type = 'finale' and deleted_at is null`. La base
   refuse le doublon, quelle que soit la course. **Migration additive.**
3. **F3** — un état **`valide`** entre `finalise` et la facturation, posé par
   le back-office, et seul à ouvrir la génération. **Décision produit — voir
   ci-dessous.**
4. **F4** — recopier les lignes du devis signé, puis une ligne de déduction
   d'acompte ; date d'intervention et intervenant en mentions. Totaux
   inchangés : ils restent ceux du devis moins l'acompte.
5. **Traçabilité** — elle existe (audit à chaque étape). J'ajouterai l'audit
   de la **validation** et de l'**émission** avec le numéro alloué.

### Ce qui vous appartient

- **F3** : faut-il une validation distincte de « réalisé » ? Si oui, **qui**
  valide (planification, Super Admin), et **sur quoi** (photos de fin,
  PV signé du client, simple confirmation) ?
- **F4** : la finale doit-elle détailler les prestations, ou la ligne
  unique « solde » vous convient-elle ?
- **F1** : autorisez-vous la modification de la numérotation ? Elle touche
  la comptabilité ; elle sera appliquée **sur la recette d'abord**.

---

## 2 · Notifications entre modules (L11)

### Le principe que vous fixez, et ce qui le respecte déjà

« **Lire une notification ne clôt pas une tâche.** » Le moteur des actions
commerciales (`lib/commercial-actions/engine-server.ts`) le respecte déjà :
il **réconcilie** depuis `audit_logs` et ne ferme une action que lorsque
l'acte est fait. Une notification n'y est qu'un **signal** ; l'état est
ailleurs. C'est ce modèle qu'il faut étendre — pas la table `notifications`,
dont l'état « lu » ne doit jamais rien résoudre.

### Ce qui est notifié aujourd'hui

| Étape | Qui est averti |
| --- | --- |
| Lead entrant (WF1) | le commercial attribué, ou le rôle |
| Réponse client par courriel, médias reçus | propriétaire + planification |
| Appel Ringover | le commercial |
| Changement d'état d'un devis (`lib/devis/status.ts`) | propriétaire + planification |
| **Signature d'un devis** | propriétaire + planification |
| Actions commerciales (relances, photos, découverte…) | le commercial — **persistant jusqu'à l'acte** |
| Contrat **client** à renouveler (`contract.expiring`, `lib/documents/alerts-server.ts`) | planification |

Non trouvés : aucune notification sur la **conformité des sous-traitants**
(Kbis, décennale, CNI — la matrice les annonçait ; la fiche les calcule à
l'écran, mais rien n'est envoyé), et **aucune** dans `lib/docusign` ni
`lib/sous-traitance`.

### Ce qui manque — l'après-signature est muet

| Étape | Action attendue | Qui | Persistante ? |
| --- | --- | --- | --- |
| Dossier créé à la signature | planifier | planification | **oui**, jusqu'à `planifie` |
| Intervention `finalise` | valider puis facturer | back-office | **oui**, jusqu'à la finale émise |
| Acompte dû (`signe · avec`) non encaissé | encaisser / relancer | back-office | **oui**, jusqu'à `paye` |
| Facture finale échue | relancer | back-office | **oui**, jusqu'à `paye` |
| **Contrat de sous-traitance signé (DocuSign)** | lancer la mission | planification | non — information |
| Contrat de sous-traitance **refusé / expiré** | relancer ou changer de prestataire | planification | **oui** |
| Prestataire incomplet au moment du contrat (SIRET, dirigeant) | compléter la fiche | planification | **oui** |
| Décennale ou Kbis d'un sous-traitant expiré ou proche de l'échéance | obtenir la pièce | planification | **oui**, jusqu'au dépôt de la nouvelle version |

**Proposition** : une famille d'**actions back-office** dans le même moteur
(même réconciliation depuis `audit_logs`, même idempotence), et une
notification seulement au moment où l'action **naît**. ⚠️ Tout cela dépend
du **cron** toutes les 1–2 minutes, dont la configuration réelle sur le VPS
n'est pas vérifiée (D11, D18).

**Ce qui vous appartient** : valider ce tableau, rôle par rôle, et dire
quelles alertes doivent **remonter au Super Admin** quand elles traînent.

---

## 3 · Signatures (L5) — les deux circuits restent séparés

| | Devis client | Contrat de sous-traitance |
| --- | --- | --- |
| Circuit | **interne** (`lib/signature-server.ts`) | **DocuSign** |
| Preuve | jeton 256 bits, seul son SHA-256 est stocké ; PDF signé + attestation + certificat, **hachés** | enveloppe et événements DocuSign ; webhook vérifié en HMAC **à temps constant** |
| Archivage | bucket privé `signed-documents`, URL signées ≤ 60 min | bucket privé, document signé **et** certificat, URL ≤ 3 600 s |
| Testé techniquement | oui (suites `check:docusign`, `check:recette`) | oui — 1 165 contrôles |
| **Testé réellement** | **non** | **non** — et `DOCUSIGN_ENV` vaut `demo` sur le poste ; la valeur en production n'est pas vérifiable sans accès au conteneur |

**Ce que la recette devra montrer**, pour chaque circuit : un document
signé depuis une session **non authentifiée**, la preuve archivée, la preuve
**ré-hachée** égale à l'empreinte stockée, et l'URL d'archive qui **expire**.
Pour DocuSign, sur un **compte développeur** (gratuit), jamais sur le compte
de production.

---

## 4 · Finalisation du Lot C — ce qui demande votre intervention

Le dossier complet est `LOT-C-DOSSIER-CREATION-RECETTE.md`. Ce qui ne peut
**pas** se faire sans vous, dans l'ordre :

| # | Action | Pourquoi vous | Coût |
| --- | --- | --- | --- |
| 1 | **Créer le projet Supabase de recette** (de préférence dans une organisation séparée) | création de ressource | 0 € attendu au plan gratuit — à confirmer sur `supabase.com/pricing` |
| 2 | **Écrire `.env.recette`** (gabarit fourni) avec une **clé de chiffrement propre** à la recette | secrets | — |
| 3 | Lancer `npm run verif:cible -- .env.recette` et **me coller la sortie** | elle ne contient aucun secret, par construction | — |
| 4 | **Lier la CLI** au projet de recette | la CLI de ce poste est liée à la **production** | — |
| 5 | **M'autoriser** à appliquer les 177 migrations, les semences, puis les migrations en attente (superviseur, M1) — **sur la recette seulement** | migration | — |
| 6 | **Créer les six comptes de test fictifs** (admin, planification, commerciaux) | mots de passe | — |
| 7 | Optionnel : **autoriser une requête en lecture** sur la production, `select count(*) from subcontractor_profiles` | trancher « 0 fiche sous-traitant » (D20) | — |
| 8 | Optionnel : **installer PostgreSQL** sur ce poste, pour rejouer les migrations hors cloud (E7) | installation sur votre machine | 0 € |

Et trois **décisions** : F1/F3/F4 ci-dessus, le tableau des notifications,
et D23 (le lien de contrat signé 7 jours).

**Rappel** : aucun push, aucun déploiement, aucune migration ni ressource de
production n'a été engagé. Le VPS déploie toujours depuis
`feature/docusign-sandbox`, pas depuis `main`.
