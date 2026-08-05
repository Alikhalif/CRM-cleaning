-- Bibliothèque de devis Déménagement — 1. Particulier / complet.
-- « Déménagement complet après sinistre ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet après sinistre', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement particulier complet à la suite d'un sinistre (incendie, dégât des eaux, catastrophe naturelle ou tout autre événement similaire), comprenant la manutention, le chargement, le transport sécurisé, le déchargement ainsi que la mise en place de l'ensemble des biens vers le lieu de destination indiqué par le client.

Prestations incluses :
- Manutention complète du mobilier, des effets personnels, des cartons, de l'électroménager et des biens à préserver.
- Protection des biens durant les opérations de manutention et de transport.
- Chargement méthodique du véhicule de déménagement.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement et mise en place des biens dans les pièces désignées par le client.
- Utilisation de matériel professionnel adapté aux contraintes de l'intervention.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, l'état d'accessibilité des lieux, les conditions de sécurité, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique liée au sinistre.
La présente prestation concerne exclusivement le déménagement des biens. Les opérations de nettoyage, de désinfection, de décontamination, de débarras ou de remise en état ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification des conditions d'intervention, de l'accessibilité des lieux, du volume des biens à transporter ou des prestations demandées pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
