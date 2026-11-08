# Livrable — instructions après le commit `0c86c7e`

> Réponse au message « CRM CGK — Instructions après le commit 0c86c7e ».
> **Rien n'a touché la production** : aucun push, aucune fusion, aucune
> migration appliquée, aucune ressource créée.

## Où en est chaque point — les quatre états, sans les confondre

| Point | Développé | Testé techniquement | Testé réellement | Validé en recette |
| --- | --- | --- | --- | --- |
| 1 · Séries par société (D26) | ✅ séries **datées**, heure légale de chaque pays, immuables une fois employées, écran Super Admin | ✅ validation **exécutée** ; migration lue | ❌ | ❌ |
| 2 · OPTIMIVV (D27) | analyse + plan ✅ · transition ❌ (attend vos décisions) | inventaire écrit, **jamais exécuté** | ❌ | ❌ |
| 3 · Brouillons (D28) | ✅ tous les circuits vérifiés, anciens compris | ✅ dont un **rendu PDF réel** | ❌ | ❌ |
| 4 · Encaissements (D29) | ✅ base + serveur + écran | ✅ | ❌ — section 7 prête | ❌ |
| 5 · Notifications | ✅ six actions, escalade réglable, ciblage par pays | ✅ logique **exécutée** | ❌ — section 8 prête | ❌ |
| 6 · Recette | préparation ✅ (verrous **exécutés** en refus) | — | ❌ — aucune base | ❌ |
| 7 · Tests réels | **écrits** : 8 sections en base | refus de cible exécutés | ❌ | ❌ |
| 8 · Traçabilité | registre : 99 entrées, aucune perdue | — | — | — |

## Ce qui a été fait

**D29 — votre décision, appliquée à trois niveaux.** En **base** : un trigger
refuse le passage d'une facture à « payé » et d'un lead à « encaissé » pour
toute session qui n'est ni admin ni planification (migration `…05`). Côté
**serveur** : `markDocumentPaid` et le passage du lead à « encaissé » exigent
le back-office. À l'**écran** : le commercial voit toujours les colonnes
d'encaissement et l'état de paiement ; s'il glisse une carte vers une
colonne d'encaissement, le pipeline lui explique que la validation revient
au back-office. Le reste de son pipeline est inchangé.

**D28 — tous les circuits d'envoi.** Six routes PDF et quatorze modules
d'envoi passés en revue. Résultat : le circuit principal était tenu ; **le
circuit OPTIMIVV ne l'était pas** (D30, ci-dessous). Ajouts : le PDF d'une
facture brouillon porte sur chaque page « BROUILLON — FACTURE NON ÉMISE, SANS
VALEUR DE FACTURE » — vérifié en **rendant réellement** le PDF avec le moteur
de production.

**D30 — trouvé en vérifiant les anciens circuits.** Toute session connectée,
commercial compris, obtenait une facture OPTIMIVV **numérotée définitivement**
par `/api/devis` ou `/api/devis/envoyer`, et l'aperçu affichait le prochain
vrai numéro. **Corrigé** : facture réservée au back-office (403, avant
l'allocation du numéro), bouton masqué au commercial, aperçu « APERÇU ».
⚠️ **Reste ouvert** : chaque renvoi par cette route crée un nouveau numéro —
c'est le risque R1 du plan D27.

**D26 — une série par société.** Préparée par le Super Admin (Paramètres ›
Sociétés émettrices), avec une **date d'effet** : avant cette date, la série
historique continue — on prépare tout sans rien faire basculer. L'année et la
date de bascule se lisent à l'**heure légale** de la société (sans quoi une
facture du 1er janvier à 0 h 30 tomberait dans l'année précédente ; le Canada
a son propre fuseau). Une série active ou déjà employée **ne se modifie plus**,
en base comme à l'écran. Aucune facture émise n'est renumérotée.

**D27 — analysé** : `docs/D27-PLAN-TRANSITION-OPTIMIVV.md`. Deux séries
« FAC- » parallèles, aucune ne connaît la société, des trous probables. Plan
en quatre temps, **sans toucher à l'historique** ; trois décisions vous
reviennent, avec l'expert-comptable.

**Notifications.** Six actions attendues — intervention à planifier, à
valider, facture à préparer, à émettre, facture impayée, acompte impayé — plus
l'information « contrat de sous-traitance signé ».
- **Immédiates** : évaluées juste après chaque action qui change un état, sans
  ralentir l'utilisateur (`after()` de Next) ; le cron rattrape le reste.
- **Persistantes** : la table n'a **aucune colonne « lue »**. Une action ne se
  ferme que lorsque son état disparaît (« action effectuée »). Elle s'affiche
  dans Planification › Actions attendues.
- **Escalade paramétrable** : valeurs initiales documentées (48 h, 72 h,
  15 jours…), modifiables par le Super Admin (Paramètres › Intégrations),
  bornées entre 1 h et 90 jours.
- **Sans doublon** : une seule action ouverte par sujet (index unique) ; seul
  le gagnant d'une insertion notifie ; « à planifier » ne notifie pas, car
  `quote.signed` l'a déjà fait.
- **Ciblées** : seuls les planificateurs qui **couvrent le pays** du dossier
  sont avertis — ce qui a fait apparaître **D31**.

**D31 — à votre décision.** Les notifications **existantes** (`quote.signed`,
`email.reply`, `contract.expiring`) avertissent **tous** les planificateurs,
y compris ceux d'autres pays — qui lisent alors le nom de clients qu'ils ne
voient pas dans Planification. Confirmé par lecture intégrale. **Non corrigé**,
parce que l'un des appels est dans le flux de signature ; la correction est
prête.

## Tests

| | Résultat |
| --- | --- |
| 4 vérificateurs, 43 suites | **3 639 contrôles, 0 échec** (107 nouveaux) |
| Mutations volontaires | **6 / 6 détectées** (doublon de notification, fuite entre pays, escalade qui fermerait l'action, encaissement ouvert, facture OPTIMIVV par un commercial, série datée dans le passé) |
| Rendu PDF réel | brouillon et facture émise, moteur de production |
| `tsc` · `eslint .` | propres (1 avertissement **antérieur**) |
| Non lancés | `npm run build` (son pré-rendu lit la base de **production**) ; les 8 sections réelles de `recette:facturation` (aucune base) |

**Le test réel est prêt pour vos sept vérifications** : facturation dans les
cinq pays (section 6), séries (6), doubles émissions (2-3), permissions
d'encaissement (7), notifications (8). Signatures et parcours complet
intervention → facture : C15, C19, C20, à l'écran.

**Erreurs de ma part, rattrapées avant cette livraison** : trois jetons CSS
inventés (ils auraient effacé bordures et fonds sans erreur), deux assertions
qui ne testaient rien, un motif qui prenait un commentaire pour un bouton.

## Quand votre intervention devient indispensable

**Maintenant.** Tout ce qui pouvait avancer sans base est fait. Les tests
réels exigent la recette, et sa première étape vous revient :

> **Ouvrir le tableau de bord Supabase et relever deux choses** : le plan de
> l'organisation de production (Free ou Pro), et le nombre de projets
> gratuits **actifs** dont vous êtes propriétaire ou administrateur, toutes
> organisations confondues.

S'il reste une place gratuite, la recette coûte **0 €** et vous pouvez la
créer. Sinon, elle coûte **≈ 10 $/mois** et j'attends votre accord. Les
étapes suivantes sont dans `LOT-C-RECETTE-PLAN-FINAL.md` §5.

## Ce qui attend votre accord

| # | Opération |
| --- | --- |
| 1 | Créer la recette (gratuite si possible) |
| 2 | Appliquer les **183** migrations **sur la recette** |
| 3 | Pousser vers `main`, puis fusionner (3 commits d'avance, 0 de retard) |
| 4 | D27 : une ou deux séries par société, date de bascule, traitement des trous — avec l'expert-comptable |
| 5 | D26 : la date d'effet des séries par société |
| 6 | D31 : cibler par pays les notifications existantes |
| 7 | Optionnel : l'inventaire des séries **en lecture seule** sur la production |
