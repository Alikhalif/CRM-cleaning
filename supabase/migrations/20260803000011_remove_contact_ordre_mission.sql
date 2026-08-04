-- Retirer « Contact sur place : {Nom - Téléphone} » de l'Ordre de mission
-- (client 2026-08-03) — placeholder non rempli.
update message_templates
set body = replace(body, E'\n\nContact sur place : {Nom - Téléphone}', '')
where body like '%Contact sur place : {Nom - Téléphone}%';
