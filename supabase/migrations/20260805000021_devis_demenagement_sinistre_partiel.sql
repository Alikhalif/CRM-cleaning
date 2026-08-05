-- Bibliothèque de devis Déménagement — 1. Particulier / partiel.
-- « Déménagement partiel après sinistre ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement partiel après sinistre', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement particulier partiel à la suite d'un sinistre (incendie, dégât des eaux, catastrophe naturelle ou tout autre événement similaire), comprenant la manutention, le chargement, le transport sécurisé et le déchargement des biens, du mobilier, des effets personnels et des équipements expressément désignés par le client vers le lieu de destination indiqué.

Prestations incluses :
- Manutention des biens sélectionnés pour le déménagement.
- Protection du mobilier et des biens durant les opérations de manutention et de transport.
- Chargement organisé des biens concernés par la prestation.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement des biens transportés.
- Mise en place des biens dans les pièces indiquées par le client.
- Utilisation de matériel professionnel adapté aux contraintes de l'intervention.

Conditions d'intervention :
Le devis est établi sur la base de la liste des biens communiquée par le client, du volume estimatif à transporter, des conditions d'accès aux lieux, des possibilités de stationnement, des distances de portage ainsi que de toute contrainte technique liée au sinistre.
La présente prestation concerne exclusivement le déménagement des biens identifiés par le client. Les prestations de nettoyage, de désinfection, de décontamination, de débarras ou de remise en état ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification des biens à transporter, des conditions d'intervention ou des informations communiquées lors de l'établissement du devis pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
