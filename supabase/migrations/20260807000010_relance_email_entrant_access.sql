-- Accès des relances email au profil commercial « Appel entrant » (2026-08-07).
-- Jusqu'ici les relances email n'étaient visibles que par emission/divers ; un
-- commercial « appel entrant » n'avait donc aucune relance dans le sélecteur.
-- On ajoute l'audience « entrant » (idempotent : distinct) aux relances
-- génériques (relance devis + non joignable 1/2/3).
update message_templates
set audiences = (select array(select distinct unnest(audiences || array['entrant'])))
where channel = 'email'
  and name in (
    'Relance devis (email)',
    'Mail relance 1 — non joignable',
    'Mail relance 2 — non joignable',
    'Mail relance 3 — non joignable'
  );
