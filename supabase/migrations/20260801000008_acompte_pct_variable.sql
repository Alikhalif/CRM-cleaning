-- Make the acompte % dynamic in the "avec acompte" devis mails (client
-- 2026-08-02: real data, not static). Replaces the literal "50 %" with the
-- {acompte.pct} variable, resolved to the real deposit % (devis → acompte
-- négocié → sector default) at render time. Idempotent.
update message_templates set body = replace(body, '50 %', '{acompte.pct}')
where name in (
  'Mail devis — virement avec acompte (Nettoyage)',
  'Mail devis — virement avec acompte (Débarras)'
);
