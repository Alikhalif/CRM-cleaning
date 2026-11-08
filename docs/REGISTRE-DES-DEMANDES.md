# Registre des demandes — CRM CGK

> Ouvert le 9 novembre 2026, à la demande du client :
> *« Les 15 fonctionnalités historiques identifiées ne doivent pas limiter
> l'audit : retrouve également toutes les autres demandes antérieures. »*
>
> **Ce registre est distinct du [registre des anomalies](REGISTRE-CORRECTIONS-FINALES.md).**
> Celui-là suit ce qui est **cassé** ; celui-ci suit ce qui a été **demandé**.
> Une demande livrée et sans défaut n'apparaît nulle part ailleurs — c'est
> précisément ce trou que ce document comble.

## Comment il a été construit

Sources croisées, dans cet ordre : les **32 mémoires de projet** (une par
demande ou décision du client depuis le 10 juin 2026), les rapports de lot
sous `docs/`, et l'historique Git.

## ⚠️ La limite à connaître avant de lire

**La colonne « Test réel » est vide presque partout, et ce n'est pas un oubli.**
Aucun environnement de recette n'existe : rien n'a jamais été vérifié dans une
session authentifiée. Et **je ne peux pas vérifier qu'une migration est
appliquée** — cela demande un accès à la base, que je n'ai pas.

Tout ce qui est marqué 🟠 l'est donc sur la foi des enregistrements de
l'époque, pas d'une vérification de ce jour.

| Marque | Sens |
| --- | --- |
| ✅ | livré **et** vérifié par mesure (script, build, extraction) |
| 🟠 | livré selon les enregistrements, **jamais vérifié à l'écran** |
| ⏳ | reste à faire, périmètre connu |
| 🔴 | bloqué, ou en attente d'une action du client |
| ⚪ | décidé puis abandonné volontairement — conservé pour mémoire |

---

## 1 · Les grandes demandes fonctionnelles

| # | Demande initiale | Origine | Fonctionnalité développée | Emplacement CRM | Test réel | Résultat | Reste |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **R1** | Routage des leads par profil commercial, premium, secteur Débarras, techniciens géolocalisés, multi-société, NRP, e-mail planificatrice | appel client 2026-06-10 | Profils commerciaux, pools de routage, secteur Débarras, appariement géographique | `lib/routing.ts`, `lib/routing-shared.ts` | — | 🟠 | — |
| **R2** | 6 lots : Diogène, multi-pays, registre des landing pages, profils + routage, leads à affecter, planif par pays, recherche, performance | CDC d'évolution 2026-07-25 | Les 6 lots | `lib/leads.ts`, `/a-affecter`, `/recherche` | — | 🟠 **tous livrés** | — |
| **R3** | Refonte profils/capacités/taxonomie LP + Canada | 2026-07-28 | Lot A livré ; Lot B = secteur Nettoyage difficile, `lp_type`, refonte routage | `lib/leads.ts`, `landing_pages` | — | 🟠 secteur créé (migration `20260728000002`) | ⏳ **vérifier que `lp_type` et la refonte du routage sont bien faits** |
| **R4** | CRM-assistant guidé : 2 parcours séparés, découverte commune enrichie, journal avant-appel, devis 100 %/e-mail acompte, handoff planif | 2026-07-30 | **Lot 1 seul** (découverte enrichie) | `/leads/[id]`, découverte | — | 🟠 | ⏳ **Lots 2 à 6** |
| **R5** | Webphone Ringover embarqué, SMS, templates mail/SMS | 2026-07-30 | SDK iframe, screen-pop, bouton SMS, bibliothèque de templates | `lib/ringover-webphone.ts`, `components/RingoverPhone` | — | 🟠 | 🔴 **bloqué : activation de la ligne Ringover (portabilité)** |
| **R6** | Correctif signature → planification + deux modes de signature | 2026-08-02 | Dossier créé à la signature, mode `logiciel`/`planificateur`, RLS planner | `lib/signature-server.ts` | — | 🟠 | 🔴 **migration à appliquer** |
| **R7** | Bibliothèque de templates par rôle et audience | 2026-08-02 | Audiences sur `message_templates`, profil `emission_appel` | `lib/templates`, `message_templates` | — | 🟠 | 🔴 **3 migrations à pousser** |
| **R8** | Module Photos & Vidéos par dossier | 2026-08-03 | Bucket `lead-media`, table `lead_media`, RLS, onglet fiche | `lib/media-server.ts` | — | 🟠 | — |
| **R9** | Responsive mobile et tablette | client 2026-09-09 | Lots 0 à 4, conventions de points de rupture | `*.module.scss`, `MobileTabBar` | — | 🟠 | ⏳ **I2/I3 du registre : 24 cellules sans `data-label`, 163 sans adaptation** |
| **R10** | Actions & relances commerciales | 2026-09-11 | Moteur de réconciliation sur `audit_logs`, `/ma-journee`, vue manager | `lib/commercial-actions/` | — | 🟠 | 🔴 **migration à pousser** |
| **R11** | Documents & contrats (hotte, désinsectisation) | 2026-09-15 | **Lot 1 seul** : `client_documents` + onglets fiche | `/documents`, `lib/documents/` | — | 🟠 | ⏳ **Lots 2 à 4** |
| **R12** | Chaîne d'arrivée des leads : provenance **jamais** visible du commercial | 2026-09-19 | Chiffrement + `canProvenance = admin \|\| planif`, notifications différenciées | `lib/crypto/`, `lib/leads-server.ts` | — | ✅ chiffrement mesuré | ⏳ **test S2 en recette** |
| **R13** | Documents/contrats par activité | 2026-09-26 | **Lot 1** : contrat de sous-traitance + attestation de propreté | `lib/pdf/ContractPdf.tsx` | — | 🟠 | 🔴 **db push à faire** · ⏳ devis/factures par activité **bloqué sur vos visuels** |
| **R14** | Module Sous-traitants | 2026-09-30 | Bibliothèque documentaire, conformité, factures ST, historique | `/sous-traitants` | — | 🟠 | 🔴 **migration `20260930000001` à pousser** |
| **R15** | Cloisonnement du rôle Commercial — « la signature est la frontière » | 2026-10-07 | `lib/access-shared.ts` source unique + layouts de garde | `lib/access-shared.ts` | ✅ **12 modules / 12 gardes mesurés** | ✅ | ⏳ **test S6 en recette** |
| **R16** | Formation commerciale Déménagement & Débarras | 2026-10-11 | Application autonome **hors CRM**, 17 étapes × 2 métiers | hors dépôt | — | 🟠 | ⏳ **7 autres activités à décliner** |
| **R17** | Génération du devis depuis la découverte | 2026-11-04 | Bouton 1 clic + moteur **déterministe** + brouillon modifiable | `lib/generation/` | ✅ 1 480 contrôles | ✅ | ⏳ e-mails prestataires et appariement : **donnée absente en base** |
| **R18** | Module Superviseur, 6 lots | validation 2026-11-05 | **Lot 1 seul** : périmètre fermé par défaut (Option A) | `lib/supervision-*` | ✅ 201 contrôles | 🟠 **inerte** | 🔴 **migration `20261105000001` non appliquée** · ⏳ **Lots 2 à 6 = Lot G** |
| **R19** | Référentiel de rédaction des devis (master prompt) | 2026-11-05 | Moteur déterministe 3 niveaux, 13 familles, 369 contrôles | `lib/generation/devis-contenu.ts` | ✅ par script | 🟠 | ⏳ **§17 jamais essayé en session réelle** |
| **R20** | Corrections du moteur de devis B1–B6 puis C1–C5 | 2026-11-06 | Règle « une observation n'autorise aucune prestation », mention par pays, section ciblée, projection québécoise | `lib/generation/` | ✅ par script | ✅ | ⏳ **4 phases non traitées : historique, IA, multi-pays, section nommée** |
| **R21** | PDF multi-entreprises, 5 pays, parcours harmonisés | master prompt Lot B | Voie 0, garde d'identité 3 crans, gabarits par société | `lib/devis/` | ✅ 18 échantillons | ✅ | ⏳ **G1/G5 : photo et emblème** |
| **R22** | Visualisation, historique M1, préremplissage | master prompt Lot E | Fenêtre partagée, 4 origines d'historique, 3e parcours | `components/ApercuDocument/` | — | 🟠 | 🔴 **migration M1 préparée, non appliquée** |
| **R23** | Environnement de recette sécurisé | master prompt Lot C | Garde-fou, goulet d'envoi, liste blanche d'URL, voie 2 du chiffrement | `lib/env/`, `lib/envoi/`, `lib/urls/` | ✅ 253 contrôles + `next dev` réel | 🟠 **en cours** | ⏳ **l'environnement lui-même** |

---

## 2 · Les demandes d'audit et de recette

| # | Demande | Origine | Produit | Résultat | Reste |
| --- | --- | --- | --- | --- | --- |
| **A1** | Recette fonctionnelle complète | 2026-09-18 | Audit statique 6 domaines, `docs/RECETTE-CRM.md`, P1 corrigés | ✅ | superseded par A2 |
| **A2** | Recette complète avant prod, **tests réels sur la base** | 2026-09-24 | `docs/RECETTE-CRM-2026-09-24.md`, 4-5 bloquants P1 | ✅ | ⏳ **la phase de correctifs n'a jamais été menée à son terme** — à rapprocher du registre actuel |
| **A3** | Carte grise & CDC de l'existant | 2026-09-30 | Dossier PDF professionnel, `docs/carte-grise/` + toolkit reportlab | ✅ | ⏳ **écarts relevés alors et toujours ouverts** : fuite provenance `/comptabilite`, acompte OPTIMIVV, IBAN `using(true)`, MFA absente, Google Ads absent |
| **A4** | Inventaire des comptes de l'équipe | 2026-10-11 | `Identifiants-Equipe.xlsx` + `build-identifiants.py` | ✅ | ⏳ **7 comptes sur 10 sans activité → aucune restriction de secteur** |
| **A5** | État réel de la production | 2026-11-04 | 687 leads dont 634 jamais contactés ; Ringover quasi non journalisé | ✅ | ⏳ retard **humain**, pas une panne — mais à rapprocher de D11/D18 |
| **A6** | Identités légales des contrats | 2026-11-06 | 1 société sur 7 a un SIRET valide ; 0 fiche sous-traitant | ✅ | 🔴 **saisie client** (D2, D3 du registre) |
| **A7** | Audit chiffrement + DocuSign | 2026-11-05 | Clé locale = clé prod ; **DocuSign prod en mode `demo`** | ✅ | 🔴 **les contrats signés en prod n'ont pas de valeur juridique → Lot D** |

---

## 3 · Les actions qui attendent le client

Elles ne sont pas des anomalies : ce sont des demandes dont la suite ne
m'appartient pas.

| # | Action attendue | Depuis | Conséquence de l'attente |
| --- | --- | --- | --- |
| **C1** | **Saisir la mention des produits**, société par société | 2026-11-06 | Depuis `693c31f`, aucun devis ne porte de mention. Désormais à cocher **par société** (`Réglages › Intégrations`) |
| **C2** | **Fournir les visuels** des sociétés (photo du gabarit, emblèmes) | 2026-09-26 | G1 : la photo du gabarit nettoyage montre des tenues marquées OPTIMIVV. G5 : aucune société ne peut fournir son emblème |
| **C3** | **Corriger les identifiants légaux** en base | 2026-11-06 | 6 sociétés sur 7 ont un identifiant invalide ; la garde de cran 2 les signale |
| **C4** | **Renseigner un représentant légal** par société | 2026-11-06 | Bloque l'émission des contrats de sous-traitance |
| **C5** | **Activer la ligne Ringover** (portabilité) | 2026-07-30 | Le webphone est codé et inutilisable |
| **C6** | **Trancher la branche suivie par le VPS** | 2026-11-05 | Le VPS déploie depuis `feature/docusign-sandbox` : un commit poussé sur `main` **n'atteint pas la production** |
| **C7** | **Vérifier la configuration du cron** sur le VPS | 2026-11-08 | D11 et D18 restent ouvertes ; hypothèse non écartée que le cron n'ait jamais authentifié |
| **C8** | **Autoriser les migrations en attente** | variable | Au moins 5 modules sont codés et **inertes** : superviseur, M1, sous-traitants, templates par audience, actions commerciales |

---

## 4 · Ce qui a été volontairement abandonné

Conservé pour qu'on ne le « redécouvre » pas comme un oubli.

| # | Demande | Décision | Date |
| --- | --- | --- | --- |
| **X1** | Séquence n8n WF2 (relance automatique des devis) | **Retirée** avec l'envoi automatique : « les devis ne doivent jamais être envoyés automatiquement » | 2026-11-04 |
| **X2** | Capacités d'IA dans le moteur de devis | **Écartées** : le moteur est déterministe, même quand la demande dit « IA » | 2026-11-06 |
| **X3** | Coordonnées bancaires sur la fiche société | **Retirées du formulaire** : le RIB circule en pièce jointe | 2026-11-05 — ⚠️ **réouverte par le client le 2026-11-09** |

---

## 5 · Le décompte honnête

| | Nombre |
| --- | --- |
| Demandes fonctionnelles recensées | **23** |
| Demandes d'audit | **7** |
| Actions en attente du client | **8** |
| Abandons volontaires | **3** |
| **Total des demandes tracées** | **41** |
| Dont **vérifiées par mesure** | **8** |
| Dont **jamais vérifiées à l'écran** | **33** |
| **Migrations codées, notées « à pousser » dans les enregistrements** | **au moins 5** |

> ⚠️ Sur ce dernier chiffre, une précision qui compte : **je ne peux pas
> vérifier qu'une migration est appliquée** sans accès à la base. « Au moins
> 5 » vient des mémoires de l'époque, qui notaient « db push à faire ». Certaines
> l'ont peut-être été depuis sans que la mémoire soit mise à jour. **La
> première chose à faire en recette sera de comparer la liste des migrations
> appliquées à celle des 177 fichiers** — c'est une requête, et elle tranchera.

**Le chiffre qui compte est le dernier de la deuxième colonne : 33.** Trente-trois
demandes livrées selon les enregistrements, et jamais vues fonctionner dans une
session authentifiée. C'est la mesure de ce que le Lot C doit rendre possible,
et c'est pourquoi aucun lot ne peut être déclaré validé avant lui.

## Journal

| Date | Évènement |
| --- | --- |
| 2026-11-09 | Ouverture, à la demande du client. 41 demandes recensées depuis le 10 juin 2026, à partir des 32 mémoires de projet, des rapports de lot et de l'historique Git. **Trois constats** : au moins **5 migrations** sont codées et inertes ; **8 actions** attendent le client depuis des semaines ; et la phase de correctifs de la recette du 24 septembre (**A2**) n'a jamais été menée à son terme. |
