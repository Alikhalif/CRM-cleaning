-- Bibliothèque de devis Déménagement — 1. Particulier / complet.
-- « Déménagement complet d'un appartement ». Prix à chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet d''un appartement', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement complet d'un appartement comprenant la manutention, le chargement, le transport sécurisé et le déchargement de l'ensemble du mobilier, des effets personnels, des cartons, de l'électroménager et des équipements du logement vers la nouvelle adresse.

Prestations incluses :
- Manutention complète de l'ensemble des biens à déménager.
- Protection du mobilier et des équipements durant les opérations de déménagement.
- Chargement méthodique du mobilier, des cartons, de l'électroménager et des effets personnels.
- Transport sécurisé jusqu'au lieu de destination.
- Déchargement de l'ensemble des biens.
- Mise en place du mobilier et des cartons dans les pièces désignées par le client.
- Utilisation de matériel et d'équipements professionnels adaptés afin d'assurer un transport dans les meilleures conditions de sécurité.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume estimatif à déménager, les conditions d'accès au logement de départ et d'arrivée, les étages, la présence d'un ascenseur, les possibilités de stationnement, les distances de portage ainsi que toute contrainte technique particulière.
Toute modification des informations communiquées lors de l'établissement du devis, notamment concernant le volume, les accès, les prestations demandées ou les contraintes d'intervention, pourra entraîner une réévaluation du devis après accord du client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
