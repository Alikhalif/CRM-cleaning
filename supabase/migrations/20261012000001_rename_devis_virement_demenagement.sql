-- Renommage du modèle e-mail « Mail devis — virement (Déménagement) » pour que
-- son nom dise explicitement ce que fait son corps : le client règle la
-- TOTALITÉ par virement avant l'intervention (demande client 2026-10-12).
--
-- Le corps du modèle n'est pas touché, seulement son libellé dans le sélecteur
-- de la page Devis. Idempotent : un second passage ne trouve plus l'ancien nom.

update message_templates
   set name = 'Mail devis — virement (Déménagement) 100% prépaiement'
 where name = 'Mail devis — virement (Déménagement)';
