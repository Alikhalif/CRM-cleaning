-- Accès des relances email au profil commercial « Diogène » (2026-08-07).
-- Même logique que pour « appel entrant » : on ajoute l'audience « diogene »
-- (idempotent : distinct) aux relances email génériques, pour que ce profil
-- dispose d'une vraie rubrique Relances dans le sélecteur.
update message_templates
set audiences = (select array(select distinct unnest(audiences || array['diogene'])))
where channel = 'email'
  and name in (
    'Relance devis (email)',
    'Mail relance 1 — non joignable',
    'Mail relance 2 — non joignable',
    'Mail relance 3 — non joignable'
  );
