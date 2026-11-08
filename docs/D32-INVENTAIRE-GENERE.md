# D32 — Inventaire GÉNÉRÉ des accès (schéma effectif des migrations)

> Généré par `scripts/d32/inventaire.ts` à partir des 184 migrations, rejouées dans l'ordre. Ne pas modifier à la main.

## 1. Tables sous RLS dont une politique ouvre l'accès à `is_planificateur()`

| Table | Commandes ouvertes à la planification | Colonnes de rattachement | Politiques |
| --- | --- | --- | --- |
| `actions_back_office` | select | entity_id, pays, entite_id | `actions_bo_select` |
| `cert_hotte` | select | lead_id, dossier_id | `cert_hotte_select` |
| `client_documents` | insert, update, delete, select | client_id, contract_id, dossier_id, lead_id | `client_docs_insert`, `client_docs_update`, `client_docs_delete`, `client_docs_select` |
| `clients` | select, all | source_lead_id | `clients visible to admin / planner / lead-owner`, `clients writable by admin / planner` |
| `commercial_action_events` | select | **aucune** | `comm_events_read` |
| `commercial_actions` | select | lead_id | `comm_actions_select` |
| `commercial_task_events` | select | **aucune** | `comm_task_events_select` |
| `commercial_tasks` | select | lead_id | `comm_tasks_select` |
| `contract_passages` | all | contract_id, dossier_id | `passages_all` |
| `contracts` | insert, update, delete, select | client_id, lead_id, entity_id | `contracts_insert`, `contracts_update`, `contracts_delete`, `contracts_select` |
| `contrat_liens_acces` | select | contract_id | `contrat_liens_acces_select` |
| `devis_optimivv` | select | lead_id | `devis_optimivv_select` |
| `doc_counters` | select | **aucune** | `doc_counters readable to admin / planner` |
| `document_archive` | select | entity_id, client_id, contract_id | `docarch_backoffice` |
| `document_lines` | all | document_id | `document_lines follow parent document` |
| `document_retention_rules` | select | **aucune** | `drr_read` |
| `document_versions` | select, insert | document_id | `document_versions visible comme le devis`, `document_versions écrivable comme le devis` |
| `documents` | select, all | lead_id, client_id, entity_id, related_devis_id, dossier_id | `documents visible to admin / planner / lead-owner`, `documents writable by admin / planner / lead-owner` |
| `docusign_envelope_events` | select | **aucune** | `dsee_backoffice` |
| `docusign_envelopes` | select | entity_id, contract_id, mission_id | `dse_backoffice` |
| `dossier_validations` | select, insert | dossier_id | `dossier_validations_select`, `dossier_validations_insert` |
| `dossiers` | select, all | lead_id, technician_id | `dossiers readable to admin / planner / lead-owner`, `dossiers writable by admin / planner` |
| `intervenant_consultations` | select, all | lead_id | `consultations visible to admin / planner`, `consultations writable by admin / planner` |
| `lead_media` | select, insert, update | lead_id | `lead_media visible to owner / admin / planner`, `lead_media insertable by owner / admin / planner`, `lead_media updatable by author / admin / planner` |
| `leads` | select, update | entity_id, country | `leads visible to owner / admin / planner`, `leads updatable by owner / admin / planner` |
| `signature_events` | select | **aucune** | `signature_events readable` |
| `signature_requests` | select, insert, update | document_id, lead_id, client_id | `signature_requests readable`, `signature_requests insertable`, `signature_requests updatable` |
| `subcontract_amendments` | select, insert, update | contract_id | `subcontract_amendments_backoffice`, `subcontract_amendments_backoffice_insert`, `subcontract_amendments_backoffice_update` |
| `subcontract_contracts` | select, insert, update | technician_id, dossier_id, lead_id, entity_id | `subcontract_contracts_backoffice`, `subcontract_contracts_backoffice_insert`, `subcontract_contracts_backoffice_update` |
| `subcontract_events` | select, insert, update | contract_id | `subcontract_events_backoffice`, `subcontract_events_backoffice_insert`, `subcontract_events_backoffice_update` |
| `subcontract_incidents` | select, insert, update | contract_id, technician_id, dossier_id | `subcontract_incidents_backoffice`, `subcontract_incidents_backoffice_insert`, `subcontract_incidents_backoffice_update` |
| `subcontract_lines` | select, insert, update, delete | contract_id | `subcontract_lines_backoffice`, `subcontract_lines_backoffice_insert`, `subcontract_lines_backoffice_update`, `subcontract_lines_backoffice_delete` |
| `subcontract_missions` | select, insert, update | contract_id, dossier_id | `subcontract_missions_backoffice`, `subcontract_missions_backoffice_insert`, `subcontract_missions_backoffice_update` |
| `subcontract_report_photos` | select, insert, update | **aucune** | `subcontract_report_photos_backoffice`, `subcontract_report_photos_backoffice_insert`, `subcontract_report_photos_backoffice_update` |
| `subcontract_reports` | select, insert, update | contract_id, dossier_id | `subcontract_reports_backoffice`, `subcontract_reports_backoffice_insert`, `subcontract_reports_backoffice_update` |
| `subcontract_sequences` | select | **aucune** | `subcontract_sequences_backoffice` |
| `subcontractor_documents` | select, all | technician_id | `subcontractor_documents_select`, `subcontractor_documents_write` |
| `subcontractor_invoices` | select, all | technician_id, dossier_id | `subcontractor_invoices_select`, `subcontractor_invoices_write` |
| `subcontractor_profiles` | select, all | technician_id | `subcontractor_profiles_select`, `subcontractor_profiles_write` |
| `technicians` | all | **aucune** | `technicians writable by admin / planner` |

**40 tables** — AVANT la migration D32 (20261109000008_d32_cloisonnement.sql).

### Après D32 : ce qui accorde ENCORE `is_planificateur()` sans périmètre

- `doc_counters` · « doc_counters readable to admin / planner » — compteurs de numérotation : aucune donnée métier
- `technicians` · « technicians writable by admin / planner » — annuaire des sous-traitants : aucun pays ni entité en base (D35, décision ouverte)
- `subcontractor_profiles` · « subcontractor_profiles_select » — fiche administrative d'un sous-traitant de l'annuaire (D35)
- `subcontractor_profiles` · « subcontractor_profiles_write » — fiche administrative d'un sous-traitant de l'annuaire (D35)
- `subcontractor_documents` · « subcontractor_documents_select » — pièces de conformité d'un sous-traitant de l'annuaire (D35)
- `subcontractor_documents` · « subcontractor_documents_write » — pièces de conformité d'un sous-traitant de l'annuaire (D35)
- `subcontract_sequences` · « subcontract_sequences_backoffice » — compteurs de numérotation : aucune donnée métier
- `document_retention_rules` · « drr_read » — règles de rétention : paramètres, aucune donnée métier

Tables sans RLS après D32 : **aucune**.

## 2. Tables SANS RLS AVANT D32 (exposées à tout compte connecté si la table est dans `public`)

- `cert_hotte_counters` — colonnes : year, next_value
- `contract_counters` — colonnes : year, next_value
- `devis_optimivv_counters` — colonnes : year, next_value
- `facture_optimivv_counters` — colonnes : year, next_value

## 3. Vues (une vue contourne la RLS de ses tables, sauf `security_invoker = true`)

_aucune_

## 4. Fonctions SECURITY DEFINER exécutables par un rôle applicatif

| Fonction | Exécutable par | Tables métier lues | Fichier |
| --- | --- | --- | --- |
| `allocate_document_archive_ref(text)` | public | — | 20261031000002_docusign_archive_entites.sql |
| `allocate_subcontract_ref(text,text)` | public | — | 20261031000001_sous_traitance_contrats.sql |
| `annee_legale(uuid,timestamptz)` | public | — | 20261109000003_facturation_numero_a_emission.sql |
| `assign_doc_num()` | public | documents, dossiers | 20261109000003_facturation_numero_a_emission.sql |
| `fuseau_societe(uuid)` | public | — | 20261109000003_facturation_numero_a_emission.sql |
| `garder_encaissement_facture()` | public | — | 20261109000005_encaissement_back_office.sql |
| `garder_lead_encaisse()` | public | — | 20261109000005_encaissement_back_office.sql |
| `guard_users_privilege_escalation()` | public | — | 20260924000002_p2_integrity_privilege.sql |
| `handle_new_auth_user()` | public | — | 20260517000001_auth_user_setup.sql |
| `has_permission(text)` | public | — | 20260515000005_init_rls.sql |
| `is_admin()` | public | — | 20260515000005_init_rls.sql |
| `is_planificateur()` | public | — | 20260515000005_init_rls.sql |
| `next_cert_hotte_num(integer)` | authenticated | — | 20260908000001_cert_hotte.sql |
| `next_contract_num(integer)` | public, authenticated | — | 20260915000002_contracts.sql |
| `next_devis_optimivv_num(integer)` | authenticated | — | 20261012000009_peek_numero_devis.sql |
| `next_doc_num(document_type,integer)` | authenticated | — | 20260515000004_init_functions.sql |
| `next_facture_optimivv_num(integer)` | authenticated | — | 20261012000009_peek_numero_devis.sql |
| `notification_dans_perimetre(uuid,text,uuid)` | authenticated | — | 20261109000007_notifications_perimetre.sql |
| `peek_devis_optimivv_num(integer)` | authenticated | — | 20261012000009_peek_numero_devis.sql |
| `peek_facture_optimivv_num(integer)` | authenticated | — | 20261012000009_peek_numero_devis.sql |
| `proteger_facture()` | public | — | 20261109000003_facturation_numero_a_emission.sql |
| `proteger_lignes_facture()` | public | documents | 20261109000003_facturation_numero_a_emission.sql |

