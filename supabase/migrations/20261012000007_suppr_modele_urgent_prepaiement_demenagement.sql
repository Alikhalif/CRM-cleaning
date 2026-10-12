-- Suppression du modèle e-mail « Mail devis urgent — 100 % prépaiement
-- (Déménagement) » (demande client 2026-10-12).
--
-- Avec la suppression de « Mail devis — virement (Déménagement) »
-- (20261012000005), le Déménagement n'a plus de modèle de prépaiement intégral :
-- il ne reste que le circuit avec acompte. Suppression demandée explicitement.
--
-- Les variantes Nettoyage et Débarras du modèle urgent ne sont PAS touchées.

delete from message_templates
 where name = 'Mail devis urgent — 100 % prépaiement (Déménagement)';
