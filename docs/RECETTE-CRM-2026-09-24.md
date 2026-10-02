# Recette fonctionnelle CRM — 2026-09-24

Audit avant prod : cartographie 100 % du code + **18 tests réels** sur la base prod
(compte commercial jetable, webhook, DB), avec nettoyage. Rien de fabriqué :
🟢 testé OK · 🔴 bug confirmé · 🟠 à corriger (code) · ⚪ non testable ici.
Supersède `docs/RECETTE-CRM.md` (A03/A04/A05/A10/A11/A12 confirmés corrigés).

## Synthèse
CRM riche et globalement fonctionnel, mais **5 bloquants P1** à corriger avant prod,
plus des écarts sur le chemin **OPTIMIVV** (secteurs nettoyage + déménagement, cœur du business).

## Bloquants P1 (avant prod)
| # | Bloquant | Preuve |
|---|---|---|
| 1 | Fuite `devis_optimivv`+factures : tout commercial lit noms/emails/montants de **tous** les clients | 🔴 testé (5/15 lus) — RLS `using(true)` `20260807000020:73` |
| 2 | Fuite `cert_hotte` (PII clients) | 🔴 testé — `20260908000001:71` |
| 3 | Page `/documents` sans garde de rôle (lecture service-role non scopée → contourne RLS) | 🔴 code `documents/page.tsx:8`, `dashboard-server.ts:35` |
| 4 | `audit_logs` perdu pour webhooks/signatures publiques (user_id null refusé) → conformité + moteur d'actions aveugle | 🔴 testé (lead webhook = 0 audit) |
| 5 | Signature OPTIMIVV faible : token=HMAC(leadId), signe le dernier devis, rejouable, sans expiration | 🔴 code (exploit ⚪ non exécuté) — `lib/devis/tracking.ts`, `sign.ts:84` |

## Importants P2
- 🔴 Auto-escalade `is_premium`/`is_extreme` par un commercial (testé).
- 🔴 Double dossier par lead : aucune contrainte `UNIQUE(dossiers.lead_id)` → `.maybeSingle()` casse ensuite (testé).
- 🔴 OPTIMIVV signé « avec acompte » sans facture d'acompte (testé, 2 cas réels).
- 🟠 KPI dashboard : `TODAY` figé au boot, « médiane »=min-max, conversionRate bases mixtes, funnel € fabriqué, CA `/performance` ≠ `/dashboard`.
- 🟠 CA fiche Client en TTC vs Comptabilité en HT · monotonie pipeline partielle (A06) · marquage « signé » manuel sans preuve (A08) · numérotation CTR-/CERT- hors transaction · statut `retard` jamais posé · drag Kanban→signé OPTIMIVV ne crée pas de dossier.

## Mineurs P3
Refus découverte via `window.prompt` sans confirm · `callLead` code mort · secret cron en query-string · défauts OPTIMIVV codés en dur · liens nav 403 affichés à tous · double-fire WF2 · appariement Brevo au dernier lead · « ouvert » prématuré (préchargement pixel).

## Vérifiés OK 🟢 (test réel)
Tenancy leads « mine » · idempotence webhook · notif différenciée admin/commercial (provenance admin only) · RLS contrats scopée · **INSERT contrat client d'autrui bloqué** (le flag S3 était un faux positif) · audit admin-only · chiffrement provenance · calculs System A (remise/HT, TVA par ligne, recalc serveur). **Signature du système principal robuste** : attribution 1:1, PDF figé + SHA-256, aucun croisement A/B/C.

## Constat structurant
Deux moteurs parallèles (Devis A `documents`/TVA vs B **OPTIMIVV** ; signature principale robuste vs **OPTIMIVV** faible). **Le point faible est systématiquement OPTIMIVV — qui sert les secteurs principaux.**

## Parcours (statut global)
Commercial 🟠 · Planificatrice 🟠 · Client 🟠 (e-sign principal 🟢 / OPTIMIVV 🔴) · Super Admin 🟠.

## ⚪ Non testable ici
Click-through UI complet · e-sign prestataire live · livraison email/SMS réelle · runs n8n WF1/WF2 live · responsive mobile/tablette · MFA. (Marqués ⚪ avec raison, jamais « OK » sur le seul code.)

## Ordre de correction recommandé
1. **Avant prod** : P1 1-2-3-4 (sécurité/conformité).
2. Chemin argent OPTIMIVV : P1-5, FA acompte, double dossier, Kanban→signé.
3. Fiabilité chiffres : KPI + CA.
4. Hygiène : P2/P3 restants.

*Aucun code modifié (phase audit). Correctifs = phase 2 sur autorisation.*
