-- Bibliothèque de devis Déménagement — 2. Professionnel / complet.
-- « Déménagement professionnel complet longue distance ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement professionnel complet longue distance', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel complet sur longue distance comprenant la manutention, le chargement, le transport sécurisé entre les sites de départ et d'arrivée, le déchargement ainsi que la mise en place du mobilier, des équipements, du matériel professionnel, des archives, des stocks et de l'ensemble des biens nécessaires à la continuité de l'activité.

Prestations incluses :
- Manutention complète de l'ensemble des biens professionnels.
- Protection du mobilier, des équipements et du matériel durant les opérations de déménagement.
- Chargement organisé du mobilier, des équipements, des archives, des fournitures et des autres biens professionnels.
- Transport sécurisé sur longue distance jusqu'au nouveau site.
- Déchargement de l'ensemble des biens transportés.
- Mise en place des équipements et du mobilier dans les espaces désignés par le client.
- Utilisation de matériel professionnel, de véhicules adaptés et de moyens de manutention conformes aux contraintes logistiques de l'intervention.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à transporter, la distance entre les sites, la nature des biens professionnels, les conditions d'accès, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique particulière.
La présente prestation concerne exclusivement le transfert des biens professionnels. Les opérations de démontage technique, de reconnexion des équipements, de remise en service des installations ou toute autre intervention spécialisée ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification des conditions d'intervention, du volume à transporter, des lieux d'intervention ou des prestations demandées après validation du devis pourra entraîner une réévaluation de la prestation après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
