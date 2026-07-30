-- Communication templates (email + SMS), 2026-07-30. Paramétrables dans
-- Paramètres → Templates. Ciblage secteur OPTIONNEL (activity_id null = global)
-- et rangés par catégorie d'usage. Corps avec variables {client.prenom},
-- {lead.type_service}, {commercial.nom}… interpolées à l'envoi.

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'sms')),
  category text not null check (category in ('relance', 'decouverte', 'planification', 'apres_vente', 'autre')),
  name text not null,
  subject text,                                 -- email uniquement
  body text not null,
  activity_id uuid references activities(id),   -- ciblage secteur optionnel (null = global)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table message_templates enable row level security;

create policy "message_templates readable to authenticated"
  on message_templates for select to authenticated using (true);
create policy "message_templates writable by admin"
  on message_templates for all to authenticated using (is_admin()) with check (is_admin());

-- Quelques templates par défaut (seedés une seule fois, table vide).
insert into message_templates (channel, category, name, subject, body)
select v.channel, v.category, v.name, v.subject, v.body
from (values
  ('sms', 'relance', 'Relance devis (SMS)', null,
   'Bonjour {client.prenom}, suite à votre demande de {lead.type_service}, avez-vous pu consulter notre devis ? Nous restons à votre disposition. — {commercial.nom}'),
  ('sms', 'decouverte', 'Demande de photos (SMS)', null,
   'Bonjour {client.prenom}, pour affiner votre devis {lead.secteur}, pourriez-vous nous envoyer quelques photos par retour de message ? Merci ! — {commercial.nom}'),
  ('sms', 'planification', 'Confirmation intervention (SMS)', null,
   'Bonjour {client.prenom}, nous confirmons le passage de notre technicien. À bientôt ! — {societe.nom}'),
  ('email', 'relance', 'Relance devis (email)', 'Votre devis {lead.type_service}',
   E'Bonjour {client.prenom},\n\nSuite à votre demande, veuillez trouver notre proposition. N''hésitez pas à revenir vers nous pour toute question.\n\nCordialement,\n{commercial.nom}\n{societe.nom}')
) as v(channel, category, name, subject, body)
where not exists (select 1 from message_templates);
