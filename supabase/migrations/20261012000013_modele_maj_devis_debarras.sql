-- Nouveau modèle e-mail « Débarras — Modification / mise à jour du devis »
-- (demande client 2026-10-12) : jumeau du modèle Déménagement du même nom,
-- qui n'existait que pour cette activité.
--
-- Deux écarts assumés par rapport à une copie littérale :
--   • la signature est celle des autres modèles Débarras (Optimivv Nettoyage) ;
--   • le pourcentage d'acompte utilise la variable {acompte.pct} au lieu du
--     « 50 % » écrit en dur dans le modèle Déménagement. Sur un nouveau modèle
--     rien n'oblige à reproduire ce défaut : le texte suit ainsi l'acompte
--     réellement saisi sur le devis, quel qu'il soit.
--
-- Idempotent : rien n'est inséré si le nom existe déjà.

insert into message_templates
  (channel, category, name, subject, body, audiences, recipient, is_active, sort_order)
select
  'email',
  'devis',
  'Débarras — Modification / mise à jour du devis',
  'Envoi de votre devis de débarras actualisé',
  $corps$Bonjour,

Suite à nos derniers échanges et aux informations complémentaires que vous nous avez communiquées, nous vous adressons en pièce jointe une version mise à jour de votre devis de débarras.

Cette nouvelle version remplace et annule la précédente.

Nous vous invitons à en prendre connaissance. Si vous souhaitez une nouvelle modification ou des précisions sur son contenu, notre équipe reste à votre entière disposition.

Pour valider votre devis, vous pouvez utiliser le lien de signature électronique ou simplement répondre à ce mail avec la mention « Bon pour accord – Devis n° {devis.numero} ».

Vous trouverez également en pièce jointe notre RIB pour le règlement de l'acompte de {acompte.pct} du montant de la prestation.

Dès réception de votre accord sur le devis et du règlement de l'acompte, nous vous confirmerons par retour d'email la date et le créneau horaire de votre intervention.

Bien professionnellement,
L'équipe Optimivv Nettoyage
La qualité professionnelle, la proximité d'un artisan$corps$,
  array['debarras']::text[],
  'client',
  true,
  2
where not exists (
  select 1 from message_templates
   where name = 'Débarras — Modification / mise à jour du devis'
);
