-- Nouveau modèle e-mail « Débarras — Confirmation de réception de l'acompte »
-- (demande client 2026-10-12) : jumeau du modèle Déménagement du même nom, qui
-- n'existait que pour cette activité.
--
-- Deux adaptations : « organiser votre déménagement » devient « organiser votre
-- débarras », et la signature est celle des autres modèles Débarras.
-- L'objet ne nomme aucune activité : il est repris tel quel.
--
-- Idempotent : rien n'est inséré si le nom existe déjà.

insert into message_templates
  (channel, category, name, subject, body, audiences, recipient, is_active, sort_order)
select
  'email',
  'devis',
  'Débarras — Confirmation de réception de l''acompte',
  'Confirmation de réception de votre acompte',
  $corps$Bonjour,

Nous vous confirmons avoir bien reçu votre acompte.

Nous vous remercions pour votre confiance.

Votre dossier est désormais validé et transmis à notre service planification, qui prendra prochainement contact avec vous afin d'organiser votre débarras et de vous communiquer la date ainsi que le créneau de votre intervention.

Si vous avez la moindre question d'ici là, notre équipe reste à votre entière disposition.

Bien professionnellement,
L'équipe Optimivv Nettoyage
La qualité professionnelle, la proximité d'un artisan$corps$,
  array['debarras']::text[],
  'client',
  true,
  3
where not exists (
  select 1 from message_templates
   where name = 'Débarras — Confirmation de réception de l''acompte'
);
