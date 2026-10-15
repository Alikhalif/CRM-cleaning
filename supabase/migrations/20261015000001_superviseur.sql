-- Ajoute « superviseur » à l'ENUM role_slug (demande client 2026-10-15).
--
-- SEULE dans sa migration, à dessein : PostgreSQL refuse qu'une valeur d'ENUM
-- ajoutée soit UTILISÉE dans la même transaction (« unsafe use of new value of
-- enum type »). L'insertion de la ligne `roles` vit donc dans la migration
-- suivante.

alter type role_slug add value if not exists 'superviseur';
