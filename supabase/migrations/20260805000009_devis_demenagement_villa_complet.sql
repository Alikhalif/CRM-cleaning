-- Bibliothèque de devis Déménagement — 1. Particulier / complet.
-- « Déménagement complet d'une villa ou d'une propriété ». À chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet d''une villa ou d''une propriété', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement complet d'une villa ou d'une propriété comprenant la manutention, le chargement, le transport sécurisé et le déchargement de l'ensemble du mobilier, des effets personnels, des cartons, de l'électroménager, des équipements et des aménagements présents dans l'habitation vers la nouvelle adresse.

Prestations incluses :
- Manutention complète de l'ensemble des biens à déménager.
- Protection du mobilier, des équipements et des objets transportés durant les opérations de déménagement.
- Chargement organisé du mobilier, des cartons, de l'électroménager et des effets personnels.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens.
- Mise en place du mobilier et des cartons dans les pièces désignées par le client.
- Utilisation de matériel professionnel et de moyens de manutention adaptés aux déménagements de grandes habitations.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume à déménager, les accès aux propriétés de départ et d'arrivée, les possibilités de stationnement, les distances de portage, les dépendances, les accès extérieurs ainsi que toute contrainte technique particulière.
Toute modification des conditions d'intervention, du volume des biens à transporter ou des informations communiquées lors de l'établissement du devis pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
