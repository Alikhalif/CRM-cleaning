-- ============================================================================
-- Intervention VALIDÉE — nouvelle valeur de `dossier_status` (2026-11-09)
--
-- ⚠️ PRÉPARÉE, NON APPLIQUÉE. À appliquer sur la RECETTE d'abord, jamais en
-- production sans l'autorisation explicite du client.
--
-- Décision du client du 2026-11-09 : « Intervention terminée → Intervention
-- validée → Facture finale préparée ». `finalise` (« Marquer comme réalisé »)
-- reste l'état « terminée » ; `valide` s'intercale avant la facturation.
--
-- Isolée dans son propre fichier : une valeur ajoutée à un ENUM ne peut pas
-- être EMPLOYÉE dans la transaction qui l'ajoute. Les migrations suivantes
-- (20261109000002, 20261109000003) s'en servent.
-- ============================================================================

alter type dossier_status add value if not exists 'valide' after 'finalise';
