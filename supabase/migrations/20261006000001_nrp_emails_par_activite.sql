-- Emails NRP (non joignable) par activité pour les commerciaux (client 2026-10-06).
-- NRP 1 = texte fourni par le client ; NRP 2 = brouillon 2ᵉ relance (même ton,
-- éditable dans Paramètres → Templates). Identité Optimivv Nettoyage pour les
-- 4 activités (décision client : on change uniquement le mot de l'activité).
-- Ciblage par profil commercial via `audiences` (Nettoyage=divers, Débarras=
-- debarras, Déménagement=demenagement, Désinsectisation=divers).
--
-- ADDITIF : n'altère ni ne supprime les NRP génériques existants
-- (« Mail relance 1/2/3 — non joignable »), qui restent disponibles et peuvent
-- être désactivés dans les Paramètres si souhaité. Idempotent par `name`.

insert into message_templates (channel, category, name, subject, body, recipient, audiences, sort_order)
select v.channel, v.category, v.name, v.subject, v.body, v.recipient, v.audiences::text[], v.sort_order
from (values
  -- ───────────────────────────── NETTOYAGE ──────────────────────────────
  ('email', 'relance', 'Mail NRP 1 — Nettoyage',
   'Votre devis nettoyage — dernières informations',
   E'Bonjour,\n\nNous faisons suite à votre demande concernant la réalisation d''un nettoyage approfondi.\n\nAfin de pouvoir le finaliser et vous l''adresser rapidement, nous avons simplement besoin de quelques informations complémentaires concernant le logement.\n\nPourriez-vous, s''il vous plaît, nous transmettre vos coordonnées téléphoniques afin que nous puissions échanger quelques minutes avec vous et valider les derniers éléments ?\n\nVous pouvez également nous contacter directement par téléphone à votre convenance au :\n📞 07 56 88 82 75\n\nOu par e-mail :\ndevis@optimivv-nettoyage.com\n\nDès réception de ces informations, nous pourrons finaliser votre devis et vous le transmettre.\n\nNous vous remercions par avance pour votre retour et restons à votre disposition.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   'client', '{emission,divers}', 21),

  ('email', 'relance', 'Mail NRP 2 — Nettoyage',
   'Nous avons tenté de vous joindre — devis nettoyage',
   E'Bonjour,\n\nNous revenons vers vous concernant votre demande de nettoyage approfondi, pour laquelle nous avons de nouveau tenté de vous joindre sans succès.\n\nVotre devis est prêt à être finalisé : il ne nous manque que quelques minutes d''échange pour valider les derniers éléments concernant le logement.\n\nPourriez-vous nous transmettre vos coordonnées téléphoniques, ou nous rappeler directement à votre convenance ?\n📞 07 56 88 82 75\n✉️ devis@optimivv-nettoyage.com\n\nSans retour de votre part, nous tenterons de vous recontacter prochainement. Nous restons bien entendu à votre entière disposition d''ici là.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   'client', '{emission,divers}', 22),

  -- ───────────────────────────── DÉBARRAS ───────────────────────────────
  ('email', 'relance', 'Mail NRP 1 — Débarras',
   'Votre devis débarras — dernières informations',
   E'Bonjour,\n\nNous faisons suite à votre demande concernant la réalisation d''un débarras.\n\nAfin de pouvoir le finaliser et vous l''adresser rapidement, nous avons simplement besoin de quelques informations complémentaires concernant le logement.\n\nPourriez-vous, s''il vous plaît, nous transmettre vos coordonnées téléphoniques afin que nous puissions échanger quelques minutes avec vous et valider les derniers éléments ?\n\nVous pouvez également nous contacter directement par téléphone à votre convenance au :\n📞 07 56 88 82 75\n\nOu par e-mail :\ndevis@optimivv-nettoyage.com\n\nDès réception de ces informations, nous pourrons finaliser votre devis et vous le transmettre.\n\nNous vous remercions par avance pour votre retour et restons à votre disposition.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   'client', '{emission,debarras}', 21),

  ('email', 'relance', 'Mail NRP 2 — Débarras',
   'Nous avons tenté de vous joindre — devis débarras',
   E'Bonjour,\n\nNous revenons vers vous concernant votre demande de débarras, pour laquelle nous avons de nouveau tenté de vous joindre sans succès.\n\nVotre devis est prêt à être finalisé : il ne nous manque que quelques minutes d''échange pour valider les derniers éléments concernant le logement.\n\nPourriez-vous nous transmettre vos coordonnées téléphoniques, ou nous rappeler directement à votre convenance ?\n📞 07 56 88 82 75\n✉️ devis@optimivv-nettoyage.com\n\nSans retour de votre part, nous tenterons de vous recontacter prochainement. Nous restons bien entendu à votre entière disposition d''ici là.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   'client', '{emission,debarras}', 22),

  -- ──────────────────────────── DÉMÉNAGEMENT ────────────────────────────
  ('email', 'relance', 'Mail NRP 1 — Déménagement',
   'Votre devis déménagement — dernières informations',
   E'Bonjour,\n\nNous faisons suite à votre demande concernant la réalisation d''un déménagement.\n\nAfin de pouvoir le finaliser et vous l''adresser rapidement, nous avons simplement besoin de quelques informations complémentaires concernant le logement.\n\nPourriez-vous, s''il vous plaît, nous transmettre vos coordonnées téléphoniques afin que nous puissions échanger quelques minutes avec vous et valider les derniers éléments ?\n\nVous pouvez également nous contacter directement par téléphone à votre convenance au :\n📞 07 56 88 82 75\n\nOu par e-mail :\ndevis@optimivv-nettoyage.com\n\nDès réception de ces informations, nous pourrons finaliser votre devis et vous le transmettre.\n\nNous vous remercions par avance pour votre retour et restons à votre disposition.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   'client', '{emission,demenagement}', 21),

  ('email', 'relance', 'Mail NRP 2 — Déménagement',
   'Nous avons tenté de vous joindre — devis déménagement',
   E'Bonjour,\n\nNous revenons vers vous concernant votre demande de déménagement, pour laquelle nous avons de nouveau tenté de vous joindre sans succès.\n\nVotre devis est prêt à être finalisé : il ne nous manque que quelques minutes d''échange pour valider les derniers éléments concernant le logement.\n\nPourriez-vous nous transmettre vos coordonnées téléphoniques, ou nous rappeler directement à votre convenance ?\n📞 07 56 88 82 75\n✉️ devis@optimivv-nettoyage.com\n\nSans retour de votre part, nous tenterons de vous recontacter prochainement. Nous restons bien entendu à votre entière disposition d''ici là.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   'client', '{emission,demenagement}', 22),

  -- ─────────────────────────── DÉSINSECTISATION ─────────────────────────
  ('email', 'relance', 'Mail NRP 1 — Désinsectisation',
   'Votre devis désinsectisation — dernières informations',
   E'Bonjour,\n\nNous faisons suite à votre demande concernant la réalisation d''une désinsectisation.\n\nAfin de pouvoir le finaliser et vous l''adresser rapidement, nous avons simplement besoin de quelques informations complémentaires concernant le logement.\n\nPourriez-vous, s''il vous plaît, nous transmettre vos coordonnées téléphoniques afin que nous puissions échanger quelques minutes avec vous et valider les derniers éléments ?\n\nVous pouvez également nous contacter directement par téléphone à votre convenance au :\n📞 07 56 88 82 75\n\nOu par e-mail :\ndevis@optimivv-nettoyage.com\n\nDès réception de ces informations, nous pourrons finaliser votre devis et vous le transmettre.\n\nNous vous remercions par avance pour votre retour et restons à votre disposition.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   'client', '{emission,divers}', 21),

  ('email', 'relance', 'Mail NRP 2 — Désinsectisation',
   'Nous avons tenté de vous joindre — devis désinsectisation',
   E'Bonjour,\n\nNous revenons vers vous concernant votre demande de désinsectisation, pour laquelle nous avons de nouveau tenté de vous joindre sans succès.\n\nVotre devis est prêt à être finalisé : il ne nous manque que quelques minutes d''échange pour valider les derniers éléments concernant le logement.\n\nPourriez-vous nous transmettre vos coordonnées téléphoniques, ou nous rappeler directement à votre convenance ?\n📞 07 56 88 82 75\n✉️ devis@optimivv-nettoyage.com\n\nSans retour de votre part, nous tenterons de vous recontacter prochainement. Nous restons bien entendu à votre entière disposition d''ici là.\n\nBien professionnellement,\nL''équipe Optimivv Nettoyage\nLa qualité professionnelle, la proximité d''un artisan',
   'client', '{emission,divers}', 22)
) as v(channel, category, name, subject, body, recipient, audiences, sort_order)
where not exists (
  select 1 from message_templates mt where mt.name = v.name
);
