# Module Superviseur — journal de développement et traçabilité

Référence : validation client du **2026-11-05** (« VALIDATION DÉFINITIVE —
MODULE SUPERVISEUR CRM »). Six lots, dans l'ordre validé. Ce document est mis
à jour **après chaque lot** avec le tableau de correspondance demandé au §12.

Mission du module, telle qu'énoncée par le client :

> **Aucun lead oublié. Aucun devis sans suivi. Aucune opportunité commerciale
> perdue par manque de traitement.**

---

## La règle de sécurité : fermé par défaut (Option A)

Un superviseur **sans périmètre configuré n'accède à aucune donnée
commerciale**. Il n'existe aucune autorisation implicite : une liste vide
signifie « rien », jamais « tout ».

Les trois axes se **cumulent** — un dossier doit satisfaire les trois :

| Axe | Vide signifie | Où c'est appliqué |
| --- | --- | --- |
| Pays | aucun pays visible | serveur, avant tout calcul |
| Activités | aucune activité visible | serveur, avant tout calcul |
| Commerciaux | aucun dossier visible | serveur, avant tout calcul |

⚠️ **C'est l'inverse de la convention du reste du CRM.** Ailleurs
(`visibleSectorsForUser`, `visibleCountriesForUser`, routage), une liste vide
veut dire « pas de restriction » — un choix fait pour activer le cloisonnement
progressivement, compte par compte. Les deux conventions coexistent
volontairement et ne doivent pas être confondues : c'est pourquoi le module
Superviseur a ses propres règles, dans un fichier séparé
([lib/supervision-perimetre.ts](../lib/supervision-perimetre.ts)).

Le **Super Admin conserve son accès global** : il ne passe pas par la table
des périmètres.

---

## Organisation des activités (§2 de la validation)

Deux familles, six branches. Le reste du CRM n'est pas touché : ces familles
ne servent qu'à la supervision.

### Famille 1 — NETTOYAGE

| Branche | Activités en base | État |
| --- | --- | --- |
| Nettoyage | `nettoyage`, `nettoyage_difficile`, `diogene` | opérationnelle |
| Désinfection / Décontamination | *aucune* | **branche vide — décision client requise** |
| Désinsectisation / Dératisation | *aucune* | **branche vide — décision client requise** |

### Famille 2 — DÉMÉNAGEMENT / DÉBARRAS / TRANSPORT

| Branche | Activités en base | État |
| --- | --- | --- |
| Déménagement | `demenagement` | opérationnelle |
| Débarras | `debarras` | opérationnelle |
| Transport | `transport` | opérationnelle |

### Activités exclues du module

`urgence` (dépannage), `enr`, `renovation`. L'exclusion vaut **pour tout le
monde, Super Admin compris** : c'est le périmètre du module, pas un droit.
Elles restent intactes dans le reste du CRM (pipeline, devis, planification…).

> **Note de vérification.** Le client cite aussi « Travaux tous corps d'état
> (TCE) », « Bâtiment » et « Urgence bâtiment ». Ces activités **n'existent pas
> en base** : les neuf secteurs du CRM sont `urgence`, `nettoyage`,
> `nettoyage_difficile`, `enr`, `renovation`, `debarras`, `demenagement`,
> `transport`, `diogene`. Les trois exclusions ci-dessus couvrent donc tout ce
> qui est réellement exclu aujourd'hui. Un contrôle automatique échoue si un
> dixième secteur apparaît sans être classé d'un côté ou de l'autre.

### Les découvertes n'ont pas été touchées

Consigne explicite : « Il ne faut surtout pas fusionner les formulaires de
découverte. » Le regroupement ci-dessus concerne **la supervision**, pas la
saisie. Un contrôle de non-régression vérifie que
[lib/discovery-nettoyage.ts](../lib/discovery-nettoyage.ts) et
[lib/discovery-metier.ts](../lib/discovery-metier.ts) gardent leurs jeux de
questions distincts (`VOLUME_DEBARRAS`, `VOLUME_DEMENAGEMENT`, `TYPE_OBJET`,
`OPTIONS_TRANSPORT`, `DIO_*`, désinfection / décontamination).

---

## LOT 1 — Sécurité et périmètres · tableau de correspondance

Légende des états :

- ✅ **développé et testé** — code écrit, contrôle automatique au vert ;
- ☑️ **existant vérifié** — déjà en place avant ce lot, relu et conservé ;
- 🟡 **partiellement opérationnel** — fonctionne, avec une limite nommée ;
- ⏳ **non développé** — prévu dans un lot ultérieur ;
- 🔒 **non testable sans accès supplémentaire**.

| Demande initiale | Fonctionnalité développée | Emplacement dans le CRM | Test | Résultat |
| --- | --- | --- | --- | --- |
| §1 Option A : fermé par défaut | Règles de périmètre pures, une liste vide ne laisse rien passer | [lib/supervision-perimetre.ts](../lib/supervision-perimetre.ts) | `npm run check:superviseur` → suite « Périmètre fermé » | ✅ |
| §1 Restrictions appliquées **côté serveur** | Filtrage avant tout calcul ; un périmètre non configuré n'interroge même pas la base | [lib/supervision-server.ts](../lib/supervision-server.ts) | suite « Cloisonnement » (règle importée, pas réécrite) | ✅ |
| §1 Pays autorisés (5 + « tous ») | Cases à cocher France / Suisse / Belgique / Luxembourg / Canada + « Tout sélectionner » | [app/(app)/settings/superviseurs/](<../app/(app)/settings/superviseurs/>) | suite « Cloisonnement » + `npm run build` | ✅ |
| §1 Activités autorisées (+ « toutes ») | Deux familles → six branches → secteurs, avec « tout » à chaque niveau | même écran | suites « Taxonomie » + « Cloisonnement » | ✅ |
| §1 Commerciaux à superviser (+ « tous ») | Liste des comptes avec leurs rôles + « Tout sélectionner » | même écran | suite « Cloisonnement » | ✅ |
| §1 Droits d'intervention | 4 droits distincts, fermés par défaut : ouvrir un dossier · demander une action · réaffecter · définir une priorité | [migration 20261105000001](../supabase/migrations/20261105000001_superviseur_perimetre_ferme.sql) + garde `assertDroitSuperviseur()` | suite « Périmètre » (§6) | 🟡 — modélisés, stockés et gardés ; **les actions elles-mêmes arrivent aux lots 3 et 4** |
| §1 Autorisations définies **exclusivement** par le Super Admin | Route en scope `admin` + garde de layout + revérification dans l'action serveur + RLS « modifiable par admin » | [lib/access-shared.ts](../lib/access-shared.ts), [layout.tsx](<../app/(app)/settings/superviseurs/layout.tsx>), [actions.ts](<../app/(app)/settings/superviseurs/actions.ts>) | suite « Cloisonnement » (§2, §3) | ✅ |
| §1 Le Super Admin conserve son accès global | Portée `admin` traitée explicitement, pas par une liste vide | [lib/supervision-perimetre-server.ts](../lib/supervision-perimetre-server.ts) | suite « Périmètre » (§1, §2) | ✅ |
| §2 Deux familles, six branches, filtrage famille → branche | Taxonomie unique, réutilisée par l'écran d'administration et (au lot 2) par les filtres | [lib/supervision-perimetre.ts](../lib/supervision-perimetre.ts) | suite « Taxonomie » | ✅ |
| §2 Découvertes **non fusionnées** | Aucune modification ; contrôle de non-régression ajouté | suites de contrôle | suite « Taxonomie » (§5) | ✅ |
| §2 Activités exclues du module | Exclusion appliquée même si un identifiant hors familles est stocké | [lib/supervision-perimetre.ts](../lib/supervision-perimetre.ts) + action serveur | suite « Périmètre » (§2) | ✅ |
| §2 Ne rien supprimer de l'existant | Migration **additive** ; aucun `DROP`, aucun `UPDATE` de données | [migration 20261105000001](../supabase/migrations/20261105000001_superviseur_perimetre_ferme.sql) | suite « Cloisonnement » (§6) | ✅ |
| §3 Conserver `supervision-server.ts`, `supervision-shared.ts`, `Supervision.tsx`, `supervisor_scopes`, `calculerKpi()`, `calculerAlertes()`, `parCommercial()`, `parPays()`, `parActivite()`, `audit_logs` | Tous conservés. `supervision-server.ts` est **modifié** (filtrage), `supervision-shared.ts` et `Supervision.tsx` **inchangés** | `lib/`, `app/(app)/leads/` | `git diff` + `npm run build` | ☑️ |
| §6 Chaque intervention historisée | Action d'audit `supervisor.scope.set` avec état avant / après et périmètre effectif | [lib/audit.ts](../lib/audit.ts) + action serveur | suite « Cloisonnement » (§3) | ✅ — pour l'attribution de périmètre ; les interventions sur dossiers viennent aux lots 3-4 |
| §4 « Aucun lead oublié » — leads non attribués | Droit explicite « inclure les leads non attribués » (sinon aucune liste de commerciaux ne peut les couvrir) + compteur des dossiers écartés avec le motif | [lib/supervision-perimetre.ts](../lib/supervision-perimetre.ts), [lib/supervision-server.ts](../lib/supervision-server.ts) | suite « Périmètre » (§4, §5) | ✅ |
| §12 Pas de compte de test créé sans accord | Aucun compte créé. Contrôles limités à la logique et aux fichiers | — | — | 🔒 — la vérification en session superviseur réelle reste à faire |
| §5 Tableau de bord, KPI cliquables | — | — | — | ⏳ lot 2 |
| §10 Menu des 10 rubriques | — | — | — | ⏳ lot 2 |
| §7 Devis et relances | — | — | — | ⏳ lot 3 |
| §8 Fiche de performance par commercial | — | — | — | ⏳ lot 4 |
| §9 Objectifs commerciaux | — | — | — | ⏳ lot 5 |
| §6/§11 Graphiques et statistiques | — | — | — | ⏳ lot 6 |

### Contrôles exécutés

```
npm run check:superviseur     3 suites, 141 assertions — TOUT PASSE
npx tsc --noEmit              aucune erreur
npx eslint <fichiers du lot>  aucun avertissement
npm run build                 ✓ Compiled successfully
python scripts/check-selects/check-selects.py .   aucune colonne inexistante
```

Serveur de développement démarré : `/settings/superviseurs` répond `307` vers
`/login` (route enregistrée et gardée par le proxy). Le rendu de l'écran avec
une session Super Admin **n'a pas été exercé** : il demande des identifiants
dont je ne dispose pas.

### Ce que le lot 1 ne prouve pas

1. **Qu'un superviseur réel est bien bloqué.** Les contrôles valident la
   règle et la chaîne d'accès, pas le parcours d'un humain connecté. Il faut
   un compte superviseur de test — le client a demandé de ne pas en créer sans
   son accord (§12).
2. **Que la migration passe en base.** Elle n'est **pas poussée** :
   `npx supabase db push` exige une validation explicite du client (CLAUDE.md).
   Tant qu'elle ne l'est pas, l'écran d'attribution affiche un bandeau
   d'avertissement et l'enregistrement est refusé avec un message explicite
   plutôt qu'une erreur SQL brute.
3. **Combien de dossiers sont écartés en production.** Le nombre de leads sans
   pays ou sans activité conditionne l'effet réel du filtrage ; la lecture de
   la base de production a été refusée par la politique d'accès de l'outil. Le
   compteur `ecartes` répondra à la question dès la première ouverture du
   cockpit.

---

## Points ouverts — décisions à prendre

1. **Désinfection / Décontamination et Désinsectisation / Dératisation.** Ces
   deux branches sont demandées comme filtres, mais aucune activité
   correspondante n'existe en base :
   - *désinfection* et *décontamination* sont des **prestations cochées dans la
     découverte Nettoyage** ([lib/discovery-nettoyage.ts](../lib/discovery-nettoyage.ts)) ;
   - *désinsectisation*, *dératisation*, *punaises*, *cafards* sont des **tags
     de fiche client** du module Documents & Contrats
     ([lib/documents/tags.ts](../lib/documents/tags.ts)).

   Deux options : **(a)** créer deux vraies activités — ce qui implique leur
   découverte dédiée, leur grille tarifaire et leur entité émettrice ; **(b)**
   déduire la branche du contenu de la découverte, sans nouvelle activité. La
   branche est déjà déclarée et affichée avec son explication ; elle reste
   inactive jusqu'à cette décision.

2. **Les superviseurs déjà existants perdent l'accès.** Sous l'ancienne
   sémantique, un périmètre vide valait « tout voir ». Après `db push`, un
   superviseur dont le périmètre est vide ne verra plus rien **jusqu'à sa
   configuration**. C'est le comportement demandé ; aucun périmètre n'a été
   inventé pour « rattraper » les lignes existantes, ce qui aurait été
   exactement l'autorisation implicite refusée.

3. **Deux accès implicites subsistants, hors module.** Ni l'un ni l'autre ne
   laisse fuir de donnée commerciale aujourd'hui (la politique RLS des `leads`
   ne cite pas le rôle superviseur), mais tous deux donnent au superviseur un
   droit qu'aucun périmètre ne borne :
   - [lib/leads-server.ts](../lib/leads-server.ts) traite le superviseur comme
     un planificateur pour le filtre **pays** des listes ;
   - [lib/pricing/grid-server.ts](../lib/pricing/grid-server.ts) lui accorde la
     visibilité **back-office des grilles tarifaires**.

   À arbitrer : les aligner sur l'Option A, ou les assumer comme des droits de
   rôle indépendants du périmètre. Rien n'a été modifié sans décision.

4. **Exports.** Le client demande que les restrictions s'appliquent « sur
   toutes les données, statistiques, listes, exports et actions ». Le module
   Superviseur **n'a aucune fonction d'export aujourd'hui** ; si elle est
   attendue, elle sera construite au lot 6 et passera par le même filtrage.
