# Carte grise & cahier des charges — CRM CGK/OPTIMIVV

Documentation officielle de référence de l'**existant** (version 1.0 — 30 septembre 2026).
Produite par inspection du code (55 migrations de schéma, l'ensemble des routes, les
couches de données, les webhooks et les workflows n8n), croisée avec la recette réelle
du 24/09/2026. Règle appliquée : **ne rien inventer** — toute information non vérifiable
est marquée « À VÉRIFIER ».

## Livrables

| Fichier | Contenu |
|---|---|
| `CARTE-GRISE-CRM-2026-09-30.pdf` | **Document complet (35 pages)** : couverture, sommaire, synthèse dirigeant, présentation, architecture, modèle de données, cartographie des pages, processus métier de bout en bout, documentation par rôle, pipeline & statuts, devis & signature, facturation, planification, médias, emails/n8n, automatisations & alertes, intégrations, matrice des droits, inventaire des fonctionnalités (checklist), test fonctionnel global, **registre des écarts**, sécurité & recommandations, historique. Intègre les livrables 2 à 5 sous forme de chapitres. |
| `SYNTHESE-DIRIGEANT-CRM-2026-09-30.pdf` | **Synthèse dirigeant autonome (4 pages)** : ce que fait le CRM, les rôles, les automatisations, le niveau d'achèvement, les points restant à finaliser, le parcours en un coup d'œil. |

Les cinq livrables demandés sont couverts : (1) PDF complet, (2) synthèse dirigeant,
(3) checklist de conformité = §16, (4) cartographie des processus = §5 et schémas,
(5) registre des écarts = §18.

## Régénérer les PDF

Le dossier `generateur/` contient les sources (reportlab). Prérequis : `pip install reportlab`.

```bash
cd generateur
python build_doc.py        # -> CARTE-GRISE-CRM-2026-09-30.pdf
python build_synthese.py   # -> SYNTHESE-DIRIGEANT-CRM-2026-09-30.pdf
```

- `pdf_kit.py` : boîte à outils de mise en page (couverture, sommaire automatique, styles,
  tableaux, badges de statut, schémas boîtes/flèches).
- `content_a.py` … `content_d.py` : le contenu du document, par blocs.
- `build_doc.py` / `build_synthese.py` : assemblage des deux livrables.

Pour mettre à jour le document, éditer les fichiers `content_*.py` puis relancer les scripts.

## Statuts utilisés

`ACTIF/CONFORME` (présent et opérationnel) · `PARTIEL` (incomplet ou limité à un moteur) ·
`PRÉVU` (attendu, non livré) · `ÉCART/ABSENT` (attendu mais absent, ou divergence) ·
`À VÉRIFIER` (à confirmer par un test terrain).
