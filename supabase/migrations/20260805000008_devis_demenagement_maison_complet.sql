-- Bibliothèque de devis Déménagement — 1. Particulier / complet.
-- « Déménagement complet d'une maison ». Prix à chiffrer (0 €), forfait, TVA 20 %.
insert into prestations (activity_id, label, unit, unit_price_ht, vat_rate, description, is_active)
select a.id, v.label, v.unit::prestation_unit, v.price, v.vat, v.description, true
from activities a
join (values
  ('Déménagement complet d''une maison', 'forfait', 0, 20, $D$Prestation à réaliser :
Réalisation d'un déménagement complet d'une maison comprenant la manutention, le chargement, le transport sécurisé et le déchargement de l'ensemble du mobilier, des effets personnels, des cartons, de l'électroménager ainsi que des équipements présents dans le logement vers la nouvelle adresse.

Prestations incluses :
- Manutention complète de l'ensemble des biens à déménager.
- Protection du mobilier et des équipements avant les opérations de transport.
- Chargement organisé du mobilier, des cartons, de l'électroménager et des effets personnels.
- Transport sécurisé jusqu'au nouveau domicile.
- Déchargement de l'ensemble des biens transportés.
- Mise en place du mobilier et des cartons dans les pièces désignées par le client.
- Utilisation de matériel professionnel adapté aux opérations de manutention et de déménagement.

Conditions d'intervention :
Le devis est établi sur la base des informations communiquées par le client concernant le volume estimatif à déménager, les accès aux deux habitations, les possibilités de stationnement, les distances de portage, les particularités du terrain ainsi que toute contrainte technique susceptible d'influencer le bon déroulement de l'intervention.
Toute modification du volume, des conditions d'accès, des biens à transporter ou de toute autre information non communiquée lors de l'établissement du devis pourra entraîner une réévaluation de la prestation après validation avec le client.$D$)
) as v(label, unit, price, vat, description) on true
where a.slug = 'demenagement'
  and not exists (select 1 from prestations p where p.activity_id = a.id and p.label = v.label);
