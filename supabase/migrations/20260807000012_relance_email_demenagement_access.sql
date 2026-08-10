-- Accès des relances email au profil commercial « Déménagement » (2026-08-07).
-- Même système de relance que les profils émission / appel entrant / Diogène :
-- on ajoute l'audience « demenagement » (idempotent : distinct) aux relances
-- email génériques. Le profil déménagement conserve en plus ses relances
-- dédiées (suivi_commercial : J+2, J+7, dernière relance).
update message_templates
set audiences = (select array(select distinct unnest(audiences || array['demenagement'])))
where channel = 'email'
  and name in (
    'Relance devis (email)',
    'Mail relance 1 — non joignable',
    'Mail relance 2 — non joignable',
    'Mail relance 3 — non joignable'
  );
