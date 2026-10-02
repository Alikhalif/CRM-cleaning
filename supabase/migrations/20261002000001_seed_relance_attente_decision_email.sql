-- Nouveau modèle d'email commercial (client 2026-10-02) :
-- « Relance attente décision devis » — relance après devis envoyé + créneau
-- pressenti, pour savoir quelle suite le client souhaite donner.
--
-- Additif : une ligne message_templates. Idempotent par `name` (ne réinsère pas
-- s'il existe déjà). Apparaît dans Paramètres → Templates (rubrique « relance »),
-- destinataire client. Le corps utilise les variables interpolées à l'envoi
-- ({client.prenom}, {commercial.nom}) comme les autres modèles.

insert into message_templates (channel, category, name, subject, body, recipient, audiences, sort_order)
select v.channel, v.category, v.name, v.subject, v.body, v.recipient, v.audiences::text[], v.sort_order
from (values
  (
    'email', 'relance', 'Relance attente décision devis',
    'Suite à votre devis — {societe.nom}',
    E'Bonjour {client.prenom},\n\nJe reviens vers vous concernant le devis transmis et l''intervention que nous avions prévue ensemble, afin de savoir quelle suite vous souhaitez donner et si nous devons maintenir le créneau planifié.\n\nJe reste bien entendu disponible si vous avez besoin d''un complément d''information.\n\nBien cordialement,\n{commercial.nom}',
    'client', '{entrant,emission,divers}', 10
  )
) as v(channel, category, name, subject, body, recipient, audiences, sort_order)
where not exists (
  select 1 from message_templates mt where mt.name = v.name
);
