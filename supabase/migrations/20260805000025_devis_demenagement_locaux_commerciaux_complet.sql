-- Bibliothèque de devis Déménagement — 2. Professionnel / complet.
-- « Déménagement complet de locaux commerciaux ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet de locaux commerciaux', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement professionnel complet de locaux commerciaux comprenant la manutention, le chargement, le transport sécurisé et le déchargement de l'ensemble du mobilier, des équipements, des présentoirs, des stocks, du matériel professionnel et des autres biens nécessaires à l'exploitation vers les nouveaux locaux.

Prestations incluses :
- Manutention complète de l'ensemble des biens professionnels.
- Protection du mobilier, des équipements, des présentoirs et du matériel durant les opérations de déménagement.
- Chargement organisé du mobilier, des équipements, des stocks et des fournitures professionnelles.
- Transport sécurisé jusqu'au nouveau local commercial.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier et des équipements dans les espaces désignés par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés aux contraintes de l'intervention.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, la nature des biens à transporter, les conditions d'accès aux locaux de départ et d'arrivée, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique particulière.
La présente prestation concerne exclusivement le transfert des biens professionnels. Les opérations de démontage technique, de réinstallation des équipements, de remise en service des installations ou toute autre prestation spécialisée ne sont pas incluses, sauf mention expresse figurant au devis.
Toute modification des informations communiquées lors de l'établissement du devis, du volume des biens à transporter ou des conditions d'intervention pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
