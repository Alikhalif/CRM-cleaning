-- ============================================================================
-- MODULE « ACTIONS & RELANCES » — extension : alerte « Photos client non reçues ».
-- Additif pur au module 20260911000001. Détecte les dossiers en attente de
-- photos (leads.photos_requested_at posé, aucune photo rattachée depuis) et
-- matérialise une action de relance auto-clôturée dès qu'une photo arrive dans
-- lead_media. Aucune table métier modifiée.
-- ============================================================================

-- Sous-type d'action (photos : 'attente' = rien reçu ; 'a_verifier' = le client
-- a répondu mais aucune photo rattachée → faux positif possible). NULL sinon.
alter table commercial_actions add column if not exists subtype text;

-- Règle paramétrable : première relance après first_after_hours ; rappel proposé
-- toutes les reminder_every_hours (l'action reste ouverte tant qu'aucune photo).
insert into commercial_action_rules (key, label, config) values
  ('photos', 'Relancer le client pour obtenir les photos', jsonb_build_object('first_after_hours', 24, 'reminder_every_hours', 24))
on conflict (key) do nothing;
