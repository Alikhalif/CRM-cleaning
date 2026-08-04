-- Retirer le bloc « Personne à contacter sur place : {Nom} - {Téléphone} » de
-- tous les modèles qui le contiennent (client 2026-08-03).
update message_templates
set body = replace(body, E'\n\nPersonne à contacter sur place :\n{Nom} - {Téléphone}', '')
where body like '%Personne à contacter sur place%';
