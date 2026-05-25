-- ════════════════════════════════════════════════════════════════════════
-- Test-data fixtures for the new lead-detail features
-- (call notes, followup, intervention delay, immob/travaux annotation).
--
-- This is a one-off update script, NOT a migration. Run it manually in
-- Supabase Studio → SQL editor whenever you want to refresh the demo
-- data. Safe to re-run — every UPDATE is idempotent (sets specific values,
-- doesn't append).
--
-- Coverage:
--   L-1051 — active devis sent, call notes + 24H followup
--   L-1050 — devis envoyé, NRP marked, call notes + 48H followup
--   L-1042 — devis ouvert, longer notes + précisions
--   L-1035 — SIGNED (dossier a_planifier), full intervention_delay capture
--   L-1033 — SIGNED (dossier planifié), 15 jours delay + précisions
--   L-1031 — SIGNED (dossier bloqué), 1 mois delay + immob/travaux annotation
--   L-1024 — encaissé partiel, post-signature delay + intervention notes
--   L-1019 — encaissé soldé, sous_72h delay (already past)
-- ════════════════════════════════════════════════════════════════════════

-- ── L-1051 (status: envoye, mano) — active devis sent ──────────────────
update leads
set notes = 'Client rappelé le matin. Devis transmis par email à 11h. ' ||
            'Demande comparaison avec un concurrent local — relance vendredi.',
    next_followup_at = now() + interval '24 hours'
where short_id = 'L-1051';

-- ── L-1050 (status: envoye, mano) — NRP ────────────────────────────────
update leads
set notes = 'Tentative d''appel x2 sans réponse. Email de relance envoyé. ' ||
            'Numéro pro disponible uniquement après 18h.',
    next_followup_at = now() + interval '48 hours',
    is_nrp = true,
    nrp_at = now() - interval '6 hours'
where short_id = 'L-1050';

-- ── L-1042 (status: ouvert) ────────────────────────────────────────────
update leads
set notes = 'Devis ouvert hier soir, durée de lecture ~7 minutes. ' ||
            'Client semble engagé — relance courte conseillée pour confirmer le rdv téléphonique.'
where short_id = 'L-1042';

-- ── L-1035 (SIGNED, dossier a_planifier) — full intervention capture ──
update leads
set notes = 'Signature obtenue après 2 rendez-vous. Acompte 30% à encaisser ' ||
            'avant programmation du chantier.',
    intervention_delay = 'sous_72h',
    intervention_delay_notes = 'Présence obligatoire d''un proche durant toute l''intervention. ' ||
                               'Contrainte clés : remise par la voisine du 3e étage.'
where short_id = 'L-1035';

-- ── L-1033 (SIGNED, dossier planifié) ──────────────────────────────────
update leads
set notes = 'Café Margot — intervention prévue avant la réouverture (lundi). ' ||
            'Confirmation reçue par WhatsApp.',
    intervention_delay = '15_jours',
    intervention_delay_notes = 'Disponible uniquement le mercredi entre 14h et 17h. ' ||
                               'Stationnement difficile : prévoir véhicule petit gabarit.'
where short_id = 'L-1033';

-- ── L-1031 (SIGNED, dossier bloqué) — with immob/travaux annotation ────
update leads
set notes = 'Domaine de Beaulieu — accord ABF en attente. ' ||
            'Client OK pour démarrer dès réception de l''autorisation.',
    intervention_delay = '1_mois',
    intervention_delay_notes = 'Délai conditionné à l''aval de l''ABF (Architecte des Bâtiments de France). ' ||
                               'Estimation : 3-5 semaines selon dossier.',
    immob_travaux_annotation = 'Bâtiment classé monument historique. ' ||
                               'Cadre réglementaire : loi 2016-925 du 7 juillet 2016. ' ||
                               'Documents fournis par le client : permis de démolir antérieur ' ||
                               'et avis ABF partiel sur volet façade.'
where short_id = 'L-1031';

-- ── L-1024 (encaissé partiel) ──────────────────────────────────────────
update leads
set notes = 'Mathieu Perret — intervention réalisée, facture finale envoyée. ' ||
            'Solde de 1 245 € en attente, relance prévue J+10.',
    intervention_delay = '1_semaine',
    intervention_delay_notes = 'Intervention réalisée sous délai initial. RAS.'
where short_id = 'L-1024';

-- ── L-1019 (encaissé soldé) ────────────────────────────────────────────
update leads
set notes = 'SCI Le Beffroi — dossier clôturé. Client satisfait, ' ||
            'devis additionnel en perspective pour Q3.',
    intervention_delay = 'sous_72h',
    intervention_delay_notes = 'Délai tenu — intervention sous 48h après signature.'
where short_id = 'L-1019';
