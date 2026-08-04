-- Rename commercial profile slug 'nettoyage' → 'divers' (client 2026-08-02).
-- The profile lives as a value inside users.commercial_profiles (text[]), not
-- a pg enum, so no type change is needed — just swap the stored value in place
-- for every user that holds it. The display label stays "Divers".
update users
set commercial_profiles = array_replace(commercial_profiles, 'nettoyage', 'divers')
where 'nettoyage' = any(commercial_profiles);
